import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  applyDecorators,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiCookieAuth, ApiSecurity } from '@nestjs/swagger';
import type { Request } from 'express';
import { TabliodbHeader } from '../constants.js';
import type { AuthContext } from '../database.js';
import { AuthService } from '../services/auth.service.js';

export const authMetadataKey = 'tabliodb:auth';

export type AuthenticatedOptions = {
  allowTemporaryPassword?: boolean;
  permission?: string | false;
};

export function Authenticated(options: AuthenticatedOptions = {}): ClassDecorator & MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiCookieAuth(),
    ApiSecurity('api-key'),
    SetMetadata(authMetadataKey, options),
  ) as ClassDecorator & MethodDecorator;
}

export const Auth = createParamDecorator((data, context: ExecutionContext): AuthContext => {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
});

export interface AuthRequest extends Request {
  user?: AuthContext;
}

export interface AuthenticatedRequest extends Request {
  user: AuthContext;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<AuthenticatedOptions | undefined>(authMetadataKey, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const auth = await this.authService.authenticate({
      headers: request.headers,
      queryParams: request.query as Record<string, string | undefined>,
    });
    request.user = {
      ...auth,
      request: {
        // Audit log metadata is attached once at the auth boundary so services can stay independent from Express.
        ipAddress: request.ip ?? null,
        requestId: readHeader(request.headers[TabliodbHeader.RequestId]),
        userAgent: readHeader(request.headers['user-agent']),
      },
    };

    await this.authService.verifySessionProof(request.user, {
      headers: request.headers,
      ipAddress: request.ip ?? null,
      method: request.method,
      // originalUrl preserves the query string, so the signed payload matches the exact route the browser requested.
      path: request.originalUrl,
      userAgent: readHeader(request.headers['user-agent']),
    });

    if (request.user.user.passwordChangeRequired && !options.allowTemporaryPassword) {
      throw new ForbiddenException('Change your temporary password before continuing');
    }

    return true;
  }
}

function readHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
