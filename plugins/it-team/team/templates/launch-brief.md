# Role launch brief

The one prompt shape the orchestrator sends to every story-scoped role. It points at the story's
`## Context pack` and adds only what the pack cannot know in advance. Delete a line that has
nothing to say; never leave a placeholder.

```text
MODE: <implement | fix | contract | story | review | recheck | groom | delta>
Story: S-xxx — <title> · docs/backlog/stories/S-xxx-<slug>.md — read § Acceptance criteria and § Context pack; nothing else of the backlog (groom and delta: what the mode needs)
Base: <commit> · Branch: <release/vX> · App: <url | none> · Routes warmed: <list | n/a>
Task: <one or two sentences: exactly what this launch must produce>
Findings (fix / recheck only): <id — source — file:line — expected (number when there is one)>, one per line, or a path to the list
Budget: ≈ <N> tool calls, <M> minutes, <K> browser calls (0 for engineers); over budget → stop and return what is done and what is left
Return (≤ 20 lines): <the role's Return format> · roles that read the pack end with `Pack gaps: <lines> | none`
Do not: read whole design files (use the pack's line ranges) · start or stop servers · commit · ask the owner (write the question with your default)
```

Per mode, add only:
| Mode | Extra lines |
|---|---|
| `implement` (FE/BE) | `Contract ready: yes/no (schemas at …)`; FE: widths, shipped locales, tokens path for the probe |
| `fix` | `Round n/2`; the findings above with their source (qa / design / code / a11y / react / security) |
| `review` (design-reviewer) | the probe JSON path; `Judge only: <screens / states changed>`; widths and locales |
| `story` (QA) | `Critical journey touched: yes/no (spec path)`; the probe JSON path |
| `recheck` | only the ids to confirm, the fix return path, the new probe JSON path |
| `groom` (PM) | `Stories: S-xxx, …`; `Fill § Context pack`; `Pack gaps to fold in: <lines>` |
| `contract` (BE) | the endpoints or repository methods by name |

Rules: the brief points at files and never pastes a document, a previous role's full return, or
more than 20 finding lines (write them to `docs/qa/bugs/` or `test-results/review/` and point at
the file). A fix round is a fresh agent, never `SendMessage` to the implementer. Reviewers get
facts, never verdicts.
