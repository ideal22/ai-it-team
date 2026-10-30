# ai-it-team

A Claude Code plugin that gives one developer a product team of AI agents — mainly for building
**client projects**, and for your own products. You (or your client) give a short brief and
approve the gates; the team turns it into a working, tested app.

You act as **Product Owner / CTO**. The main Claude session is the **PM-orchestrator**: it runs
the process and launches the role agents. The roles hand work to each other only through
documents in the project's `docs/`.

## What the team builds

Only these five project types — work the owner can personally build and stand behind:

| Type | Default stack |
|---|---|
| Landing pages (incl. SEO) | Next.js App Router |
| Web apps | Next.js or Vite + React (per ADR) + NestJS API |
| Admin panels / dashboards | Vite + React + TanStack Query + NestJS API |
| Telegram bots | grammY (inside NestJS or `apps/bot`) |
| Telegram Mini Apps | Vite + React + `@tma.js/sdk-react` |

Out of scope: CRM / 1C / ERP integrations, takeover of other people's abandoned projects,
native mobile, ML/data platforms, enterprise integrations. `/it-team:kickoff` and
`/it-team:adopt` stop and tell you when a brief falls outside the list.

## Default stack

| Surface | Stack |
|---|---|
| Public web with SEO | Next.js App Router |
| Admin panel / dashboard | Vite + React + TanStack Query |
| Telegram Mini App | Vite + React + TanStack Query + `@tma.js/sdk-react` |
| Telegram bot | grammY (inside NestJS or `apps/bot`) |
| API | NestJS + Prisma + PostgreSQL, Zod contracts in `packages/shared` |
| UI | Tailwind + shadcn/ui, RHF + Zod, Zustand for client state |
| Tests | Vitest + RTL + MSW, Supertest, Playwright |

The system analyst records the per-project choice (and auth per surface) in ADRs.

## Team

| Role | Agent | Model / effort / max turns | Owns |
|---|---|---|---|
| PM-orchestrator | main session + skills | — | process, statuses, `docs/run/STATE.md`, `docs/client/` gate packs |
| Product manager | `product-manager` | sonnet / medium / 120 | `docs/backlog/`, `docs/client/project-plan.md` |
| Market researcher | `market-researcher` | sonnet / medium / 80 | `docs/discovery/` |
| Business analyst | `business-analyst` | sonnet / medium / 60 | `docs/product/prd.md` |
| System analyst / architect | `system-analyst` | opus / medium / 120 | `docs/architecture/`, shared Zod contract |
| UX/UI designer | `ux-ui-designer` | opus / high / 180 | `docs/design/` + HTML prototype |
| Data analyst | `data-analyst` | sonnet / low / 40 | `docs/product/metrics.md` |
| Backend engineer | `backend-engineer` | sonnet / medium / 160 (opus on `risk: high`) | `apps/api`, `apps/bot`, `prisma/` |
| Frontend engineer | `frontend-engineer` | sonnet / medium / 220 (opus on `risk: high`) | `apps/web`, `apps/admin`, `apps/tma` |
| QA engineer | `qa-engineer` | sonnet / medium / 120 | `docs/qa/`, `e2e/` |
| DevOps / release | `devops-engineer` | sonnet / low / 60 | CI, Docker, deploy config, `docs/release/` |
| Tech writer | `tech-writer` | sonnet / low / 60 | README, CHANGELOG, `docs/guides/` |
| Design reviewer | `design-reviewer` | opus / medium / 60 | read-only design QA of each UI story |

Every role has an explicit `tools:` list (engineers and devops have no browser; QA, the designer
and the design reviewer have the Playwright tools), so a launch starts at ≈ 10–20 k tokens instead
of ≈ 55–67 k of tool schemas. Preloaded skills: `it-team:design-system-first` (frontend engineer,
designer), `it-team:frontend-code` (frontend engineer), `it-team:ui-fidelity-check` (QA, design
reviewer); everything else loads on demand.

Code review comes from the reviewer agents in `~/.claude` (code, react, security, database,
a11y), launched by the sprint's verify step in parallel with QA and design review (`/pr-ready` stays for your own manual use).

## Flow

Goal: you give a brief and take part only in key decisions (≈10–12 touches per project). The
orchestrator keeps everything in `docs/run/STATE.md`, so any session resumes where the last one
stopped.

