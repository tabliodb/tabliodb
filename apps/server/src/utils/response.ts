import type { CookieOptions, Response } from 'express';
import { TabliodbCookie } from '../constants.js';

export function respondWithAuthCookies<T>(
  res: Response,
  body: T,
  options: { secure: boolean; accessToken: string; authType: string },
): T {
  const defaults: CookieOptions = {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 400,
    path: '/',
    sameSite: 'lax',
    secure: options.secure,
  };

  res.cookie(TabliodbCookie.AccessToken, options.accessToken, defaults);
  res.cookie(TabliodbCookie.AuthType, options.authType, defaults);

  // Frontend can read this lightweight flag without gaining access to the session token itself.
  res.cookie(TabliodbCookie.IsAuthenticated, 'true', { ...defaults, httpOnly: false });

  return body;
}

export function clearAuthCookies<T>(res: Response, body: T): T {
  res.clearCookie(TabliodbCookie.AccessToken);
  res.clearCookie(TabliodbCookie.AuthType);
  res.clearCookie(TabliodbCookie.IsAuthenticated);
  return body;
}
