import { redirect, type LoaderFunctionArgs } from 'react-router';
import { TabliodbApiError, activatePreparedSessionBinding, clearSessionBinding } from '@tabliodb/sdk';
import { routes } from '@/app/routes';
import { queryClient } from '@/lib/react-query';
import { authQueries } from '@/resources/auth';

export async function oidcCompleteLoader({ request }: LoaderFunctionArgs) {
  await activatePreparedSessionBinding();

  const url = new URL(request.url);
  const returnTo = normalizeOidcReturnTo(url.searchParams.get('returnTo'));

  try {
    const user = await queryClient.fetchQuery(authQueries.me());

    if (user.passwordChangeRequired) {
      throw redirect(routes.login.to());
    }

    throw redirect(returnTo);
  } catch (error) {
    if (isRedirectResponse(error)) {
      throw error;
    }

    if (error instanceof TabliodbApiError && error.status === 401) {
      await clearSessionBinding();
      throw redirect(`${routes.login.to()}?oidcError=failed`);
    }

    throw error;
  }
}

function normalizeOidcReturnTo(value: string | null): string {
  const trimmed = value?.trim();

  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/api')) {
    return routes.home.to();
  }

  return trimmed;
}

function isRedirectResponse(error: unknown): boolean {
  return error instanceof Response && error.status >= 300 && error.status < 400;
}
