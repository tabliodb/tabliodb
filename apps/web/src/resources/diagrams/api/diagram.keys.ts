export const diagramsKeys = {
  all: ['diagrams'] as const,
  lists: () => [...diagramsKeys.all, 'list'] as const,
  listByProject: (projectId: string) => [...diagramsKeys.lists(), { projectId }] as const,
};