| Phase | Roles | Output in `<project>/docs/` | You |
|---|---|---|---|
| Intake | orchestrator | `00-brief.md` (Type, Track `lite`/`standard`), `run/STATE.md`, `client/inputs.md` | ≤4 questions |
| Definition | market-researcher → business-analyst ∥ ux-ui-designer (3 directions from the brief; or, with `Design source: provided`, the design system and missing screens from your finished design) | `product/prd.md`, `design/directions/*` or `design/provided/` | **Client Gate A:** PRD + direction (or design summary) + architecture, one message |
| Architecture | system-analyst | `architecture/*`, ADRs incl. pre-approved dependencies | approve async, while the client thinks |
| Scaffold + Epic 0 | `/new-project`, devops-engineer, product-manager, then `/it-team:run E00` | repo, CI, staging, allow-list proposal, Foundation stories | first commit, run permission for E00 |
| Design + plan | ux-ui-designer (full) ∥ data-analyst → product-manager → qa-engineer | prototype, every Must story `ready`, `backlog/trace.md`, `client/project-plan.md` | **Client Gate B:** design + plan + estimate (`lite`: none) |
| Run permission | orchestrator | consents in STATE.md, `.claude/settings.local.json` | one message: commit consent per epic, allow-list |
| Build | `/it-team:run`: contract → backend ∥ frontend → one verify pass (checks, then QA ∥ design-reviewer ∥ code reviewers) → ≤2 fix rounds → commit to `release/v1` | code + tests, `backlog/polish.md`, inbox in STATE.md | answer the inbox when convenient |
| Epic gate | orchestrator | epic gate section, client demo pack | push / PR, polish → stories |
| Release | devops ∥ tech-writer ∥ data-analyst + security/database review → staging → client UAT | `release/checklist.md`, README, CHANGELOG | UAT relay, tag, merge, push, deploy |

The run never stops for a design question, a blocker, a missing key, or MINOR findings — they go
to the inbox or `polish.md` and the next story starts. It stops for: an epic gate, a security or
data-loss risk, a scope change (change request), an empty queue, or a hand-over to a fresh
session when the context gets long.

## Existing project flow (`/it-team:adopt`)

| Phase | Roles | Output | Gate |
|---|---|---|---|
| Baseline | orchestrator | path map, install/typecheck/lint/test/build results, `00-brief.md` (current + goals) | answer ≤4 questions |
| As-is | system-analyst ∥ ux-ui-designer ∥ qa-engineer ∥ devops-engineer | as-is architecture + tech debt, design system from code, test inventory, infra audit | — |
| Definition | business-analyst (+ market-researcher optional) | PRD: Part A current, Part B next release | **1: PRD** |
| To-be | system-analyst ∥ ux-ui-designer ∥ data-analyst | deltas, ADRs, new screens + prototype, metrics | **2: architecture + design** |
| Backlog | product-manager | E00 Hardening, tech debt, feature epics | you pick tech debt |
| Hand-off | orchestrator | Team section + path map in the existing CLAUDE.md, commit on `chore/adopt-it-team`, `release/<next>` branch | commit, run permission |

Then `/it-team:run` (or `/it-team:sprint next` story by story).

## Commands

| Command | What it does |
|---|---|
| `/it-team:kickoff <brief or path>` | Idea → brief → research → PRD → architecture + design → backlog → scaffold. `--from <discovery\|prd\|design\|backlog\|scaffold>` resumes a phase. |
| `/it-team:adopt [goals]` | Brings the team into an **existing** repo: baseline checks, as-is architecture/design/tests/infra docs from the code, PRD (current + next release), backlog with an E00 Hardening epic. Never rescaffolds or changes the stack. `--from <baseline\|as-is\|prd\|design\|backlog\|handoff>` resumes. |
| `/it-team:run [E02]` | Hands-off: builds ready stories one after another, commits each to `release/vX` under your per-epic consent, parks questions in the inbox, stops at the epic gate. |
| `/it-team:sprint [next \| S-001 \| E02]` | The same story pipeline, interactive: questions come to you at once; without a consent it asks before each commit. |
| `/it-team:retro [all \| E02 \| v1] [--cost <usage>]` | Retrospective from the run journal: owner touches by cause, stalls, fix rounds, role errors, permission prompts worth allow-listing, and ranked kit improvements → `docs/run/retro-<date>.md`. |
| `/it-team:team-status [--page]` | The decision inbox first, then progress, blockers, bugs, inputs, and what's next; `--page` publishes a status page. |
| `/it-team:release [vX.Y.Z]` | Release checklist, docs, analytics check, security/DB review, staging and client UAT. You merge, push, and deploy. |

