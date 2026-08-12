import { AppRouteHandle } from '@/app/route-meta';
import { useEffect } from 'react';
import { useMatches } from 'react-router';

const appConfig = {
  name: 'TablioDB',
  titleSeparator: ' - ',
} as const;

export function DocumentTitle() {
  const matches = useMatches();

  useEffect(() => {
    const matchedTitle = [...matches]
      .reverse()
      .map((match) => {
        const handle = match.handle as AppRouteHandle | undefined;

        if (!handle?.title) {
          return undefined;
        }

        if (typeof handle.title === 'function') {
          return handle.title({
            params: match.params,
            loaderData: match.loaderData,
            matches,
          });
        }

        return handle.title;
      })
      .find(Boolean);

    document.title = matchedTitle ? `${matchedTitle}${appConfig.titleSeparator}${appConfig.name}` : appConfig.name;
  }, [matches]);

  return null;
}
