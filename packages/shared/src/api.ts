export type ApiEnvelope<T> = {
  data: T;
  requestId?: string;
};

export type ApiErrorResponse = {
  code: string;
  details?: string[];
  error?: string;
  message: string;
  method: string;
  path: string;
  requestId: string | null;
  statusCode: number;
  timestamp: string;
};

export type PaginationQuery = {
  cursor?: string;
  limit?: number;
};

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
  totalCount: number;
};
