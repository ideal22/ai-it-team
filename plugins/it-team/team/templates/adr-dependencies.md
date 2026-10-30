# ADR-<NNN>: Pre-approved dependencies

Status: proposed | accepted (<date>, by the owner)

## Context
Agents must not add packages without the owner's OK. Approving the expected set once, at the
architecture review, lets stories run without stopping for each `add`.

## Decision — approved packages
| Package | Workspace | Why | Alternatives considered | Size / maintenance |
|---|---|---|---|---|
| zod | packages/shared | contracts | — | small, active |

## Rules
- A package in this table may be added by its owning role without asking.
- Anything else is a proposal in the story result → the story is blocked with an inbox item for
  the owner; `/it-team:run` continues with other stories meanwhile.
- Major-version upgrades always ask.
