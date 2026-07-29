import type { InvitationPublicDto } from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { sdk } from '@/services/sdk';
import { invitationsKeys } from './invitation.keys';

type InvitationQueries = {
  byToken: (token: string) => AppQueryOptions<InvitationPublicDto, ReturnType<typeof invitationsKeys.token>>;
};

export const invitationsQueries: InvitationQueries = {
  byToken: (token: string) =>
    appQueryOptions({
      enabled: Boolean(token),
      queryFn: () => sdk.invitations.getByToken(token),
      queryKey: invitationsKeys.token(token),
      retry: false,
    }),
};
