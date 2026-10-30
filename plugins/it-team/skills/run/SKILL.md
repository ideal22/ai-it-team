---
name: run
description: Hands-off build loop for a team-driven project - builds ready stories one after another under the owner's per-epic commit consent, parks questions and blockers in an inbox instead of stopping, and stops only at epic gates, hard risks, or an empty queue; hands over to a fresh session every few stories. Use when the user says "run", "keep going", "build the backlog", or after the run permission at the end of kickoff or adopt.
argument-hint: "[E02 | next]"
---

# /it-team:run — build the backlog without stopping

Target: $ARGUMENTS (default: the current epic in STATE.md, else the next epic with ready stories)

You are the **PM-orchestrator**. The story pipeline is the one in
`${CLAUDE_PLUGIN_ROOT}/skills/sprint/SKILL.md` (sections 0–6) — read it now and follow it with
the **[run]** notes. This file adds only the loop, the stop rules, and the hand-over.
Journal events (if `Journal: on`) follow sprint and TEAM.md → Run journal; log every `stop`.

## 1. Preflight (one message to the owner at most)
Read `docs/run/STATE.md`, `docs/backlog/BOARD.md`, and the project `CLAUDE.md`. Check:
- Phase is `build` (or `epic-gate` with the owner's go for the next epic). Otherwise say which
  command comes first (`/it-team:kickoff --from …`, `/it-team:adopt --from …`) and stop.
- **Run permission** in STATE.md Consents: commit consent for the target epic, and the project
  allow-list (`.claude/settings.local.json`, proposed by devops from
  `docs/_team/templates/claude-settings.local.json`). Ask for whatever is missing in **one**
  message, including whether to apply the team's default when an inbox item expires. Record the
  answers. Without commit consent, stop: use `/it-team:sprint` instead.
- Kit version: `docs/_team/VERSION` missing or older than the plugin → TEAM.md → Kit upgrades
  (owner steps go into this preflight message).
- Read inbox answers the owner gave since the last run; unblock those stories.

## 2. Loop
Repeat: pick the next story (sprint §1) → build (§2) → verify (cheap checks, probe, reviewers) within 2 fix rounds (§3) →
commit (§4). Between stories, write STATE.md and keep your own notes to the story ID, commit
hash, and verdicts — the details are in the files.

Never stop for (park it and continue with the next story):
- a product, design, or copy question → inbox item (a visible deviation from the provided
  design blocks its story until the owner answers — sprint §3 step 6);
- a role reporting Blocked, a missing input (`needs`), a missing provider key → story `blocked`;
- the fix-round budget used up → story `blocked` + inbox item;
- MINOR/NIT findings → `docs/backlog/polish.md`;
- an environment failure (DB down, port busy, flaky dev server): one fix attempt via
  `it-team:devops-engineer`; if it persists → inbox item, story `blocked`;
- a new dependency outside `adr/*-dependencies.md` → inbox item, story `blocked`.

## 3. Stop (remove `.claude/sprint-active`, update STATE.md `Resume with`, report)
- **Epic gate:** the target epic has no buildable stories left (sprint §5).
- **Hard risk:** a security hole or possible data loss you cannot contain within the story.
- **Scope change:** the work needs something outside the approved PRD / client scope → draft a
  change request, then stop.
- **Empty queue:** every remaining story is `blocked` or not `ready`.
- **Hand-over:** the context is getting long (or 5 stories finished in this session) — finish
  the current story first. If the app lets you offer a new session, offer it with
  `/it-team:run` as the first message so the owner starts it in one click.

## 4. Report (≤15 lines, the user's language)
Done stories with commit hashes · blocked stories with the reason · inbox items with the team's
default and answer-by date · what stopped the run · the next command (`/it-team:run` in a new
session, or the epic gate decision). If a push-notification tool is available, send a one-line
push when the run stops or when an inbox item blocks the last buildable story.

## Rules
- Commits only to the integration branch and only under a recorded consent; never push, never
  deploy, never touch non-local databases.
- One story at a time.
- The owner can answer inbox items in chat at any time; read them before each story.
