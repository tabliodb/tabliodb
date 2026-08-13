import { useEffect } from 'react';
import { useMatches } from 'react-router';
import type { AppRouteHandle } from './route-meta';

const appConfig = {
  name: 'TablioDB',
  titleSeparator: ' = ',
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
            loaderData: match.loaderData,
            matches,
            params: match.params,
          });
        }

        return handle.title;
      })
      .find((title): title is string => Boolean(title?.trim()));

    const cleanTitle = matchedTitle?.trim();

    // The app name stays singular in browser chrome; route handles only provide the contextual prefix.
    document.title =
      cleanTitle && cleanTitle !== appConfig.name
        ? `${cleanTitle}${appConfig.titleSeparator}${appConfig.name}`
        : appConfig.name;
  }, [matches]);

  return null;
}
