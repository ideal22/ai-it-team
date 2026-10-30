# API contract: <product>

Source of truth in code:
- `packages/shared/src/http.ts` — base path, envelopes, pagination, error codes (copied from
  `docs/_team/templates/http.ts`; follows the `api-design` skill).
- `packages/shared/src/contracts/*.ts` — request/response schemas per resource (Zod).

This doc is the human-readable index; keep it in sync with the code.
Ownership: system-analyst owns Conventions and the overall shape; backend-engineer adds and
updates the rows of its own story's endpoints (`MODE: contract`).
Adopted projects: the existing convention wins — record it here as found instead of the defaults.

## Conventions (from `http.ts`)
- Base path `/api/v1`, JSON, camelCase keys, ISO 8601 UTC dates, money in integer minor units
  plus currency.
- Success: `{ "data": … }`. Lists: `{ "data": [ … ], "page": { "nextCursor": "…" | null, "limit": 20 } }`
  with `?cursor=&limit=` (max 100).
- Error: `{ "error": { "code": "STABLE_CODE", "message": "…", "details"?: [{ "path", "code" }] } }`
- Auth: <cookie session | bearer>

## Endpoints
### <Resource>
| Method | Path | Auth | Request schema | Response schema | Errors | Story |
|---|---|---|---|---|---|---|
| GET | /items | user | ListItemsQuery | page(Item) | 401, 422 | S-00x |

## Error codes
Full list: `ErrorCode` in `packages/shared/src/http.ts`. Domain codes added by stories:

| Code | HTTP | Meaning | Story |
|---|---|---|---|
| MALFORMED_REQUEST | 400 | Unparseable JSON | |
| VALIDATION_FAILED | 422 | Well-formed but invalid payload | |
| UNAUTHENTICATED | 401 | | |
| FORBIDDEN | 403 | | |
| NOT_FOUND | 404 | Missing or not owned by the caller | |
