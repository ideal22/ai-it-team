---
name: sprint
description: Deliver backlog stories with the AI team - picks ready stories, runs backend and frontend test-first, verifies in one parallel pass (QA, design review, code reviewers), fixes within a 2-round budget, and commits each story to the release branch under the owner's per-epic consent; closes epics with an epic gate. Use when the user says "sprint", "next story", or names a story/epic ID to build. For hands-off building use /it-team:run.
argument-hint: "[next | S-001 | E02]"
---

# /it-team:sprint — story → working, tested, reviewed commit

Target: $ARGUMENTS (default `next`)

You are the **PM-orchestrator**. Read `docs/run/STATE.md` first, then the project `CLAUDE.md`,
`docs/backlog/BOARD.md`, and `docs/_team/TEAM.md`. Role agents talk through files; you launch
them and route issues. If `docs/_team/` is missing (project started before the kit), copy
`${CLAUDE_PLUGIN_ROOT}/team/` there first — role agents read templates from it. If
`docs/_team/VERSION` is missing or older than the plugin, run TEAM.md → Kit upgrades first. If
`docs/run/STATE.md` is missing, create it from `docs/_team/templates/state.md` using BOARD.md and
git, set Phase `build`, and tell the user.

Launch every role as `it-team:<role>`, and start every prompt with `MODE: <name>` (the modes
are listed in each agent file). A role that answers `BLOCKED: mode` was launched wrong — fix the
prompt and relaunch. You and every role follow TEAM.md → Command hygiene (docs via
Edit/Write, you own the dev server). Ask each role to return at most 20 lines plus file paths.

**Context pack and launch brief.** Every story-scoped launch uses
`docs/_team/templates/launch-brief.md` and points at the story's `## Context pack` — never paste
documents into a brief. Before each launch rewrite the pack's `(live)` line (app URL, warmed
routes, base commit). After each return, append its `Pack gaps:` lines (not `none`) to the pack's
*Pack gaps* with the date and role, and journal a `pack-gap` row per line.

**Journal.** If STATE.md says `Journal: on`, append one row per event as described in TEAM.md →
Run journal (one shell command per event; never read the journal during the run).

`/it-team:run` uses sections 1–5 of this file as its story pipeline; the **[interactive]** notes
apply only to `/it-team:sprint`, the **[run]** notes only to `/it-team:run`.

## 0. Branch
- Work on the integration branch from STATE.md (`release/v1` by default). If it does not exist,
  create it from the current `main` (the scaffold commit): `git switch -c release/v1`. Never work
  on `main`; no per-story branches.
- Require a clean tree before a story starts.

## 1. Pick work
- `next`: the first `ready` story in BOARD order whose `depends_on` are all `done` and whose
  `needs` (inputs) are all received. A story with a missing input → `blocked` with the input ID.
- `S-xxx`: that story (refuse if dependencies are not done; say which).
- `E-xx`: all ready stories in the epic, one after another.
- Story not `ready` (Definition of Ready not met)? Launch the owning role to fill the gap first:
  `it-team:business-analyst` `MODE: prd`, `it-team:ux-ui-designer` `MODE: story`,
  `it-team:system-analyst` `MODE: delta`, `it-team:product-manager` `MODE: groom`. A groom that
  returns `Needs facts: <screen> <sections>` → `it-team:ux-ui-designer` `MODE: story` with
  `facts only: <screen> <sections>`, then the groom once more.
