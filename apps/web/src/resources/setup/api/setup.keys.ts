export const setupKeys = {
  all: ['setup'] as const,
  authSettings: () => [...setupKeys.all, 'auth-settings'] as const,
  oidcProvider: () => [...setupKeys.all, 'oidc-provider'] as const,
  status: () => [...setupKeys.all, 'status'] as const,
};
