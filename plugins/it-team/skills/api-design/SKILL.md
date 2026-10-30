---
name: api-design
description: REST API design for TypeScript backends (Express, NestJS, Next.js route handlers) with shared Zod contracts. Use when designing or reviewing endpoints, error envelopes, pagination, or idempotency.
---

# API Design (TypeScript + Zod)

Conventions for consistent REST APIs whose Zod schemas are shared with the frontend.

## Conventions at a glance

- URLs: plural nouns, kebab-case, base path `/api/v1` (NestJS `setGlobalPrefix('api')` + URI
  version; Next.js `app/api/v1/`): `/api/v1/expenses`, `/api/v1/budget-plans/:id/categories`.
  Verbs only for non-CRUD actions: `POST /api/v1/payments/:id/refund`.
- JSON keys: **camelCase** everywhere (requests, responses, errors, query params).
- Dates: ISO 8601 strings with offset, stored/returned in UTC.
- Money: integer **minor units**, plus a `currency` code. Never floats, never formatted strings.
- IDs: opaque strings (UUIDv7/cuid2). Clients never parse them.
- Success: `{ "data": ... }`. Lists: `{ "data": [...], "page": { "nextCursor", "limit" } }`.
  Errors: `{ "error": { "code", "message", "details"? } }`.
- One file holds these shapes: `packages/shared/src/http.ts` (base path, envelopes, page query,
  `ErrorCode`, `ErrorBody`). it-team projects copy it from the plugin's `team/templates/http.ts`.
  Never declare a second envelope or error list elsewhere.

## Methods and status codes

| Method | Use | Success |
|---|---|---|
| GET | Read; never mutates | 200 |
| POST | Create / action | 201 + `Location` (create), 200/202 (action) |
| PUT | Full replace (idempotent) | 200 |
| PATCH | Partial update | 200 |
| DELETE | Remove (idempotent) | 204 |

| Status | Code examples | When |
|---|---|---|
| 400 | `MALFORMED_REQUEST`, `INVALID_CURSOR` | Unparseable JSON, bad cursor |
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired credentials |
| 403 | `FORBIDDEN` | Authenticated but not allowed (use 404 when existence itself is private) |
| 404 | `EXPENSE_NOT_FOUND` | Missing or not owned by caller |
| 409 | `CONFLICT`, `IDEMPOTENCY_IN_PROGRESS` | Unique violation, state conflict |
| 422 | `VALIDATION_FAILED`, `IDEMPOTENCY_KEY_REUSED` | Well-formed but invalid payload |
| 429 | `RATE_LIMITED` | Include `Retry-After` |
| 500 | `INTERNAL` | Never include stack traces or SQL |

## Shared contract (Zod is the source of truth)

```ts
// packages/shared/src/contracts/expense.ts — imported by server AND frontend
import { z } from 'zod';

export const MoneyMinor = z.string().regex(/^-?\d{1,18}$/); // bigint minor units as a JSON string
export const CurrencyCode = z.string().regex(/^[A-Z]{3}$/);

export const CreateExpenseBody = z
  .object({
    amountMinor: MoneyMinor,
    currency: CurrencyCode,
    categoryId: z.string().min(1),
    note: z.string().max(500).optional(),
    spentAt: z.string().datetime({ offset: true }),
  })
  .strict(); // reject unknown keys (mass-assignment guard)
export type CreateExpenseBody = z.infer<typeof CreateExpenseBody>;

export const Expense = z.object({
  id: z.string(),
  amountMinor: MoneyMinor,
  currency: CurrencyCode,
  categoryId: z.string(),
  note: z.string().nullable(),
  spentAt: z.string(),
  createdAt: z.string(),
});
export type Expense = z.infer<typeof Expense>;

// ErrorCode and ErrorBody belong in packages/shared/src/http.ts; shown here for completeness.
export const ErrorCode = z.enum([
  'MALFORMED_REQUEST', 'VALIDATION_FAILED', 'INVALID_CURSOR', 'UNAUTHENTICATED', 'FORBIDDEN',
  'EXPENSE_NOT_FOUND', 'CONFLICT', 'IDEMPOTENCY_IN_PROGRESS', 'IDEMPOTENCY_KEY_REUSED',
  'RATE_LIMITED', 'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(), // developer-facing English; never shown to end users
    details: z.array(z.object({ path: z.string(), code: z.string() })).optional(),
  }),
});
```

Money as a JSON **string** avoids silent precision loss above `Number.MAX_SAFE_INTEGER`. If you
choose JSON numbers instead, document the range and validate `.int().max(Number.MAX_SAFE_INTEGER)`.
(Zod 4 also offers `z.iso.datetime()` / `z.strictObject()`; the forms above work in 3 and 4.)

## Errors: stable codes, localized on the client

```ts
import type { ZodError } from 'zod';
import type { ErrorCode } from '@acme/shared';

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly details?: ReadonlyArray<{ path: string; code: string }>,
  ) {
    super(code);
  }
}

export function validationError(err: ZodError): AppError {
  return new AppError(
    422,
    'VALIDATION_FAILED',
    err.issues.map((i) => ({ path: i.path.map(String).join('.'), code: i.code })),
  );
}
```

The client renders ``t(`errors.${code}`)`` (and per-field keys from `details[].code`) in RU/UZ/EN;
it never displays `message`. Codes are part of the contract: add new ones, never rename.

