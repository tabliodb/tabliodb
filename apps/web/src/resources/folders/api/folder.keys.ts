import type { getFolders } from '@tabliodb/sdk';
import type { PaginationQuery } from '@tabliodb/shared';

export type FolderListQuery = Parameters<typeof getFolders>[0];

export const foldersKeys = {
  all: ['folders'] as const,
  lists: () => [...foldersKeys.all, 'list'] as const,
  list: (query: FolderListQuery = {}) => [...foldersKeys.lists(), query] as const,
  listItemsByOrganization: (organizationId: string) =>
    [...foldersKeys.lists(), 'items-by-organization', { organizationId }, { limit: 50 }] as const,
  accessRoot: (folderId: string) => [...foldersKeys.all, 'access', folderId] as const,
  access: (folderId: string, query: PaginationQuery = {}) => [...foldersKeys.accessRoot(folderId), query] as const,
};
