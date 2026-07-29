import type { Permission } from '@tabliodb/shared';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarColor: string | null;
};

export type AuthSession = {
  id: string;
};

export type AuthApiKey = {
  id: string;
  permissions: Permission[];
};

export type AuthContext = {
  user: AuthUser;
  session?: AuthSession;
  apiKey?: AuthApiKey;
};
