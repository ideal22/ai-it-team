---
name: story-context-pack
description: How to fill and refresh a story's Context pack section - files to touch, exemplar, contracts, guards, design facts with line ranges, exact check commands, and how roles report gaps back. Use in product-manager MODE: groom, by the orchestrator at each role launch, and when a role's return lists Pack gaps.
---

# Story context pack

The pack is the only thing an engineer or reviewer reads besides the acceptance criteria. It
points at paths and line ranges; it never pastes content. It lives in the story file as the
`## Context pack` section of `docs/_team/templates/story.md` (*Outcome*; *Code*: *Touch*,
*Exemplar*, *Primitives*, *Contract*, *Copy keys*; *Design*; *Guards*; *Checks* with the
*(live)* line; *Pack gaps*). Every launch brief points at it: `docs/_team/templates/launch-brief.md`.

## Filling it (`product-manager`, `MODE: groom`) — ≈ 25 tool calls per story

1. **Outcome.** Rewrite Done-when as the user-visible result plus the proof (test names, pack
   check). **Completeness:** every AC scenario and every item the story owns in Notes (P-/B-/D-
   IDs, named UI elements) appears in *Done when* or, with the owning story, in *Out of scope* —
   nothing is left implicit; the return lists them as `Folded in: <ids>`. Name neighbouring
   stories that own adjacent scope.
2. **Code.** `Glob` the slices the story names (`src/features/<slice>/**`, routes) → *Touch*.
   Find the closest existing slice with the same shape (sheet + store, list + filters, form +
   mutation) → *Exemplar* with a line range (one bounded `Read`, ≤ 80 lines). List the primitives
   from `design-system.md` → Layout primitives that the screen's sections use, plus the shared
   hooks and helpers the exemplar imports from `shared/` (Grep its imports). Grep the contract
   file for the schema names and the `api-contract.md` rows → *Contract*. Grep the message files
   for the copy namespace → *Copy keys*.
3. **Design.** Open `screens.md` at the screen's block (Grep the heading, read that block only).
   Copy the screen row reference, the states drawn, the key copy, and the **measured facts**
   (edges, radii, one-line rows). No measured facts in `screens.md` but a
   `docs/design/provided-facts.json` → point *Facts* at its screen entry
   (`provided-facts.json → screens[<File>.html]`: containers, radii, colours, fonts, strings) and
   copy the few numbers the story's sections need. Only what the JSON cannot hold (real wrapping,
   a nested container's width) → end your return with `Needs facts: <screen> <sections>` — the
   orchestrator runs `it-team:ux-ui-designer` `MODE: story` with `facts only` and re-launches the
   groom. Never open the provided file beyond one Grep for a line range. Write the provided file's line ranges
   for the story's sections (Grep `id="` / section markers).
4. **Guards.** From `docs/qa/pitfalls.md`, copy by ID the classes whose *Rule* mentions anything the
   story builds (labels/locales → PF-03; focus → PF-05; persisted state → PF-01/PF-09; tokens →
   PF-13). One line each, rule included. Add the pack line (`e2e/regression` + routes.ts).
5. **Checks.** Exact commands from the project allow-list, one per line: targeted vitest path,
   typecheck, lint, and the build when the story adds or changes a statically generated route
   (`generateStaticParams`). No `cd`, no pipes.
6. **Size.** ≤ 60 lines. Over → split the story or cut explanation.
7. **Stamp.** Set the first line to `Filled: <date> · base <HEAD commit> · Stale: no`.

## Refreshing it (orchestrator)
- At every launch: rewrite the `(live)` lines (app URL, warmed routes, base commit).
- After a `story-done` whose diff touched a path named in a dependant story's *Touch* → set
  that pack's `Stale: yes`; sprint's "Pack before build" regrooms it before the story starts.
- After every role return: append its `Pack gaps:` lines to the story's *Pack gaps*; journal
  `pack-gap`. Never answer a gap by pasting content into the next brief — fix the pack.

## Gap feedback (every role)
End every return with `Pack gaps: <what was missing and where you found it, file:line> | none`.
Typical gaps that should become pack lines: a primitive the role did not know existed; a contract
field; a drawn state not in the row; a locale string longer than the column; a command that
needed a permission prompt.

## At the epic gate
Gaps with 2+ occurrences across the epic's stories → a grooming rule in this skill or a
`screens.md` / `design-system.md` fix (designer `MODE: story`). Report the count in the gate.
