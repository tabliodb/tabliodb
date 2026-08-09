import type { Permission } from '@tabliodb/shared';
import type { JsonValue } from './schema/index.js';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  cursorColor: string;
  passwordChangeRequired: boolean;
};

export type AuthSession = {
  bindingAlgorithm: string | null;
  bindingKeyFingerprint: string | null;
  bindingPublicKeyJwk: JsonValue | null;
  bindingRequired: boolean;
  id: string;
  source: 'bearer' | 'cookie' | 'header' | 'query';
};

export type AuthApiKey = {
  id: string;
  permissions: Permission[];
};

export type AuthRequestMetadata = {
  ipAddress: string | null;
  requestId: string | null;
  userAgent: string | null;
};

export type AuthContext = {
  request?: AuthRequestMetadata;
  user: AuthUser;
  session?: AuthSession;
  apiKey?: AuthApiKey;
};