Reference skill (loaded by the roles; you can also call it directly):

| Skill | What it covers |
|---|---|
| `it-team:design-system-first`, `it-team:frontend-code`, `it-team:ui-fidelity-check`, `it-team:fix-round`, `it-team:story-context-pack` | Team skills: closed token set and primitives; the frontend code rules (one component per file, explicit variants, logic outside JSX, unions for states, Server Components by default, no arbitrary values, comments that say why — MAJOR in code review; adapted from Vercel Labs `react-best-practices` and `composition-patterns`, MIT); the two-stage UI fidelity check with the probe `scripts/measure.mjs` + `tokens-lint.mjs` (kit templates); one fix round (root cause first, 0 browser calls); how a story's `## Context pack` (story template) is filled at groom, refreshed at launch (`launch-brief.md`), and fed by roles' `Pack gaps`. The designer's `MODE: provided` reads facts from `extract-provided.mjs` instead of measuring in the browser. |
| `it-team:react-patterns`, `react-testing`, `e2e-testing`, `frontend-a11y`, `react-performance`, `vite-patterns`, `api-design`, `nestjs-patterns`, `prisma-patterns`, `postgres-patterns`, `database-migrations`, `appsec-checklist` | Engineering reference skills bundled with the plugin (copied from the owner's `~/.claude/skills`, which stays untouched) so every machine with the plugin has the same set; roles load them on demand with the Skill tool. `it-team:frontend-design` is Anthropic's `frontend-design` skill (Apache-2.0, `LICENSE.txt` next to it). |
| `/it-team:uz-integrations` | Uzbekistan projects: Payme, Click, Uzum payments; Eskiz SMS and Telegram Gateway OTP; Yandex Maps licensing; UZS in tiyin; uz-Latn/uz-Cyrl/ru locales; personal-data localization (2026 rules) and hosting. Cited sources, unverified items marked. The system analyst writes integration and hosting ADRs from it when the brief's target market is Uzbekistan. |

## Install

The repo is its own local marketplace:

```bash
claude plugin marketplace add "$HOME/Ai projects/ai-it-team"
```

```bash
claude plugin install it-team@ai-it-team
```

The plugin is read in place from `plugins/it-team` (`claude plugin list` shows
`Read from: …/ai-it-team/plugins/it-team`). After you edit it, run `/reload-plugins` in an open
session (or start a new one) — no version bump or reinstall needed. Validate with
`python3 scripts/validate.py` (names, namespaces, size caps) and
`claude plugin validate ./plugins/it-team --strict`.

Permissions: the kit's allow-list template (`team/templates/claude-settings.local.json`) covers
the commands roles run (`cd`, `sed -n` (with `sed -i` denied), `printf` appends to the run
journal, the three probe scripts in `scripts/`, yarn scripts, `npx vitest`/`playwright`). A global `ask` rule such as `Bash(npx *)` in
`~/.claude/settings.json` overrides it and brings the prompts back — remove it there yourself.

Bump `version` in `plugins/it-team/.claude-plugin/plugin.json` only when you distribute a
release to other machines or copies; they update with:

```bash
claude plugin marketplace update ai-it-team
```

```bash
claude plugin update it-team@ai-it-team
```

### Depends on (from `~/.claude`)
- Skills: `new-project`, `pr-ready`, `api-design`, `prisma-patterns`, `postgres-patterns`,
  `nestjs-patterns`, `database-migrations`, `appsec-checklist`, `react-patterns`,
  `react-testing`, `react-performance`, `frontend-a11y`, `vite-patterns`, `e2e-testing`.
- Agents: `code-reviewer`, `react-reviewer`, `security-reviewer`, `database-reviewer`, `a11y-reviewer`.
- Plugins: `frontend-design`, `claude-md-management` (claude-plugins-official).
  The `engineering` plugin skills are optional.
- MCP: Context7, Playwright.

## Layout

```
.claude-plugin/marketplace.json      # local marketplace (this repo)
plugins/it-team/
  .claude-plugin/plugin.json
  agents/*.md                        # 12 role agents
  skills/{kickoff,adopt,run,sprint,team-status,release,retro}/SKILL.md
  hooks/hooks.json, log-permission.sh # logs permission prompts to the run journal (no tokens)
  skills/uz-integrations/            # Uzbekistan reference: SKILL.md + references/*.md
  team/TEAM.md                       # conventions: doc layout, ownership, language
  team/CHARTER.md                    # what the team optimizes, quality bar, targets, the nine role rules
  team/design-taste.md               # default design taste profile
  team/templates/*.md                # 31 document templates (incl. story with context pack, launch-brief, claude-team, state, journal, gate-pack)
  team/templates/http.ts             # the one HTTP convention, copied to packages/shared
  team/templates/claude-settings.local.json  # project allow-list template (devops adapts it)
scripts/validate.py                  # frontmatter and reference checks
```

`/it-team:kickoff` copies `team/` into each project as `docs/_team/` with the kit version in
`docs/_team/VERSION`. When the plugin is newer, `/it-team:run` and `/it-team:sprint` refresh the
copy between stories and apply TEAM.md → Kit upgrades (e.g. 0.13.0 adds the screen inventory,
`shared/ui` layout primitives, and lint gates to an existing project).

## Client projects vs own projects

The brief starts with `Type: client | own`.

| | Client project | Own project |
|---|---|---|
| Design leads with | client brand (`docs/design/brand/`) → client refs (`docs/design/refs/`) → client taste log | your taste profile → project refs → your library `~/.claude/it-team/refs/` |
| Your taste profile | only the quality bar: banned template tells + required basics | fully |
| Gates | the orchestrator writes a client-facing gate pack for Gate A and B in `docs/client/` (client language, with a recommendation and a default); you share it and relay the answer; decisions go to `docs/client/approvals.md`; scope changes after Gate B go through a change request | you approve directly |
| Plan & inputs | `docs/client/project-plan.md` (estimate, calendar, milestones), `docs/client/inputs.md` (what the client must provide), staging demo per epic, UAT before launch | optional |
| Design learnings | `docs/design/client-taste.md` (stays in the project) | appended to your taste profile |
| Language | client-facing docs in the client language; technical docs in English | brief's language |
| Confidentiality | client names, data, assets never leave the project; artifacts stay private | — |

Story commits are approved by you once per epic (or per story, if you prefer); pushes, merges,
and deploys are always yours.

## Design: how the team avoids template looks

1. **Your taste profile** — `~/.claude/it-team/design-taste.md` (created on the first kickoff from
   `plugins/it-team/team/design-taste.md`). Fill in what you like / don't like once; it also holds
   a banned list of template tells and a Learnings log that grows after each design gate.
2. **References** — links in the brief + screenshots in `docs/design/refs/` (from the client on
   client projects); your own library `~/.claude/it-team/refs/` for own projects; the designer
   also browses public galleries and competitors → `docs/design/moodboard.md`.
3. **Three directions** — distinct style tiles with a real key screen each; you pick or mix at
   Client Gate A before any detailed design.
4. **Design QA** — `design-reviewer` checks every UI story in the browser against the prototype
   (or the provided design), tokens, and your taste profile — at the design's own widths, every
   locale on one-line rows, and with measured edges instead of eyeballing.
5. **Lint gates** — deprecated APIs and hand-written page containers fail `yarn lint`
   (TEAM.md → Lint gates), so they never reach review.

## Working habits

- **Run journal** (`Journal: on` in STATE.md; default on for own projects, off for client
  projects): the orchestrator appends one line per touch, block, fix round, and stop, and the
  plugin hook logs every permission prompt. After a pilot, epic, or release run `/it-team:retro`
  and bring its "Kit improvements" section to this repo.
- **Bug classes** are written down once: QA files each bug into `docs/qa/pitfalls.md` (a rule
  engineers follow) and, where it can, into the regression pack `e2e/regression/` that runs
  before every review. Epic gates propose root-cause clusters of bugs and polish as one story.
- `/it-team:run` hands over to a fresh session when the context gets long; start the new session with
  `/it-team:run` again. State lives in `docs/run/STATE.md`, so nothing is lost.
- If a role's output is wrong, re-run that role with your notes. Don't patch it by hand.
- Scope change → business-analyst updates the PRD (version bump) → product-manager re-plans.
- Cost: discovery ≈ 6 agent runs, a story ≈ 4–7. To change a role's model, edit `model:` in its
  agent file.
- Limits: design is solid shadcn/Tailwind with a custom theme, not brand-agency level. Market
  research uses the public web only. Nobody but you pushes or deploys.
