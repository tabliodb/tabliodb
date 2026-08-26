import { redirect } from 'react-router';
import { TabliodbApiError, type CurrentUserResponseDtoOutput, type OidcLoginProviderDtoOutput } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { authQueries } from '@/resources/auth';
import { setupQueries } from '@/resources/setup';

export type LoginLoaderData = {
  oidcError: boolean;
  oidcProvider: OidcLoginProviderDtoOutput;
  temporaryUser: CurrentUserResponseDtoOutput | null;
};

export async function loginLoader({ request }: { request: Request }) {
  const setupStatus = await queryClient.fetchQuery(setupQueries.status());

  if (!setupStatus.isSetupComplete) {
    throw redirect(routes.setup.to());
  }

  const url = new URL(request.url);
  const oidcProvider = await loadOidcProvider();

  if (hasRecentUnauthorizedCurrentUserProbe()) {
    return {
      oidcError: url.searchParams.get('oidcError') === 'failed',
      oidcProvider,
      temporaryUser: null,
    } satisfies LoginLoaderData;
  }

  try {
    // Guest login route tidak perlu render form kalau session cookie masih valid.
    const user = await queryClient.fetchQuery(authQueries.me());
    if (user.passwordChangeRequired) {
      return { oidcError: false, oidcProvider, temporaryUser: user } satisfies LoginLoaderData;
    }

    throw redirect(routes.home.to());
  } catch (error) {
    if (error instanceof TabliodbApiError && error.status === 401) {
      return {
        oidcError: url.searchParams.get('oidcError') === 'failed',
        oidcProvider,
        temporaryUser: null,
      } satisfies LoginLoaderData;
    }

    throw error;
  }

  return { oidcError: false, oidcProvider, temporaryUser: null } satisfies LoginLoaderData;
}

async function loadOidcProvider(): Promise<OidcLoginProviderDtoOutput> {
  try {
    return await queryClient.fetchQuery(authQueries.oidcProvider());
  } catch {
    // Password login should stay available even if an unfinished OIDC provider config is temporarily broken.
    return {
      buttonLabel: 'Continue with SSO',
      enabled: false,
    };
  }
}

function hasRecentUnauthorizedCurrentUserProbe(): boolean {
  const meQuery = authQueries.me();
  const state = queryClient.getQueryState(meQuery.queryKey);

  return Boolean(
    state?.error instanceof TabliodbApiError &&
    state.error.status === 401 &&
    // Protected-route redirects already verified that the session is missing; reusing the very recent 401 avoids a duplicate /auth/me call on /login.
    Date.now() - state.errorUpdatedAt < 2_000,
  );
}
