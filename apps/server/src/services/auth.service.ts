import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Permission, isGranted } from '@tabliodb/shared';
import { parse } from 'cookie';
import { IncomingHttpHeaders } from 'node:http';
import { AuditAction, AuthType, SALT_ROUNDS, TabliodbCookie, TabliodbHeader, TabliodbQuery } from '../constants.js';
import { AuthContext } from '../database.js';
import {
  ApiKeyCreateDto,
  ApiKeyCreateResponseDto,
  CurrentUserPasswordUpdateDto,
  CurrentUserProfileUpdateDto,
  CurrentUserResponseDto,
  CurrentUserTemporaryPasswordUpdateDto,
  LoginCredentialDto,
  LoginResponseDto,
  PasswordResetConfirmDto,
  PasswordResetConfirmResponseDto,
  PasswordResetRequestDto,
  PasswordResetRequestResponseDto,
  SignUpDto,
} from '../dtos/auth.dto.js';
import { ApiKeyRepository } from '../repositories/api-key.repository.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { ConfigRepository } from '../repositories/config.repository.js';
import { CryptoRepository } from '../repositories/crypto.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { PasswordResetRepository } from '../repositories/password-reset.repository.js';
import { SessionRepository } from '../repositories/session.repository.js';
import { SetupRepository, type InstanceAuthSettings } from '../repositories/setup.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { JsonValue } from '../schema/index.js';
import { FileService, type UploadedAvatarFile } from './file.service.js';

const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export type ValidateRequest = {
  headers: IncomingHttpHeaders;
  queryParams: Record<string, string | undefined>;
};

type SessionTokenSource = 'bearer' | 'cookie' | 'header' | 'query';

