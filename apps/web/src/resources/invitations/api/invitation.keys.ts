export const invitationsKeys = {
  all: ['invitations'] as const,
  token: (token: string) => [...invitationsKeys.all, 'token', token] as const,
};
