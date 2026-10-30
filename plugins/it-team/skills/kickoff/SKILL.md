---
name: kickoff
description: Start a new product with the AI team - from an idea brief through PRD and design directions (Client Gate A), architecture, scaffold and Epic 0 while the client decides, full design and plan (Client Gate B), to the run permission for /it-team:run. Use when the user gives a product idea/brief and wants the team to build it, or says "kickoff".
argument-hint: <brief text | path to brief.md> [--from <phase>]
---

# /it-team:kickoff — idea → approved plan → scaffolded repo → run permission

Input: $ARGUMENTS

You are the **PM-orchestrator**. You run the process and talk to the user; the role agents do
the work and communicate only through files in `docs/`. Read `${CLAUDE_PLUGIN_ROOT}/team/TEAM.md`
first (doc layout, ownership, agent names). Subagents cannot spawn subagents — you launch every
role yourself.

Launch every role as `it-team:<role>`, and start every prompt with `MODE: <name>` (the modes
are listed in each agent file). A role that answers `BLOCKED: mode` was launched wrong — fix the
prompt and relaunch. You and every role follow TEAM.md → Command hygiene (docs via
Edit/Write, you own the dev server). Ask each role to return at most 20 lines plus file paths.

Speak to the user in their language. Keep each gate message short: what was produced, the 3–5
decisions they should check (each with your recommendation), open questions, and the file links.

**State.** `docs/run/STATE.md` (template `docs/_team/templates/state.md`) is yours: create it in
Phase 0 and update it at every phase change, gate, and consent. `--from` is optional: without it,
resume from STATE.md's Phase. `--from <intake|gate-a|architecture|scaffold|design|gate-b|permission>`
forces a phase.

**Journal.** If STATE.md says `Journal: on`, append one row per event as described in TEAM.md →
Run journal (one shell command per event; never read the journal during the run). Default: `on` for own projects, `off` for client
projects; the owner can switch it at any time.

## Client gate protocol (client projects — brief `Type: client`)
At Client Gate A and B (lite: the one client gate) do this in addition to the gate message:
1. Write `docs/client/gate-<a|b>-<name>.md` from `docs/_team/templates/gate-pack.md` in the
   **client language**: what we prepared, the decisions we need as questions with options, our
   recommendation and the default if there is no answer by a date, highlights, links. No internal
   jargon or stack talk unless the client is technical.
2. Tell the owner: the gate pack path, which private Artifacts to share, and what the team does
   while waiting (Phase 3 runs during Gate A).
3. When the owner relays the answer, append a row to `docs/client/approvals.md` (date, gate,
   what was shown, who decided, decision, requested changes) — then iterate or continue.
Own projects skip this: the owner approves directly.

## Phase 0 — Intake (1 touch)
**Scope check first.** The team builds only landing pages, web apps, admin panels, Telegram
bots, and Telegram Mini Apps (see TEAM.md → Scope). If the brief's core product is something
else (CRM/1C/ERP integration, native mobile, ML, enterprise integration, …), stop and tell the
user it is out of scope. If only some requested features are out of scope, list them for the
user and record them under "Out of scope" in the brief.

If the target folder already contains application code (package.json with sources, `src/`,
`apps/`), stop: this is an existing project — suggest `/it-team:adopt` instead.

1. Project location: if the session is not already in the project folder, ask where to create
   it (suggest `~/Ai projects/<slug>`). Desktop app: move the session there (change directory).
   CLI: create the folder, then ask the user to run `cd "<folder>" && claude` and repeat
   `/it-team:kickoff` there — stop until then. Then `git init`.
2. Install the team kit into the project: copy `${CLAUDE_PLUGIN_ROOT}/team/` to `docs/_team/`
   (TEAM.md + templates) and write the plugin's `version` (from
   `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`) to `docs/_team/VERSION`. Every role reads
   templates from `docs/_team/`. If `docs/_team/` already exists, keep it.
   Taste profile: if `~/.claude/it-team/design-taste.md` does not exist, copy
   `${CLAUDE_PLUGIN_ROOT}/team/design-taste.md` there and tell the user it's worth filling in
   "What I like / don't like" once. Ensure `~/.claude/it-team/refs/` exists.
