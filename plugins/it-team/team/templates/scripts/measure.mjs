#!/usr/bin/env node
// UI fidelity probe (it-team:ui-fidelity-check, stage 1). Deterministic measurements of a running app
// at the drawn widths and locales; one JSON per run plus one line per width/locale.
// usage (from the project root, dev server running):
//   node scripts/measure.mjs --url http://localhost:3000/product/x --widths 390,1440 --locales uz,ru,en \
//     --out test-results/design/S-017-measure.json [--tokens test-results/design/tokens.json] \
//     [--edges 40,1400] [--header-edges 24,1416] [--seed seed.json] [--locale-path '/{locale}'] [--max-focus 150]
// Locale URLs: `--locale-path '/{locale}'` inserts `/ru` before the path for every locale but the first
// (default; matches next-intl `as-needed`). `--locale-path 'query:lang'` appends `?lang=ru` instead.
// Checks and pass rules (severity the reviewer uses):
//   overflow    page scrollWidth > clientWidth, or any element past the right edge      → BLOCKER
//   rows        a one-line row renders on > 1 line (header nav, tablists, [data-row])   → BLOCKER
//   midWord     a word of a heading/button/link/label split across two line boxes       → MAJOR
//   rings       a focusable element whose focus ring is absent or clipped by an ancestor → MAJOR
//   cls         cumulative layout shift from load to idle (and after --seed + reload)    → MAJOR when > 0.01
//   console     console errors / hydration warnings during load                         → MAJOR
//   tokens      computed colour / radius / font not in the token set (--tokens)          → MINOR (list)
//   edges       section / footer / header edges vs --edges / --header-edges, > 2 px off   → MAJOR
//   targets     interactive elements < 44 px at the narrowest width                      → MINOR
// Exit code: 1 when any BLOCKER/MAJOR check fails, else 0.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1]; const e = argv.find((a) => a.startsWith(`--${k}=`)); return e ? e.slice(k.length + 3) : d; };
const url = arg('url'); if (!url) { console.error('usage: measure.mjs --url <url> [--widths 390,1440] [--locales uz,ru] --out <json>'); process.exit(2); }
if (!/^(https?|file):\/\//.test(url)) { console.error(`measure.mjs: --url must be absolute (http://localhost:3000/…), got "${url}"`); process.exit(2); }
const widths = arg('widths', '390,1440').split(',').map(Number);
const locales = arg('locales', '').split(',').filter(Boolean);
const out = arg('out', 'test-results/design/measure.json');
const tokensPath = arg('tokens', '');
const localePath = arg('locale-path', '/{locale}');
const edgesExp = arg('edges', '').split(',').filter(Boolean).map(Number);
const headerExp = arg('header-edges', '').split(',').filter(Boolean).map(Number);
const seedPath = arg('seed', '');
const maxFocus = +arg('max-focus', 150);
const tokens = tokensPath ? JSON.parse(fs.readFileSync(tokensPath, 'utf8')) : null;
const seed = seedPath ? JSON.parse(fs.readFileSync(seedPath, 'utf8')) : null;

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('@playwright/test');

const localeUrl = (base, loc, i) => {
  if (!loc || i === 0) return base;
  if (localePath.startsWith('query:')) return base + (base.includes('?') ? '&' : '?') + `${localePath.slice(6)}=${loc}`;
  const u = new URL(base); u.pathname = localePath.replace('{locale}', loc) + (u.pathname === '/' ? '' : u.pathname); return u.toString();
};

// ---------- in-page measurements ----------
const inPage = {
  edges: () => {
    // Content edges: from each top-level block descend into the widest visible child until the
    // content box is narrower than the block (the Container), so full-bleed wrappers do not count.
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const content = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { left: Math.round(r.left + parseFloat(s.paddingLeft)), right: Math.round(r.right - parseFloat(s.paddingRight)), outerLeft: Math.round(r.left), outerRight: Math.round(r.right) }; };
    const descend = (el, outer = false, depth = 0) => {
      const c = content(el);
      const l = outer ? c.outerLeft : c.left, r = outer ? c.outerRight : c.right;
      if (l > 0 || r < document.documentElement.clientWidth || depth > 8) return { node: el, ...c };
      const kids = [...el.children].filter(vis);
      if (!kids.length) return { node: el, ...c };
      const widest = kids.reduce((a, b) => (b.getBoundingClientRect().width > a.getBoundingClientRect().width ? b : a));
      return descend(widest, outer, depth + 1);
    };
    const label = (el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
    const pick = (sel, kind) => [...document.querySelectorAll(sel)].filter(vis).map((el) => { const d = descend(el); return { kind, el: label(el), via: label(d.node), left: d.left, right: d.right, outerLeft: d.outerLeft, outerRight: d.outerRight }; });
    const header = [...document.querySelectorAll('header')].filter(vis).map((el) => { const d = descend(el, true); return { kind: 'header', el: label(el), via: label(d.node), left: d.left, right: d.right, outerLeft: d.outerLeft, outerRight: d.outerRight }; });
    return [...header, ...pick('main > section, main > div, main > article, main [data-edge]', 'section'), ...pick('footer', 'footer')];
  },
  rows: () => {
    // Line count by vertical overlap: items of different heights centred on one line overlap, a
    // wrapped item starts below the previous line's bottom.
    const rowsOf = (row) => {
      const boxes = [...row.children].map((c) => c.getBoundingClientRect()).filter((r) => r.height > 0).sort((a, b) => a.top - b.top);
      let lines = 0, bottom = -Infinity;
      for (const r of boxes) { if (r.top >= bottom - 1) { lines++; bottom = r.bottom; } else bottom = Math.max(bottom, r.bottom); }
      return lines;
    };
    const label = (el) => el.dataset.rowId || el.id || el.getAttribute('aria-label') || el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    const auto = [...document.querySelectorAll('header nav ul, header nav ol, [role="tablist"], [data-row="one-line"], [data-row]')]
      .filter((e) => e.getBoundingClientRect().width > 0 && e.children.length > 1);
    return auto.map((row) => ({ id: label(row), items: row.children.length, rows: rowsOf(row) }));
  },
  overflow: () => {
    const vw = document.documentElement.clientWidth;
    const clipped = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (s.overflowX !== 'visible' || s.overflowY !== 'visible') return true; } return false; };
    const els = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && getComputedStyle(e).position !== 'fixed' && !clipped(e); });
    return { page: document.documentElement.scrollWidth - vw, els: els.slice(0, 8).map((e) => e.tagName.toLowerCase() + '.' + (typeof e.className === 'string' ? e.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + ` right=${Math.round(e.getBoundingClientRect().right)}`) };
  },
  midWord: () => {
    const outWords = [];
    for (const el of document.querySelectorAll('h1,h2,h3,h4,button,a,label,summary,[role="tab"],[data-check="no-break"]')) {
      if (el.getBoundingClientRect().width === 0) continue;
      const style = getComputedStyle(el);
      if (style.hyphens === 'auto' || style.visibility === 'hidden') continue;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode());) {
        if (n.parentElement && getComputedStyle(n.parentElement).display === 'none') continue;
        for (const m of n.textContent.matchAll(/[^\s­-]{3,}/g)) {
          const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
          const tops = new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)));
          if (tops.size > 1) outWords.push(m[0]);
        }
      }
    }
    return [...new Set(outWords)];
  },
  rings: (limit) => {
    const clips = (el) => { const res = []; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if ([s.overflowX, s.overflowY].some((o) => o !== 'visible')) res.push(p); } return res; };
    // Computed shadows lead with the colour in any notation: rgb(), oklch(), oklab(), color-mix(), hex.
    const spread = (shadow) => Math.max(0, ...[...shadow.matchAll(/(?:^|,)\s*(?:[\w-]+\((?:[^()]|\([^()]*\))*\)|#[0-9a-f]+|\w+)?\s*(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?/gi)]
      .filter((m) => !/\/\s*0%?\)/.test(m[0])).map((m) => Math.abs(parseFloat(m[4] || 0)) + Math.abs(parseFloat(m[3] || 0)) / 2));
    const label = (el) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' "' + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30) + '"');
    const transparent = (c) => c === 'transparent' || /rgba\([^)]*,\s*0\)$|\/\s*0%?\)$/.test(c);
    // Focus styles apply at once: a `transition` would otherwise be read at its first frame (no ring).
    const freeze = document.createElement('style');
    freeze.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.appendChild(freeze);
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); // autofocus would put its ring into the "before" state
    const res = []; let checked = 0;
    for (const el of document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')) {
      if (checked >= limit) break;
      const r0 = el.getBoundingClientRect();
      if (r0.width === 0 || r0.height === 0 || el.disabled || el.closest('[inert],[aria-hidden="true"]') || getComputedStyle(el).visibility === 'hidden') continue;
      checked++;
      const shadowBefore = getComputedStyle(el).boxShadow;
      el.focus({ preventScroll: true, focusVisible: true });
      if (document.activeElement !== el) continue;
      const s = getComputedStyle(el);
      // A ring is a visible, non-transparent outline, or a box-shadow that focus added (an always-on
      // shadow-sm is not a focus indicator).
      const outlineW = s.outlineStyle !== 'none' && !transparent(s.outlineColor) ? parseFloat(s.outlineWidth) || 0 : 0, off = parseFloat(s.outlineOffset) || 0;
      const shadowPad = s.boxShadow !== 'none' && s.boxShadow !== shadowBefore ? spread(s.boxShadow) : 0;
      const pad = outlineW ? Math.max(0, outlineW + off) : shadowPad;
      if (!outlineW && !shadowPad) { res.push({ el: label(el), issue: 'no ring' }); continue; }
      if (s.boxShadow !== 'none' && s.boxShadow.includes('inset') && !outlineW) continue; // ring-inset by design
      const r = el.getBoundingClientRect();
      if (!pad) continue; // ring drawn inside the element (negative outline-offset): nothing to clip
      let skip = false;
      for (const c of clips(el)) {
        const cr = c.getBoundingClientRect();
        if (r.left < cr.left - 0.5 || r.right > cr.right + 0.5 || r.top < cr.top - 0.5 || r.bottom > cr.bottom + 0.5) { skip = true; break; } // scrolled out of view: not a clipping finding
        if (r.left - pad < cr.left - 0.5 || r.right + pad > cr.right + 0.5 || r.top - pad < cr.top - 0.5 || r.bottom + pad > cr.bottom + 0.5) {
          res.push({ el: label(el), issue: `ring ${pad}px clipped by ${c.tagName.toLowerCase()}${c.id ? '#' + c.id : ''}.${typeof c.className === 'string' ? c.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}` }); break;
        }
      }
      if (skip) continue;
    }
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    freeze.remove();
    return { checked, issues: res };
  },
  cls: (ms) => new Promise((r) => { let v = 0; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (v += e.value))).observe({ type: 'layout-shift', buffered: true }); } catch { r(-1); } setTimeout(() => r(+v.toFixed(4)), ms); }),
  tokens: (set) => {
    const lin2s = (v) => { v = Math.max(0, Math.min(1, v)); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)); };
    const oklabToRgb = (L, a, b) => { const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b; const l = l_ ** 3, m = m_ ** 3, s3 = s_ ** 3; return `rgb(${lin2s(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s3)}, ${lin2s(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s3)}, ${lin2s(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s3)})`; };
    const okl = (c) => { const m = c.match(/^okl(ab|ch)\(\s*([\d.]+%?)\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*([\d.]+%?))?/); if (!m) return null; if (m[5] !== undefined && parseFloat(m[5]) === 0) return 'transparent'; const L = m[2].endsWith('%') ? parseFloat(m[2]) / 100 : parseFloat(m[2]); let a = +m[3], b = +m[4]; if (m[1] === 'ch') { const h = (b * Math.PI) / 180; [a, b] = [a * Math.cos(h), a * Math.sin(h)]; } return oklabToRgb(L, a, b); };
    const norm = (c) => { const o = okl(c); if (o) return o === 'transparent' ? null : o; const m = c.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?/); if (!m) return c === 'transparent' ? null : c; const a = m[4] === undefined ? 1 : parseFloat(m[4]) / (m[4].endsWith('%') ? 100 : 1); return a === 0 ? null : `rgb(${+m[1]}, ${+m[2]}, ${+m[3]})`; };
    const colors = new Set(set.colorSet), radii = new Set(set.radiusSet.map((r) => parseFloat(r))), fonts = set.fontSet.map((f) => f.split(',')[0].replace(/["']/g, '').trim().toLowerCase());
    const leaks = {}; const hit = (k, el) => { (leaks[k] ||= { n: 0, where: [] }); leaks[k].n++; if (leaks[k].where.length < 3) leaks[k].where.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + (typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); };
    for (const el of document.querySelectorAll('body *:not(img):not(svg):not(svg *):not(video):not(canvas):not(picture):not(script):not(style):not([data-token-exempt]):not([data-token-exempt] *)')) {
      const r = el.getBoundingClientRect(); if (r.width === 0) continue;
      const s = getComputedStyle(el);
      for (const [prop, val] of [['color', s.color], ['background-color', s.backgroundColor], ['border-color', s.borderTopWidth !== '0px' ? s.borderTopColor : null], ['outline-color', s.outlineStyle !== 'none' ? s.outlineColor : null]]) {
        if (!val) continue; const c = norm(val); if (c && !colors.has(c)) hit(`${prop} ${c}`, el);
      }
      const rad = parseFloat(s.borderTopLeftRadius);
      if (rad > 0 && !radii.has(rad) && !(rad >= 999) && !s.borderTopLeftRadius.includes('%')) hit(`radius ${s.borderTopLeftRadius}`, el);
      const fam = s.fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
      if (fonts.length && !fonts.some((f) => fam.includes(f) || f.includes(fam)) && !/^(serif|sans-serif|monospace|system-ui)$/.test(fam) && !fam.startsWith('__')) hit(`font ${fam}`, el);
    }
    return Object.entries(leaks).sort((a, b) => b[1].n - a[1].n).slice(0, 25).map(([k, v]) => ({ value: k, count: v.n, where: v.where }));
  },
  targets: () => [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,[role=button],[role=tab]')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && (r.width < 44 || r.height < 44) && !e.closest('[aria-hidden="true"]') && getComputedStyle(e).clip === 'auto'; })
    .slice(0, 12).map((e) => `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`),
};

// ---------- run ----------
const browser = await chromium.launch();
const results = { url, widths, locales, generated: new Date().toISOString(), runs: {} };
let hardFails = 0;
const effectiveLocales = locales.length ? locales : [''];
if ((edgesExp.length || headerExp.length) && !widths.some((w) => w >= 1024)) console.log('WARN --edges / --header-edges are checked at widths ≥ 1024 only; none given');
try {
for (const w of widths) for (const [i, loc] of effectiveLocales.entries()) {
  const key = `${w}${loc ? '/' + loc : ''}`;
  const context = await browser.newContext({ viewport: { width: w, height: w < 768 ? 844 : 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 160)));
  const target = localeUrl(url, loc, i);
  const res = { url: target };
  try {
    const resp = await page.goto(target, { waitUntil: 'networkidle', timeout: 60000 });
    res.status = resp?.status();
    await page.evaluate(() => document.fonts.ready);
    res.cls = await page.evaluate(inPage.cls, 800);
    res.edges = await page.evaluate(inPage.edges);
    res.rows = await page.evaluate(inPage.rows);
    res.overflow = await page.evaluate(inPage.overflow);
    res.midWord = await page.evaluate(inPage.midWord);
    if (tokens) res.tokens = await page.evaluate(inPage.tokens, { colorSet: tokens.colorSet, radiusSet: tokens.radiusSet, fontSet: tokens.fontSet });
    if (w < 768) res.targets = await page.evaluate(inPage.targets);
    res.rings = await page.evaluate(inPage.rings, maxFocus);
    if (seed) {
      await page.evaluate((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }, seed);
      await page.reload({ waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      res.clsSeeded = await page.evaluate(inPage.cls, 800);
    }
    res.console = [...new Set(errors)].filter((e) => !/favicon|ERR_BLOCKED_BY_CLIENT|Download the React DevTools/.test(e));
  } catch (e) { res.error = String(e.message).slice(0, 200); }
  await context.close();
  // ----- judge -----
  const fails = [];
  if (res.error) fails.push(`BLOCKER load: ${res.error}`);
  if (res.status && res.status >= 400) fails.push(`BLOCKER http ${res.status}`);
  if (res.overflow?.page > 0 || res.overflow?.els?.length) fails.push(`BLOCKER overflow ${res.overflow.page}px ${res.overflow.els.slice(0, 2).join(' ')}`);
  for (const r of res.rows || []) if (r.rows > 1) fails.push(`BLOCKER row "${r.id}" wraps to ${r.rows} lines`);
  if (res.midWord?.length) fails.push(`MAJOR mid-word: ${res.midWord.slice(0, 5).join(' ')}`);
  if (res.rings?.issues?.length) fails.push(`MAJOR rings (${res.rings.issues.length}/${res.rings.checked}): ${res.rings.issues.slice(0, 3).map((x) => x.issue + ' @ ' + x.el).join('; ')}`);
  if (res.cls > 0.01) fails.push(`MAJOR CLS ${res.cls}`);
  if (res.clsSeeded > 0.01) fails.push(`MAJOR CLS after seed+reload ${res.clsSeeded}`);
  if (res.console?.length) fails.push(`MAJOR ${res.console.length} console errors: ${res.console[0]}`);
  if (edgesExp.length === 2 && w >= 1024) for (const e of res.edges || []) if (e.kind !== 'header' && (Math.abs(e.left - edgesExp[0]) > 2 || Math.abs(e.right - edgesExp[1]) > 2)) fails.push(`MAJOR edge ${e.kind} ${e.el}: ${e.left}–${e.right} vs ${edgesExp.join('–')}`);
  if (headerExp.length === 2 && w >= 1024) for (const e of res.edges || []) if (e.kind === 'header' && (Math.abs(e.outerLeft - headerExp[0]) > 2 || Math.abs(e.outerRight - headerExp[1]) > 2)) fails.push(`MAJOR header edge ${e.el}: ${e.outerLeft}–${e.outerRight} vs ${headerExp.join('–')}`);
  const minors = [];
  if (res.cls < 0) minors.push('MINOR CLS not measured (no layout-shift observer)');
  if (edgesExp.length === 2 && w >= 1024 && !res.error && !(res.edges || []).some((e) => e.kind !== 'header')) minors.push('MINOR edges: no main section/footer found to measure');
  if (headerExp.length === 2 && w >= 1024 && !res.error && !(res.edges || []).some((e) => e.kind === 'header')) minors.push('MINOR header edges: no <header> found to measure');
  if (res.tokens?.length) minors.push(`MINOR token leaks: ${res.tokens.slice(0, 4).map((t) => `${t.value} ×${t.count}`).join(', ')}`);
  if (res.targets?.length) minors.push(`MINOR targets < 44: ${res.targets.slice(0, 3).join('; ')}`);
  res.verdict = { fails, minors };
  hardFails += fails.length;
  results.runs[key] = res;
  console.log(`${key.padEnd(9)} ${fails.length ? 'FAIL ' + fails.join(' | ') : 'ok'}${minors.length ? '  ' + minors.join(' | ') : ''}`);
}
} finally {
  await browser.close();
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(results, null, 1));
console.log(`→ ${out}`);
process.exit(hardFails ? 1 : 0);
