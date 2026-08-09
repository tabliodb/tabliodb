const sensitiveRoutePatterns = [
  [/^\/api\/invitations\/[^/?#]+/i, '/api/invitations/:token'],
  [/^\/api\/public\/share-links\/[^/?#]+/i, '/api/public/share-links/:token'],
  [/^\/invite\/[^/?#]+/i, '/invite/:token'],
  [/^\/reset-password\/[^/?#]+/i, '/reset-password/:token'],
] as const;

const sensitiveQueryKeys = new Set(['accesstoken', 'apikey', 'sessionkey', 'token']);

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

function isSensitiveQueryKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();

  return sensitiveQueryKeys.has(normalizedKey) || normalizedKey.includes('token');
}
