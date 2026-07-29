export type ApiEnvelope<T> = {
  data: T;
  requestId?: string;
};

export type ApiErrorResponse = {
  statusCode: number;
  message: string;
  error?: string;
  requestId?: string;
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
