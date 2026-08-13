export const authKeys = {
  all: ['auth'] as const,
  editorPreference: () => [...authKeys.all, 'editor-preference'] as const,
  me: () => [...authKeys.all, 'me'] as const,
  oidcProvider: () => [...authKeys.all, 'oidc-provider'] as const,
};
