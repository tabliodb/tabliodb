import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Permission } from '@tabliodb/shared';
import { parse } from 'cookie';
import { IncomingHttpHeaders } from 'node:http';
import { AuthType, TabliodbCookie, TabliodbHeader, TabliodbQuery } from '../constants.js';
import { AuthContext } from '../database.js';
import {
  ApiKeyCreateDto,
  ApiKeyCreateResponseDto,
  LoginCredentialDto,
  LoginResponseDto,
  SignUpDto,
} from '../dtos/auth.dto.js';
import { ApiKeyRepository } from '../repositories/api-key.repository.js';
import { ConfigRepository } from '../repositories/config.repository.js';
import { CryptoRepository } from '../repositories/crypto.repository.js';
import { SessionRepository } from '../repositories/session.repository.js';
import { SetupRepository } from '../repositories/setup.repository.js';
import { UserRepository } from '../repositories/user.repository.js';

export type ValidateRequest = {
  headers: IncomingHttpHeaders;
  queryParams: Record<string, string | undefined>;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly configRepository: ConfigRepository,
    private readonly cryptoRepository: CryptoRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly setupRepository: SetupRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async signUp(_dto: SignUpDto): Promise<LoginResponseDto> {
    const setup = await this.setupRepository.getStatus();
    if (setup.isSetupComplete) {
      throw new BadRequestException('Public sign-up is disabled for this Tabliodb instance');
    }

    throw new BadRequestException('Complete first setup before creating regular user accounts');
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

  async createApiKey(auth: AuthContext, dto: ApiKeyCreateDto): Promise<ApiKeyCreateResponseDto> {
    const secret = this.cryptoRepository.randomBytesAsText(32);
    const key = this.cryptoRepository.hashSha256(secret);
    const permissions = dto.permissions as Permission[];

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

  async createLoginResponse(user: { id: string; email: string; name: string; avatarColor: string | null }) {
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
        avatarColor: user.avatarColor,
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
}