type SessionTokenCandidate = {
  source: SessionTokenSource;
  token: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly configRepository: ConfigRepository,
    private readonly cryptoRepository: CryptoRepository,
    private readonly fileService: FileService,
    private readonly organizationRepository: OrganizationRepository,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly setupRepository: SetupRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async signUp(dto: SignUpDto): Promise<LoginResponseDto> {
    const setup = await this.setupRepository.getStatus();
    if (!setup.isSetupComplete) {
      throw new BadRequestException('Complete first setup before creating regular user accounts');
    }

    const settings = await this.setupRepository.getAuthSettings();
    const email = dto.email.trim().toLowerCase();

    this.assertPasswordSignupAllowed(email, settings);

    if (await this.userRepository.getAnyByEmail(email)) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await this.cryptoRepository.hashBcrypt(dto.password, SALT_ROUNDS);
    const user = await this.userRepository.create({
      cursorColor: '#58cc02',
      email,
      name: dto.name.trim(),
      passwordHash,
    });

    await this.organizationRepository.createPersonalOrganization({
      name: `${user.name}'s Workspace`,
      userId: user.id,
    });

    return this.createLoginResponse(user);
  }

  async login(dto: LoginCredentialDto): Promise<LoginResponseDto> {
    const user = await this.userRepository.getByEmail(dto.email);
    if (!user?.passwordHash || !this.cryptoRepository.compareBcrypt(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    return this.createLoginResponse(user);
  }

  async logout(auth: AuthContext): Promise<void> {
    if (auth.session) {
      await this.sessionRepository.delete(auth.session.id);
    }
  }

  async uploadAvatar(auth: AuthContext, file: UploadedAvatarFile | undefined): Promise<CurrentUserResponseDto> {
    await this.fileService.uploadUserAvatar(auth.user.id, file);

    return this.getFreshAuthUser(auth.user.id);
  }

  async deleteAvatar(auth: AuthContext): Promise<CurrentUserResponseDto> {
    await this.fileService.clearUserAvatar(auth.user.id);

    return this.getFreshAuthUser(auth.user.id);
  }

  async updateProfile(auth: AuthContext, dto: CurrentUserProfileUpdateDto): Promise<CurrentUserResponseDto> {
    const values: { cursorColor?: string; name?: string } = {};

    if (dto.name !== undefined) {
      // Nama dinormalisasi di server supaya SDK, API key client, dan web mendapat perilaku yang sama.
      values.name = dto.name.trim();
    }

    if (dto.cursorColor !== undefined) {
      values.cursorColor = dto.cursorColor.toLowerCase();
    }

    const user = await this.userRepository.updateProfile(auth.user.id, values);

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return user;
  }

  async updatePassword(auth: AuthContext, dto: CurrentUserPasswordUpdateDto): Promise<CurrentUserResponseDto> {
    const currentUser = await this.userRepository.getPasswordAuthUserById(auth.user.id);

    if (!currentUser?.passwordHash) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!this.cryptoRepository.compareBcrypt(dto.currentPassword, currentUser.passwordHash)) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (this.cryptoRepository.compareBcrypt(dto.password, currentUser.passwordHash)) {
      throw new BadRequestException('Choose a password that is different from your current password');
    }

    const passwordHash = await this.cryptoRepository.hashBcrypt(dto.password, SALT_ROUNDS);
    const user = await this.userRepository.updatePasswordHash(auth.user.id, passwordHash, {
      passwordChangeRequired: false,
    });

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const revokedSessions = auth.session
      ? await this.sessionRepository.revokeAllForUser(auth.user.id, { exceptSessionId: auth.session.id })
      : 0;

    await this.auditLogRepository.create({
      action: AuditAction.AuthPasswordChanged,
      actorId: auth.user.id,
      entityId: auth.user.id,
      entityType: 'user',
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: {
        email: currentUser.email,
        name: currentUser.name,
        passwordChangeRequiredCleared: auth.user.passwordChangeRequired,
        revokedSessions,
      } satisfies Record<string, JsonValue>,
      organizationId: user.organizations[0]?.id ?? null,
      projectId: null,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });

    return this.getFreshAuthUser(auth.user.id);
  }

  async updateTemporaryPassword(
    auth: AuthContext,
    dto: CurrentUserTemporaryPasswordUpdateDto,
  ): Promise<CurrentUserResponseDto> {
    if (!auth.user.passwordChangeRequired) {
      throw new BadRequestException('This account does not have a temporary password to replace');
    }

    const currentUser = await this.userRepository.getPasswordAuthUserById(auth.user.id);

    if (!currentUser?.passwordHash) {
      throw new UnauthorizedException('Authentication required');
    }

    if (this.cryptoRepository.compareBcrypt(dto.password, currentUser.passwordHash)) {
      throw new BadRequestException('Choose a password that is different from your temporary password');
    }

    const passwordHash = await this.cryptoRepository.hashBcrypt(dto.password, SALT_ROUNDS);
    const user = await this.userRepository.updatePasswordHash(auth.user.id, passwordHash, {
      passwordChangeRequired: false,
    });

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const revokedSessions = auth.session
      ? await this.sessionRepository.revokeAllForUser(auth.user.id, { exceptSessionId: auth.session.id })
      : 0;

    await this.auditLogRepository.create({
      action: AuditAction.AuthPasswordChanged,
      actorId: auth.user.id,
      entityId: auth.user.id,
      entityType: 'user',
      ipAddress: auth.request?.ipAddress ?? null,
      metadata: {
        email: currentUser.email,
        name: currentUser.name,
        passwordChangeRequiredCleared: true,
        revokedSessions,
      } satisfies Record<string, JsonValue>,
      organizationId: user.organizations[0]?.id ?? null,
      projectId: null,
      requestId: auth.request?.requestId ?? null,
      userAgent: auth.request?.userAgent ?? null,
    });

    return this.getFreshAuthUser(auth.user.id);
  }

  async requestPasswordReset(dto: PasswordResetRequestDto): Promise<PasswordResetRequestResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const neutralResponse = this.createNeutralPasswordResetRequestResponse();
    const setup = await this.setupRepository.getStatus();

    if (!setup.isSetupComplete) {
      return neutralResponse;
    }

    const user = await this.userRepository.getByEmail(email);
    if (!user?.passwordHash) {
      return neutralResponse;
    }

    const resetToken = this.cryptoRepository.randomBytesAsText(PASSWORD_RESET_TOKEN_BYTES);
    const tokenHash = this.cryptoRepository.hashSha256(resetToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    const token = await this.passwordResetRepository.createForUser({
      expiresAt,
      tokenHash,
      userId: user.id,
    });
    const shouldExposeToken = this.configRepository.getEnv().auth.exposePasswordResetToken;

    await this.auditLogRepository.create({
      action: AuditAction.AuthPasswordResetRequested,
      actorId: null,
      entityId: user.id,
      entityType: 'user',
      metadata: {
        email: user.email,
        expiresAt: token.expiresAt.toISOString(),
        tokenExposedInResponse: shouldExposeToken,
      } satisfies Record<string, JsonValue>,
      organizationId: null,
      projectId: null,
    });

    return {
      expiresAt: token.expiresAt.toISOString(),
      resetToken: shouldExposeToken ? resetToken : null,
      resetUrl: shouldExposeToken ? this.createPasswordResetUrl(resetToken) : null,
      successful: true,
    };
  }

  async confirmPasswordReset(dto: PasswordResetConfirmDto): Promise<PasswordResetConfirmResponseDto> {
    const passwordHash = await this.cryptoRepository.hashBcrypt(dto.password, SALT_ROUNDS);
    const tokenHash = this.cryptoRepository.hashSha256(dto.token.trim());
    const reset = await this.passwordResetRepository.consumeValidToken(tokenHash);

    if (!reset) {
      throw new BadRequestException('Password reset token is invalid or expired');
    }

    const user = await this.userRepository.updatePasswordHash(reset.userId, passwordHash, {
      passwordChangeRequired: false,
    });
    if (!user) {
      throw new BadRequestException('Password reset token is invalid or expired');
    }

    const revokedSessions = await this.sessionRepository.revokeAllForUser(reset.userId);

    await this.auditLogRepository.create({
      action: AuditAction.AuthPasswordResetCompleted,
      actorId: reset.userId,
      entityId: reset.userId,
      entityType: 'user',
      metadata: {
        email: reset.email,
        name: reset.name,
        revokedSessions,
      } satisfies Record<string, JsonValue>,
      organizationId: user.organizations[0]?.id ?? null,
      projectId: null,
    });

    return { revokedSessions, successful: true };
  }

  async createApiKey(auth: AuthContext, dto: ApiKeyCreateDto): Promise<ApiKeyCreateResponseDto> {
    const permissions = dto.permissions as Permission[];

    if (auth.apiKey && !isGranted({ current: auth.apiKey.permissions, requested: permissions })) {
      // API key chaining may only create an equal-or-narrower key, which prevents limited automation from minting admin keys.
      throw new ForbiddenException('API key cannot create a key with broader permissions');
    }

    const secret = this.cryptoRepository.randomBytesAsText(32);
    const key = this.cryptoRepository.hashSha256(secret);

    const apiKey = await this.apiKeyRepository.create({
      keyHash: key,
      name: dto.name,
      permissions,
      userId: auth.user.id,
    });

    return {
      secret,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        permissions: apiKey.permissions,
      },
    };
  }

  async authenticate(request: ValidateRequest): Promise<AuthContext> {
    const sessionToken = this.getSessionToken(request);
    if (sessionToken) {
      return this.validateSessionToken(sessionToken.token, sessionToken.source);
    }

    const apiKey = this.getApiKey(request);
    if (apiKey) {
      return this.validateApiKey(apiKey);
    }

    throw new UnauthorizedException('Authentication required');
  }

  async validateSessionToken(token: string, source: SessionTokenSource = 'header'): Promise<AuthContext> {
    const hashed = this.cryptoRepository.hashSha256(token);
    const session = await this.sessionRepository.getByToken(hashed);
    if (!session?.user) {
      throw new UnauthorizedException('Invalid session token');
    }

    return {
      user: session.user,
      session: { id: session.id, source },
    };
  }

  private async validateApiKey(token: string): Promise<AuthContext> {
    const hashed = this.cryptoRepository.hashSha256(token);
    const apiKey = await this.apiKeyRepository.getByToken(hashed);
    if (!apiKey?.user) {
      throw new UnauthorizedException('Invalid API key');
    }

    return {
      user: apiKey.user,
      apiKey: {
        id: apiKey.id,
        permissions: apiKey.permissions,
      },
    };
  }

  async createLoginResponse(user: {
    avatarUrl?: string | null;
    cursorColor: string;
    email: string;
    id: string;
    name: string;
    passwordChangeRequired?: boolean;
  }) {
    const accessToken = this.cryptoRepository.randomBytesAsText(32);
    const token = this.cryptoRepository.hashSha256(accessToken);

    // The database stores only the SHA-256 hash, so a leaked session table does not expose usable bearer tokens.
    await this.sessionRepository.create({
      tokenHash: token,
      userId: user.id,
      deviceOs: '',
      deviceType: '',
      appVersion: null,
      expiresAt: null,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
        cursorColor: user.cursorColor,
        passwordChangeRequired: user.passwordChangeRequired ?? false,
      },
    };
  }

  private async getFreshAuthUser(userId: string): Promise<CurrentUserResponseDto> {
    const user = await this.userRepository.getAuthUserById(userId);

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return user;
  }

  private getSessionToken({ headers, queryParams }: ValidateRequest): SessionTokenCandidate | null {
    const bearer = this.getBearerToken(headers);
    const cookies = parse(headers.cookie || '');

    return (
      readSessionToken(headers[TabliodbHeader.UserToken], 'header') ??
      readSessionToken(headers[TabliodbHeader.SessionToken], 'header') ??
      readSessionToken(queryParams[TabliodbQuery.SessionKey], 'query') ??
      readSessionToken(bearer, 'bearer') ??
      readSessionToken(cookies[TabliodbCookie.AccessToken], 'cookie')
    );
  }

  private getApiKey({ headers, queryParams }: ValidateRequest): string | null {
    return (headers[TabliodbHeader.ApiKey] as string | undefined) || queryParams[TabliodbQuery.ApiKey] || null;
  }

  private getBearerToken(headers: IncomingHttpHeaders): string | null {
    const [type, token] = (headers.authorization || '').split(' ', 2);
    return type?.toLowerCase() === 'bearer' ? token : null;
  }

  getCookieSecureDefault(): boolean {
    return this.configRepository.getEnv().auth.cookieSecure;
  }

  getPasswordAuthType(): AuthType {
    return AuthType.Password;
  }

  private createNeutralPasswordResetRequestResponse(): PasswordResetRequestResponseDto {
    return {
      expiresAt: null,
      resetToken: null,
      resetUrl: null,
      successful: true,
    };
  }

  private createPasswordResetUrl(token: string): string {
    const publicUrl = this.configRepository.getEnv().server.publicUrl;
    return new URL(`/reset-password/${encodeURIComponent(token)}`, publicUrl).toString();
  }

  private assertPasswordSignupAllowed(email: string, settings: InstanceAuthSettings): void {
    if (settings.signupPolicy === 'public_signup') {
      return;
    }

    if (settings.signupPolicy === 'allowed_domains') {
      const domain = email.split('@')[1]?.toLowerCase();

      if (domain && settings.allowedDomains.includes(domain)) {
        return;
      }

      throw new BadRequestException('Email domain is not allowed for this Tabliodb instance');
    }

    if (settings.signupPolicy === 'sso_only') {
      throw new BadRequestException('Password sign-up is disabled because this instance requires SSO');
    }

    if (settings.signupPolicy === 'signup_disabled') {
      throw new BadRequestException('Public sign-up is disabled for this Tabliodb instance');
    }

    throw new BadRequestException('This Tabliodb instance is invite only');
  }
}

function readSessionToken(
  value: string | string[] | undefined | null,
  source: SessionTokenSource,
): SessionTokenCandidate | null {
  const token = Array.isArray(value) ? value[0] : value;

  if (!token || token.trim().length === 0) {
    return null;
  }

  return {
    source,
    token,
  };
}
