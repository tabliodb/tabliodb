export const snapshotsKeys = {
  all: ['snapshots'] as const,
  lists: () => [...snapshotsKeys.all, 'list'] as const,
  listByDiagram: (diagramId: string) => [...snapshotsKeys.lists(), { diagramId }] as const,
};