- **Pack before build.** A `ready` story whose `## Context pack` is empty or says `Stale: yes`
  gets `it-team:product-manager`
  `MODE: groom` ("fill § Context pack", with the story's open *Pack gaps*) before any build
  launch. Groom the next 2–3 stories in one launch to save start-up cost. Before the first
  groom of a project that has `docs/design/provided/` but no `docs/design/provided-facts.json`
  (started before kit 0.17), run the extractor once, one command on one line:
  `node docs/_team/templates/scripts/extract-provided.mjs docs/design/provided --out docs/design/provided-facts.json`
  — otherwise every groom returns `Needs facts`. Exit ≠ 0 (e.g. no `.html` in `provided/`) →
  one inbox item "extractor failed: <its error line>", Blocks `—`, default "facts from the
  designer"; groom anyway (`Needs facts` → designer as above). No rerun while that item is open,
  unless a file in `provided/` is newer than its *Asked* date.
- **Commit consent per epic.** If STATE.md has no commit consent for this story's epic, ask once:
  "Commit the stories of E0x to `release/v1` automatically when QA, design review, and code
  review are green?" — options: yes for this epic / yes for the whole release / ask per story.
  Record the answer under Consents. Never push either way.
- Set the story `status: in-progress`, update BOARD.md and STATE.md Current (stage `contract`),
  add a Log line.
- Create `.claude/sprint-active` (`mkdir -p .claude && touch .claude/sprint-active`; add the
  path to `.gitignore` if missing). While it exists, the user's Stop-hook quality gate skips
  its check, so it does not lint half-written files while agents work. The full check runs in
  `/pr-ready`.

## 2. Build
1. **Contract.** If the story has backend work, a frontend part, and its schemas are not in
   `packages/shared` yet, launch `it-team:backend-engineer` with `MODE: contract` (skip it for
   backend-only stories — `MODE: implement` writes the schemas). It writes the story's Zod schemas
   and its rows in `docs/architecture/api-contract.md`, then returns.
2. **Implement.** Launch in **one message** `it-team:backend-engineer` with `MODE: implement`
   and `it-team:frontend-engineer` with `MODE: implement` — they write disjoint directories.
   Frontend-only or backend-only stories launch only that role. Story `risk: high` → pass
   `model: opus` to both (and to their fix rounds); otherwise use the agent default (sonnet).
   **UI story:** before the launch, start the dev server yourself (you own it; no role starts or
   stops servers) and export the tokens once per sprint (`node scripts/tokens-from-css.mjs
   <globals.css> --out test-results/design/tokens.json`); the frontend brief carries the app URL,
   the story's routes, the drawn widths, the shipped locales, and the tokens path, so the engineer
   can run the probe on its own work. The server stays up through Verify.
   UI components that have no page yet are reviewed on the dev gallery (`/dev/components`);
   never create a temporary review page.
3. **Blocked** or a product/design question from a role: [interactive] ask the user; [run]
   inbox item (section 6), story `blocked`, next story. Never let a developer guess product
   behavior. If the backend changed the contract while implementing, tell the frontend in its
   next run.

## 3. Verify — cheap checks, probe, then reviewers in parallel; budget: 2 fix rounds per story
A **fix round** = one launch of owners with `MODE: fix` for all open BLOCKER/MAJOR findings at
once. Count rounds in STATE.md (`fix (round n/2)`).
4. **Cheap checks first** (you, one command each, from the project root): typecheck, lint, and
   the unit/component tests the story touched. Red → straight to a fix round; no reviewer runs
   on a red tree.
5. **Probe before reviewers.** With the dev server from step 2 (start it now if it is down;
   restart it if the story changed message/locale files — `next dev` keeps the old module and
   the probe then fails on raw keys). A story that adds or changes a statically generated route
   runs the build first (one command). Then **warm the routes**: one command,
   `curl -s -o /dev/null -w "%{http_code} " http://localhost:<port>/<route> …`, with every
   changed route in every shipped locale — a dev server compiles a route on its first request
   after an edit (20–45 s), and otherwise each reviewer waits for that. A 5xx answer is a red
   tree. Then, one command each: the **regression pack** (`npx playwright test e2e/regression`,
   if `e2e/regression/` exists) and the **probe** on the changed routes
   (`node scripts/measure.mjs --url <app URL><route> --widths <drawn> --locales <shipped> --tokens
   test-results/design/tokens.json --out test-results/design/S-xxx-measure.json`; re-export the
   tokens first if the story changed `globals.css`; add `--seed <json>` with the story's
   persisted state — the localStorage keys the pack or the store names — when the screen looks
   different with saved data, so the reviewer does not re-probe it). Pack or probe red (a BLOCKER/MAJOR line) → straight to a
   fix round with the failing lines and the JSON path, **no reviewers**. Green → launch
   **in one message**:
   - `it-team:qa-engineer` `MODE: story` (with the probe JSON path);
   - `it-team:design-reviewer` `MODE: review` with the app URL, the routes, the probe JSON
     path, the design files and widths from `screens.md`, and the shipped locales — only if
     the story changed UI; it judges stage 2 on the probe's numbers (≤ 25 tool calls, ≤ 6
     browser calls);
   - code reviewers on the diff since the story started, each told "BLOCKER/MAJOR in full, at
     most 5 MINOR": `code-reviewer` (always, `model: sonnet`), `react-reviewer` (`.tsx`/`.jsx`
     changed, `model: sonnet`), `a11y-reviewer` (UI markup/styles changed, `model: sonnet`),
     `security-reviewer` (input handling, auth, sessions, env, webhooks, PII, or dependencies
     changed, `model: opus`), `database-reviewer` (schema, migrations, or data access changed,
     `model: opus`). When frontend files changed, `code-reviewer` and `react-reviewer` also get
     "read `${CLAUDE_PLUGIN_ROOT}/skills/frontend-code/SKILL.md`; a violation of it in lines this
     story added or changed is MAJOR, one that was already there is not a finding" and the
     engineer's `Guide:` and `Legacy:` lines.
   `/pr-ready` is not used inside the pipeline — this step replaces it.
   Prompts give reviewers facts (what changed, known trade-offs), never verdicts: do not tell a
   reviewer that a deviation is acceptable. Screenshots go to `test-results/`, not `docs/`.
