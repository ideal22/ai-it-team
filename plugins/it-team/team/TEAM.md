# AI IT team — conventions

Shipped by the `it-team` plugin (repo `ai-it-team`). `/it-team:kickoff` copies this folder into
each project as `docs/_team/` with the kit version in `docs/_team/VERSION`, so roles read
templates from there. Agents and skills always come from the installed plugin, so
`/it-team:sprint` and `/it-team:run` refresh an older copy and apply **Kit upgrades** (end of
this file).

- Orchestration skills: `/it-team:kickoff` (new project), `/it-team:adopt` (existing project),
  `/it-team:run` (hands-off build loop), `/it-team:sprint` (the same story pipeline,
  interactive), `/it-team:team-status`, `/it-team:release`, `/it-team:retro` (report from the run
  journal).
- **Run state:** `docs/run/STATE.md` (template `state.md`) — phase, gates, consents, current story
  and stage, decision inbox, deferred stories, expected inputs. Only the orchestrator writes it;
  every skill reads it first and resumes from it.
- **Branches:** the scaffold (or adopt) commit, then one integration branch `release/vX`; stories
  are committed there under the owner's per-epic consent. Unfinished work that hit the fix-round
  budget is parked on `wip/s-xxx`. Only the owner merges, pushes, and deploys.
- **Role results:** each role returns at most 20 lines plus file paths; details live in the files.
- **Models:** roles default to the `model:` in their agent file (engineers, BA, PM, research,
  QA, devops, tech writer, data: sonnet; system-analyst, designer, design-reviewer: opus). The
  orchestrator passes `model: opus` to backend/frontend for stories with `risk: high`. Reviewers
  in the verify step: code, react, a11y on sonnet; security and database on opus.
- Reference skill: `it-team:uz-integrations` — Payme, Click, Uzum, SMS/OTP, maps, UZS, ru/uz
  locales, and personal-data hosting rules for Uzbekistan projects. system-analyst,
  backend-engineer, frontend-engineer, and devops-engineer load it when the brief's target market
  is Uzbekistan.
- Role agents: market-researcher, business-analyst, product-manager, system-analyst,
  ux-ui-designer, data-analyst, backend-engineer, frontend-engineer, qa-engineer,
  devops-engineer, tech-writer, design-reviewer (read-only). Launch them as `it-team:<role>`.
  The first line of every role prompt is `MODE: <name>` (modes are listed in each agent file);
  a missing or unknown mode returns `BLOCKED: mode`.
- `CHARTER.md` — what the team optimizes, the quality bar, targets, and the nine rules every
  role follows; the project `CLAUDE.md` → Team section carries the rules
  (`templates/claude-team.md`), so agent files do not repeat them.
- `design-taste.md` — default design taste profile. The live, cross-project copy is
  `~/.claude/it-team/design-taste.md`; the designer and design-reviewer read it every time.
- `templates/` — document templates. Agents copy the structure, never the placeholder text.
  Exception: `templates/http.ts` is copied verbatim to `packages/shared/src/http.ts` at scaffold —
  the project's one HTTP convention (base path, envelopes, pagination, error codes), following
  the `it-team:api-design` skill.
- Project docs live in `<repo>/docs/` (layout below). Documents are the ONLY hand-off channel
  between roles: if it is not written down, the next role does not know it.

```
docs/
  00-brief.md
  discovery/market.md
  product/prd.md, metrics.md
  run/STATE.md
  architecture/architecture.md, api-contract.md, adr/NNN-*.md (incl. NNN-dependencies.md)
  design/design-system.md, flows.md, screens/*.md, prototype/index.html,
         provided/ (brief `Design source: provided`: the owner's or client's finished design),
         screens.md (provided design: the screen inventory every role reads instead of provided/)
  backlog/BOARD.md, trace.md, polish.md, epics/E01-*.md, stories/S-001-*.md
  qa/test-plan.md, bugs/B-001-*.md
  release/checklist.md, allow-list.json
  client/ (client projects) gate-a-*.md, gate-b-*.md, approvals.md, inputs.md,
          project-plan.md, change-requests/CR-NNN.md, demo-<epic>.md, release-<version>.md
```

