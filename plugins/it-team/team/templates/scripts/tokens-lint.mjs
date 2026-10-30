#!/usr/bin/env node
// Lint a design-token CSS file (docs/design/tokens.css or src/app/globals.css):
//   1. every `var(--x)` referenced in the token blocks is defined (no dangling references);
//   2. the semantic roles shadcn/Tailwind utilities expect exist (background, foreground, primary,
//      primary-foreground, muted, muted-foreground, border, ring, card, destructive);
//   3. radius tiers: at least two radius tokens (control / card) or one `--radius`;
//   4. WCAG contrast of every text/background pair that the names imply (`x` / `x-foreground`),
//      plus foreground on background and muted-foreground on background, light and dark:
//      < 3:1 FAIL, < 4.5:1 WARN (large text only), else ok;
//   5. orphan tokens: defined in `:root` but never referenced by another token (informative).
// usage: node scripts/tokens-lint.mjs src/app/globals.css [--json out.json]   exit 1 on FAIL
import fs from 'node:fs';
import path from 'node:path';
import { parseTokens, resolve, normColor, looksLikeColor, inputFile } from './tokens-from-css.mjs';

const args = process.argv.slice(2);
const file = inputFile(args, ['--json']);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : '';
if (!file) { console.error('usage: tokens-lint.mjs <tokens.css|globals.css> [--json out.json]'); process.exit(2); }
const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const raw = parseTokens(css);
const findings = [];
const add = (level, check, msg) => findings.push({ level, check, msg });

// 1. dangling var() references inside token blocks
const defined = new Set([...Object.keys(raw.light || {}), ...Object.keys(raw.dark || {})]);
for (const scope of Object.keys(raw)) for (const [name, value] of Object.entries(raw[scope]))
  for (const m of value.matchAll(/var\(--([\w-]+)/g))
    if (!defined.has(m[1]) && !/^font-|^tw-/.test(m[1])) add('FAIL', 'dangling', `--${name} references undefined --${m[1]}`);

// 1b. colour tokens the probe cannot compare (color-mix, lab, lch, …): every use becomes a "leak"
for (const scope of Object.keys(raw)) for (const [name, value] of Object.entries(raw[scope])) {
  const v = resolve(value, scope, raw);
  if (looksLikeColor(v)) add('WARN', 'unparsed', `${scope} --${name}: ${v} is not normalised; use oklch/hex/rgb/hsl for tokens`);
}

// 2. semantic roles
const roles = ['background', 'foreground', 'primary', 'primary-foreground', 'muted', 'muted-foreground', 'border', 'ring', 'card', 'destructive'];
const has = (n) => defined.has(n) || defined.has(`color-${n}`);
for (const r of roles) if (!has(r)) add('FAIL', 'roles', `missing semantic token --${r} (or --color-${r})`);

// 3. radius tiers
const radii = [...defined].filter((n) => /radius/.test(n));
if (radii.length === 0) add('FAIL', 'radius', 'no radius token (--radius or --radius-*)');
else if (radii.length === 1 && !defined.has('radius')) add('WARN', 'radius', `one radius token only (${radii[0]}): controls and cards share one tier?`);

// 4. contrast
const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).map((c) => { c = +c / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
// A role resolves from `--x` or from Tailwind v4's `--color-x`, in the scope first, then light.
const valueOf = (name, scope) => raw[scope]?.[name] ?? raw[scope]?.[`color-${name}`] ?? raw.light?.[name] ?? raw.light?.[`color-${name}`];
const colorOf = (name, scope) => { const v = valueOf(name, scope); return v ? normColor(resolve(v, scope, raw)) : null; };
const role = (n) => n.replace(/^color-/, '');
const pairs = [];
for (const scope of Object.keys(raw)) {
  const names = Object.keys(raw[scope]).map(role);
  for (const n of names) if (n.endsWith('-foreground')) pairs.push([scope, n, n.replace(/-foreground$/, '')]);
  if (names.includes('foreground') || scope === 'dark') pairs.push([scope, 'foreground', 'background'], [scope, 'muted-foreground', 'background'], [scope, 'muted-foreground', 'card']);
}
const seen = new Set();
const contrast = [];
for (const [scope, fg, bg] of pairs) {
  const key = `${scope}:${fg}/${bg}`; if (seen.has(key)) continue; seen.add(key);
  if (!valueOf(fg, scope) || !valueOf(bg, scope)) continue; // pair not defined (e.g. sidebar-foreground without --sidebar)
  const f = colorOf(fg, scope), b = colorOf(bg, scope);
  if (!f || !b) { add('WARN', 'contrast', `${scope} --${fg} on --${bg}: colour not parsed (${f ? '' : valueOf(fg, scope)} ${b ? '' : valueOf(bg, scope)}), contrast not checked`); continue; }
  const r = ratio(f, b);
  contrast.push({ scope, fg, bg, ratio: +r.toFixed(2) });
  if (r < 3) add('FAIL', 'contrast', `${scope} --${fg} on --${bg}: ${r.toFixed(2)}:1 (< 3:1)`);
  else if (r < 4.5) add('WARN', 'contrast', `${scope} --${fg} on --${bg}: ${r.toFixed(2)}:1 (large text only)`);
}

// 5. orphans (informative)
const referenced = new Set();
for (const m of css.matchAll(/var\(--([\w-]+)/g)) referenced.add(m[1]);
for (const n of Object.keys(raw.light || {})) if (!referenced.has(n) && !/^(color|radius|shadow|font|ease|spacing|breakpoint|animate|text|leading|tracking)-/.test(n) && n !== 'radius')
  add('INFO', 'orphan', `--${n} is defined but no other token references it (fine if utilities use it directly)`);

const fails = findings.filter((f) => f.level === 'FAIL').length, warns = findings.filter((f) => f.level === 'WARN').length;
for (const f of findings.filter((f) => f.level !== 'INFO')) console.log(`${f.level} ${f.check}: ${f.msg}`);
console.log(`tokens-lint ${file}: ${fails} FAIL, ${warns} WARN, ${findings.filter((f) => f.level === 'INFO').length} info; ${contrast.length} contrast pairs checked`);
if (jsonOut) { fs.mkdirSync(path.dirname(jsonOut), { recursive: true }); fs.writeFileSync(jsonOut, JSON.stringify({ file, findings, contrast }, null, 1)); }
process.exit(fails ? 1 : 0);