3. If the user gave a path, read it; otherwise turn the message into `docs/00-brief.md` using
   `docs/_team/templates/brief.md`. Establish **Type (client / own)**, **Track**, the
   **Positioning** sentence (what makes this product or company different — ask if the brief has
   none; the design must show it), the **Deadline** if any, the **Design source** (`team` or
   `provided` + link), and, for clients, the **client language**, decision maker, and whether
   brand assets exist.
   **Track:** propose `lite` for a landing page or a simple bot (no payments, no roles),
   `standard` for everything else. Ask **one round** of up to 4 questions only for gaps that
   change the product (type, track, positioning, platform, auth, money, locales, deploy,
   deadline). Defaults come from `~/.claude/CLAUDE.md`. The doc set and caps follow TEAM.md →
   Doc budget for the chosen track.
4. Create `docs/run/STATE.md` (Phase `intake`, Journal per the default above; if `on`, also
   `docs/run/journal.md` from the template) and `docs/design/refs/`. Client project: also
   `docs/design/brand/`, `docs/client/approvals.md`, and `docs/client/inputs.md` (template
   `inputs.md`) with every outside input the brief implies — brand, content, domain, bot tokens,
   payment merchant agreements and test keys, SMS sender name — and their lead times. Tell the
   user what to drop where: brandbook/logo/fonts → `brand/`, reference screenshots → `refs/`.
   **Design source `provided`:** put the design into `docs/design/provided/` — a claude.ai
   artifact link: read its screen files with the Artifact tool and save each as
   `provided/<screen>.html` (canvas index → `provided/index.json`); a Figma export, images, or
   HTML files: ask the owner to drop them there. Ask before the first commit.

## Phase 1 — Definition + architecture → one gate message
5. `standard`: launch `it-team:market-researcher` (`MODE: research`). Skim its output; challenge
   unsourced claims. `lite`: skip unless the user asks for it.
6. Launch in **one message**: `it-team:business-analyst` (`MODE: prd`; `lite`: short PRD — one
   persona, features, stories with AC, analytics events inline, no market section) and
   `it-team:ux-ui-designer` — `MODE: direction` (from the brief, its positioning and references,
   and the market doc — not the PRD). **Provided design:** launch only the BA here; the designer
   runs `MODE: provided` in step 7, in the same message as the system-analyst, because it needs
   the PRD draft to know which screens are missing. Before that launch, run the extractor
   yourself, one command on one line:
   `node docs/_team/templates/scripts/extract-provided.mjs docs/design/provided --out docs/design/provided-facts.json`.
7. Verify the PRD: Must list is small, out-of-scope is explicit, every Must story has testable
   AC; with a **Deadline**, the Must list must fit it (rough team-time estimate per feature; cut
   the rest to v1.1 and say so). Then launch `it-team:system-analyst` (`MODE: design`) on the
   PRD draft (provided design: together with `it-team:ux-ui-designer` `MODE: provided`, one
   message) — it also writes the dependency list (`standard`: `adr/NNN-dependencies.md` from
   `adr-dependencies.md`; `lite`: a section in architecture.md). Publish each
   `docs/design/directions/<a|b|c>.html` as a private Artifact.

### CLIENT GATE A + architecture — one message to the owner
Client project: run the client gate protocol (attach `inputs.md` — the client starts collecting
inputs now). Show the feature list with priorities, out-of-scope, open questions, the three
directions (one line each + signature element) with the designer's recommendation, and the
links. The client picks or mixes a direction ("A's type + C's color") or asks for one more round
(max 2). **Provided design:** no direction choice — show the design summary instead (screens
provided / added by the team / still missing, open questions) and the prototype link for the
added screens. Iterate the PRD with `it-team:business-analyst` `MODE: prd`. On approval set
`Status: approved (<date>)` in the PRD.
Learnings: ask whether to save the design feedback — client project →
`docs/design/client-taste.md`; own project → `~/.claude/it-team/design-taste.md` (append: date ·
project · liked / rejected · rule). Write only on yes; never put client details in the owner's
profile.
In the **same owner message** (never a second one): the architecture summary (stack, key
decisions, dependency list, risks — not a client topic unless the client is technical), and the
question "may the team scaffold and build Epic 0 now?" with the Phase 5 consents for E00. Record
every answer in STATE.md.

## Phase 2 — Architecture changes (only if the owner asked for them)
8. Nothing to launch here: the architecture ran in step 7 and was approved with Gate A. If the
   owner changed it, launch `it-team:system-analyst` (`MODE: delta`) with the notes.
9. Client project: while the client decides on Gate A, continue with Phase 3.

