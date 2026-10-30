---
name: team-status
description: Report AI-team project progress from docs/run/STATE.md and docs/backlog - the decision inbox first, then done, in progress, blocked, next up, open bugs, and release readiness; optionally publish it as a status page to read from a phone. Use when the user asks "status", "where are we", or "what's next" on a team-driven project.
argument-hint: "[--page]"
---

# /it-team:team-status

Arguments: $ARGUMENTS

1. Read `docs/run/STATE.md`, `docs/backlog/BOARD.md`, all `docs/backlog/stories/*.md`
   frontmatter, open `docs/qa/bugs/*.md`, `docs/client/inputs.md` (if present), and
   `git log --oneline -15` on the integration branch. Trust story frontmatter over BOARD.md;
   if they disagree, fix BOARD.md and mention it.
2. Report in the user's language, compact:
   - **Inbox first:** open decisions from STATE.md — question, options, the team's default,
     answer-by date, which stories wait. The owner can answer right here; record the answers in
     STATE.md and say which stories are unblocked.
   - Phase, open gates, and the next command (`Resume with` in STATE.md).
   - Release progress: `v1: 7/18 stories done (39%)`, by epic.
   - In progress / review — with the stage (build, QA, review, waiting for user).
   - Blocked — reason and who/what unblocks it (inbox item, input, parked `wip/` branch).
   - Open inputs from `inputs.md` that will block a story soon.
   - Open bugs by severity.
   - Next 3 ready stories.
   - Polish items waiting for the next epic gate (count).
   - Risks: stories without AC/screens, PRD items unmapped, stale `in-progress` (> 3 days).
3. With `--page`: publish the same content as a private Artifact (progress bars per epic, tables),
   updating the same file on later runs so the link stays stable.
