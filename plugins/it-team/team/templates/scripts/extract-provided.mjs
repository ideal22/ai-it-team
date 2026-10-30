#!/usr/bin/env node
// Design facts from a provided design folder (HTML exports with inline styles), without a browser.
// usage: node docs/_team/templates/scripts/extract-provided.mjs [docs/design/provided] [--out docs/design/provided-facts.json] [--only Main,Product]
// Per screen: drawn width/height and state props (data-props), centred containers (margin auto) with their
// border-box totals and gutters (inline styles are content-box: max-width 1360 + padding 40 → 1440),
// fonts, colours, radii, shadows and spacing by frequency, key strings (headings, buttons, links),
// imports of wrapper files (state variants), and template expressions the static read cannot
// resolve. Container edges assume the container sits in the viewport; a nested one may be
// clamped by its parent (check that one in the browser). A summary across screens feeds design-system.md / tokens.css. Measure in the browser
// only what this file cannot know (wrapping, real line breaks) — and say so in screens.md.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const valueFlags = ['--out', '--only'];
const flag = (k) => {
  const eq = args.find((a) => a.startsWith(`${k}=`));
  if (eq) return eq.slice(k.length + 1);
  const i = args.indexOf(k);
  if (i < 0) return '';
  const v = args[i + 1];
  if (!v || v.startsWith('--')) { console.error(`extract-provided: ${k} needs a value`); process.exit(2); }
  return v;
};
let dir = 'docs/design/provided';
for (let i = 0; i < args.length; i++) { if (valueFlags.includes(args[i])) { i++; continue; } if (!args[i].startsWith('--')) dir = args[i]; }
const out = flag('--out') || 'docs/design/provided-facts.json';
const only = flag('--only').split(',').filter(Boolean);
if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) { console.error(`extract-provided: ${dir} is not a folder`); process.exit(2); }

