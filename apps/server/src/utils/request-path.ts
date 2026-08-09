const sensitiveRoutePatterns = [
  [/^\/api\/invitations\/[^/?#]+/i, '/api/invitations/:token'],
  [/^\/api\/public\/share-links\/[^/?#]+/i, '/api/public/share-links/:token'],
  [/^\/invite\/[^/?#]+/i, '/invite/:token'],
  [/^\/reset-password\/[^/?#]+/i, '/reset-password/:token'],
] as const;

const sensitiveQueryKeys = new Set(['accesstoken', 'apikey', 'sessionkey', 'token']);

export type RoutePatternRequest = {
  baseUrl?: string;
  method?: string;
  originalUrl?: string;
  route?: {
    path?: RegExp | string | Array<RegExp | string>;
  };
  url?: string;
};

export function sanitizeRequestPath(value: string): string {
  const [rawPathname = '/', rawQuery = ''] = value.split('?', 2);
  const pathname = sensitiveRoutePatterns.reduce(
    (currentPathname, [pattern, replacement]) => currentPathname.replace(pattern, replacement),
    rawPathname,
  );

  if (!rawQuery) {
    return pathname;
  }

  const query = new URLSearchParams(rawQuery);

  for (const key of query.keys()) {
    if (isSensitiveQueryKey(key)) {
      // Query tokens are usable secrets in browser history and reverse proxy logs, so logs only keep the key shape.
      query.set(key, '[redacted]');
    }
  }

  const safeQuery = query.toString();

  return safeQuery ? `${pathname}?${safeQuery}` : pathname;
}

export function getRequestRoutePattern(request: RoutePatternRequest): string {
  const routePath = request.route?.path;

  if (!routePath) {
    return sanitizeRequestPath(request.originalUrl || request.url || '/');
  }

  const normalizedRoutePath = normalizeRoutePath(routePath);
  const baseUrl = request.baseUrl?.replace(/\/+$/, '') ?? '';
  const path = `${baseUrl}${normalizedRoutePath.startsWith('/') ? normalizedRoutePath : `/${normalizedRoutePath}`}`;

  // Express route templates keep dynamic params as ":id"; using them for metrics prevents per-resource URL cardinality.
  return sanitizeRequestPath(path.replace(/\/{2,}/g, '/'));
}

function isSensitiveQueryKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();

  return sensitiveQueryKeys.has(normalizedKey) || normalizedKey.includes('token');
}

function normalizeRoutePath(path: RegExp | string | Array<RegExp | string>): string {
  if (Array.isArray(path)) {
    return path.map((item) => normalizeRoutePath(item)).join('|');
  }

  return typeof path === 'string' ? path : path.source;
}
