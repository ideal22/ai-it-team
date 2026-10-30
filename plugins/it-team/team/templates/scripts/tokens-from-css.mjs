#!/usr/bin/env node
// Export the design tokens of a Tailwind v4 / shadcn globals.css as JSON for the probe and the lint.
// usage: node scripts/tokens-from-css.mjs src/app/globals.css --out test-results/design/tokens.json
// Reads the custom properties of `:root` / `html`, `.dark` / `[data-theme=dark]`, `@theme` blocks and
// the same selectors nested in `@layer` / `@media (prefers-color-scheme: dark)` (static text, no
// build); resolves `var()` chains and `calc()` over px/rem/numbers; normalises hex, rgb(a), hsl(a),
// oklch, oklab, white/black to `rgb(r, g, b)` with the same maths the probe uses on computed styles.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const isMain = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();

// The positional argument that is not a flag or a flag's value.
export function inputFile(args, valueFlags) {
  for (let i = 0; i < args.length; i++) {
    if (valueFlags.includes(args[i])) { i++; continue; }
    if (!args[i].startsWith('--')) return args[i];
  }
  return '';
}

const TOKEN_SELECTOR = /(^|[\s,>])(:root|html)(?![\w-])|\.dark(?![\w-])|\[data-(theme|mode)\b|^@theme\b/;
const DARK_SELECTOR = /\.dark(?![\w-])|\[data-(theme|mode)=["']?dark/;
const DARK_MEDIA = /prefers-color-scheme\s*:\s*dark/;
const isDark = (selector) => DARK_SELECTOR.test(selector.replace(/:not\([^()]*\)/g, ''));

// Walks the CSS once: each block keeps only its own declarations (nested rules such as @keyframes
// inside @theme are cut out of it), quoted strings and url() bodies are copied whole so braces in
// them do not count, and a @media/@supports nested in a token block belongs to that block.
export function parseTokens(text) {
  const raw = {};
  const stack = [];
  let top = '';
  const cur = () => stack[stack.length - 1];
  const append = (s) => { const b = cur(); if (b) b.own += s; else top += s; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== ch) j += text[j] === '\\' ? 2 : 1;
      append(text.slice(i, j + 1));
      i = j;
    } else if (text.startsWith('url(', i)) {
      const j = text.indexOf(')', i);
      append(text.slice(i, j < 0 ? text.length : j + 1));
      i = j < 0 ? text.length : j;
    } else if (ch === '{') {
      const b = cur();
      const buf = b ? b.own : top;
      const cut = buf.lastIndexOf(';') + 1;
      const prelude = buf.slice(cut).trim();
      if (b) b.own = buf.slice(0, cut); else top = '';
      stack.push({ prelude, own: '' });
    } else if (ch === '}') {
      const block = stack.pop();
      if (!block) continue;
      if (cur()) cur().own += ';';
      const nestedAt = /^@(media|supports)\b/.test(block.prelude);
      const owner = TOKEN_SELECTOR.test(block.prelude) ? block
        : nestedAt ? [...stack].reverse().find((s) => TOKEN_SELECTOR.test(s.prelude)) : null;
      if (!owner) continue;
      const dark = isDark(owner.prelude) || [block, ...stack].some((s) => DARK_MEDIA.test(s.prelude));
      const scope = dark ? 'dark' : 'light';
      for (const d of block.own.matchAll(/--([\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g)) {
        const name = d[1];
        if (name.endsWith('*')) continue; // namespace resets (--color-*: initial)
        (raw[scope] ||= {})[name] = d[2].trim();
      }
    } else {
      append(ch);
    }
  }
  return raw;
}

// calc() over px / rem / unitless numbers: * and / first, then + and -. Anything else stays as is.
function evalCalc(expr) {
  const parts = expr.trim().split(/\s+([+-])\s+/);
  const term = (t) => {
    const factors = t.split(/\s*([*/])\s*/);
    let acc = null;
    for (let i = 0; i < factors.length; i += 2) {
      const m = factors[i].match(/^(-?[\d.]+)(px|rem)?$/);
      if (!m) return null;
      const v = { n: +m[1] * (m[2] === 'rem' ? 16 : 1), px: !!m[2] };
      if (acc === null) { acc = v; continue; }
      const op = factors[i - 1];
      if (op === '*') acc = { n: acc.n * v.n, px: acc.px || v.px };
      else if (v.n === 0 || v.px) return null;
      else acc = { n: acc.n / v.n, px: acc.px };
    }
    return acc;
  };
  let acc = term(parts[0]);
  for (let i = 1; acc && i < parts.length; i += 2) {
    const v = term(parts[i + 1]);
    if (!v || v.px !== acc.px) return null;
    acc = { n: parts[i] === '+' ? acc.n + v.n : acc.n - v.n, px: acc.px };
  }
  return acc ? `${+acc.n.toFixed(4)}${acc.px ? 'px' : ''}` : null;
}

export function resolve(value, scope, raw, depth = 0) {
  if (depth > 8) return value;
  const v = value.replace(/var\(--([\w-]+)(?:,\s*([^)]+))?\)/g, (_, n, fb) => {
    const r = (raw[scope] && raw[scope][n]) ?? raw.light?.[n];
    return r !== undefined ? resolve(r, scope, raw, depth + 1) : (fb ?? `var(--${n})`);
  });
  return v.replace(/calc\(([^()]*)\)/g, (whole, expr) => evalCalc(expr) ?? whole);
}

// Same conversion as measure.mjs (inPage.tokens) so token values and computed styles compare equal.
const lin2s = (v) => { v = Math.max(0, Math.min(1, v)); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)); };
const oklabToRgb = (L, a, b) => {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s3 = s_ ** 3;
  return `rgb(${lin2s(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s3)}, ${lin2s(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s3)}, ${lin2s(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s3)})`;
};
const hslToRgb = (h, s, l) => {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return `rgb(${f(0)}, ${f(8)}, ${f(4)})`;
};

