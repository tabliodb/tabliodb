import { redirect, type LoaderFunctionArgs } from 'react-router';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { invitationsQueries } from '@/resources/invitations';
import { setupQueries } from '@/resources/setup';

export async function acceptInvitationLoader({ params }: LoaderFunctionArgs) {
  const setupStatus = await queryClient.ensureQueryData(setupQueries.status());

  if (!setupStatus.isSetupComplete) {
    throw redirect(routes.setup.to());
  }

  if (!params.token) {
    throw new Response('Invitation token is required', { status: 400 });
  }

  // Loader menghangatkan preview invite agar page form tidak memulai dengan state kosong yang terasa patah.
  await queryClient.ensureQueryData(invitationsQueries.byToken(params.token));

  return null;
}