## Stack defaults (the project's architecture.md and ADRs win)

| Surface / concern | Default |
|---|---|
| Public web with SEO/SSR (landing, catalog, content) | Next.js App Router |
| Admin panel, dashboard, internal tool | Vite + React SPA + React Router (data routers) + TanStack Query |
| Telegram Mini App | Vite + React SPA + `@tma.js/sdk-react` (theme params, viewport, BackButton/MainButton); optionally `@telegram-apps/telegram-ui` |
| Telegram bot | grammY inside the NestJS backend (or `apps/bot` when it scales separately): webhook in prod with a secret token, long polling in dev, `conversations` plugin, sessions in Postgres/Redis |
| API | NestJS + Prisma + PostgreSQL (local via docker-compose), REST, Zod contracts in `packages/shared` → Nest validation pipe, OpenAPI from the same schemas |
| Repo | yarn workspaces monorepo: `apps/*`, `packages/shared`, `prisma/`, `e2e/`, `docs/` |
| Language | TypeScript `strict`, `noUncheckedIndexedAccess`; no `any`, no suppressions |
| HTTP convention | `packages/shared/src/http.ts` (copied from `templates/http.ts` at scaffold): base `/api/v1`, `{ data }`, lists `{ data, page: { nextCursor, limit } }`, errors `{ error: { code, message, details? } }`, 422 `VALIDATION_FAILED`, 400 `MALFORMED_REQUEST` |
| Auth — web | httpOnly, `Secure`, `SameSite` cookie sessions stored in Postgres (library or own — per ADR) |
| Auth — Mini App | server-side `initData` validation with the bot token (`@tma.js/init-data-node`), reject stale `auth_date`, upsert the user by Telegram id, then the project's session/bearer token |
| Auth — bot | Telegram user id from the update → our `User`, roles in our DB; one `User` can link several identities |
| Server state / client state / forms | TanStack Query v5 (query-key factories, `queryOptions()`); Zustand for shared UI state only, `useState` local, URL for filters; React Hook Form + `zodResolver` with schemas from `packages/shared` |
| Styling | Tailwind + shadcn/ui (Radix); tokens from `docs/design/design-system.md`; FSD layers `app → pages → widgets → features → entities → shared`, imports downward through each slice's `index.ts` |
| i18n | next-intl / i18next when the project has locales (ru/uz/en typical) |
| Background jobs | BullMQ + Redis only when a story needs it (broadcasts, schedules, retries) |
| Config / logging / security | `@nestjs/config` + Zod-validated env (`.env.example` names only); pino structured logs without PII or tokens; helmet, CORS allow-list, `@nestjs/throttler` |
| Tests | Vitest + React Testing Library + MSW v2 (frontend); Vitest or Jest + Supertest against a real test Postgres (API); Playwright (QA) |
| Hosting | per project in an ADR: Vercel for Next.js; Railway / Fly.io / VPS + Docker for API, bot, DB; Uzbekistan data-residency projects on an in-country provider |

## Doc budget (by the brief's Track)
Docs are for the next role, not for reading pleasure. Tables and bullets, no intros, no
restating another doc — link to it. The owner reads only the gate summary (≤ 1 screen).
A role that needs more words than the cap says so in its result instead of exceeding it.

