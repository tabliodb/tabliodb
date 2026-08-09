import type { PaginationQuery } from '@tabliodb/shared';
import {
  getDiagramShareLinks,
  getPublicDiagramShare,
  type DiagramShareLinkListResponseDtoOutput,
  type PublicDiagramShareResponseDtoOutput,
} from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { shareLinkKeys } from './share-link.keys';

type ShareLinkQueries = {
  listByDiagram: (
    diagramId: string,
    query?: PaginationQuery,
  ) => AppQueryOptions<DiagramShareLinkListResponseDtoOutput, ReturnType<typeof shareLinkKeys.listByDiagram>>;
  publicByToken: (
    token: string,
  ) => AppQueryOptions<PublicDiagramShareResponseDtoOutput, ReturnType<typeof shareLinkKeys.publicByToken>>;
};

export const shareLinkQueries: ShareLinkQueries = {
  listByDiagram: (diagramId: string, query: PaginationQuery = {}) =>
    appQueryOptions({
      enabled: Boolean(diagramId),
      queryFn: () => getDiagramShareLinks({ diagramId, ...query }),
      queryKey: shareLinkKeys.listByDiagram(diagramId, query),
    }),

  publicByToken: (token: string) =>
    appQueryOptions({
      enabled: Boolean(token),
      // Public share memakai endpoint khusus tanpa auth sehingga stakeholder bisa membuka diagram read-only tanpa akun.
      queryFn: () => getPublicDiagramShare({ token }),
      queryKey: shareLinkKeys.publicByToken(token),
    }),
};
