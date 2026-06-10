/** Standard API response shape used across all routes */
export type ApiResponse<T = unknown> = {
  data: T | null;
  error: string | null;
  message: string | null;
};

/** Build a successful API response */
export function apiSuccess<T>(data: T, message?: string): ApiResponse<T> {
  return { data, error: null, message: message ?? null };
}

/** Build an error API response */
export function apiError(
  error: string,
  message?: string,
  status = 400
): Response {
  return Response.json(
    { data: null, error, message: message ?? null } satisfies ApiResponse,
    { status }
  );
}

/** Parse pagination params from URL search params */
export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10))
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
