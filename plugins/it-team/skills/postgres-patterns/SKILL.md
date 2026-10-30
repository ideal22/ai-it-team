---
name: postgres-patterns
description: PostgreSQL schema, data type, indexing, and query-tuning patterns. Use when designing tables or indexes, choosing column types (incl. money), or diagnosing a slow query in Postgres.
---

# PostgreSQL Patterns

Quick reference for PostgreSQL design and tuning. For a full review, use the `database-reviewer`
agent. For Prisma specifics see `it-team:prisma-patterns`; for safe schema changes see `it-team:database-migrations`.

> Safety: run diagnostic queries only against local or explicitly approved databases.
> `EXPLAIN ANALYZE` **executes** the statement — wrap writes in `BEGIN; ... ROLLBACK;`.

## Data types

| Use case | Use | Avoid |
|---|---|---|
| Internal IDs | `bigint GENERATED ALWAYS AS IDENTITY` | `serial`, `int` (overflow) |
| Public IDs | UUIDv7 (`uuidv7()` on PG18+, else generate in app) | UUIDv4 on hot-insert tables |
| Money | `bigint` minor units + `currency char(3)` | `float`, `real`, `numeric`/`decimal` for amounts |
| Text | `text` + `CHECK (length(col) <= n)` if needed | `varchar(255)` by habit |
| Timestamps | `timestamptz` | `timestamp` (no zone) |
| Flags | `boolean` | `int`, `'Y'/'N'` |
| Enums that evolve | lookup table or `text` + `CHECK` | native `enum` if values get removed |
| Semi-structured | `jsonb` | `json`, JSON in `text` |

Money rules:

```sql
CREATE TABLE expense (
  id            uuid PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES app_user(id),
  amount_minor  bigint NOT NULL CHECK (amount_minor > 0),  -- e.g. 12 500.00 UZS -> 1250000 (exponent 2)
  currency      char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  spent_at      timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

- Store the currency exponent (minor units per major unit) in app config, not per row.
- **Trap:** `sum(bigint)` returns `numeric`. Cast back explicitly: `sum(amount_minor)::bigint`
  (overflow is only possible beyond ~9.2e18 minor units). `avg()` returns `numeric` too — round to
  an integer in the query or in the app's money helper; never keep a fractional amount.
- Do not mix currencies in one `sum`; group by `currency`.

## Index cheat sheet

| Query pattern | Index |
|---|---|
| `WHERE a = ?` / range on `a` | B-tree `(a)` |
| `WHERE a = ? AND b > ?` | Composite `(a, b)` — equality first, then range |
| `WHERE a = ? ORDER BY b DESC, id DESC` | `(a, b DESC, id DESC)` — serves filter + sort |
| `WHERE jsonb_col @> '{...}'` | GIN `(jsonb_col)` |
| Full-text `tsv @@ q` | GIN `(tsv)` |
| Huge append-only time series | BRIN `(created_at)` |
| Only "active" rows | Partial: `... WHERE deleted_at IS NULL` |
| Index-only scans | Covering: `(email) INCLUDE (name)` |
| Case-insensitive lookup | Expression: `(lower(email))` and query `lower(email) = ...` |

- Every foreign key column needs an index (Postgres does not create one) — otherwise deletes on
  the parent seq-scan the child.
- A `UNIQUE` constraint already creates an index; do not duplicate it.
- Each index slows writes and costs memory: drop unused ones (see `pg_stat_user_indexes`).
- On existing large tables, create indexes `CONCURRENTLY` (see `it-team:database-migrations`).

## Query patterns

**Keyset (cursor) pagination** — stable and O(log n) at any depth, unlike `OFFSET`:

```sql
SELECT id, amount_minor, spent_at
FROM expense
WHERE user_id = :userId
  AND (spent_at, id) < (:cursorSpentAt, :cursorId)   -- row-value comparison
ORDER BY spent_at DESC, id DESC
LIMIT 21;                                            -- page size + 1 to detect next page
```

**Upsert:**

```sql
INSERT INTO user_setting (user_id, key, value)
VALUES (:userId, 'theme', 'dark')
ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value;
```

**Queue claim without contention:**

```sql
UPDATE job SET status = 'processing', locked_at = now()
WHERE id = (
  SELECT id FROM job WHERE status = 'pending'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING id;
```

**Guarded update for invariants** (no read-modify-write race):

```sql
UPDATE wallet SET balance_minor = balance_minor - :amount
WHERE id = :walletId AND balance_minor >= :amount
RETURNING balance_minor;   -- zero rows => insufficient funds
```

## Diagnosing slow queries

1. `EXPLAIN (ANALYZE, BUFFERS)` the exact query with realistic parameters.
2. Look for `Seq Scan` on large tables, row-estimate vs actual mismatches (run `ANALYZE`),
   `Sort` spilling to disk (`external merge`), and nested loops over large outer sets.
3. Check `pg_stat_statements` for the real top offenders by `total_exec_time`, not just mean.

```sql
-- Unindexed foreign keys
SELECT c.conrelid::regclass AS table_name, a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND a.attnum = ANY (i.indkey)
  );

-- Top queries by total time (requires pg_stat_statements)
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;

-- Unused indexes
SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes WHERE idx_scan = 0 ORDER BY relname;

-- Dead tuples / vacuum health
SELECT relname, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 20;
```

## Configuration notes

```sql
-- Per-role timeouts are safer than global ones (migrations may need longer)
ALTER ROLE app_user SET statement_timeout = '15s';
ALTER ROLE app_user SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE app_user SET lock_timeout = '5s';

ALTER SYSTEM SET work_mem = '16MB';   -- per sort/hash node, per connection: keep modest
SELECT pg_reload_conf();              -- applies reloadable settings like work_mem
```

- `max_connections` and `shared_preload_libraries` (needed for `pg_stat_statements`) require a
  **server restart**, not `pg_reload_conf()`. Prefer a pooler over raising `max_connections`.
- PostgreSQL 15+ already revokes `CREATE` on schema `public` from `PUBLIC`. On older versions run
  `REVOKE CREATE ON SCHEMA public FROM PUBLIC;` (keep `USAGE`).
- The app role should own nothing it does not need: no superuser, no `CREATEDB`; migrations run
  with a separate, more privileged role.

## Row-level security (optional defense in depth)

Primary authorization stays in the app (scope every query by owner). If you add RLS, set the
user per transaction and reference it via `current_setting`, wrapped in a sub-select so it is
evaluated once:

```sql
ALTER TABLE expense ENABLE ROW LEVEL SECURITY;
CREATE POLICY expense_owner ON expense
  USING (user_id = (SELECT current_setting('app.user_id', true)::uuid));
-- per request, inside the transaction: SELECT set_config('app.user_id', :userId, true);
```

RLS does not apply to table owners or roles with `BYPASSRLS` — the app must connect as a
non-owner role.

## Checklist

- [ ] Money is `bigint` minor units with a currency column; sums cast back to `bigint`
- [ ] All FKs indexed; no duplicate indexes on unique columns
- [ ] List queries use keyset pagination with a unique tiebreaker
- [ ] `timestamptz` everywhere; no `timestamp`
- [ ] Timeouts set per role; pooler in front of the app

<!-- Adapted from everything-claude-code by Affaan Mustafa (MIT License). See ~/.claude/THIRD_PARTY_NOTICES.md -->