export function normColor(v) {
  const s = v.trim().toLowerCase();
  if (s === 'white') return 'rgb(255, 255, 255)';
  if (s === 'black') return 'rgb(0, 0, 0)';
  const hex = s.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return `rgb(${r}, ${g}, ${b})`;
  }
  const rgb = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (rgb) return `rgb(${+rgb[1]}, ${+rgb[2]}, ${+rgb[3]})`;
  const okl = s.match(/^okl(ab|ch)\(\s*([\d.]+%?)\s+(-?[\d.]+%?)\s+(-?[\d.]+)(?:deg)?/);
  if (okl) {
    const L = okl[2].endsWith('%') ? parseFloat(okl[2]) / 100 : parseFloat(okl[2]);
    let a = parseFloat(okl[3]), b = +okl[4];
    if (okl[3].endsWith('%')) a = (a / 100) * 0.4; // 100% chroma / a-axis = 0.4
    if (okl[1] === 'ch') { const h = (b * Math.PI) / 180; [a, b] = [a * Math.cos(h), a * Math.sin(h)]; }
    return oklabToRgb(L, a, b);
  }
  const hsl = s.match(/^hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/);
  if (hsl) return hslToRgb(((+hsl[1] % 360) + 360) % 360, +hsl[2] / 100, +hsl[3] / 100);
  return null;
}

// Values that look like a colour but are not normalised (color-mix, lab, lch, hwb, color()).
export const looksLikeColor = (v) => /^(color-mix|lab|lch|hwb|color)\(/i.test(v.trim());

if (isMain) {
  const args = process.argv.slice(2);
  const file = inputFile(args, ['--out']);
  const out = (args.find((a) => a.startsWith('--out=')) || '').slice(6) || (args.includes('--out') ? args[args.indexOf('--out') + 1] : '');
  if (!file) { console.error('usage: tokens-from-css.mjs <globals.css> [--out <json>]'); process.exit(2); }
  const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const raw = parseTokens(css);
  const tokens = { source: file, colors: {}, radii: {}, shadows: {}, fonts: {}, other: {}, dark: {}, unparsed: [] };
  for (const scope of Object.keys(raw)) {
    for (const [name, value] of Object.entries(raw[scope])) {
      const v = resolve(value, scope, raw);
      const target = scope === 'dark' ? tokens.dark : tokens;
      const color = normColor(v);
      if (color) (target.colors ||= {})[name] = color;
      else if (/^-?[\d.]+(px|rem)$/.test(v) && /radius/.test(name)) (target.radii ||= {})[name] = v.endsWith('rem') ? `${parseFloat(v) * 16}px` : v;
      else if (/^shadow/.test(name)) (target.shadows ||= {})[name] = v;
      else if (/^font/.test(name)) (target.fonts ||= {})[name] = v;
      else {
        (target.other ||= {})[name] = v;
        if (looksLikeColor(v)) tokens.unparsed.push(`${scope} --${name}: ${v}`);
      }
    }
  }
  // Values the probe accepts (unique, normalised); the names are kept for the report.
  tokens.colorSet = [...new Set([...Object.values(tokens.colors), ...Object.values(tokens.dark.colors || {})])];
  tokens.radiusSet = [...new Set(['0px', '9999px', ...Object.values(tokens.radii), ...Object.values(tokens.dark.radii || {})])];
  tokens.shadowSet = [...new Set(Object.values(tokens.shadows).map((s) => s.replace(/\s+/g, ' ')))];
  tokens.fontSet = [...new Set(Object.values(tokens.fonts).filter((f) => !f.includes('var(')))]; // literal families only; Next.js font vars resolve at runtime
  const json = JSON.stringify(tokens, null, 1);
  if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, json); }
  else process.stdout.write(json + '\n');
  console.error(`tokens: ${Object.keys(tokens.colors).length} colours, ${Object.keys(tokens.radii).length} radii, ${Object.keys(tokens.shadows).length} shadows, ${Object.keys(tokens.fonts).length} fonts${out ? ` → ${out}` : ''}`);
  if (tokens.unparsed.length) console.error(`WARN ${tokens.unparsed.length} colour tokens not normalised (the probe will report them as leaks): ${tokens.unparsed.slice(0, 3).join('; ')}`);
}
