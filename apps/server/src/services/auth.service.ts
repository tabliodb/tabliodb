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

const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export type ValidateRequest = {
  headers: IncomingHttpHeaders;
  queryParams: Record<string, string | undefined>;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly configRepository: ConfigRepository,
    private readonly cryptoRepository: CryptoRepository,
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

    const user = await this.userRepository.updatePasswordHash(reset.userId, passwordHash);
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
      return this.validateSessionToken(sessionToken);
    }

    const apiKey = this.getApiKey(request);
    if (apiKey) {
      return this.validateApiKey(apiKey);
    }

    throw new UnauthorizedException('Authentication required');
  }

  async validateSessionToken(token: string): Promise<AuthContext> {
    const hashed = this.cryptoRepository.hashSha256(token);
    const session = await this.sessionRepository.getByToken(hashed);
    if (!session?.user) {
      throw new UnauthorizedException('Invalid session token');
    }

    return {
      user: session.user,
      session: { id: session.id },
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

  async createLoginResponse(user: { id: string; email: string; name: string; cursorColor: string }) {
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
        cursorColor: user.cursorColor,
      },
    };
  }

  private getSessionToken({ headers, queryParams }: ValidateRequest): string | null {
    const bearer = this.getBearerToken(headers);
    const cookies = parse(headers.cookie || '');

    return (
      (headers[TabliodbHeader.UserToken] as string | undefined) ||
      (headers[TabliodbHeader.SessionToken] as string | undefined) ||
      queryParams[TabliodbQuery.SessionKey] ||
      bearer ||
      cookies[TabliodbCookie.AccessToken] ||
      null
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
