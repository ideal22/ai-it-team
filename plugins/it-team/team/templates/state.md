# Run state: <product>

<!-- docs/run/STATE.md — written ONLY by the orchestrator (kickoff, adopt, sprint, run, release).
Every it-team skill reads it first and resumes from it. Keep it short: facts, not history
(history lives in story Logs and git). Update it at every phase change, gate, consent, story
stage change, and inbox change. -->

Updated: <YYYY-MM-DD HH:MM>

## Project
- Type: client | own · Track: lite | standard
- Integration branch: release/v1 (cut from the scaffold commit)
- Release in progress: v1
- Journal: on | off — `docs/run/journal.md` (TEAM.md → Run journal); `on` for pilots and after
  big kit changes, `off` by default otherwise

## Phase
<intake | discovery | gate-a | architecture | scaffold | design | gate-b | permission | build | epic-gate | release | done>
Resume with: `<exact command, e.g. /it-team:run>`

## Gates
| Gate | Status | Date | Record |
|---|---|---|---|
| Client Gate A — PRD + directions | pending / approved / changes requested | | docs/client/approvals.md |
| Architecture (owner) | pending / approved | | |
| Client Gate B — design + plan | pending / approved | | |
| Run permission | pending / given | | |

## Consents (from the owner, in chat)
| What | Scope | Given | Notes |
|---|---|---|---|
| Commit stories to the integration branch when QA, design review, and code review are green | E01 | <date> | |
| Project allow-list `.claude/settings.local.json` | project | <date> | |
| Apply the team's default answer when an inbox item expires | project | no | |

## Current
- Epic: E01 · Story: S-004 · Stage: contract | implement | checks | probe | qa | design-review | code-review | fix (round n/2) | recheck | commit
- Stories finished in this session: 0 (run hands over when the context gets long, at most 5)

## Inbox (decisions for the owner)
| ID | Asked | Question | Options | Team default | Answer by | Blocks | Answer |
|---|---|---|---|---|---|---|---|
| D-01 | <date> | | A / B | A | <date> | S-007 | |

## Deferred stories
| Story | Why | Waiting for |
|---|---|---|

## Expected inputs (details in docs/client/inputs.md)
| Input | Owner | Needed by | Status |
|---|---|---|---|
