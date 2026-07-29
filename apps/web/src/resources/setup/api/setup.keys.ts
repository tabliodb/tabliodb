export const setupKeys = {
  all: ['setup'] as const,
  status: () => [...setupKeys.all, 'status'] as const,
};
