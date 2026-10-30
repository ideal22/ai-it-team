---
name: ui-fidelity-check
description: Two-stage UI fidelity check for implemented screens against a design - a deterministic Playwright probe (edges, one-line rows, overflow, clipped focus rings, layout shift, token leaks, console errors) at the drawn widths and locales, then a bounded LLM judgment only on what the probe cannot measure. Use in design review, in the regression pack, and by the frontend engineer before hand-off.
---

# UI fidelity check

Measure first, judge second. In the pilots the design reviewer caused 22 of 25 fix rounds in
the storefront pilot and 6 of 10 in the landing-page pilot; most findings were numbers (an edge 8 px off, a row
that wraps in ru, a radius 20 instead of 16, a ring clipped by `overflow-hidden`, CLS on
hydration). Numbers come from a script; the model spends its budget on hierarchy, states and
template tells.

## Stage 1 — probe (deterministic, ≈ 30 s per screen)

`scripts/measure.mjs` (below) runs with the project's Playwright against the app URL and, when
present, the design file (`file://…/docs/design/provided/<Screen>.html`). Output: one JSON per
screen in `test-results/design/S-xxx-measure.json` plus one line per failing check.

Checks, each with its pass rule:
| Check | Measure | Fails when |
|---|---|---|
| Edges | content box of the header card, each top-level section and the footer at the desktop width (descends past full-bleed wrappers) | with `--edges` / `--header-edges`: an edge > 2 px off the design's numbers (from `screens.md`) |
| One-line rows | distinct `offsetTop` of the items in rows marked `data-row="one-line"` (header nav, tabs, button groups, meta lines), per locale | > 1 row at a drawn width in any shipped locale |
| Horizontal overflow | `scrollWidth > clientWidth`, and any element past the right edge that no scroller clips, at every drawn width | any overflow |
| Mid-word break | for every heading and label: `Range.getClientRects()` per word → a word split across two rects without a hyphen/soft hyphen | any split |
| Focus ring visible | every focusable (≤ 150) focused with `focusVisible`; outline or box-shadow ring box vs clipping ancestors; rings drawn inside (negative offset / `ring-inset`) and elements scrolled out of a scroller are fine | ring clipped on any side, or no ring |
| Layout shift | `PerformanceObserver('layout-shift')` from load to idle, then after `--seed` storage and reload | CLS > 0.01 |
| Token leaks | computed styles of every element: colours, radii, font-family → compared to the token set exported from `globals.css` | a value not in the set (MINOR; images and `[data-token-exempt]` skipped) |
| Console | errors and hydration warnings during load and the state walk | any |
| Touch targets | interactive elements at the mobile width | < 44 px (MINOR; the design's drawn size wins when the owner accepted it) |

Width matrix: the drawn widths (provided design: e.g. 390 and 1440; team design: 375 and 1280),
each shipped locale at the desktop width, the second locale at mobile for text-heavy screens.
Breakpoint edges (`bp − 1`, `bp`) only when the story changes a breakpoint.

### Running the probe
The kit ships the probe as `docs/_team/templates/scripts/measure.mjs` (kickoff copies it to the
project's `scripts/`; older projects get it through the 0.16.0 kit upgrade), with
`tokens-from-css.mjs` (exports the `@theme` / `:root` tokens as JSON) and `tokens-lint.mjs`
(dangling `var()`, missing semantic roles, radius tiers, WCAG contrast of every implied pair).
```bash
node scripts/tokens-from-css.mjs src/app/globals.css --out test-results/design/tokens.json
node scripts/measure.mjs --url http://localhost:3000/product/x --widths 390,1440 --locales uz,ru,en \
  --tokens test-results/design/tokens.json --edges 40,1400 --header-edges 24,1416 \
  --out test-results/design/S-017-measure.json
```
One line per width/locale (`ok`, or `FAIL` with the BLOCKER/MAJOR checks, then the MINOR list);
exit code 1 when a BLOCKER/MAJOR check fails. The JSON keeps every measurement (edges with the
element that set them, rows, overflow elements, split words, ring issues, CLS, token leaks with
counts and selectors, console errors, small targets) so the reviewer quotes numbers instead of
re-measuring. `--seed seed.json` sets `localStorage` and reloads to measure CLS with persisted
state; `--locale-path 'query:lang'` for `?lang=` locales.

Edges against the design: run the same `edgesOf` on the design file (`--design`), diff per
section; the designer's `screens.md` row carries the expected numbers so the check also works when
the design file does not render standalone (e.g. `dc-import` wrappers).

Token leaks: computed colours (hex/rgb/oklab/oklch normalised to rgb, alpha ignored), radii and
font families are compared with the exported token set; images, SVG and `[data-token-exempt]`
subtrees are skipped. Product-content colours (swatches) show up as MINOR — the reviewer decides.

## Stage 2 — judgment (model, bounded)

Only after stage 1 is green or its failures are listed. Budget: ≤ 25 tool calls, ≤ 6 browser calls,
one screenshot per drawn width (scale 0.5) of the changed screens only.
Judge, per the screen spec and the taste profile's banned list:
1. **Hierarchy and fidelity** — layout, order of sections, the signature element, missing or extra
   elements vs the design row in `screens.md`.
2. **States** — each listed state looks designed (not a bare spinner or "No data").
3. **Template tells** — anything from the banned list.
4. **Copy** — matches the spec and locale.
Do not re-measure what stage 1 measured; quote its numbers in the finding.

Output: `DESIGN REVIEW — S-xxx — PASS | CHANGES REQUESTED`, then `BLOCKER / MAJOR / MINOR` lines
with route, file:line, expected (number or spec reference), fix hint; `Probe: <json path>`;
`Screenshots: <paths>`. At most 5 MINOR. A deviation the owner accepted is still reported with
"owner decision D-xx".

## Where it runs
| When | Who | What |
|---|---|---|
| Before hand-off | frontend-engineer `implement` | stage 1 on the story's routes (no screenshots) — fixes numbers before any reviewer |
| Before every review | orchestrator | regression pack (`e2e/regression`) + stage 1 on changed routes; red → fix round, no reviewers |
| Verify step | design-reviewer `review` | stage 1 result + stage 2 |
| Re-check | design-reviewer `MODE: recheck` | stage 1 only on the fixed items, stage 2 only if a fix changed layout and only on the listed findings |
| Regression pack | qa-engineer `regression` | overflow, rows, console, mid-word, rings on sample routes × locales, < 90 s |
