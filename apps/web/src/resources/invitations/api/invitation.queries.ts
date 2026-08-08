import { getInvitationByToken, type InvitationPublicDtoOutput } from '@tabliodb/sdk';
import { appQueryOptions, type AppQueryOptions } from '@/lib/react-query';
import { invitationsKeys } from './invitation.keys';

type InvitationQueries = {
  byToken: (token: string) => AppQueryOptions<InvitationPublicDtoOutput, ReturnType<typeof invitationsKeys.token>>;
};

export const invitationsQueries: InvitationQueries = {
  byToken: (token: string) =>
    appQueryOptions({
      enabled: Boolean(token),
      queryFn: () => getInvitationByToken({ token }),
      queryKey: invitationsKeys.token(token),
      retry: false,
    }),
};
