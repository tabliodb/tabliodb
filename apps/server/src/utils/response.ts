import { randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import { TabliodbCookie } from '../constants.js';

const authCookieMaxAgeMs = 1000 * 60 * 60 * 24 * 400;
const csrfTokenBytes = 32;

export function respondWithAuthCookies<T>(
  res: Response,
  body: T,
  options: { secure: boolean; accessToken: string; authType: string },
): T {
  const defaults = getAuthCookieDefaults(options.secure);

  res.cookie(TabliodbCookie.AccessToken, options.accessToken, defaults);
  res.cookie(TabliodbCookie.AuthType, options.authType, defaults);
  setCsrfCookie(res, { secure: options.secure });

  // Frontend can read this lightweight flag without gaining access to the session token itself.
  res.cookie(TabliodbCookie.IsAuthenticated, 'true', { ...defaults, httpOnly: false });

  return body;
}

export function setCsrfCookie(res: Response, options: { secure: boolean }): string {
  const token = randomBytes(csrfTokenBytes).toString('base64url');

  // Double-submit CSRF needs a browser-readable token, while the actual session cookie stays httpOnly.
  res.cookie(TabliodbCookie.CsrfToken, token, {
    ...getAuthCookieDefaults(options.secure),
    httpOnly: false,
  });

  return token;
}

export function clearAuthCookies<T>(res: Response, body: T): T {
  res.clearCookie(TabliodbCookie.AccessToken);
  res.clearCookie(TabliodbCookie.AuthType);
  res.clearCookie(TabliodbCookie.CsrfToken);
  res.clearCookie(TabliodbCookie.IsAuthenticated);
  return body;
}

function getAuthCookieDefaults(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    maxAge: authCookieMaxAgeMs,
    path: '/',
    sameSite: 'lax',
    secure,
  };
}
