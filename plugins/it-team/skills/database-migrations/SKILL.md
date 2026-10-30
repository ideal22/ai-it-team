---
name: database-migrations
description: Safe PostgreSQL + Prisma migrations - forward-only, expand-contract, concurrent indexes, batched backfills. Use when writing a migration, altering a large table, or planning a zero-downtime deploy.
---

# Database Migrations (PostgreSQL + Prisma)

Safe schema changes for production systems using Prisma Migrate on PostgreSQL.

## Ground rules

1. **Never run migrate/SQL commands against a non-local database from an agent session.**
   Production and staging migrations go through CI/CD (`yarn prisma migrate deploy`).
2. **Destructive commands need explicit user confirmation**, even locally:
   `prisma migrate reset`, `prisma db push --force-reset`, `--accept-data-loss`, `DROP`, `TRUNCATE`.
   Before running anything, confirm the host in `DATABASE_URL` is `localhost`/`127.0.0.1`/a local container.
3. **Production is forward-only.** Prisma has no down migrations. A bad migration is fixed by a
   new, tested **roll-forward** migration — write that plan before deploying risky changes.
4. **Applied migrations are immutable.** Editing one causes a checksum mismatch everywhere it ran.
5. **Schema and data changes are separate migrations/steps.** Long backfills never run inside
   a DDL migration.
6. **Review every generated SQL file.** Prisma may express a rename as `DROP COLUMN` + `ADD COLUMN`.

## Prisma workflow

Use the lockfile's package manager (yarn by default):

```bash
yarn prisma migrate dev --create-only --name add_expense_note   # generate SQL, don't apply
# review / hand-edit prisma/migrations/<timestamp>_add_expense_note/migration.sql
yarn prisma migrate dev                                          # apply locally + generate client
yarn prisma migrate status                                       # pending / failed migrations
yarn prisma migrate deploy                                       # CI/CD only, never migrate dev there
```

- `migrate dev` uses a shadow database and may offer to **reset** on drift — local only.
- A failed deploy leaves the migration marked failed. Fix forward, then mark it with
  `prisma migrate resolve --rolled-back <name>` or `--applied <name>` — a deliberate, reviewed step.

## Pre-merge checklist

- [ ] Generated SQL reviewed; no accidental `DROP`
- [ ] No long `ACCESS EXCLUSIVE` locks on large tables (see table below)
- [ ] New columns are nullable or have a non-volatile default
- [ ] Indexes on existing large tables are built `CONCURRENTLY` in their own migration
- [ ] Backfills batched, outside the DDL migration
- [ ] Old app version still works against the new schema (deploys are not atomic)
- [ ] Roll-forward plan written and tested on a production-sized copy

## Lock-safety reference

| Change | Safe? | Notes |
|---|---|---|
| `ADD COLUMN` nullable | Yes | Metadata only |
| `ADD COLUMN ... NOT NULL DEFAULT <constant>` | Yes (PG11+) | No rewrite for non-volatile defaults |
| `ADD COLUMN ... DEFAULT <volatile>` (e.g. `clock_timestamp()`) | No | Rewrites the table |
| `ADD COLUMN ... NOT NULL` **without** default | **Fails** on a non-empty table | Add nullable → backfill → enforce |
| `ALTER COLUMN ... SET NOT NULL` | Scans under exclusive lock | Use the `CHECK NOT VALID` route below |
| `ALTER COLUMN TYPE` (e.g. `int` → `bigint`) | Usually rewrites | Expand–contract with a new column |
| `ADD FOREIGN KEY` | Scans | Add `NOT VALID`, then `VALIDATE CONSTRAINT` |
| `CREATE INDEX` | Blocks writes | `CREATE INDEX CONCURRENTLY` |
| `DROP COLUMN` | Fast | Only after no deployed code reads it |
| `RENAME COLUMN` | Fast but breaks running code | Expand–contract or Prisma `@map` |

Start risky migrations with `SET lock_timeout = '5s';` so a blocked `ALTER` fails fast instead of
queueing every other query behind it.

## Making an existing column NOT NULL

