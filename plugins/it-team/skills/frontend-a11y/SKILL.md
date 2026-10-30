---
name: frontend-a11y
description: React accessibility patterns - semantic HTML, labels, form errors, ARIA, keyboard, focus, live regions, Radix/shadcn. Use when building or reviewing forms, dialogs, menus, or fixing a11y findings.
---

# Frontend Accessibility Patterns

Practical WCAG-oriented patterns for React 19 + Tailwind + shadcn/Radix. Covers the issues most
often flagged in review: unlabeled controls, disconnected errors, misused ARIA, non-semantic
interactive elements, and broken focus/keyboard behavior.

## When to Activate

- Building or reviewing forms, dialogs, menus, popovers, tabs, comboboxes, toasts
- Seeing `onClick` on a `<div>`/`<span>`, or adding any `aria-*` attribute
- Implementing keyboard navigation or focus management
- Fixing axe / eslint-plugin-jsx-a11y findings (escalate deep audits to the `a11y-reviewer` agent)

## Rule Zero: Use the Primitive

**Prefer Radix/shadcn primitives** (Dialog, AlertDialog, DropdownMenu, Popover, Select, Tabs,
Tooltip, Accordion, Command/Combobox). They ship correct roles, focus trapping, focus restore,
Escape handling, and arrow-key navigation. **Hand-roll a widget only when no primitive exists**,
and then follow the matching WAI-ARIA Authoring Practices pattern exactly.

When using primitives, still supply what they cannot know:

- `DialogTitle` (and `DialogDescription` or `aria-describedby={undefined}` explicitly)
- Accessible names for icon-only triggers
- Translated labels for every visible and screen-reader-only string (i18n, never hardcoded)

## Semantic HTML First

```tsx
// BAD: no role, no keyboard, no focus
<div onClick={save}>Save</div>

// GOOD
<button type="button" onClick={save}>{t("common.save")}</button>

// Navigation is a link, not a click handler
<Link to="/budget">{t("nav.budget")}</Link>
```

- One `<h1>` per page; don't skip heading levels
- Landmarks: `<header>`, `<nav>`, `<main>`, `<footer>`; label repeated landmarks (`aria-label`)
- Lists are `<ul>/<ol>`, tables of data are `<table>` with `<th scope>`

## Forms

### Labels and required fields

```tsx
<label htmlFor={id}>
  {t("auth.email")} <span aria-hidden="true">*</span>
</label>
<input id={id} type="email" name="email" autoComplete="email" required />
```

- `required` already exposes "required" to assistive tech - do not add `aria-required` alongside it
- Use `aria-required="true"` only on custom widgets that cannot take `required`
- Placeholder is never a label; set `autoComplete` for known fields
- Generate ids with `useId()`, never hardcode ids in reusable components

### Field errors: `aria-invalid` + `aria-describedby`, one announcement

Link each error to its field, but do **not** put `role="alert"` on every field error - several
alerts firing at once is noise. On submit, move focus to the first invalid field (or to an
error summary) and announce once through a single live region.

```tsx
import { useId } from "react";

type FieldProps = {
  label: string;
  error?: string; // already translated
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function TextField({ label, error, hint, ...inputProps }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter((v): v is string => v !== null)
    .join(" ");

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint ? <p id={hintId}>{hint}</p> : null}
      {error ? <p id={errorId}>{error}</p> : null}
    </div>
  );
}
```

```tsx
// One polite live region per form, populated on submit
<p role="status" aria-live="polite" className="sr-only">
  {submitCount > 0 && errorCount > 0 ? t("form.errorsCount", { count: errorCount }) : ""}
</p>
```

With React Hook Form, `handleSubmit` focuses the first invalid registered field by default
(`shouldFocusError`). shadcn's `<FormControl>` wires `aria-invalid` and `aria-describedby`
for you - use it rather than duplicating the wiring.

## ARIA Essentials

ARIA only when native semantics are insufficient. Wrong ARIA is worse than none.

```tsx
// Icon-only button: name the action; hide the icon
<button type="button" aria-label={t("expense.delete")}>
  <TrashIcon aria-hidden="true" />
</button>

// Visible text labels a region
<section aria-labelledby={titleId}>
  <h2 id={titleId}>{t("dashboard.recent")}</h2>
</section>

// Disclosure
<button aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
  {t("faq.question")}
</button>
<div id={panelId} hidden={!open}>{children}</div>
```

### Live regions

- `role="status"` (polite) for success messages, counts, async results
- `role="alert"` (assertive) only for urgent, interruptive errors - sparingly
- The live region must exist in the DOM **before** its content changes; render it once and
  update its text
- Toasts: use the shadcn/Radix Toast (or Sonner), which manages its own live region

