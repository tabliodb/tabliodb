import type { PaginationQuery } from '@tabliodb/shared';
import {
  getFolderAccess,
  getFolders,
  type OrganizationDtoOutput,
  type FolderListResponseDtoOutput,
  type FolderAccessListResponseDtoOutput,
  type FolderResponseDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { foldersKeys, type FolderListQuery } from './folder.keys';

type FoldersQueries = {
  list: (
    query?: FolderListQuery,
  ) => AppQueryOptions<FolderListResponseDtoOutput, ReturnType<typeof foldersKeys.list>>;
  listByOrganization: (
    organization: OrganizationDtoOutput | null,
  ) => AppQueryOptions<FolderResponseDtoOutput[], ReturnType<typeof foldersKeys.listItemsByOrganization>>;
  access: (
    folderId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<FolderAccessListResponseDtoOutput, ReturnType<typeof foldersKeys.access>>;
};

export const foldersQueries: FoldersQueries = {
  list: (query: FolderListQuery = {}) =>
    appQueryOptions({
      queryFn: () => getFolders(query),
      queryKey: foldersKeys.list(query),
    }),

  listByOrganization: (organization: OrganizationDtoOutput | null) =>
    appQueryOptions({
      enabled: Boolean(organization?.id),
      queryFn: () => listFoldersByOrganization(organization),
      queryKey: foldersKeys.listItemsByOrganization(organization?.id ?? 'missing-organization'),
    }),

  access: (folderId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(folderId),
      queryFn: () => getFolderAccess({ folderId, ...query }),
      queryKey: foldersKeys.access(folderId, query),
    }),
};

async function listFoldersByOrganization(
  organization: OrganizationDtoOutput | null,
): Promise<FolderResponseDtoOutput[]> {
  if (!organization) {
    return [];
  }

  const folders = await getFolders({ limit: 50, organizationId: organization.id });

  // Query layer harus read-only; create folder dilakukan lewat intent eksplisit di dialog/empty state.
  return folders.items;
}
