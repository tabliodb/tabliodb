const DEFAULT_PAGINATION_LIMIT = 25;
const MAX_PAGINATION_LIMIT = 100;

export function clampPaginationLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_PAGINATION_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGINATION_LIMIT);
}

export function decodeOffsetCursor(cursor?: string): number {
  if (!cursor) {
    return 0;
  }

  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as { offset?: unknown };

    // Cursor disimpan sebagai offset encoded agar client tidak bergantung pada strategi pagination internal server.
    return typeof parsed.offset === 'number' && parsed.offset > 0 ? Math.trunc(parsed.offset) : 0;
  } catch {
    return 0;
  }
}

export function encodeOffsetCursor(offset: number): string {
  // Offset cursor cukup untuk admin directory awal; nanti bisa diganti keyset cursor tanpa mengubah shape response SDK.
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
}
