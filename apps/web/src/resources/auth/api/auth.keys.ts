export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
  oidcProvider: () => [...authKeys.all, 'oidc-provider'] as const,
};
