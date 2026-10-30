// packages/shared/src/http.ts — the ONE HTTP convention for every app in this repo.
// Copied verbatim from the it-team kit (docs/_team/templates/http.ts); follows the `api-design`
// skill. Backend, frontend, MSW mocks, and E2E import from here — never re-declare these shapes.
// Change this file only through an ADR. Error codes: add new ones, never rename or remove.
import { z } from 'zod';

/** Base path of every endpoint: NestJS `setGlobalPrefix('api')` + URI version `v1`;
 *  Next.js route handlers live under `app/api/v1/`. */
export const API_BASE = '/api/v1';

/** Stable error codes. The client localizes them (`t(`errors.${code}`)`), never `message`. */
export const ErrorCode = z.enum([
  'MALFORMED_REQUEST', // 400 — unparseable JSON
  'INVALID_CURSOR', // 400
  'UNAUTHENTICATED', // 401
  'FORBIDDEN', // 403
  'NOT_FOUND', // 404 — also for resources the caller does not own (no IDOR leak)
  'CONFLICT', // 409
  'IDEMPOTENCY_IN_PROGRESS', // 409
  'VALIDATION_FAILED', // 422 — well-formed but invalid payload
  'IDEMPOTENCY_KEY_REUSED', // 422
  'RATE_LIMITED', // 429 + Retry-After
  'INTERNAL', // 500 — never stack traces or SQL
  // Domain codes go below, UPPER_SNAKE, e.g. 'ORDER_NOT_FOUND' (404), 'PAYMENT_AMOUNT_MISMATCH' (422).
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorDetail = z.object({ path: z.string(), code: z.string() });

/** Every non-2xx response body. */
export const ErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(), // developer-facing English
    details: z.array(ErrorDetail).optional(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;

/** Single-resource success body: `{ data: T }`. */
export const dataEnvelope = <T extends z.ZodType>(item: T) => z.object({ data: item });

/** Cursor-paginated list query: `?limit=20&cursor=…`. Cursors are opaque. */
export const PageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(512).optional(),
});
export type PageQuery = z.infer<typeof PageQuery>;

export const PageInfo = z.object({
  nextCursor: z.string().nullable(), // null on the last page
  limit: z.number().int(),
});

/** List success body: `{ data: T[], page: { nextCursor, limit } }`. */
export const pageEnvelope = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), page: PageInfo });