```sql
-- Migration A (after backfill is complete)
ALTER TABLE "Expense" ADD CONSTRAINT expense_currency_not_null
  CHECK ("currency" IS NOT NULL) NOT VALID;          -- instant
ALTER TABLE "Expense" VALIDATE CONSTRAINT expense_currency_not_null;  -- scans, weaker lock

-- Migration B
ALTER TABLE "Expense" ALTER COLUMN "currency" SET NOT NULL;  -- PG12+ uses the valid CHECK, no scan
ALTER TABLE "Expense" DROP CONSTRAINT expense_currency_not_null;
```

Then update `schema.prisma` to the non-optional type so Prisma sees no drift.

## Concurrent indexes in Prisma

`CREATE INDEX CONCURRENTLY` cannot run in a transaction block, and Prisma sends a migration file's
statements together — so it **must be the only statement in its migration file**.

```prisma
model Expense {
  // keep the index declared so Prisma sees no drift; pin the name with map:
  @@index([userId, spentAt(sort: Desc)], map: "expense_user_id_spent_at_idx")
}
```

```bash
yarn prisma migrate dev --create-only --name expense_user_spent_idx
```

```sql
-- migration.sql: replace the generated CREATE INDEX with exactly one statement
CREATE INDEX CONCURRENTLY IF NOT EXISTS "expense_user_id_spent_at_idx"
  ON "Expense" ("userId", "spentAt" DESC);
```

If a concurrent build fails it leaves an `INVALID` index: `DROP INDEX CONCURRENTLY IF EXISTS ...`
(own migration) and retry. Do not add `@@index` for a column that already has `@unique`.

## Batched backfills (outside migrations)

Run as a one-off script/job after the expand migration is deployed — not in `migration.sql`.

```ts
// scripts/backfill-expense-currency.ts
import { prisma } from '../src/db/prisma';

const BATCH_SIZE = 5_000;

async function main(): Promise<void> {
  for (;;) {
    const updated = await prisma.$executeRaw`
      UPDATE "Expense" SET "currency" = 'UZS'
      WHERE "id" IN (
        SELECT "id" FROM "Expense" WHERE "currency" IS NULL
        LIMIT ${BATCH_SIZE} FOR UPDATE SKIP LOCKED
      )`;
    if (updated === 0) break;
    console.info(`backfilled ${updated} rows`);
  }
}

main().finally(() => prisma.$disconnect());
```

Each batch is its own short transaction; the script is idempotent and safe to re-run.

## Expand–contract (renames, type changes, splits)

Example: rename `amount` (`Int`) to `amountMinor` (`BigInt`).

```
1. EXPAND    migration: add "amountMinor" BIGINT NULL
2. DUAL-WRITE deploy: app writes both columns, still reads the old one
3. BACKFILL  batched script copies amount -> amountMinor
4. ENFORCE   NOT NULL via CHECK NOT VALID / VALIDATE / SET NOT NULL
5. SWITCH    deploy: app reads amountMinor, still writes both
6. CONTRACT  deploy: stop writing amount; next release migration drops it
```

Each step is a separate deploy; every step is compatible with the previous app version.

**Pure renames without touching the DB:** rename the Prisma field and keep the old column via
`@map`. No migration, no downtime (type changes still need expand–contract):

```prisma
description String? @map("note")   // field renamed in code; column stays "note"
```

## Roll-forward plan template

For any migration touching a large or critical table, write in the PR:

- **Failure mode:** what breaks if the migration fails midway or the app misbehaves after it.
- **Detection:** metric/log/alert that tells you.
- **Fix-forward migration:** the SQL you would ship (tested locally against a prod-sized copy).
- **App fallback:** feature flag or previous release that runs against the new schema.
- **Data recovery:** point-in-time restore window and who runs it.

## Anti-patterns

| Anti-pattern | Better |
|---|---|
| Manual SQL in production | Migration files through CI |
| Editing an applied migration | New migration |
| Hand-written "down" scripts assumed safe | Tested roll-forward plan |
| `NOT NULL` column with no default on a live table | Nullable → backfill → enforce |
| `CREATE INDEX` in the same file as other DDL | `CONCURRENTLY`, alone in its file |
| Dropping a column in the same deploy that stops using it | Drop in the following release |
| `Float`/`Decimal` money columns | `BigInt` minor units |

For Postgres types and indexing see `it-team:postgres-patterns`; for Prisma client traps see
`it-team:prisma-patterns`. Ask the `database-reviewer` agent to review risky migrations.

<!-- Adapted from everything-claude-code by Affaan Mustafa (MIT License). See ~/.claude/THIRD_PARTY_NOTICES.md -->