## Keyboard

- Everything interactive reachable with Tab, in visual order; no positive `tabIndex`
- Enter/Space activate buttons; Escape closes overlays; arrow keys move within composite widgets
- Visible focus: keep Tailwind `focus-visible:` rings; never `outline: none` without a replacement
- Skip link to `<main>` on pages with long navigation

### Comboboxes, selects, menus

Do not hand-roll these. Use shadcn `Select` (Radix), `DropdownMenu`, or the shadcn Combobox
(Popover + `cmdk` Command). If you truly must build one, follow the APG combobox pattern:

- Focus stays on the input (`role="combobox"`, `aria-expanded`, `aria-controls={listboxId}`)
- Each option has a stable `id`; the input's `aria-activedescendant` points at the active one
- Options: `role="option"` with `aria-selected` on the selected value
- Arrow keys move the active option, Enter selects, Escape closes, Tab leaves

```tsx
<input
  role="combobox"
  aria-expanded={open}
  aria-controls={listboxId}
  aria-autocomplete="list"
  aria-activedescendant={open && active !== undefined ? `${listboxId}-${active.id}` : undefined}
  onKeyDown={onKeyDown}
/>
<ul id={listboxId} role="listbox" hidden={!open}>
  {options.map((o) => (
    <li key={o.id} id={`${listboxId}-${o.id}`} role="option" aria-selected={o.id === value}>
      {o.label}
    </li>
  ))}
</ul>
```

(`active` comes from `options[activeIndex]`, which is `T | undefined` under
`noUncheckedIndexedAccess` - guard it as shown.)

## Focus Management

- **Dialogs:** use Radix `Dialog`/`AlertDialog` - focus moves in, is trapped, and returns to the
  trigger on close. Set initial focus with `onOpenAutoFocus` when the first field isn't right.
- **Route changes (SPA):** move focus to the new page's `<h1>` (with `tabIndex={-1}`) or a
  skip target, and update `document.title`.
- **Removing content:** when a focused element is deleted (e.g. a list row), move focus to a
  sensible neighbor or the list heading.

```tsx
function PageHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    ref.current?.focus();
  }, [pathname]);
  return (
    <h1 ref={ref} tabIndex={-1} className="outline-none">
      {children}
    </h1>
  );
}
```

## Images, Icons, Charts

- Decorative: `alt=""` (an `<img>` with empty alt is already hidden; `aria-hidden` unnecessary)
- Meaningful: `alt` describes the information, not the pixels
- SVG icons inside labelled buttons: `aria-hidden="true"`
- Charts: provide a text summary or an accessible data table alternative; never rely on color
  alone (add labels, patterns, or icons for over-budget/under-budget states)

## Color, Contrast, Motion, Zoom

- Text contrast at least 4.5:1 (3:1 for large text and UI component boundaries), in light and dark
  themes
- Respect `prefers-reduced-motion` - Tailwind `motion-safe:` / `motion-reduce:` variants
- Layout works at 200% zoom and 320px width (mobile-first); touch targets at least 24x24 CSS px
  (44x44 recommended)
- Set `<html lang>` to the active i18n language and update it on language change

## Anti-Patterns

```tsx
<div onClick={go}>Go</div>                     // not focusable, no role
<div aria-label="Navigation">...</div>          // aria-label on a generic div is ignored
<input placeholder="Email" />                   // placeholder is not a label
<button tabIndex={3}>Submit</button>            // positive tabIndex
<button aria-hidden="true">Open</button>        // focusable but hidden from AT
<input required aria-required="true" />          // redundant
{errors.map((e) => <p role="alert">{e}</p>)}    // alert storm
```

## Testing

- Component: `vitest-axe` in `it-team:react-testing`; query by role/label so tests fail when a11y breaks
- E2E: `@axe-core/playwright` in `it-team:e2e-testing` (covers real contrast)
- Manual: keyboard-only pass, and a screen reader smoke test (VoiceOver / NVDA / TalkBack)

## Checklist

- [ ] Radix/shadcn primitive used where one exists
- [ ] Every control has a programmatic label (translated)
- [ ] Errors: `aria-invalid` + `aria-describedby`; focus to first error; one live announcement
- [ ] No redundant `aria-required` next to `required`
- [ ] Icon-only buttons named; decorative images `alt=""`
- [ ] Full keyboard operability, visible focus, no positive `tabIndex`
- [ ] Focus handled on dialog open/close and route change
- [ ] Contrast, reduced motion, zoom, and `<html lang>` verified

<!-- Adapted from everything-claude-code by Affaan Mustafa (MIT License). See ~/.claude/THIRD_PARTY_NOTICES.md -->