const count = (map, key, n = 1) => { if (key) map.set(key, (map.get(key) || 0) + n); };
const top = (map, n = 15) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([value, uses]) => ({ value, uses }));
const px = (v) => { const m = String(v).match(/^(-?[\d.]+)px$/); return m ? +m[1] : null; };
const hex = (c) => {
  const s = c.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map((x) => x + x).join('');
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(s)) return s;
  const m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?/);
  if (m) { const h = [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join(''); return m[4] !== undefined && parseFloat(m[4]) < 1 && !m[4].endsWith('%') ? `#${h} @${m[4]}` : `#${h}`; }
  return s === 'transparent' || s === 'none' || s === 'inherit' || s === 'currentcolor' ? null : s;
};
const decls = (style) => Object.fromEntries(style.split(';').map((d) => d.split(/:(.*)/s)).filter((p) => p[1] !== undefined).map(([k, v]) => [k.trim().toLowerCase(), v.trim()]));
const box = (v) => { const p = v.split(/\s+/).map(px); const [t, r = t, b = t, l = r] = p; return { t, r, b, l }; };
const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function screen(file) {
  const html = fs.readFileSync(file, 'utf8');
  const name = path.basename(file, '.html');
  const propsRaw = (html.match(/data-props='([^']*)'/) || [])[1];
  let props = {};
  try { props = (propsRaw ? JSON.parse(propsRaw.replace(/&quot;/g, '"')) : {}) ?? {}; } catch { props = { unparsed: true }; }
  const preview = props.$preview || {};
  const width = preview.width || (/mobile/i.test(name) ? 390 : 1440);
  const res = { file: path.basename(file), width, height: preview.height || null };
  const imports = [...html.matchAll(/<dc-import\s+name="([^"]+)"([^>]*)>/g)].map((m) => ({ name: m[1], attrs: textOf(m[2]).replace(/hint-size="[^"]*"/, '').trim() }));
  const states = Object.entries(props).filter(([k, v]) => k !== '$preview' && v && typeof v === 'object').map(([k, v]) => ({ prop: k, default: v.default, options: v.options, section: v.section }));
  if (states.length) res.states = states;
  if (imports.length && html.length < 4000) { res.wrapper = true; res.imports = imports; return res; }
  if (imports.length) res.imports = imports;

  const globalBorderBox = /\*[^{]*\{[^}]*box-sizing\s*:\s*border-box/.test(html);
  const fonts = new Map(), colors = new Map(), bgs = new Map(), borders = new Map(), radii = new Map(), shadows = new Map(), spacing = new Map(), gaps = new Map();
  const containers = new Map();
  const styles = [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1].replace(/&quot;/g, '"'));
  for (const block of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) for (const r of block[1].matchAll(/\{([^}]*)\}/g)) styles.push(r[1]);
  for (const s of styles) {
    const d = decls(s);
    if (d.font) { const m = d.font.match(/(\d{3})?\s*([\d.]+px)(?:\/([\d.]+(?:px)?))?\s+(.+)/); if (m) count(fonts, `${m[4].split(',')[0].replace(/['"]/g, '').trim()} ${m[1] || 400} ${m[2]}${m[3] ? '/' + m[3] : ''}`); }
    if (d['font-size']) count(fonts, `${d['font-family'] ? d['font-family'].split(',')[0].replace(/['"]/g, '').trim() : 'inherited'} ${d['font-weight'] || 400} ${d['font-size']}${d['line-height'] ? '/' + d['line-height'] : ''}`);
    if (d.color) count(colors, hex(d.color));
    for (const k of ['background', 'background-color']) if (d[k] && !/url\(|gradient/.test(d[k])) count(bgs, hex(d[k]));
    for (const k of ['border', 'border-top', 'border-bottom', 'border-left', 'border-right']) if (d[k]) { const c = d[k].match(/(#[0-9a-f]{3,8}|rgba?\([^)]*\))/i); if (c) count(borders, hex(c[1])); }
    if (d['border-radius']) count(radii, d['border-radius']);
    if (d['box-shadow'] && d['box-shadow'] !== 'none') count(shadows, d['box-shadow'].replace(/\s+/g, ' '));
    for (const k of ['padding', 'margin']) if (d[k]) for (const v of d[k].split(/\s+/)) if (px(v)) count(spacing, v);
    for (const k of ['gap', 'row-gap', 'column-gap']) if (d[k]) count(gaps, d[k]);
    const centred = /\bauto\b/.test(d.margin || '') || (d['margin-left'] === 'auto' && d['margin-right'] === 'auto') || d['margin-inline'] === 'auto';
    if (d['max-width'] && px(d['max-width']) && centred) {
      const pad = d['padding-inline'] ? (() => { const [a, b = a] = d['padding-inline'].split(/\s+/); return { l: px(a), r: px(b) }; })()
        : d.padding ? box(d.padding) : { l: d['padding-left'] ? px(d['padding-left']) : 0, r: d['padding-right'] ? px(d['padding-right']) : 0 };
      if (pad.l === null || pad.r === null) { count(spacing, `non-px container padding: ${d.padding || d['padding-inline']}`); continue; }
      const l = pad.l ?? 0, r = pad.r ?? 0, inner = px(d['max-width']);
      const borderBox = d['box-sizing'] === 'border-box' || (globalBorderBox && d['box-sizing'] !== 'content-box');
      const total = borderBox ? inner : inner + l + r;
      const edge = Math.max(0, (width - total) / 2);
      const key = `${total} (max-width ${inner}${borderBox ? ' border-box' : ''}, padding ${l}/${r})`;
      const c = containers.get(key) || { total, maxWidth: inner, paddingLeft: l, paddingRight: r, contentLeft: Math.round(edge + l), contentRight: Math.round(width - edge - r), uses: 0 };
      c.uses++; containers.set(key, c);
    }
  }
  const strings = { headings: [], buttons: [], links: [] };
  const seen = new Set();
  for (const [kind, re] of [['headings', /<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>/g], ['buttons', /<(button)\b[^>]*>([\s\S]*?)<\/\1>/g], ['links', /<(a)\b[^>]*>([\s\S]*?)<\/\1>/g]]) {
    for (const m of html.matchAll(re)) { const t = textOf(m[2]); if (t && !t.includes('{{') && t.length <= 80 && !seen.has(t)) { seen.add(t); strings[kind].push(t); } }
    strings[kind] = strings[kind].slice(0, 25);
  }
  const templates = (html.match(/\{\{[^}]*\}\}/g) || []).length;
  Object.assign(res, {
    containers: [...containers.values()].sort((a, b) => b.uses - a.uses),
    fonts: top(fonts), colors: top(colors), backgrounds: top(bgs), borders: top(borders, 8),
    radii: top(radii), shadows: top(shadows, 6), spacing: top(spacing, 20), gaps: top(gaps, 12),
    strings,
  });
  if (templates) res.unresolved = `${templates} template expressions ({{…}}): loops and bound values are not expanded — count repeated items from the design, not from this file`;
  return res;
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).filter((f) => !only.length || only.includes(path.basename(f, '.html'))).sort();
if (!files.length) { console.error(`extract-provided: no .html files in ${dir}${only.length ? ` matching --only ${only.join(',')}` : ''}`); process.exit(1); }
const screens = files.map((f) => screen(path.join(dir, f)));
const summary = { colors: new Map(), backgrounds: new Map(), radii: new Map(), fonts: new Map(), spacing: new Map(), containers: new Map() };
for (const s of screens.filter((x) => !x.wrapper)) {
  for (const k of ['colors', 'backgrounds', 'radii', 'fonts', 'spacing']) for (const { value, uses } of s[k]) count(summary[k], value, uses);
  for (const c of s.containers) count(summary.containers, `${c.total} @${s.width}: content ${c.contentLeft}–${c.contentRight}`, c.uses);
}
const result = {
  source: dir, generated: new Date().toISOString(),
  summary: Object.fromEntries(Object.entries(summary).map(([k, m]) => [k, top(m, k === 'spacing' ? 24 : 20)])),
  screens,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 1));
for (const s of screens) {
  if (s.wrapper) { console.log(`${s.file.padEnd(28)} wrapper → ${s.imports.map((i) => `${i.name} ${i.attrs}`.trim()).join('; ')}`); continue; }
  const c = s.containers[0];
  console.log(`${s.file.padEnd(28)} ${s.width}px · container ${c ? `${c.total} content ${c.contentLeft}–${c.contentRight}` : '—'} · radii ${s.radii.slice(0, 3).map((r) => r.value).join(' ')} · states ${s.states?.length || 0}${s.unresolved ? ' · templates' : ''}`);
}
console.log(`→ ${out} (${screens.length} files, ${screens.filter((s) => s.wrapper).length} wrappers)`);
