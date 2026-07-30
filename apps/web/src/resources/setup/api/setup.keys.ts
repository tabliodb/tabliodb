export const setupKeys = {
  all: ['setup'] as const,
  authSettings: () => [...setupKeys.all, 'auth-settings'] as const,
  status: () => [...setupKeys.all, 'status'] as const,
};
