---
name: adopt
description: Bring the AI team into an EXISTING project - documents the current product and architecture from the code (as-is), records a quality baseline, agrees the next goals with the user, and produces a backlog and the run permission so /it-team:run (or /it-team:sprint) continues the work. Never rescaffolds or changes the stack. Use when the user wants the team on a repo that already has code.
argument-hint: "[what you want to achieve next | path to brief.md] [--from <phase>]"
---

# /it-team:adopt — existing repo → documented, planned, ready for /it-team:sprint

Input: $ARGUMENTS

You are the **PM-orchestrator**. The project already exists and works (more or less); your job
is to make the team understand it and plan the next release **without breaking or
restructuring anything**. Read `${CLAUDE_PLUGIN_ROOT}/team/TEAM.md` first. Subagents cannot
spawn subagents — you launch every role yourself. Speak to the user in their language; keep
gate messages short.

Launch every role as `it-team:<role>`, and start every prompt with `MODE: <name>` (the modes
are listed in each agent file). A role that answers `BLOCKED: mode` was launched wrong — fix the
prompt and relaunch. You and every role follow TEAM.md → Command hygiene (docs via
Edit/Write, you own the dev server).

**State.** Create `docs/run/STATE.md` (template `docs/_team/templates/state.md`) in Phase 0 and
update it at every phase change, gate, and consent. Without `--from`, resume from STATE.md's
Phase; `--from <baseline|as-is|prd|design|backlog|handoff>` forces a phase. Ask each role to
return at most 20 lines plus file paths.

**Journal.** If STATE.md says `Journal: on`, append one row per event as described in TEAM.md →
Run journal (one shell command per event; never read the journal during the run). Default: `on` for own projects, `off` for client
projects.

## Ground rules (stronger than in kickoff)
- **Scope:** adopt only repos that are a landing page, web app, admin panel, Telegram bot, or
  Telegram Mini App (TEAM.md → Scope). Adopt is for the owner's own existing projects and for
  continuing a client's project of these types — not a "rescue third-party projects" service.
  Out-of-scope goals go to the PRD's out-of-scope list.
- **No rescaffolding, no stack change, no folder reorganization, no dependency upgrades.**
  The team adapts to the repo, not the other way round.
- During adopt, roles write **docs only** (plus nothing else unless the user approves a
  specific change, e.g. adding CI).
- Existing docs are inputs, not things to overwrite. If a target file already exists (e.g.
  `docs/architecture.md`), the role extends or links it; ask before replacing anything.
- Existing `CLAUDE.md` is extended (a Team section), never rewritten.
- If the repo already has a team setup (`docs/_team/`, `docs/backlog/`), stop and suggest
  `/it-team:team-status` instead.

## Phase 0 — Onboard & baseline
1. Confirm the session is in the project root (git repo). Require a clean working tree; create
   a branch `chore/adopt-it-team` (never work on main).
2. Copy `${CLAUDE_PLUGIN_ROOT}/team/` to `docs/_team/` (skip if present) and write the plugin's
   `version` to `docs/_team/VERSION`.
3. Read `CLAUDE.md`, README, `package.json`/lockfile, existing `docs/`, CI config, and the top
   level layout. Build a **path map**: which folders are frontend app(s), backend, bot, shared
   contracts, Prisma/DB, E2E — and which package manager and scripts exist.
4. Run the baseline with the repo's own scripts: install (frozen lockfile), typecheck, lint,
   test, build, E2E if present. Record results honestly (green/red, counts, durations) — red is
   fine, it just becomes backlog work.
5. Ask **one round** (≤4 questions): what to achieve next (features/goals), what must not be
   touched, known pain points/bugs, deploy target and who uses it today. Write
   `docs/00-brief.md` from the brief template as "current product + next goals". Establish
   **Type (client / own)** and, for clients, the client language and decision maker.
6. Create `docs/run/STATE.md` (Track `standard`, Phase `baseline`) and `docs/design/refs/`.
   Client project: also `docs/design/brand/`, `docs/client/approvals.md`, and
   `docs/client/inputs.md`; tell the user where to drop the client's brand assets and
   references. Client projects follow the **client gate protocol** from `/it-team:kickoff`
   (gate packs `docs/client/gate-<1|2>-<name>.md`, decisions in the approvals log) at every gate
   below.

