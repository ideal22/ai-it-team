# Lint gates for a design-system-first frontend

Paste after the presets that register `@typescript-eslint` and the TEAM.md → Lint gates block
(`no-deprecated`, the TypeScript rules, hand-written containers). Adjust the palette names to what the design reset.

## ESLint (flat config)
```js
// Raw palette and arbitrary values are not design tokens.
{
  files: ['**/*.{ts,tsx}'],
  rules: {
    'no-restricted-syntax': ['error',
      { selector: 'Literal[value=/\\b(bg|text|border|ring|shadow|rounded|fill|stroke)-\\[/], TemplateElement[value.raw=/\\b(bg|text|border|ring|shadow|rounded|fill|stroke)-\\[/]',
        message: 'Arbitrary value: add a token to globals.css (design-system.md) instead.' },
      { selector: 'Literal[value=/\\b(bg|text|border|ring)-(slate|zinc|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d+/]',
        message: 'Stock palette: use a semantic token (bg-background, text-muted-foreground, …).' },
      { selector: 'Literal[value=/\\bdark:(bg|text|border)-/]',
        message: 'Semantic tokens already switch in dark mode; no dark: colour overrides.' },
    ],
  },
},
{ files: ['**/shared/ui/**'], rules: { 'no-restricted-syntax': 'off' } },
```
With `eslint-plugin-better-tailwindcss` (or `eslint-plugin-tailwindcss`) also enable
`no-unknown-classes` / `no-contradicting-classname` so a typo is an error, not a silent no-op.

## stylelint (projects with CSS files)
```js
// .stylelintrc.cjs
module.exports = {
  plugins: ['stylelint-declaration-strict-value'],
  rules: {
    'scale-unlimited/declaration-strict-value': [
      ['/color$/', 'background', 'background-color', 'border', 'border-color', 'box-shadow', 'font-family', 'border-radius'],
      { ignoreValues: ['transparent', 'inherit', 'currentColor', 'none', '0'] },
    ],
  },
};
```

## What the probe still catches
Values that reach the DOM through computed styles (inline styles, third-party components, data
colours): `node scripts/measure.mjs --tokens …` lists them as MINOR token leaks.
