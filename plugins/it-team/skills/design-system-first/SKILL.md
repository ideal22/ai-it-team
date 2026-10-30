---
name: design-system-first
description: Design-system-first rules for building UI that matches a design - closed token set (Tailwind v4 @theme), semantic tokens only, layout primitives built once, radius by hierarchy, long-word and focus-ring policy, states per screen, and the lint gates that enforce them. Use when writing or reviewing design-system.md, screen specs, or any React/Tailwind UI built from a design.
---

# Design-system first

The design system is a **closed set of values** the code cannot step outside of, not a document
engineers consult. Tokens, primitives and lint rules exist before the first screen; every screen
is composed from them. The rules below are the ones the two pilots paid for in review rounds:
radii (4 rounds), long ru/uz words wrapping (7), clipped or missing focus rings (3 + 3), layout
shift on hydration (2), one-off values instead of tokens (polish class PF-13).

Sources adapted: Anthropic `it-team:frontend-design` (Apache-2.0, process and anti-patterns), shadcn/ui
official skill (MIT, semantic-token rules), Tailwind v4 `@theme` docs, Google DESIGN.md lint ideas,
the pilots' `docs/qa/pitfalls.md`.

## 1. Tokens are closed

- Define every colour, font, radius, shadow and spacing step the design uses as a CSS variable in
  `globals.css` under `@theme` (Tailwind v4) and **reset the namespaces the design does not use**:
  ```css
  @import "tailwindcss";
  @theme {
    --color-*: initial;            /* no stock palette: bg-red-500 does not exist */
    --radius-*: initial;
    --shadow-*: initial;
    --color-background: oklch(…);  /* semantic names only */
    --color-foreground: …;
    --color-primary: …;  --color-primary-foreground: …;
    --color-muted: …;    --color-border: …;  --color-ring: …;
    --radius-control: 10px;  --radius-card: 16px;  --radius-pill: 999px;
    --shadow-card: 0 1px 2px …;
    --font-display: "Unbounded", …;  --font-text: "Onest", …;
  }
  ```
  shadcn's `:root { --background … }` + `@theme inline` mapping is fine; the point is that only
  semantic utilities (`bg-background`, `text-muted-foreground`, `rounded-card`) exist.
- Three tiers, named in `design-system.md`: **primitive** values (hex/oklch, never used in code),
  **semantic** tokens (what code uses), **component** tokens only when a component needs its own
  (e.g. `--color-badge-sale`).
- Light and dark are two value sets for the same semantic names. A screen never contains `dark:`
  colour overrides; it uses the semantic token that already switches.
- **Lint gate** (ESLint flat config, `eslint-plugin-better-tailwindcss` or `eslint-plugin-tailwindcss`):
  - `no-restricted-classes` banning arbitrary values and raw palette: pattern
    `^(bg|text|border|ring|shadow|rounded|fill|stroke)-\[` and `-(slate|zinc|gray|neutral|stone|red|blue|…)-\d+`;
  - `no-unknown-classes` (a typo is an error, not a silent no-op);
  - the TEAM.md gates (no plugin needed): no hand-written `mx-auto … max-w-[…]` and no numeric
    arbitrary values (`p-[22px]`) outside `shared/ui`.
  - stylelint (if the project has CSS files): `declaration-strict-value` for `color`, `background*`,
    `border*`, `box-shadow`, `font-family`, `border-radius` → `var()` only.

## 2. Primitives are built once

`design-system.md` → **Layout primitives** lists, with border-box totals per breakpoint:
`Container` (max width, gutter), `HeaderContainer` if the header's edges differ, `Section`
(vertical rhythm), `Button` sizes, `Chip`, `IconButton`, `Badge`, `ResponsiveSheet`
(dialog on desktop, sheet on mobile), `Skeleton` shapes, `EmptyCard`, `ErrorCard`.
- The app-shell story (E00) builds them in `shared/ui` plus the dev gallery route
  `/dev/components` (404 in production) showing every primitive in every state and both themes.
- A pattern that appears a second time becomes a primitive in the same story. Copied class
  strings are a review MAJOR.
- **Provided HTML is content-box**: `max-width: 1360px; padding: 0 40px` is a 1440 px border-box
  container. Write totals, then compare edges with the design (see `it-team:ui-fidelity-check`).

## 3. Shape, type, space — by hierarchy, from the design

- **Radius by hierarchy**: controls, cards, large surfaces each have one token; a value outside the
  three (or whatever the design draws) does not exist. Pills are `--radius-pill`.
- **Type scale** from the design: family, size, line-height, weight per role (display, h1–h3,
  body, small, label). Cyrillic and Uzbek Latin (oʻ gʻ ʼ) render in the chosen faces; check the
  longest locale (usually ru) in every one-line row.
- **Spacing** on the 4 px grid, section rhythm as a `Section` prop, not ad-hoc `py-*`.
- **Long words policy** (PF-03 class): user text gets `wrap-break-word` (Tailwind ≥ 4.1; `break-words`
  earlier); display words longer than the narrowest column get a soft hyphen (U+00AD) in the
  dictionary or a shorter label on phones; `hyphens: auto` only where the design allows visible
  hyphenation; **no fixed widths on labels**. Every new one-line row is checked at the drawn widths
  in all locales (the probe does it).
- **One focus ring** utility (`focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background`
  or the project's `:focus-visible` outline in `globals.css`) used by every interactive element.
  Rings must not be clipped: an ancestor with `overflow-hidden` around a focusable element needs
  padding ≥ ring width + offset, or the ring goes inside (`ring-inset`) as the design allows.
- **No layout shift on hydration**: persisted stores render behind a hydration gate with a
  fixed-size placeholder; async rows reserve their height (skeleton matches the layout).

## 4. Every screen lists its states

Per screen (spec or `screens.md` row): loading, empty (with next action), error (with retry),
success; forms add validation and submitting; lists add filtered-empty. A state not drawn is
built from the design system's `EmptyCard` / `ErrorCard` / `Skeleton` and reported as a design
question with the default used — never improvised ad hoc.

## 5. Process for a screen (engineer)

1. Read the story's context pack: primitives to use, measured facts, states, guards. Open the
   design file only at the given line range.
2. List `shared/ui` primitives you will compose; name a new primitive only if nothing fits.
3. Build mobile first at the drawn mobile width, then desktop; copy in all locales from the
   message files (typed keys).
4. Run the lint gates and the probe (`it-team:ui-fidelity-check`) at the drawn widths in every
   locale; fix edges, rows, rings and tokens before handing off. Screenshots are the reviewer's.

## 6. Anti-patterns (template tells and pilot classes)

Untouched shadcn look (slate greys, one radius, identical shadowed cards); Inter as the brand
face; gradient washes, glass, 3D; eyebrow ALL-CAPS labels, `A · B · C` meta strings, `→` on
every link, `01 / 02 / 03` on non-sequences; fade-up on every section; hover lift on every card;
emoji as icons; lorem ipsum; `text-[13px]`, `bg-[#…]`, `rounded-[20px]`; `dark:` colour
overrides; copied `mx-auto max-w-[…]`; `hyphens: auto` on headings; `overflow-hidden` wrapping
a focusable without padding; spinners where the design shows a skeleton.

## References (load on demand)
- `${CLAUDE_SKILL_DIR}/references/lint-gates.md` — the ESLint / stylelint blocks to paste.
- `it-team:ui-fidelity-check` — the measuring probe and review stages.
- `it-team:frontend-design` (copied from Anthropic's `it-team:frontend-design`, Apache-2.0) — for the
  designer's direction and self-critique passes, not for engineers.
