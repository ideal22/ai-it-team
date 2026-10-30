---
name: retro
description: Retrospective of a team-driven project, pilot, epic, or release - reads the run journal, STATE.md, backlog, bugs, polish, and git history once and reports where the team needed the owner, where it stalled, fix rounds, role errors, permission prompts worth allow-listing, and which kit improvements would have saved the most. Use when the user says "retro", "retrospective", or after a pilot, an epic gate, or a release.
argument-hint: "[all | E02 | v1] [--cost <amount from /usage>]"
---

# /it-team:retro — what slowed the team down, and what to fix in the kit

Scope: $ARGUMENTS (default `all`)

You are the **PM-orchestrator**. Read everything below **once**, compute, write one report. Do not
launch role agents. Speak the owner's chat language.

## 1. Read (once)
- `docs/run/journal.md` — the event log (TEAM.md → Run journal). If it is missing or STATE.md
  says `Journal: off`, say so: the report then rebuilds what it can from the sources below and
  marks owner touches and permission prompts as incomplete.
- `docs/run/STATE.md` — track, gates, consents, inbox, deferred stories.
- `docs/backlog/BOARD.md`, story frontmatter (`status`, `size`, `depends_on`, `needs`), and only
  the **Log** sections of stories in scope.
- `docs/qa/bugs/*.md` (severity, owner, status), `docs/backlog/polish.md`.
- `git log --format='%h %ad %s' --date=iso` on the integration branch, plus `wip/*` branches.
- Client projects: `docs/client/approvals.md` (gate waiting times).

## 2. Compute
1. **Owner touches** — total, per phase, by cause (gate, consent, question, inbox answer,
   permission prompt, blocked, stop). Mark each cause *needed* (a real decision) or *avoidable*
   (could have been a default, an inbox item, the allow-list, or a better spec). Compare with the
   target of ≈10–12 touches per project.
2. **Flow** — per story: time from `story-start` to `story-done`, fix rounds used, stories that
   hit the 2-round budget, parked `wip/` branches. Slowest 5 stories and why.
3. **Stalls** — `blocked`, `inbox`, `env-fail`, and `stop` rows grouped by reason, with the
   stories they cost.
4. **Role quality** — `mode-error` and `rerun` rows per role; bug counts per owner and severity;
   design-review findings that repeat across stories.
5. **Permissions** — `permission` rows grouped by tool and command prefix. Propose allow-list
   lines only for local, non-destructive commands; never push, deploy, remote databases,
   `migrate reset`/`deploy`, or package installs.
6. **Cost** (if `--cost` is given) — cost per done story and per epic.

## 3. Map findings to fixes
For each finding, name where the fix belongs:
- **kit** — the it-team plugin (agent prompt, skill step, template, a wave-3 accelerator:
  scaffold, `packages/shared` kit, test kit, ready modules, ops kit, grammY patterns, SEO kit; or a
  wave-4 item: model routing, tool allow-lists, prototype by section, checkable Done-when).
- **project** — this repo only (allow-list, seed data, a flaky test, a missing doc).
- **owner** — habits (answering the inbox, giving inputs earlier).
Rank kit fixes by touches or rounds they would have saved.

## 4. Write the report
`docs/run/retro-<YYYY-MM-DD>.md`:
1. Summary — 5 lines: touches (needed / avoidable), stories done, average rounds, top 3 problems.
2. Tables for sections 2.1–2.6.
3. **Kit improvements**, ranked: finding → evidence (journal rows, story IDs) → proposed change →
   expected saving. Client projects: no client names, data, or quotes in this section — it is
   meant to be carried to the kit repo.
4. Project fixes and owner habits.
Then show a ≤15-line summary in chat with the report path. Do not edit the kit or commit; the
owner carries the kit section to the `ai-it-team` repo.
