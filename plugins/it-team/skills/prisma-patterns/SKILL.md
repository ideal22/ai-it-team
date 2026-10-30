---
name: prisma-patterns
description: Prisma + PostgreSQL patterns and traps for TypeScript backends. Use when writing a Prisma schema, query, transaction, or pagination, or debugging Prisma errors, BigInt money, or connection limits.
---

# Prisma Patterns

Production patterns and non-obvious traps for Prisma ORM on PostgreSQL, strict TypeScript.

## Check your version first

Run the CLI with the lockfile's package manager (yarn by default): `yarn prisma --version`.
The API surface differs a lot between major versions:

| Topic | Older (`prisma-client-js` generator) | Newer (Prisma 6.6+ `prisma-client` generator; default in 7) |
|---|---|---|
| Import path | `import { PrismaClient, Prisma } from '@prisma/client'` | From the generated `output` path, e.g. `'../generated/prisma/client'` |
| `output` in generator | Optional | **Required** |
| Driver adapter | Optional (preview/GA by version) | Required in 7 (e.g. `@prisma/adapter-pg`) |
| Datasource URL | `schema.prisma` `env("DATABASE_URL")` | May live in `prisma.config.ts` |

Relation loading: by default Prisma issues **separate queries per relation**. JOIN-based loading
is opt-in via the `relationJoins` preview feature plus `relationLoadStrategy: 'join'` per query;
its preview/GA status depends on your version — check the release notes before relying on it.

## Schema defaults

```prisma
model Expense {
  id          String    @id @default(uuid(7))   // time-sortable; or cuid(2) if you prefer cuids
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  amountMinor BigInt                             // money: integer minor units, never Float/Decimal
  currency    String    @db.Char(3)
  note        String?
  spentAt     DateTime  @db.Timestamptz(3)
  createdAt   DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime  @updatedAt @db.Timestamptz(3)
  deletedAt   DateTime?

  @@index([userId, spentAt(sort: Desc), id])
}
```

- **IDs:** `cuid()` (v1) and `uuid()` (v4) are **not** time-sortable and v4 fragments B-tree
  inserts. Prefer `uuid(7)` or `cuid(2)`; use `autoincrement()` only for internal tables (it leaks counts).
- **Money:** `BigInt` minor units (or `Int` only if you document a range that fits int4).
  Never `Float` or `Decimal` for amounts.
- `@unique` already creates an index — do not add a duplicate `@@index` on the same column.
- Index every FK and every `WHERE`/`ORDER BY` combination you actually query; order composite
  columns equality-first, then sort/range.
- Use `@db.Timestamptz` so timestamps are stored with zone semantics.

## BigInt trap: JSON serialization

`JSON.stringify` throws `TypeError: Do not know how to serialize a BigInt`. Never monkey-patch
`BigInt.prototype.toJSON`; map explicitly in the response DTO:

```ts
type ExpenseDto = { id: string; amountMinor: string; currency: string; spentAt: string };

function toExpenseDto(e: { id: string; amountMinor: bigint; currency: string; spentAt: Date }): ExpenseDto {
  return { id: e.id, amountMinor: e.amountMinor.toString(), currency: e.currency, spentAt: e.spentAt.toISOString() };
}
```

Parse inbound amounts with Zod (`z.string().regex(/^-?\d+$/).transform((s) => BigInt(s))`) — see
the `it-team:api-design` skill for the shared money schema.

## `select` over `include` on hot paths; never return raw entities

```ts
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, name: true }, // allowlist; passwordHash never leaves the DB layer
});
```

`include` returns every scalar plus the relation — fine for internal use, risky at API boundaries.

## N+1

```ts
// BAD: one query per user
for (const u of await prisma.user.findMany()) {
  await prisma.expense.findMany({ where: { userId: u.id } });
}
// GOOD: one round of queries
const users = await prisma.user.findMany({ include: { expenses: { take: 10 } } });
```

## Transactions

| Situation | Use |
|---|---|
| Independent writes | Array form `prisma.$transaction([a, b])` |
| Later step depends on earlier result | Interactive form, using **only** `tx` |
| Email / HTTP / queue calls | Outside the transaction |

```ts
const expense = await prisma.$transaction(async (tx) => {
  const budget = await tx.budget.findFirstOrThrow({ where: { id: budgetId, userId } });
  return tx.expense.create({ data: { userId, budgetId: budget.id, amountMinor, currency, spentAt } });
});
```