## Express (v5 forwards async errors)

```ts
import type { ErrorRequestHandler, Router } from 'express';

export function mountExpenses(router: Router): void {
  router.post('/api/v1/expenses', async (req, res) => {
    const parsed = CreateExpenseBody.safeParse(req.body);
    if (!parsed.success) throw validationError(parsed.error);
    const userId = requireUserId(req); // throws AppError(401) if absent
    const created = await expenseService.create(userId, {
      ...parsed.data,
      amountMinor: BigInt(parsed.data.amountMinor),
    });
    res.status(201).location(`/api/v1/expenses/${created.id}`).json({ data: toExpenseDto(created) });
  });
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  logger.error({ err, requestId: req.get('x-request-id') }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal error' } });
};
```

On Express 4, wrap async handlers (or use `express-async-errors`) so rejections reach the handler.

## Next.js App Router route handler

```ts
// app/api/v1/expenses/route.ts
export async function POST(req: Request): Promise<Response> {
  const body: unknown = await req.json().catch(() => undefined);
  if (body === undefined) return errorResponse(new AppError(400, 'MALFORMED_REQUEST'));
  const parsed = CreateExpenseBody.safeParse(body);
  if (!parsed.success) return errorResponse(validationError(parsed.error));
  const userId = await requireSessionUserId(); // from the HttpOnly session cookie
  const created = await expenseService.create(userId, {
    ...parsed.data,
    amountMinor: BigInt(parsed.data.amountMinor),
  });
  return Response.json({ data: toExpenseDto(created) }, {
    status: 201,
    headers: { Location: `/api/v1/expenses/${created.id}` },
  });
}
```

For NestJS, use a Zod validation pipe and a global exception filter — see `it-team:nestjs-patterns`.

## Cursor pagination (default for lists)

```
GET /api/v1/expenses?limit=20&cursor=eyJzcGVudEF0Ijoi...
200 { "data": [...], "page": { "nextCursor": "eyJ...", "limit": 20 } }
```

```ts
const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(512).optional(),
});

const CursorPayload = z.object({ spentAt: z.string(), id: z.string() });
type CursorPayload = z.infer<typeof CursorPayload>;

export const encodeCursor = (c: CursorPayload): string =>
  Buffer.from(JSON.stringify(c)).toString('base64url');

export function decodeCursor(raw: string): CursorPayload {
  try {
    return CursorPayload.parse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
  } catch {
    throw new AppError(400, 'INVALID_CURSOR');
  }
}
```

Cursors are opaque, encode the full sort key plus a unique tiebreaker, and are always
re-validated. Offset pagination only for small admin tables that need "jump to page N".
DB side: keyset query in `it-team:postgres-patterns`, Prisma version in `it-team:prisma-patterns`.

## Filtering and sorting

- Filters are explicit, schema-validated params: `?categoryId=...&from=2026-01-01&to=2026-01-31`.
- Sort via an allowlisted enum: `sort: z.enum(['spentAt', '-spentAt', 'amountMinor', '-amountMinor'])`.
  Never pass a user-supplied column name to SQL.

## Idempotency keys (required for payments and money movements)

Clients send `Idempotency-Key: <uuid>` on POSTs that create charges, transfers, or balances.

```prisma
model IdempotencyKey {
  userId       String
  key          String
  requestHash  String   // sha256 of method + path + canonical body
  status       String   // 'in_progress' | 'completed'
  responseCode Int?
  responseBody Json?
  createdAt    DateTime @default(now())

  @@id([userId, key])
}
```

Flow: insert the row (`in_progress`) first — a unique violation means the key exists. Existing +
same hash + `completed` → replay the stored status and body. Existing + `in_progress` → 409
`IDEMPOTENCY_IN_PROGRESS`. Existing + different hash → 422 `IDEMPOTENCY_KEY_REUSED`. On success,
store the response in the same transaction as the business write. Expire keys after 24–72 h.

## Rate limiting

Return `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (e.g. `express-rate-limit`
with `standardHeaders`) and `Retry-After` on 429. Limit per user when authenticated, per IP
otherwise; much tighter on auth, OTP, and password-reset endpoints. Use a shared store (Redis)
when running more than one instance.

## Versioning

Path versioning (`/api/v1`). Additive changes (new optional fields, new endpoints, new error codes)
are non-breaking; removing/renaming fields or changing types requires `/v2`. Announce deprecations
with `Deprecation` and `Sunset` headers before removal.

## Endpoint checklist

- [ ] Request **and** response schemas defined in the shared Zod contract
- [ ] Unknown keys rejected; query params coerced and bounded
- [ ] Authn required (or explicitly public); authz scopes every query by owner
- [ ] Errors use the envelope with a stable `code`; client has i18n keys for each code
- [ ] Money as minor units + currency; dates ISO 8601 UTC; keys camelCase
- [ ] Lists use cursor pagination with a max `limit`
- [ ] Payment/money POSTs require `Idempotency-Key`
- [ ] Rate limited; no internals (stack, SQL, Prisma messages) leak
- [ ] OpenAPI generated from the Zod schemas (e.g. `zod-openapi`) is up to date

Security review of endpoints: `it-team:appsec-checklist` skill or the `security-reviewer` agent.

<!-- Adapted from everything-claude-code by Affaan Mustafa (MIT License). See ~/.claude/THIRD_PARTY_NOTICES.md -->