6. **Merge the findings** into one list (dedupe; drop what you cannot confirm in the code). All
   BLOCKER/MAJOR → one fix round: **fresh** owner agents (`it-team:backend-engineer` /
   `it-team:frontend-engineer`, `MODE: fix`, with the story file, findings, and bug file paths)
   in one message — never continue the implementing agent with SendMessage: its context carries
   every file and screenshot of the build. Fix mode (`it-team:fix-round`) runs only targeted
   tests and, for visual findings, one probe call on the fixed routes against your running
   server — never a browser, never its own server; give it the app URL, the probe JSON path, and
   the design facts (numbers) for visual findings. Save every fix return to
   `test-results/review/S-xxx-fix-<n>.md` (recheck briefs and round 2 point at it). Round 2 of a
   finding that round 1 did not close → that owner runs on `model: opus`, with the round-1
   return's path (not pasted). Design or product questions go to the user [interactive] or the inbox [run].
   A visible deviation from the provided design at a drawn width, in any shipped locale
   (layout, wrapping, alignment, a missing element), is never settled by an inbox default: fix
   it in the round, or — when fixing needs a design decision — ask the owner with the
   screenshot [interactive], or block the story with an inbox item [run].
7. **Re-check = probe first:** re-run the cheap checks, warm the changed routes again, run the
   regression pack and the probe on the fixed routes (step 5). A finding that was a probe
   number (edge, row, overflow, ring, CLS, token) is closed by the probe alone — no reviewer
   re-launch. Launch in one message only the reviewers whose findings the probe cannot settle
   and whose fix changed layout or behaviour, each with its findings to confirm
   (`it-team:design-reviewer` `MODE: recheck` with the finding ids, routes, widths, expected
   values, the fix return path, and the new probe JSON path), and QA only if behavior changed:
   `it-team:qa-engineer` `MODE: recheck` with the bug IDs, the behaviors the round changed, the
   routes, and the story pass's probe path. Never re-run the whole step 5.
8. **MINOR/NIT** never start a round. Security- or privacy-flavoured MINOR (spoofing, injection,
   PII, auth) go to the epic gate as a decision; the rest go to `docs/backlog/polish.md`
   (template `polish.md`) — at most 5 per story, merged with existing items on the same file and
   topic.
