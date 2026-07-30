import type { Permission } from '@tabliodb/shared';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  cursorColor: string;
};

export type AuthSession = {
  id: string;
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
