export const serverKeys = {
  all: ['server'] as const,
  metrics: () => [...serverKeys.all, 'metrics'] as const,
  readiness: () => [...serverKeys.all, 'readiness'] as const,
};