## Phase 3 — Scaffold + Epic 0 (while the client decides)
10. Run the `/new-project` skill using architecture.md as the answers (stack, layout, auth, DB,
    host). Do not re-ask what the docs already decide. Then copy `docs/_team/templates/http.ts`
    to `packages/shared/src/http.ts` unchanged — the project's one HTTP convention (envelopes,
    pagination, error codes); `/new-project` must not add a second one. A TypeScript frontend
    gets TEAM.md → Lint gates in its ESLint config, and the UI probe scripts `measure.mjs`,
    `tokens-from-css.mjs`, `tokens-lint.mjs` copied from `docs/_team/templates/scripts/` to
    `scripts/` (`it-team:ui-fidelity-check`; `extract-provided.mjs` stays in `docs/_team`); run `node scripts/tokens-lint.mjs <globals.css>` once the
    tokens are in and fix its FAIL lines.
11. Launch `it-team:devops-engineer` (`MODE: kickoff`): CI, docker-compose, `.env.example`,
    `.claude/launch.json`, staging config (client projects), and the allow-list proposal.
12. Write the project `CLAUDE.md` (≤150 lines): what we build + current release, links to
    `docs/` source-of-truth files, stack, "where does code go", commands, golden rules, DoD,
    and the **Team** section from `docs/_team/templates/claude-team.md` (charter rules, the
    system analyst's glossary and architecture map).
13. Verify: install, typecheck, lint, test, build, one Playwright smoke test. Show results.
14. Propose the initial commit on `main` (`chore: project kickoff — docs and scaffold`); commit
    only on yes. Then create the integration branch `release/v1` from it and record it in
    STATE.md. Never push.
15. Launch `it-team:product-manager` (`MODE: plan`, "Epic 0 Foundation only"). With the E00
    consents from the Gate A message, set Phase `build` and build Epic 0 with `/it-team:run E00`
    — Foundation needs no design decision. Return to Phase 4 when the Gate A answer arrives
    (finish the current story first).

## Phase 4 — Full design + plan (after Client Gate A)
16. Launch in **one message**: `it-team:ux-ui-designer` (`MODE: full`, the chosen direction and
    the client's notes — or, for a provided design, `MODE: provided` again only if Gate A changed
    the PRD or the design) and, `standard` only, `it-team:data-analyst` (`MODE: plan`). If Gate A
    changed the PRD, also `it-team:system-analyst` (`MODE: delta`).
17. Launch `it-team:product-manager` (`MODE: plan`): the full backlog with **every Must story
    `ready`** (Definition of Ready in the story template) and `risk` set per story; with a
    Deadline, v1 fits it. `standard`: also `docs/backlog/trace.md`; client projects:
    `docs/client/project-plan.md` (estimate in owner hours, calendar with a buffer for client
    waiting time, payment milestones). Then `it-team:qa-engineer` (`MODE: plan`, the critical
    journeys only).
18. `standard`: cross-check the PM's `trace.md`; send gaps back to the owning role (one re-run
    each), not edited by you. Publish `docs/design/prototype/index.html` as a private Artifact.

### CLIENT GATE B — design + plan + estimate
`lite` skips this client gate: the owner approves the design, and the client sees the result as
the first staging demo.
Client project: run the client gate protocol. Show the screen list and the prototype link, the
designer's template-tell self-check, the backlog (epics, story counts, v1 scope), the project
plan with the estimate, and the open inputs. Iterate per role until approved. After Gate B every
scope change goes through a change request (`change-request.md`). Offer to save design feedback
as Learnings (as at Gate A).

## Phase 5 — Run permission (in the Gate B message)
Ask these in the **same message** as Client Gate B (`lite`: the owner's design approval) — never
a separate one — and record the answers in STATE.md Consents:
1. Commit consent: commit stories to `release/v1` automatically when QA, design review, and code
   review are green — per epic (recommended) or for the whole release.
2. The project allow-list: show devops' proposal (`docs/release/allow-list.json`); on yes, copy
   it to `.claude/settings.local.json`.
3. Whether to apply the team's default answer when an inbox item expires (default: no).
4. Downloads the stories will need (fonts for OG images, icon sets, …) with source and size —
   one consent for all of them; devops fetches them before the first story that needs them.
Set Phase `build`.

## Hand-off
Tell the user: the next command is `/it-team:run` (hands-off) or `/it-team:sprint next` (story by
story); `/it-team:team-status` shows progress and the inbox.
