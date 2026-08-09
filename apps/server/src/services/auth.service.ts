import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Permission, isGranted } from '@tabliodb/shared';
import { generators, Issuer, type Client, type TokenSet } from 'openid-client';
import { parse } from 'cookie';
import { webcrypto } from 'node:crypto';
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
  OidcLoginProviderDto,
  OidcLoginStartDto,
  OidcLoginStartResponseDto,
  PasswordResetConfirmDto,
  PasswordResetConfirmResponseDto,
  PasswordResetRequestDto,
  PasswordResetRequestResponseDto,
  SessionBindingDto,
  SessionBindingSchema,
  SignUpDto,
} from '../dtos/auth.dto.js';
import { ApiKeyRepository } from '../repositories/api-key.repository.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { ConfigRepository } from '../repositories/config.repository.js';
import { CryptoRepository } from '../repositories/crypto.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { PasswordResetRepository } from '../repositories/password-reset.repository.js';
import { SessionRepository } from '../repositories/session.repository.js';
import {
  SetupRepository,
  type InstanceAuthSettings,
  type OidcProviderSettings,
} from '../repositories/setup.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { JsonValue } from '../schema/index.js';
import { FileService, type UploadedAvatarFile } from './file.service.js';
import { RedisService } from './redis.service.js';

const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const SESSION_PROOF_ALGORITHM = 'ecdsa-p256-sha256';
const SESSION_PROOF_CLOCK_SKEW_MS = 2 * 60 * 1000;
const SESSION_PROOF_NONCE_MAX_LENGTH = 120;
const SESSION_PROOF_TTL_MS = 2 * 60 * 1000;
const OIDC_STATE_TTL_MS = 10 * 60 * 1000;
const OIDC_STATE_PREFIX = 'oidc:state';

export type ValidateRequest = {
  headers: IncomingHttpHeaders;
  queryParams: Record<string, string | undefined>;
};

type SessionTokenSource = 'bearer' | 'cookie' | 'header' | 'query';

type SessionTokenCandidate = {
  source: SessionTokenSource;
  token: string;
};

type StoredOidcLoginState = {
  codeVerifier: string;
  createdAt: number;
  expiresAt: number;
  nonce: string;
  returnTo: string;
  sessionBinding?: SessionBindingDto;
};

type OidcCallbackQuery = Record<string, string | string[] | undefined>;

type CompletedOidcLogin = {
  login: LoginResponseDto;
  redirectTo: string;
};

type OidcUserProfile = {
  email: string;
  name: string;
};

@Injectable()
export class AuthService {
  private lastSessionProofNoncePrunedAt = 0;
  private lastOidcStatePrunedAt = 0;
  private readonly oidcLoginStates = new Map<string, StoredOidcLoginState>();
  private readonly usedSessionProofNonces = new Map<string, number>();

  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly configRepository: ConfigRepository,
    private readonly cryptoRepository: CryptoRepository,
    private readonly fileService: FileService,
    private readonly organizationRepository: OrganizationRepository,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly redisService: RedisService,
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

