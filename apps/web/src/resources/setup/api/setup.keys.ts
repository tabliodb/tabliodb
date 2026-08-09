export const setupKeys = {
  all: ['setup'] as const,
  authSettings: () => [...setupKeys.all, 'auth-settings'] as const,
  oidcProvider: () => [...setupKeys.all, 'oidc-provider'] as const,
  smtpSettings: () => [...setupKeys.all, 'smtp-settings'] as const,
  status: () => [...setupKeys.all, 'status'] as const,
};
