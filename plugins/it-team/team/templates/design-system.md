# Design system: <product>

## Brand & tone
<3 adjectives; personality; what it must NOT look like>

## Tokens (implemented as shadcn/Tailwind CSS variables)
| Token | Light | Dark | Use |
|---|---|---|---|
| --background | | | |
| --foreground | | | |
| --primary | | | |
| --primary-foreground | | | |
| --muted / --accent / --destructive / --border / --ring | | | |
| --radius | | | |

All text/background pairs meet WCAG AA (4.5:1 body, 3:1 large/UI).

## Typography
Font family (Google Fonts or system), scale (xs…3xl), weights, line heights.

## Spacing, layout, breakpoints
4px grid; container widths; mobile-first breakpoints.

## Layout primitives (built once in `shared/ui`, never copied as class strings)
| Primitive | Values per breakpoint (border-box totals) | Used on |
|---|---|---|
| Container | max width 1440 total, gutter 40 (desktop) / 12 (mobile) | every page section, header, footer |
| Section | top spacing 88 / 56 … | home, catalog |
| Button | sizes sm / md / lg: height, radius, type | … |
| Chip, icon button, badge | … | … |

## Components
shadcn/ui components used and any project-specific variants. New components only when
shadcn has no fit — list them with purpose.

## Iconography & imagery

## Motion
Durations/easing; respect prefers-reduced-motion.

## Voice & microcopy
Button verbs, empty-state tone, error message style.
