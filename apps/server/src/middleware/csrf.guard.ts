import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { parse } from 'cookie';
import { TabliodbCookie, TabliodbHeader } from '../constants.js';
import type { AuthenticatedRequest } from './auth.guard.js';

const unsafeMethods = new Set(['DELETE', 'PATCH', 'POST', 'PUT']);

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const method = request.method.toUpperCase();

    if (!unsafeMethods.has(method) || request.user?.session?.source !== 'cookie') {
      return true;
    }

    const csrfCookie = parse(request.headers.cookie || '')[TabliodbCookie.CsrfToken];
    const csrfHeader = readHeader(request.headers[TabliodbHeader.CsrfToken]);

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      // Cookie-auth writes need a double-submit token because the browser attaches httpOnly session cookies automatically.
      throw new ForbiddenException('Invalid CSRF token.');
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