For balance-style invariants use a conditional update (`updateMany` with a guard in `where`, then
check `count`) or `isolationLevel: Prisma.TransactionIsolationLevel.Serializable` with retry on `P2034`.

## PrismaClient singleton

```ts
// src/db/prisma.ts — newer generator + driver adapter
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config/env'; // Zod-validated at boot

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

On the older generator, import from `@prisma/client` and `new PrismaClient()` may need no adapter.
The `globalThis` cache prevents pool duplication on hot reload (Next.js dev, tsx watch).

## Cursor pagination (strict-TS safe)

```ts
async function listExpenses(userId: string, cursor: string | undefined, limit = 20) {
  const items = await prisma.expense.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ spentAt: 'desc' }, { id: 'desc' }], // unique tiebreaker = stable pages
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasNextPage = items.length > limit;
  const page = hasNextPage ? items.slice(0, limit) : items;
  return { items: page, nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null };
}
```

`items[items.length - 1].id` fails under `noUncheckedIndexedAccess`; use `.at(-1)?.id`.

## Error mapping

```ts
import { Prisma } from '../generated/prisma/client'; // or '@prisma/client' on the old generator

function mapPrismaError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') throw new AppError(409, 'RESOURCE_CONFLICT');
    if (e.code === 'P2025') throw new AppError(404, 'RESOURCE_NOT_FOUND');
    if (e.code === 'P2003') throw new AppError(422, 'RELATED_RESOURCE_MISSING');
  }
  throw e;
}
```

Translate at the service boundary into stable error codes (see `it-team:api-design`). Never send raw
Prisma messages to clients — they leak table and constraint names.

## Critical traps

**`updateMany` / `deleteMany` return `{ count }`, not rows.** Select ids first, then update by
`id: { in: ids }`, then re-read if you need the records. On newer versions check for
`updateManyAndReturn` / `createManyAndReturn`.

**`deleteMany()` without `where` wipes the table.** Always pass a `where`; lint for it in review.

**Interactive transactions time out after 5 s** (default `timeout`; `maxWait` 2 s) →
"Transaction already closed". Move external calls out; raise `timeout` only for genuine bulk work.

**`migrate dev` can reset the database.** On drift it offers to reset and drop all data. Use it
only against a local dev DB. Elsewhere use `yarn prisma migrate deploy`. Never run any migrate
command against a non-local database from an agent session; `migrate reset`,
`db push --force-reset`, and `--accept-data-loss` require explicit user confirmation.

**Editing an applied migration** causes checksum mismatch on every environment that ran it.
Add a new migration instead. See `it-team:database-migrations` for expand–contract and concurrent indexes.

**`@updatedAt` and bulk writes.** Whether `@updatedAt` is set on `updateMany` has varied across
versions — verify against yours. Setting `updatedAt: new Date()` explicitly in bulk writes is
harmless and removes the doubt.

**Soft delete + `findUniqueOrThrow` returns deleted rows.** It only checks existence. Adding
`deletedAt: null` to a `findUnique` `where` only type-checks on versions with extended unique
filters; `findFirstOrThrow({ where: { id, deletedAt: null } })` is portable. Filter soft-deleted
rows explicitly rather than via hidden middleware/extensions.

**`$queryRaw` vs `$queryRawUnsafe`.** The tagged template parameterizes values; the `Unsafe`
variant with string interpolation is SQL injection. Dynamic identifiers (sort column) must come
from an allowlist, never from input. See `it-team:appsec-checklist`.

**`_sum` on BigInt** returns `bigint | null` — handle `null` for empty sets (`?? 0n`).

## Serverless connections

Cap the pool per instance (`connection_limit=1` in the URL for the Rust engine, or `max: 1` on the
`pg` adapter pool) and put a transaction-mode pooler (PgBouncer or your provider's) in front.
Use a direct (non-pooled) URL for migrations. Embed params in `DATABASE_URL` rather than
string-concatenating them.

## Checklist

- [ ] Money columns are `BigInt` minor units; DTOs serialize them as strings
- [ ] Responses mapped to DTOs via `select`/mappers; no raw entities
- [ ] Every list query has a unique tiebreaker in `orderBy` and an index that matches it
- [ ] No external I/O inside interactive transactions
- [ ] Prisma errors mapped to stable codes at the service boundary
- [ ] `migrate deploy` in CI; `migrate dev` only locally

<!-- Adapted from everything-claude-code by Affaan Mustafa (MIT License). See ~/.claude/THIRD_PARTY_NOTICES.md -->