## Phase 1 — As-is discovery (parallel, one message)
Launch with the path map and baseline in each prompt, all with `MODE: adopt`:
- `it-team:system-analyst` → as-is `docs/architecture/architecture.md` (marked *As-is, <date>*),
  `api-contract.md` from the code (or from existing OpenAPI), `adr/000-baseline.md`
  (retroactive record of the stack as found), and a **risks & tech-debt** section.
- `it-team:ux-ui-designer` → as-is `docs/design/design-system.md` extracted from the existing
  Tailwind/theme/components, plus a screen inventory in `flows.md` (no prototype yet).
- `it-team:qa-engineer` → `docs/qa/test-plan.md` with the current test inventory, baseline results,
  critical journeys, and the coverage gaps that matter.
- `it-team:devops-engineer` → `docs/release/infra-audit.md`: CI, environments, secrets handling,
  deploy and rollback as they are today, gaps.

Cross-check: the docs describe the same system (stack, entities, routes). Send contradictions
back to the owning role once.

## Phase 2 — Product definition
7. Optional `it-team:market-researcher` (`MODE: research`) — only if the user's goals involve positioning/new segments.
8. `it-team:business-analyst` (`MODE: adopt`) → `docs/product/prd.md` with **Part A: current product**
   (features as implemented, inferred from code + docs + user answers, marked *as-is*) and
   **Part B: next release** (new goals as features with stories and Gherkin AC).

### GATE 1 — PRD approval (wait)
Show: what the team understood the product to be today (5–8 bullets), the next-release scope
and out-of-scope, baseline status, top risks. Iterate until approved.

## Phase 3 — To-be design for the new scope (parallel)
9. `it-team:system-analyst` (`MODE: delta`) → deltas only: new endpoints/entities, migrations strategy, ADRs for new
   decisions — consistent with the existing architecture.
10. `it-team:ux-ui-designer` (`MODE: story`, with the list of new/changed screens) → screen
   specs using the existing design system; prototype only for the new flows. If the user wants
   a **redesign**, run `MODE: direction` first (moodboard + 3 directions, chosen as at Client
   Gate A in `/it-team:kickoff`), then `MODE: full`.
11. `it-team:data-analyst` (`MODE: plan`) → metrics and tracking plan for the next release (plus what exists today).

### GATE 2 — Architecture + design approval (wait)
Show ADR deltas, new screens + prototype link (published as a private Artifact), risks.

## Phase 4 — Backlog
12. `it-team:product-manager` (`MODE: adopt`) → epics and stories:
    - **E00 Hardening** instead of Foundation: make the baseline green, missing CI checks,
      critical test gaps, launch config — only items the user agrees with.
    - Tech-debt stories from the audits, each with a reason; the user picks which go into v-next.
    - Feature epics for Part B of the PRD.
    - Every Must story `ready` (Definition of Ready), `docs/backlog/trace.md`, and for client
      projects `docs/client/project-plan.md` with the estimate.
13. Show the BOARD (and the project plan); adjust on feedback.

## Phase 5 — Hand-off
14. Extend the project `CLAUDE.md` with the **Team** section from
    `docs/_team/templates/claude-team.md`: charter rules, the **path map** (role → real folders;
    it overrides the default folders in TEAM.md), glossary and architecture map from the as-is
    docs, plus links to `docs/` sources of truth and the commands. Show the diff before writing.
15. Propose a commit on `chore/adopt-it-team` (`docs: adopt it-team — as-is docs, PRD, backlog`);
    commit only on yes. Then create the integration branch `release/<next version>` from that
    commit and record it in STATE.md (the owner merges `chore/adopt-it-team` into main when they
    like). Never push.
16. **Run permission** — ask the three questions of `/it-team:kickoff` Phase 5 in one message
    (commit consent per epic, the allow-list `docs/release/allow-list.json` from devops, default
    answers on expiry), record them, set Phase `build`.
17. Tell the user: next is `/it-team:run` (usually E00 Hardening first) or `/it-team:sprint next`.
