---
name: appsec-checklist
description: Application security checklist for Node/TS + React apps - validation, authz/IDOR, XSS, CSRF, SSRF, SQLi, secrets, JWT, uploads, headers. Use when building auth, endpoints, payments, or user input.
---

# AppSec Checklist (Node/TypeScript + React)

Concrete checks and patterns for application code. For a full audit, use the `security-reviewer`
agent. API conventions live in `it-team:api-design`; DB access in `it-team:prisma-patterns`.

## 1. Input validation at every trust boundary

Parse — don't just check — all external input with Zod: bodies, query, params, headers, cookies,
webhook payloads, env vars, and data read back from third-party APIs.

```ts
const Body = z.object({ amountMinor: z.string().regex(/^\d{1,18}$/), note: z.string().max(500) }).strict();

const parsed = Body.safeParse(req.body as unknown);
if (!parsed.success) throw validationError(parsed.error); // 422 + stable code, no echo of input
```

- [ ] Allowlists (`z.enum`, regex), not blocklists; `.strict()` against mass assignment
- [ ] Bounded sizes: string `max`, array `max`, body-parser `limit` (e.g. `100kb`)
- [ ] Money as integer minor units; reject floats, negatives where not meaningful, absurd magnitudes

## 2. Authentication and authorization (IDOR)

Scope every query by the authenticated owner — never fetch by id and compare afterwards with a
possibly-null record.

```ts
// BAD: crashes on null (TypeError -> 500) and fetches other users' rows first
const expense = await prisma.expense.findUnique({ where: { id } });
if (expense.userId !== userId) throw new AppError(403, 'FORBIDDEN');

// GOOD: null-safe, ownership in the query, no existence leak
const owned = await prisma.expense.findFirst({ where: { id, userId } });
if (!owned) throw new AppError(404, 'EXPENSE_NOT_FOUND');
```

- [ ] User identity comes from the session/token, never from body/path (`userId` params ignored)
- [ ] Updates/deletes use `where: { id, userId }` (or check `count` from `updateMany`)
- [ ] Admin/role checks on the server for every route; default-deny via a global guard
- [ ] Passwords hashed with argon2id (or bcrypt with cost ≥ 12); constant-time comparisons for tokens
- [ ] Login/OTP/reset responses don't reveal whether an account exists
- [ ] Session rotated on login and privilege change; invalidated on logout and password change

## 3. Sessions, cookies, JWT

```ts
res.cookie('session', sessionId, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',          // default; use 'strict' where the UX allows (no inbound deep links needed)
  path: '/',
  maxAge: 1000 * 60 * 60 * 8,
});
```

- Tokens never in `localStorage`/`sessionStorage` (readable by any XSS).
- Prefix `__Host-` on session cookies when possible (forces `Secure`, `Path=/`, no `Domain`).

```ts
import { jwtVerify } from 'jose';

const { payload } = await jwtVerify(token, secretKey, {
  algorithms: ['HS256'],     // pinned — never accept the header's alg (no 'none', no RS/HS confusion)
  issuer: 'https://api.example.com',
  audience: 'web',
});                           // exp/nbf are enforced; reject tokens without exp
```

- [ ] Short-lived access tokens (5–15 min); refresh tokens rotated and revocable server-side
- [ ] Secrets ≥ 32 random bytes; asymmetric keys if other services verify tokens

## 4. XSS

React escapes text by default; the holes are:

```tsx
// dangerouslySetInnerHTML only with sanitized HTML
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'i', 'p'] }) }} />

// URLs from users: allowlist schemes ("javascript:" executes on click)
function safeHref(raw: string): string | undefined {
  try {
    const url = new URL(raw, window.location.origin);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
```

- [ ] No user data in `href`/`src` without `safeHref`, none in inline `<script>` or `eval`/`new Function`
- [ ] SVG uploads not served inline from the app origin (they can carry script)
- [ ] CSP enabled (section 9)

## 5. CSRF

- Cookie-authenticated, state-changing routes: `SameSite=Lax` cookies **plus** an `Origin` (fallback
  `Referer`) check against an allowlist, or a CSRF token (synchronizer or signed double-submit).
- Never mutate state on `GET`. Bearer-token APIs in an `Authorization` header are not CSRF-prone.
- CORS: explicit origin allowlist; never `*` together with `credentials: true`; don't reflect `Origin`.

## 6. SQL injection

```ts
// NEVER: string interpolation into raw SQL (shown only as the anti-pattern)
await prisma.$queryRawUnsafe(`SELECT * FROM "Expense" WHERE note LIKE '%${search}%'`);

// SAFE: tagged template parameterizes every value
await prisma.$queryRaw`SELECT id FROM "Expense" WHERE "userId" = ${userId} AND note ILIKE ${`%${search}%`}`;

// Dynamic identifiers (sort column) only via allowlist
const SORT_COLUMNS = { spentAt: Prisma.sql`"spentAt"`, amountMinor: Prisma.sql`"amountMinor"` } as const;
```