    return this.createLoginResponse(user, { sessionBinding: dto.sessionBinding });
  }

  async login(dto: LoginCredentialDto): Promise<LoginResponseDto> {
    const user = await this.userRepository.getByEmail(dto.email);
    if (!user?.passwordHash || !this.cryptoRepository.compareBcrypt(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    return this.createLoginResponse(user, { sessionBinding: dto.sessionBinding });
  }

  async getOidcLoginProvider(): Promise<OidcLoginProviderDto> {
    const [setup, settings] = await Promise.all([
      this.setupRepository.getStatus(),
      this.setupRepository.getOidcProviderSettings(),
    ]);
    const enabled = setup.isSetupComplete && this.isOidcLoginReady(settings);

    return {
      buttonLabel: settings.buttonLabel,
      enabled,
    };
  }

  async startOidcLogin(dto: OidcLoginStartDto): Promise<OidcLoginStartResponseDto> {
    const { client, settings } = await this.createOidcClient();
    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const returnTo = this.normalizeOidcReturnTo(dto.returnTo);
    const sessionBinding = this.parseSessionBinding(dto.sessionBinding);

    await this.storeOidcLoginState(state, {
      codeVerifier,
      createdAt: Date.now(),
      expiresAt: Date.now() + OIDC_STATE_TTL_MS,
      nonce,
      returnTo,
      ...(sessionBinding ? { sessionBinding } : {}),
    });

    return {
      authorizationUrl: client.authorizationUrl({
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        nonce,
        redirect_uri: this.getOidcCallbackUrl(),
        scope: settings.scopes.join(' '),
        state,
      }),
    };
  }

  async completeOidcLogin(query: OidcCallbackQuery): Promise<CompletedOidcLogin> {
    const error = readQueryValue(query.error);
    if (error) {
      throw new UnauthorizedException('OIDC provider rejected the login request');
    }

    const state = readQueryValue(query.state);
    const code = readQueryValue(query.code);
    if (!state || !code) {
      throw new BadRequestException('OIDC callback is missing code or state');
    }

    const storedState = await this.consumeOidcLoginState(state);
    if (!storedState) {
      throw new UnauthorizedException('OIDC login state is invalid or expired');
    }

    const { client, settings } = await this.createOidcClient();
    const tokenSet = await client.callback(
      this.getOidcCallbackUrl(),
      { code, state },
      {
        code_verifier: storedState.codeVerifier,
        nonce: storedState.nonce,
        state,
      },
    );
    const profile = await this.readOidcProfile(client, tokenSet);
    const user = await this.findOrCreateOidcUser(profile, settings);
    const login = await this.createLoginResponse(user, {
      sessionBinding: storedState.sessionBinding,
    });

    return {
      login,
      redirectTo: this.createOidcCompletionRedirect(storedState.returnTo),
    };
  }

  createOidcFailureRedirect(): string {
    return new URL('/login?oidcError=failed', this.configRepository.getEnv().server.webPublicUrl).toString();
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
      session: {
        bindingAlgorithm: session.bindingAlgorithm,
        bindingKeyFingerprint: session.bindingKeyFingerprint,
        bindingPublicKeyJwk: session.bindingPublicKeyJwk,
        bindingRequired: session.bindingRequired,
        id: session.id,
        source,
      },
    };
  }

  async verifySessionProof(
    auth: AuthContext,
    request: {
      headers: IncomingHttpHeaders;
      ipAddress: string | null;
      method: string;
      path: string;
      userAgent: string | null;
    },
  ): Promise<void> {
    if (!auth.session?.bindingRequired) {
      return;
    }

    const algorithm = readHeader(request.headers[TabliodbHeader.SessionProofAlgorithm]);
    const keyFingerprint = readHeader(request.headers[TabliodbHeader.SessionProofKey]);
    const nonce = readHeader(request.headers[TabliodbHeader.SessionProofNonce]);
    const signature = readHeader(request.headers[TabliodbHeader.SessionProofSignature]);
    const timestamp = readHeader(request.headers[TabliodbHeader.SessionProofTimestamp]);

    if (
      algorithm !== SESSION_PROOF_ALGORITHM ||
      auth.session.bindingAlgorithm !== SESSION_PROOF_ALGORITHM ||
      keyFingerprint !== auth.session.bindingKeyFingerprint
    ) {
      throw new UnauthorizedException('Session proof is missing or bound to another browser');
    }

    if (!nonce || nonce.length > SESSION_PROOF_NONCE_MAX_LENGTH || !signature || !timestamp) {
      throw new UnauthorizedException('Session proof is incomplete');
    }

    const timestampMs = Number(timestamp);
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > SESSION_PROOF_CLOCK_SKEW_MS) {
      throw new UnauthorizedException('Session proof is expired');
    }

    if (!auth.session.bindingPublicKeyJwk || typeof auth.session.bindingPublicKeyJwk !== 'object') {
      throw new UnauthorizedException('Session proof key is unavailable');
    }

    const payload = createSessionProofPayload({
      method: request.method,
      nonce,
      path: request.path,
      timestamp,
    });
    const publicKey = await webcrypto.subtle.importKey(
      'jwk',
      auth.session.bindingPublicKeyJwk as JsonWebKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const isValid = await webcrypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      Buffer.from(signature, 'base64url'),
      new TextEncoder().encode(payload),
    );

    if (!isValid) {
      throw new UnauthorizedException('Session proof is invalid');
    }

    const isFreshNonce = await this.consumeSessionProofNonce(`session-proof:${auth.session.id}:${nonce}`);
    if (!isFreshNonce) {
      throw new UnauthorizedException('Session proof has already been used');
    }

    // Activity is written only after a valid proof so anomaly telemetry cannot be spoofed with a stolen token alone.
    await this.sessionRepository.updateActivity(auth.session.id, {
      ipAddress: request.ipAddress,
      userAgentHash: request.userAgent
        ? this.cryptoRepository.hashSha256(request.userAgent).toString('base64url')
        : null,
    });
  }

  private async createOidcClient(): Promise<{ client: Client; settings: OidcProviderSettings }> {
    const settings = await this.setupRepository.getOidcProviderSettings();

    if (!this.isOidcLoginReady(settings)) {
      throw new BadRequestException('OIDC login is not configured');
    }

    const secret = await this.setupRepository.getSecretSettingValue('auth.oidc.client_secret');
    const clientSecret = readSecretValue(secret, 'clientSecret');

    if (!clientSecret) {
      throw new BadRequestException('OIDC client secret is not configured');
    }

    const issuer = await Issuer.discover(settings.issuerUrl!);
    const client = new issuer.Client({
      client_id: settings.clientId!,
      client_secret: clientSecret,
      redirect_uris: [this.getOidcCallbackUrl()],
      response_types: ['code'],
    });

    return { client, settings };
  }

  private isOidcLoginReady(settings: OidcProviderSettings): boolean {
    return Boolean(
      settings.enabled &&
      settings.issuerUrl &&
      settings.clientId &&
      settings.clientSecretConfigured &&
      settings.scopes.includes('openid'),
    );
  }

  private async readOidcProfile(client: Client, tokenSet: TokenSet): Promise<OidcUserProfile> {
    const claims = tokenSet.claims();
    let email = readClaimString(claims, 'email');
    let name = readClaimString(claims, 'name') ?? readClaimString(claims, 'preferred_username') ?? email;
    const emailVerified = claims.email_verified;

    if (!email && tokenSet.access_token) {
      const userinfo = await client.userinfo(tokenSet.access_token);
      email = readClaimString(userinfo, 'email');
      name = readClaimString(userinfo, 'name') ?? readClaimString(userinfo, 'preferred_username') ?? email;
    }

    if (!email) {
      throw new UnauthorizedException('OIDC profile does not include an email address');
    }

    if (emailVerified === false) {
      throw new UnauthorizedException('OIDC email address is not verified');
    }

    return {
      email: email.trim().toLowerCase(),
      name: name?.trim() || email.split('@')[0] || email,
    };
  }

  private async findOrCreateOidcUser(
    profile: OidcUserProfile,
    settings: OidcProviderSettings,
  ): Promise<{
    avatarUrl?: string | null;
    cursorColor: string;
    email: string;
    id: string;
    name: string;
    passwordChangeRequired?: boolean;
  }> {
    const existingUser = await this.userRepository.getByEmail(profile.email);

    if (existingUser) {
      return existingUser;
    }

    const anyUser = await this.userRepository.getAnyByEmail(profile.email);
    if (anyUser) {
      throw new UnauthorizedException('This account is not available for OIDC login');
    }

    if (!settings.autoCreateUsers) {
      throw new UnauthorizedException('Ask an administrator to create your Tabliodb account before using SSO');
    }

    await this.assertOidcAutoCreateAllowed(profile.email);

    const user = await this.userRepository.create({
      cursorColor: '#58cc02',
      email: profile.email,
      name: profile.name,
      passwordHash: null,
    });

    await this.organizationRepository.createPersonalOrganization({
      name: `${user.name}'s Workspace`,
      userId: user.id,
    });

    return user;
  }

  private async assertOidcAutoCreateAllowed(email: string): Promise<void> {
    const settings = await this.setupRepository.getAuthSettings();

    if (settings.signupPolicy !== 'allowed_domains') {
      return;
    }

    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && settings.allowedDomains.includes(domain)) {
      return;
    }

    throw new BadRequestException('Email domain is not allowed for this Tabliodb instance');
  }

  private async storeOidcLoginState(state: string, value: StoredOidcLoginState): Promise<void> {
    const storedInRedis = await this.redisService.setIfAbsent(
      `${OIDC_STATE_PREFIX}:${state}`,
      JSON.stringify(value),
      OIDC_STATE_TTL_MS,
    );

    if (storedInRedis === true) {
      return;
    }

    if (storedInRedis === false) {
      // State collision is extremely unlikely, but Redis owns callback consumption when configured, so do not create a split-brain fallback.
      throw new BadRequestException('OIDC login state could not be prepared');
    }

    this.pruneExpiredOidcStates(Date.now());
    // In-memory fallback keeps single-process development usable when Redis is not configured or temporarily unavailable.
    this.oidcLoginStates.set(state, value);
  }

  private async consumeOidcLoginState(state: string): Promise<StoredOidcLoginState | null> {
    const redisValue = await this.redisService.getAndDelete(`${OIDC_STATE_PREFIX}:${state}`);
    const parsedRedisValue = redisValue ? parseOidcLoginState(redisValue) : null;

    if (parsedRedisValue) {
      return parsedRedisValue.expiresAt > Date.now() ? parsedRedisValue : null;
    }

    const fallback = this.oidcLoginStates.get(state) ?? null;
    this.oidcLoginStates.delete(state);

    if (!fallback || fallback.expiresAt <= Date.now()) {
      return null;
    }

    return fallback;
  }

  private pruneExpiredOidcStates(now: number): void {
    if (now - this.lastOidcStatePrunedAt < OIDC_STATE_TTL_MS) {
      return;
    }

    this.lastOidcStatePrunedAt = now;

    for (const [state, value] of this.oidcLoginStates.entries()) {
      if (value.expiresAt <= now) {
        this.oidcLoginStates.delete(state);
      }
    }
  }

  private parseSessionBinding(value: SessionBindingDto | undefined): SessionBindingDto | undefined {
    if (!value) {
      return undefined;
    }

    const result = SessionBindingSchema.safeParse(value);

    return result.success ? result.data : undefined;
  }

  private getOidcCallbackUrl(): string {
    return new URL('/api/auth/oidc/callback', this.configRepository.getEnv().server.publicUrl).toString();
  }

  private createOidcCompletionRedirect(returnTo: string): string {
    const url = new URL('/auth/oidc/complete', this.configRepository.getEnv().server.webPublicUrl);
    url.searchParams.set('returnTo', returnTo);

    return url.toString();
  }

  private normalizeOidcReturnTo(value: string | undefined): string {
    if (!value) {
      return '/';
    }

    const trimmed = value.trim();

    if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/api')) {
      return '/';
    }

    return trimmed;
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

  async createLoginResponse(
    user: {
      avatarUrl?: string | null;
      cursorColor: string;
      email: string;
      id: string;
      name: string;
      passwordChangeRequired?: boolean;
    },
    options: { sessionBinding?: SessionBindingDto } = {},
  ) {
    const accessToken = this.cryptoRepository.randomBytesAsText(32);
    const token = this.cryptoRepository.hashSha256(accessToken);
    const sessionBinding = this.createSessionBindingRecord(options.sessionBinding);

    // The database stores only the SHA-256 hash, so a leaked session table does not expose usable bearer tokens.
    await this.sessionRepository.create({
      appVersion: null,
      bindingAlgorithm: sessionBinding?.algorithm ?? null,
      bindingKeyFingerprint: sessionBinding?.keyFingerprint ?? null,
      bindingPublicKeyJwk: sessionBinding?.publicKey ?? null,
      bindingRequired: Boolean(sessionBinding),
      deviceOs: '',
      deviceType: '',
      expiresAt: null,
      tokenHash: token,
      userId: user.id,
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

  private createSessionBindingRecord(binding: SessionBindingDto | undefined): {
    algorithm: typeof SESSION_PROOF_ALGORITHM;
    keyFingerprint: string;
    publicKey: JsonValue;
  } | null {
    if (!binding) {
      return null;
    }

    if (binding.algorithm !== SESSION_PROOF_ALGORITHM) {
      throw new BadRequestException('Unsupported session binding algorithm');
    }

    const publicKey: JsonValue = {
      crv: binding.publicKey.crv,
      kty: binding.publicKey.kty,
      x: binding.publicKey.x,
      y: binding.publicKey.y,
    };

    if (
      binding.publicKey.ext !== undefined &&
      publicKey !== null &&
      typeof publicKey === 'object' &&
      !Array.isArray(publicKey)
    ) {
      // Optional JWK metadata is persisted only when the browser sends it, keeping the fingerprint canonical.
      publicKey.ext = binding.publicKey.ext;
    }

    if (
      binding.publicKey.key_ops !== undefined &&
      publicKey !== null &&
      typeof publicKey === 'object' &&
      !Array.isArray(publicKey)
    ) {
      // WebCrypto usually includes key_ops on exported public keys; preserving it avoids surprising fingerprint drift.
      publicKey.key_ops = binding.publicKey.key_ops;
    }

    return {
      algorithm: SESSION_PROOF_ALGORITHM,
      keyFingerprint: this.createSessionBindingFingerprint(SESSION_PROOF_ALGORITHM, publicKey),
      publicKey,
    };
  }

  private createSessionBindingFingerprint(algorithm: typeof SESSION_PROOF_ALGORITHM, publicKey: JsonValue): string {
    // Fingerprinting the canonical JWK lets the client identify which local key must sign this session.
    return this.cryptoRepository.hashSha256(`${algorithm}\n${stableJson(publicKey)}`).toString('base64url');
  }

  private async consumeSessionProofNonce(key: string): Promise<boolean> {
    const redisResult = await this.redisService.setIfAbsent(key, '1', SESSION_PROOF_TTL_MS);

    if (redisResult !== null) {
      return redisResult;
    }

    return this.consumeSessionProofNonceInMemory(key);
  }

  private consumeSessionProofNonceInMemory(key: string): boolean {
    const now = Date.now();

    if (now - this.lastSessionProofNoncePrunedAt > SESSION_PROOF_TTL_MS) {
      this.pruneExpiredSessionProofNonces(now);
    }

    if (this.usedSessionProofNonces.has(key)) {
      return false;
    }

    this.usedSessionProofNonces.set(key, now + SESSION_PROOF_TTL_MS);
    return true;
  }

  private pruneExpiredSessionProofNonces(now: number): void {
    this.lastSessionProofNoncePrunedAt = now;

    for (const [key, expiresAt] of this.usedSessionProofNonces.entries()) {
      if (expiresAt <= now) {
        this.usedSessionProofNonces.delete(key);
      }
    }
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

function readHeader(value: string | string[] | undefined | null): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function readQueryValue(value: string | string[] | undefined): string | null {
  const firstValue = Array.isArray(value) ? value[0] : value;

  return firstValue?.trim() || null;
}

function readSecretValue(value: JsonValue | null, key: string): string | null {
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof value[key] === 'string') {
    return value[key].trim() || null;
  }

  return null;
}

function readClaimString(claims: unknown, key: string): string | null {
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) {
    return null;
  }

  const value = (claims as Record<string, unknown>)[key];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseOidcLoginState(value: string): StoredOidcLoginState | null {
  try {
    const parsed = JSON.parse(value) as Partial<StoredOidcLoginState>;
    const sessionBindingResult = parsed.sessionBinding
      ? SessionBindingSchema.safeParse(parsed.sessionBinding)
      : { success: true as const, data: undefined };

    if (
      typeof parsed.codeVerifier === 'string' &&
      typeof parsed.createdAt === 'number' &&
      typeof parsed.expiresAt === 'number' &&
      typeof parsed.nonce === 'string' &&
      typeof parsed.returnTo === 'string' &&
      sessionBindingResult.success
    ) {
      return {
        codeVerifier: parsed.codeVerifier,
        createdAt: parsed.createdAt,
        expiresAt: parsed.expiresAt,
        nonce: parsed.nonce,
        returnTo: parsed.returnTo,
        ...(sessionBindingResult.data ? { sessionBinding: sessionBindingResult.data } : {}),
      };
    }
  } catch {
    return null;
  }

  return null;
}

function createSessionProofPayload(input: { method: string; nonce: string; path: string; timestamp: string }): string {
  return [input.method.toUpperCase(), input.path, input.timestamp, input.nonce].join('\n');
}

function stableJson(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, JsonValue | undefined>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key] as JsonValue)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}
