import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  applyDecorators,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiCookieAuth, ApiSecurity } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthContext } from '../database.js';
import { AuthService } from '../services/auth.service.js';

const authMetadataKey = 'tabliodb:auth';

export type AuthenticatedOptions = {
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
    request.user = await this.authService.authenticate({
      headers: request.headers,
      queryParams: request.query as Record<string, string | undefined>,
    });

    return true;
  }
}