- [ ] No `Unsafe` raw-query variants with user input; `Prisma.sql` / `Prisma.join` for composition
- [ ] Escape `%` and `_` in user-supplied `LIKE` patterns when they must be literal

## 7. SSRF (server fetching user-supplied URLs: webhooks, link previews, imports)

- [ ] Allowlist hosts where possible; otherwise require `https:` and reject IP literals
- [ ] Resolve DNS and block private, loopback, link-local (incl. `169.254.169.254` metadata),
      and IPv6 equivalents — re-check after every redirect, or disable redirects
- [ ] Timeouts and response-size caps; never return raw upstream bodies/errors to the caller

## 8. File uploads

- [ ] Size limit enforced by the parser (`multer` `limits.fileSize`), not after buffering
- [ ] Type checked by magic bytes (e.g. `file-type`), not the client `Content-Type` or extension
- [ ] Server-generated random filenames; never use the client path (path traversal)
- [ ] Stored outside the web root / in object storage; served with `Content-Disposition: attachment`
      or from a separate domain; images re-encoded to strip metadata
- [ ] Private objects via short-lived signed URLs, authorized per owner

## 9. Security headers and CSP

Use `helmet` (Express/Nest) or `headers()` in `next.config` to send:

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<per-request>'; object-src 'none';
  base-uri 'self'; frame-ancestors 'none'; img-src 'self' data: https:; connect-src 'self' https://api.example.com
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Avoid `'unsafe-inline'`/`'unsafe-eval'`; if forced, record it as debt with a removal plan.

## 10. Rate limiting and abuse

- [ ] Global per-IP limit plus strict limits on login, signup, OTP, password reset, and expensive search
- [ ] Per-account lockout/backoff on repeated auth failures (without enabling account-lock DoS)
- [ ] Shared store (Redis) for multi-instance deployments; 429 + `Retry-After`
- [ ] Idempotency keys on payment/money POSTs (see `it-team:api-design`)

## 11. Secrets

- [ ] No secrets in code, tests, fixtures, or git history; `.env*` gitignored, `.env.example` committed
- [ ] Env validated with Zod at boot; app refuses to start if a secret is missing
- [ ] Nothing secret behind client-exposed prefixes (`NEXT_PUBLIC_`, `VITE_`) — those ship to browsers
- [ ] Production secrets in the platform's secret manager; rotate immediately on suspected leak
- [ ] Secret scanning in CI and as a pre-commit hook

## 12. Logging and errors without PII

```ts
const logger = pino({
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.otp'],
});
logger.info({ userId, expenseId, requestId }, 'expense created'); // ids, not payloads
```

- [ ] No passwords, tokens, OTPs, full card/account numbers, or personal financial details in logs
- [ ] Clients get `{ error: { code, message } }` only — no stack, SQL, or Prisma messages
- [ ] Auth failures, permission denials, and admin actions logged as security events

## 13. Dependencies

Use the lockfile's package manager:

- yarn Berry: `yarn npm audit --all --recursive`; CI install `yarn install --immutable`
- yarn classic: `yarn audit`; CI install `yarn install --frozen-lockfile`
- pnpm: `pnpm audit`; CI install `pnpm i --frozen-lockfile`

- [ ] Lockfile committed and enforced in CI; Dependabot/Renovate enabled
- [ ] New dependencies reviewed (maintenance, install scripts, typosquats) before adding

## 14. Deployment and secrets in CI

- [ ] Database and cache not publicly reachable; TLS in transit; encryption at rest
- [ ] App DB role least-privileged; migrations use a separate role (see `it-team:postgres-patterns`)
- [ ] Least-privilege cloud roles; no long-lived cloud keys in CI — use OIDC federation
- [ ] GitHub Actions: third-party actions pinned to a full commit SHA (or at minimum a major
      version tag), never a moving branch ref; workflow `permissions:` default to `contents: read`
- [ ] Secrets never echoed in CI logs; fork PRs get no secrets
- [ ] Automated backups with point-in-time recovery, restore tested periodically
- [ ] Branch protection + required review before merge

## Security tests to add

- Unauthenticated request → 401; other user's resource → 404 (IDOR)
- Invalid/oversized payload → 422; unknown keys rejected
- Expired JWT, wrong `alg`, wrong `aud` → 401
- Rate limit returns 429 after the threshold
- `javascript:` URL is not rendered as a link

<!-- Adapted from everything-claude-code by Affaan Mustafa (MIT License). See ~/.claude/THIRD_PARTY_NOTICES.md -->