| Doc | `lite` (landing, simple bot) | `standard` |
|---|---|---|
| `00-brief.md` | yes | yes |
| `discovery/market.md` | — (only on request) | ≤ 1200 words |
| `product/prd.md` | ≤ 800 words, features with AC inline | ≤ 2500 words |
| `product/metrics.md` | — (events listed in the PRD) | ≤ 600 words |
| `architecture/architecture.md` | ≤ 600 words, incl. hosting, env names, dependency list | ≤ 1500 words |
| `architecture/adr/*.md` | — (decisions live in architecture.md) | ≤ 300 words each; platform, auth, hosting, dependencies, + real trade-offs only |
| `architecture/api-contract.md` | — if ≤ 3 endpoints (contract in code) | table rows only |
| `design/moodboard.md` + `directions.md` | one file `directions.md` ≤ 800 words | ≤ 600 words each |
| `design/design-system.md` | ≤ 1000 words | ≤ 1500 words |
| `design/flows.md`, `design/screens/*.md` | — (states live in the prototype's state switcher) | flows ≤ 600; screen spec ≤ 300 each |
| `design/screens.md` (provided design only) | ≤ 800 words | ≤ 2500 words, tables and exact strings |
| `backlog/` | `BOARD.md`, epic ≤ 100 words, story files ≤ 150 words (AC + tasks) | epic ≤ 200, story ≤ 250 words; the story's `## Context pack` (≤ 60 lines) is outside this cap |
| `backlog/trace.md`, `client/project-plan.md` | — (project plan only for client projects) | tables only |
| `qa/test-plan.md` | ≤ 200 words: the 3–5 critical journeys | ≤ 600 words |
| `qa/pitfalls.md` | ≤ 20 classes, one line each | ≤ 20 classes, one line each |
| `release/checklist.md` | ≤ 300 words | ≤ 600 words |

## Test budget
Test what can break, once, at the cheapest level:
- **Unit** — logic: validation schemas, money/phone/text helpers, sanitizers, state machines,
  hooks with logic, services. Always.
- **Component (RTL)** — interactive components with behavior (forms, filters, cart). Not purely
  presentational sections; no snapshot tests.
- **API (Supertest)** — every endpoint: happy path, validation (422), auth (401/403/404), and
  idempotency where money or webhooks are involved.
- **E2E (Playwright)** — only the critical journeys listed in `qa/test-plan.md`: `lite` 3–5 per
  project (e.g. submit the lead form, error path, language switch, 404); `standard` one per key
  journey plus every payment flow. Screenshots and traces go to `test-results/`, never into
  tracked folders.
- **Regression pack** (web UI, `e2e/regression/`, QA) — known bug classes from
  `qa/pitfalls.md` checked on sample routes in under 90 s; the orchestrator runs it before every
  review. Outside the E2E journey count.

## Command hygiene (all roles and the orchestrator)
- Edit docs and code with the Edit/Write tools; never with `python3 -`, heredocs, or `sed -i`.
- Never start, stop, or kill servers you did not start; the orchestrator owns the dev server.
- Stay inside the project root and the session scratchpad: no `find /`, `find ~`, or reads in
  the owner's home folders — on macOS every protected folder (Downloads, Documents, Desktop, …)
  raises an access prompt for the owner. Save screenshots by absolute path under
  `test-results/` instead of searching for them.
- Never run package installs (`yarn add` and friends): a dependency outside the ADR is an inbox
  item.
- No `rm`: cleanup goes through project scripts or Playwright's `outputDir`; a file that must go
  is an inbox item for the owner.

## Lint gates (projects with a TypeScript frontend)
Rules that prompts and reviewers miss go into lint, so the orchestrator's cheap checks catch them.
The scaffold (kickoff) and E00 Hardening (adopt) add this block to the ESLint flat config, after
the presets that register `@typescript-eslint` (`eslint-config-next/typescript`,
`tseslint.configs.*`); merge it into an existing `no-restricted-syntax` rule instead of replacing it:

```js
// Lint gates (docs/_team/TEAM.md): deprecated APIs, TypeScript gaps strict mode leaves, hand-written page containers.
{
  files: ['**/*.{ts,tsx}'],
  languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  rules: {
    '@typescript-eslint/no-deprecated': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': 'error', // a new union member (state, status) is handled everywhere
    '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' }], // types come from Zod, not `{…} as T`
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/no-floating-promises': 'error', // `void` marks a promise deliberately not awaited
    'no-restricted-syntax': ['error', {
      selector: 'Literal[value=/\\bmx-auto\\b.*\\bmax-w-\\[|\\bmax-w-\\[.*\\bmx-auto\\b/], TemplateElement[value.raw=/\\bmx-auto\\b.*\\bmax-w-\\[|\\bmax-w-\\[.*\\bmx-auto\\b/]',
      message: 'Page containers come from <Container> in shared/ui (design-system.md → Layout primitives).',
    }, {
      selector: 'Literal[value=/-\\[-?[0-9.]+(px|rem|em|%)?\\]/], TemplateElement[value.raw=/-\\[-?[0-9.]+(px|rem|em|%)?\\]/]',
      message: 'No arbitrary values (p-[22px], text-[13px]): use a token, or ask the designer (it-team:frontend-code § 6).',
    }],
    'react/no-multi-comp': 'error', // one component per file (it-team:frontend-code § 1)
  },
},
{ files: ['**/shared/ui/**'], rules: { 'no-restricted-syntax': 'off', 'react/no-multi-comp': 'off' } },
// Test fixtures may build partial objects with `as` and small wrapper components.
{ files: ['**/*.test.{ts,tsx}'], rules: { '@typescript-eslint/consistent-type-assertions': 'off', 'react/no-multi-comp': 'off' } },
```
`react/no-multi-comp` comes from `eslint-plugin-react`, which `eslint-config-next` registers; a
Vite scaffold adds it as a dev dependency (`react.configs.flat.recommended`), an adopted Vite
project gets it as an inbox item (a dependency) and keeps the rest of the block meanwhile.
Adopted projects: when the TypeScript rules flag existing code, E00 Hardening fixes it; until
that story is done they run as `warn` — never `off`, never an `eslint-disable`. A CSS variable in
`style` is typed, not asserted: `const style: CSSProperties & Record<'--width', string> = { … }`.

## Run journal (when STATE.md says `Journal: on`)
`docs/run/journal.md` (template `journal.md`) records where the run needed the owner, stalled, or
wasted rounds, so `/it-team:retro` can report it. The orchestrator appends **one row per event**
with one command and **never reads the file during a run**:

```bash
printf '| %s | %s | %s | %s |\n' "$(date '+%Y-%m-%d %H:%M')" "<event>" "<ref>" "<detail ≤ 120 chars, no secrets>" >> docs/run/journal.md
```

| Event | When | Ref |
|---|---|---|
| `touch` | you ask the owner anything or the owner answers (gate, question, consent); detail = why | gate / S-xxx / D-xx |
| `story-start`, `story-done` | a story enters the pipeline / is committed (detail: commit hash, fix rounds used) | S-xxx |
| `pack-gap` | a role's return lists a context-pack gap (detail: role — what was missing) | S-xxx |
| `round` | a fix round starts (detail: source qa / design / code, n/2) | S-xxx |
| `blocked` | a role returns Blocked, or a story becomes `blocked` (detail: reason) | S-xxx |
| `inbox` | an inbox item is added (detail: question) | D-xx |
| `mode-error` | a role answered `BLOCKED: mode` or returned the wrong kind of output | role |
| `env-fail` | dev server, DB, ports, or tooling failed (detail: what) | S-xxx |
| `rerun` | a role had to be re-run because its output was wrong or incomplete | role |
| `stop` | the run or a phase stops (detail: epic gate / hard risk / scope / empty queue / hand-over) | phase |
| `permission` | written by the plugin hook when Claude Code asks the owner for a permission | tool |

## Ownership (write scope)

| Path | Owner |
|---|---|
| docs/00-brief.md | user (orchestrator records it) |
| docs/discovery/ | market-researcher |
| docs/product/prd.md | business-analyst |
| docs/product/metrics.md | data-analyst |
| docs/architecture/, packages/shared contract | system-analyst |
| api-contract.md rows of a story's endpoints, `packages/shared/src/contracts/` for that story, new codes in `http.ts` | backend-engineer (`MODE: contract`) |
| docs/design/ | ux-ui-designer (`refs/` and `brand/` are provided by the owner / client) |
| docs/run/STATE.md | orchestrator |
| docs/client/ (gate packs, approvals, inputs, change requests, demos) | orchestrator |
| docs/client/project-plan.md | product-manager |
| docs/backlog/ (incl. trace.md) | product-manager (status fields, polish.md, and a story pack's `(live)` line, `Stale`, and *Pack gaps*: orchestrator) |
| apps/api, apps/bot (Telegram bot), prisma/ | backend-engineer |
| apps/web, apps/admin, apps/tma (Telegram Mini App) | frontend-engineer |
| docs/qa/, e2e/ | qa-engineer |
| CI, Docker, deploy config, `.gitignore`, docs/release/ (incl. allow-list proposal) | devops-engineer |
| `.claude/settings.local.json` | owner (orchestrator installs devops' proposal on the owner's yes) |
| `scripts/` (probe scripts copied at kickoff) | orchestrator (kit upgrades only) |
| `test-results/` (probe JSON, screenshots; never tracked) | any role, for its own runs |
| README.md, CHANGELOG.md, docs/guides/ | tech-writer |

In an adopted project the folders differ: the project `CLAUDE.md` Team section has a **path map**
(role → real folders) that overrides the defaults above.

A role that needs a change in someone else's file writes it under **Open questions / requests**
at the end of its own document; the orchestrator routes it.

## Scope
The team builds only: landing pages, web apps, admin panels, Telegram bots, Telegram Mini Apps
(any combination of these). Anything else — CRM/1C/ERP integrations, takeover of third-party
abandoned projects, native mobile, ML/data platforms, enterprise integrations — is out of scope.
A feature that needs one of these goes to the PRD's out-of-scope list, not into the backlog.

## Language
- **Client-facing docs** — market research, PRD, design docs and copy, gate packs, release notes,
  user guide — in the brief's **client language** (own projects: the brief's language).
- **Technical docs** — architecture, ADRs, API contract, backlog, QA, release checklist — in English.
- Code, identifiers, commit messages, and file names: English.

## Client vs own projects
The brief's `Type` decides.

**Design source priority**
| Priority | Client project | Own project |
|---|---|---|
| 1 | Client brand assets `docs/design/brand/` (hard constraints) | Project refs `docs/design/refs/` + brief links (this project's explicit choice) |
| 2 | Client references `docs/design/refs/` + brief | Owner's taste profile `~/.claude/it-team/design-taste.md` (full) |
| 3 | Client taste log `docs/design/client-taste.md` | Owner's library `~/.claude/it-team/refs/` |
| 4 | Owner's taste profile — **only** "Banned defaults" and "Required in every project" (quality bar) | — |

Explicit references in the brief beat the taste profile's banned defaults: whatever they show is
allowed for that project. The brief's **Positioning** line must be visible in every direction.

**Provided design** (brief `Design source: provided`): `docs/design/provided/` is the top source,
above everything in this table — no directions, no restyling. The designer extracts the design
system and adds only missing screens in the same style (`MODE: provided`); the design reviewer
checks fidelity against it.

**Gates on client projects:** Client Gate A (PRD + design direction) and Client Gate B (full
design + plan + estimate); Track `lite` has only Gate A. The orchestrator writes a client-facing
gate pack `docs/client/gate-<a|b>-<name>.md` (template `gate-pack.md`, with a recommendation and a
default answer), the owner shares it and relays the answer, and every decision goes to
`docs/client/approvals.md`. The architecture is the owner's call. After Gate B, scope changes go
through a change request (`change-request.md`). Story commits stay with the owner (consent per
epic); the client sees a staging demo per epic and runs UAT before launch.

**Tracks** (brief `Track`): `lite` — landing page or simple bot: short PRD, one client gate,
3–6 stories, market research only on request. `standard` — everything else.

**Learnings:** design feedback on client projects goes to the project's
`docs/design/client-taste.md` — never into the owner's profile. Owner's own projects append to
`~/.claude/it-team/design-taste.md`.

**Confidentiality:** client names, data, and assets never leave the project folder (not in
global files, not in public pages). Artifacts stay private; the owner decides what to share.

## Kit upgrades (projects started on an older kit)
At the start of a sprint or run, between stories only: if `docs/_team/VERSION` is missing (=
0.12.0 or older) or older than `version` in `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`,
copy `${CLAUDE_PLUGIN_ROOT}/team/` over `docs/_team/`, write the plugin version to
`docs/_team/VERSION`, and run the steps below for every version above the old one. Tell the owner
in one line; a step that needs the owner goes into the same message as the run's preflight.

| Version | Steps for an existing project |
|---|---|
| 0.13.0 | 1. Provided design without `docs/design/screens.md` → `it-team:ux-ui-designer` `MODE: provided`, `inventory only`. 2. TypeScript frontend without `<Container>`/Layout primitives in `shared/ui`, the dev gallery, or the Lint gates → `it-team:product-manager` `MODE: groom` adds one upgrade story (primitives, gallery, lint gates, fix what they flag) that runs before the next UI story. 3. `it-team:product-manager` `MODE: groom` checks the next epic's `ready` stories against `screens.md`. 4. Inbox items whose default accepted a visible deviation from the provided design → ask the owner again. 5. Owner's yes → add the new `deny` rules of `templates/claude-settings.local.json` to `.claude/settings.local.json`. |
| 0.14.0 | Owner's yes → add the new `allow` rules of `templates/claude-settings.local.json` (`npx vitest related`, the localhost route warm-up `curl`) to `.claude/settings.local.json`. |
| 0.15.0 | Before the next UI story: `it-team:qa-engineer` `MODE: regression` with the dev server URL — seeds `docs/qa/pitfalls.md` from the existing bugs and polish and builds `e2e/regression/` for the shipped routes. Its classes with Guard `—` and 2+ bugs go to the next epic gate as clusters. |
| 0.16.0 | 1. Owner's yes → merge the new `allow` rules of `templates/claude-settings.local.json` (`cd *`, `sed -n *`, `printf * >> docs/run/journal.md`, the three `node scripts/<probe>.mjs *`) and its new `deny` rules (`sed -i*` and variants) into `.claude/settings.local.json`. 2. Copy the probe scripts `measure.mjs`, `tokens-from-css.mjs`, `tokens-lint.mjs` from `docs/_team/templates/scripts/` to `scripts/` if the project has none; run `node scripts/tokens-lint.mjs <globals.css>` once and put its FAIL lines into the inbox. 3. Before the next UI story: `it-team:qa-engineer` `MODE: regression` extends `e2e/regression/` with the probe checks (overflow, one-line rows, mid-word, rings). |
| 0.17.0 | 1. Owner's yes, diff shown → replace the project `CLAUDE.md` Team section with the block of `templates/claude-team.md` (keep the path map; the system analyst fills glossary and architecture map on its next run, or the orchestrator from `architecture.md`). 2. Owner's yes → merge the allow rule `Bash(node docs/_team/templates/scripts/extract-provided.mjs *)`. 3. Merge the four new `@typescript-eslint` rules of Lint gates into the ESLint config (adopted projects: `warn` until E00 Hardening fixes the hits). 4. Nothing else by hand: `ready` stories without a `## Context pack` are groomed by sprint § 1 "Pack before build" when they come up. |
| 0.17.1 | Nothing by hand: sprint § 1 "Pack before build" runs `extract-provided.mjs` once for a project that has `docs/design/provided/` but no `docs/design/provided-facts.json`, so the groom can fill *Facts* from it instead of returning `Needs facts`. |
| 0.17.2 | Nothing by hand: an extractor failure in "Pack before build" becomes one inbox item and is not rerun until `docs/design/provided/` changes. |
| 0.18.0 | 1. Merge the two new Lint gates rules (arbitrary values in `no-restricted-syntax`, `react/no-multi-comp`) and their `shared/ui` and test overrides into the ESLint config; a Vite project without `eslint-plugin-react` gets an inbox item for it. Existing hits: `warn`, plus one `todo` story "fix frontend-code lint hits" via `it-team:product-manager` `MODE: groom` — never `off`. 2. Nothing else by hand: the frontend engineer preloads `it-team:frontend-code`, and code and React reviewers get it as MAJOR rules. |
| 0.18.1 | Nothing by hand: `it-team:frontend-code` and its review rule cover only the lines a story adds or changes; violations already in touched files go to the story Log as `Legacy:` lines, which feed the "fix frontend-code lint hits" story when it is groomed. |

