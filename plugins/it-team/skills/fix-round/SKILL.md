---
name: fix-round
description: How an engineer runs one fix round inside the it-team pipeline - root cause before any edit, regression test first for behavior bugs, measured fix for visual findings, targeted tests only, no browser, fixed return format, escalation when the round would not close the finding. Use when launched with MODE: fix, or when a bug report or review finding names your files.
---

# Fix round

One round = every open BLOCKER/MAJOR of the story, fixed by a fresh agent that reads only what
the findings name. The reviewer who filed a finding re-checks it after you; you do not repeat
that check. Budget per round: ≈ 60 tool calls, 10 minutes, **0 browser calls** (the pilots' fix
runs used 4–79 browser calls and 65–397 k tokens each; the median round that stayed inside this
budget cost 75 k).

Adapted from obra/superpowers `systematic-debugging` and `verification-before-completion` (MIT)
and mattpocock `diagnosing-bugs` (MIT); shortened to the pipeline's needs.

## 1. Read the findings, nothing else
- The brief lists each finding with source, file:line, expected (a number for visual findings),
  and the bug file path. Read the bug files and the story Log's last lines. Open only the files
  the findings name and their tests.
- Group findings by **root cause**, not by reviewer: three findings on one primitive are one fix.
  Write the groups as the first lines of your return draft.

## 2. Root cause before the edit
- For each group, state in one line *why* the code does this (not *what* is wrong). If you cannot,
  reproduce first: a failing unit/component test, or for a visual finding the measured value from
  the probe JSON the brief points at.
- A fix that would be "add a special case" or "tweak the value until it looks right" is a signal
  the cause is elsewhere (token, primitive, data) — fix it there, once.
- **Three failed attempts on one group → stop**: write what you tried and the hypothesis, mark the
  group `not fixed`, continue with the other groups.

## 3. Fix
- **Behaviour bug:** regression test first (red), then the smallest change (green), then refactor
  while green. The test names the bug id (`// B-013`).
- **Visual finding:** fix from the design facts in the brief (edge, radius, token, row). A test
  only when logic changed. If the fix needs a value that is not in `design-system.md`, do not
  invent it: report `design question` with your proposed default and leave the finding open.
- **Guard:** if the finding belongs to a `pitfalls.md` class, apply the class rule (use the named
  primitive, never a local copy). If it is a new class, say so in the return so QA classifies it.
- Never touch files outside your write scope; a needed change elsewhere goes under `Blocked`.

## 4. Verify (targeted, once)
- Only the test files you changed or that cover changed files: `npx vitest related --run <files>`
  (or the project's equivalent); then typecheck and lint, one call each, at the end.
- Never the full suite, never E2E, never start or stop a server: the orchestrator's cheap checks
  and the regression pack run after you.
- **Visual findings:** when the brief gives the app URL, re-run the probe once on the fixed routes
  only (`node scripts/measure.mjs --url <app URL><route> --widths <the finding's widths> --locales <the
  finding's locales> --tokens <tokens path> --out <scratch json>`) and quote the new number. No
  URL in the brief → write `not measured` and leave the check to the orchestrator.
- A behaviour fix is verified by: revert → test fails, restore → test passes (`verification-before-completion`).
  Say which you did.

## 5. Return (≤ 20 lines)
```
FIX ROUND n/2 — S-xxx
Fixed: <finding id> — <root cause, one line> — <file:line> — <test name | "probe: <new value>" | "not measured">
Not fixed: <finding id> — <why> — <what you tried> — <needs: design question D-xx / contract / owner>
Design questions: <one line each with your default>
Tests run: <command> → <pass/fail counts>; typecheck ok; lint ok
Pack gaps: <what the brief lacked and where you found it> | none
```

## Escalation (orchestrator side, for reference)
- Round 2 of the same finding → launch the fix on the stronger model (`model: opus`) with the
  round-1 return attached as a file path, not pasted.
- A finding still open after round 2 → the story is parked (`wip/s-xxx`), the class goes to the
  epic gate as a guard candidate.
