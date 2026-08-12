import type { Params, UIMatch } from 'react-router';

export interface RouteTitleContext {
  params: Params<string>;
  loaderData: unknown;
  matches: UIMatch[];
}

export type RouteTitle = string | ((context: RouteTitleContext) => string | undefined);

export interface AppRouteHandle {
  title?: RouteTitle;
}