9. **Budget used up** (a 3rd round would be needed): remove `.claude/sprint-active`, set the
   story `blocked` with the open findings, and park the unfinished work so the next story starts
   clean: `git switch -c wip/s-xxx`, commit everything as `wip(s-xxx): unfinished — <reason>`,
   `git switch release/v1`. Note the branch in the story Log and STATE.md Deferred. Then
   [interactive] report and ask; [run] add an inbox item and continue with the next story.

## 4. Commit
First remove `.claude/sprint-active`, so the quality gate checks the finished tree again.
- **Consent for this epic recorded:** commit with a Conventional Commit message
  (`feat(s-xxx): …`) without asking. Report in ≤8 lines: story, commit hash, AC → tests, QA /
  design / code verdicts, polish items added.
- **No consent (ask per story) — story gate:** show what changed by role, AC → test mapping,
  test/typecheck/lint results, verdicts with screenshots, anything deferred; ask to commit.
After the commit: story `status: done`, BOARD.md Done with the hash, bugs `verified`, STATE.md
Current cleared, "stories finished in this session" +1. Never push.
**Stale packs:** one command, `git diff --stat <story base>..HEAD`, against the *Touch* lines of
the `ready` stories that depend on this one; a match → set that pack's `Stale: yes` (its next
"Pack before build" check launches the groom, which resets it with a new `Filled` line).

## 5. Epic gate (wait — also in /it-team:run)
When the last story of an epic is `done` (or the rest are `blocked`), stop and fill the epic's
**Epic gate** section (template `epic.md`): commit range, AC → tests, screenshots in
`docs/qa/screens/` (copy from `test-results/` at most one final screenshot per UI story and
width; review rounds stay untracked), polish and bugs by root cause (below), blocked stories
with reasons. Client project: write `docs/client/demo-<epic>.md` (template `gate-pack.md`,
client language) for the staging demo.
**Root-cause clusters:** group all open polish items and this epic's bugs by their
`docs/qa/pitfalls.md` class or another shared cause (one primitive, one token, one pattern). A
cluster of 3+ items, or a class with 2+ bugs and Guard `—`, is proposed as **one story**: the
guard (primitive, lint rule, or pack check) plus the fix of the cluster's items. List at most 5
clusters, largest first; single items stay in polish.
**Pack gaps:** count the epic's `pack-gap` lines by kind (missing primitive, contract field,
undrawn state, long locale, permission prompt, …). A kind seen 2+ times becomes a grooming rule
in the project `CLAUDE.md` → Team (or a `screens.md` / `design-system.md` fix by the designer);
report the counts in the gate.
Ask the owner: which clusters (and single polish items) become stories, whether to start the
next epic with the same commit consent. On a yes, `it-team:product-manager` `MODE: groom` writes
the stories and `it-team:qa-engineer` `MODE: regression` adds the new guards' pack checks. The
owner pushes or opens the PR themselves.

## 6. Inbox (decisions that must not stop the work)
An inbox item goes into STATE.md Inbox: question, options, the team's default, answer-by date
(2 working days), and the stories it blocks. The affected story becomes `blocked`. At the start
of every story, read answers the owner gave in chat and unblock those stories. If the owner
consented to "apply the default when an item expires", apply it after the date and log it.

## Guardrails
- One story = one commit on the integration branch.
- Stopping for any reason (escalation, blocker, user interrupt) → remove `.claude/sprint-active`
  first and update STATE.md (`Resume with`).
- Scope creep found during the story → new story via `it-team:product-manager` `MODE: groom`
  (status `todo`), not added to the current one. A change to agreed client scope → change request
  (`docs/_team/templates/change-request.md`) and a hard stop for the owner.
- Context getting long → finish the current story, update STATE.md, and suggest a fresh session
  with `/it-team:run` or `/it-team:sprint next` (state lives in docs, nothing is lost).
- Stories run one at a time. Planned, not built yet: a pipeline where the next story's backend
  starts while the current story is in QA and review (only with no dependency and no shared
  files).
