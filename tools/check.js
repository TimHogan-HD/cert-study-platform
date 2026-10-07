#!/usr/bin/env node
/*
 * tools/check.js — static checks for the content and CSS rules in CLAUDE.md.
 *
 *   node tools/check.js          report every violation, exit 1 if any
 *   node tools/check.js --fix    also wrap missing first-use acronyms in <abbr>
 *
 * No dependencies and no browser, so it runs in CI. Rendering problems are
 * snap.js's job; this catches what can be read straight from the files.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FIX = process.argv.includes('--fix');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })
  .flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name).replace(/\\/g, '/')]));

const problems = [];
const report = (file, line, rule, msg) => problems.push({ file, line, rule, msg });
const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

/* ── A minimal HTML tokenizer: enough for well-formed fragments ── */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
function tokens(html) {
  const out = [];
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
  let last = 0, m;
  while ((m = re.exec(html))) {
    if (m.index > last) out.push({ type: 'text', text: html.slice(last, m.index), idx: last });
    if (m[0].startsWith('<!--')) out.push({ type: 'comment', idx: m.index, end: re.lastIndex });
    else out.push({ type: m[0][1] === '/' ? 'close' : 'open', tag: m[1].toLowerCase(), attrs: m[2] || '', self: !!m[3], idx: m.index, end: re.lastIndex });
    last = re.lastIndex;
  }
  if (last < html.length) out.push({ type: 'text', text: html.slice(last), idx: last });
  return out;
}
const attr = (attrs, name) => (attrs.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i')) || [])[1];
const classes = attrs => (attr(attrs, 'class') || '').split(/\s+/).filter(Boolean);

const content = walk('content').filter(f => f.endsWith('.html'));
const indexHtml = read('index.html');

/* ── 1. Fragment structure: balanced tags, no document tags ── */
const BALANCED = ['div', 'p', 'span', 'table', 'tr', 'ul', 'ol', 'pre', 'section', 'details', 'button', 'svg', 'a'];
for (const f of content) {
  const html = read(f);
  const stack = [];
  for (const t of tokens(html)) {
    if (t.type === 'open' && ['html', 'head', 'body'].includes(t.tag)) report(f, lineOf(html, t.idx), 'fragment', `<${t.tag}> is not allowed in a fragment`);
    if (!BALANCED.includes(t.tag)) continue;
    if (t.type === 'open' && !t.self) stack.push(t);
    else if (t.type === 'close') {
      const top = stack.pop();
      if (!top || top.tag !== t.tag) {
        report(f, lineOf(html, t.idx), 'balance', `</${t.tag}> closes ${top ? `<${top.tag}> from line ${lineOf(html, top.idx)}` : 'nothing'}`);
        if (top) stack.push(top);
      }
    }
  }
  for (const t of stack) report(f, lineOf(html, t.idx), 'balance', `<${t.tag}> is never closed`);
}

/* ── 2. Tables scroll on mobile ── */
const WRAPPERS = ['table-wrap', 'cmp-wrap'];
for (const f of content) {
  const html = read(f);
  const stack = [];
  for (const t of tokens(html)) {
    if (t.type === 'open' && !t.self && !VOID.has(t.tag)) {
      if (t.tag === 'table' && !stack.some(s => classes(s.attrs).some(c => WRAPPERS.includes(c)))) {
        report(f, lineOf(html, t.idx), 'table-wrap', 'table is not inside .table-wrap');
      }
      stack.push(t);
    } else if (t.type === 'close') {
      const i = stack.map(s => s.tag).lastIndexOf(t.tag);
      if (i >= 0) stack.length = i;
    }
  }
}

/* ── 3. Deliberately removed markup stays removed ── */
for (const f of content.concat('index.html')) {
  const html = read(f);
  for (const m of html.matchAll(/data-exam-weight|exam-star/g)) report(f, lineOf(html, m.index), 'removed', `${m[0]} was deliberately removed`);
}
for (const f of content) if (/^content\/netplus\/domain\d\.html$/.test(f)) report(f, 1, 'removed', 'aggregate domain files were deliberately removed');

/* ── 4. Every navigation target resolves ── */
const ids = f => new Set([...read(f).matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const navSources = [['index.html', indexHtml], ...content.map(f => [f, read(f)])];
for (const [f, html] of navSources) {
  for (const m of html.matchAll(/data-path="([^"]+)"(?:[^>]*?data-anchor="([^"]+)")?/g)) {
    const target = `content/${m[1]}.html`;
    if (!fs.existsSync(path.join(ROOT, target))) { report(f, lineOf(html, m.index), 'nav', `data-path "${m[1]}" has no ${target}`); continue; }
    if (m[2] && !ids(target).has(m[2])) report(f, lineOf(html, m.index), 'nav', `data-anchor "${m[2]}" is not an id in ${target}`);
  }
}

/* ── 5. Inline styles: only data-driven widths and single colour tokens ── */
const SVG_TAGS = new Set(['svg', 'g', 'rect', 'text', 'tspan', 'line', 'path', 'circle', 'ellipse', 'polygon', 'polyline', 'marker', 'defs', 'use']);
const ALLOWED_STYLE = /^\s*(width:\s*\d+(\.\d+)?%|color:\s*var\(--[a-z]+\))\s*;?\s*$/;
for (const f of content) {
  const html = read(f);
  for (const t of tokens(html)) {
    if (t.type !== 'open' || SVG_TAGS.has(t.tag)) continue;
    const style = attr(t.attrs, 'style');
    if (style !== undefined && !ALLOWED_STYLE.test(style)) report(f, lineOf(html, t.idx), 'inline-style', `<${t.tag} style="${style.slice(0, 60)}"> belongs in components.css`);
  }
}

/* ── 6. Non-exhaustive notes keep their lead-in tag ── */
for (const f of content) {
  const html = read(f);
  for (const m of html.matchAll(/<p class="note-nonexhaustive">(?!<span class="note-nonexhaustive-tag">)/g)) {
    report(f, lineOf(html, m.index), 'note', '.note-nonexhaustive must open with its .note-nonexhaustive-tag');
  }
}

/* ── 7. CSS: colours come from tokens; readable text is not faded ── */
{
  const f = 'css/components.css';
  const css = read(f);
  const ACCENTS = /rgba?\(\s*(59,\s*130,\s*246|34,\s*197,\s*94|245,\s*158,\s*11|239,\s*68,\s*68|168,\s*85,\s*247|20,\s*184,\s*166|255,\s*255,\s*255|136,\s*136,\s*136)\s*,|#(3b82f6|22c55e|f59e0b|ef4444|a855f7|14b8a6)\b/gi;
  // The terminal is a fixed dark surface; its palette is literal on purpose.
  const EXEMPT = /\.terminal|^\s*\.t[a-z]{1,2}\b|\.bar-d\d/;
  // Opacity that carries meaning: game state, disabled controls, de-emphasised bits.
  const OPACITY_OK = new Set(['.match-item.matched', '.ai-explain-btn:disabled', '.cert-home-card.disabled', '.sg-check-btn:hover', '.binary-dim', '.ipv6-digit-dropped', '.ipv6-shorten-grp-sub-expanded']);
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ');
    if (sel.startsWith('@') || sel.startsWith(':root') || sel.startsWith('[data-theme')) continue;
    const at = lineOf(css, m.index + m[1].length);
    if (!EXEMPT.test(sel)) for (const c of m[2].matchAll(ACCENTS)) report(f, at, 'colour-token', `${sel}: ${c[0]}… is a theme colour written literally; use its token`);
    const op = m[2].match(/(?:^|[;\s])opacity\s*:\s*(0?\.\d+)/);
    if (op && !OPACITY_OK.has(sel)) report(f, at, 'opacity', `${sel}: opacity ${op[1]} fades text; use a colour token, or add the selector to OPACITY_OK if the dimming carries meaning`);
  }
}

/* ── 8. Acronyms: first use per page is wrapped in <abbr> ── */
// The dictionary is each certification's own <abbr title> usage, so an acronym
// is only enforced once a page in that cert has defined it, and "AD" on the
// AZ-900 page (Active Directory) never leaks into Net+ routing (administrative
// distance). Expansions that differ only by an " — explanation" suffix or case
// are one meaning; an acronym with two meanings (STP) is left to the page.
const SKIP_INSIDE = new Set(['abbr', 'code', 'pre', 'kbd', 'script', 'style', 'svg', 'title', 'button', 'a', 'h1']);
const ABBR_RE = /<abbr title="([^"]+)">([^<]+)<\/abbr>/g;
const isAcronym = k => /^[A-Z][A-Za-z0-9]*[A-Z0-9][A-Za-z0-9]*$/.test(k);
const meaning = title => title.split(' — ')[0].trim().toLowerCase();
const scopeOf = f => f.split('/')[1];
const dicts = new Map(); // scope -> key -> meaning -> Map(title -> count)
for (const f of content) {
  const d = dicts.get(scopeOf(f)) || new Map();
  dicts.set(scopeOf(f), d);
  for (const m of read(f).matchAll(ABBR_RE)) {
    const key = m[2].trim();
    if (!isAcronym(key)) continue;
    const meanings = d.get(key) || new Map();
    const titles = meanings.get(meaning(m[1])) || new Map();
    titles.set(m[1], (titles.get(m[1]) || 0) + 1);
    meanings.set(meaning(m[1]), titles);
    d.set(key, meanings);
  }
}
// Prefer the plain expansion over one carrying an ' — explanation', then the most common.
const best = titles => [...titles.entries()].sort((a, b) => a[0].includes(' — ') - b[0].includes(' — ') || b[1] - a[1] || a[0].length - b[0].length)[0][0];
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fixed = [];
for (const f of content) {
  let html = read(f);
  const dict = dicts.get(scopeOf(f));
  const ownTitles = new Map([...html.matchAll(ABBR_RE)].map(m => [m[2].trim(), m[1]]));
  // The title to use on this page, or null when the acronym is ambiguous and the page doesn't say.
  const titleFor = key => {
    const meanings = dict.get(key);
    if (ownTitles.has(key)) return best(meanings.get(meaning(ownTitles.get(key))));
    return meanings.size === 1 ? best([...meanings.values()][0]) : null;
  };
  const stack = [];
  const firstSeen = new Map(); // acronym -> { wrapped, idx, len }
  for (const t of tokens(html)) {
    if (t.type === 'open' && !t.self && !VOID.has(t.tag)) { stack.push(t); continue; }
    if (t.type === 'close') { const i = stack.map(s => s.tag).lastIndexOf(t.tag); if (i >= 0) stack.length = i; continue; }
    if (t.type !== 'text') continue;
    const inAbbr = stack.some(s => s.tag === 'abbr');
    const skipped = stack.some(s => SKIP_INSIDE.has(s.tag) && s.tag !== 'abbr') || stack.some(s => classes(s.attrs).some(c => c.startsWith('terminal')));
    for (const key of dict.keys()) {
      if (firstSeen.has(key)) continue;
      const m = new RegExp(`(?<![\\w-])${escapeRe(key)}(?![\\w-])`).exec(t.text);
      if (!m) continue;
      if (inAbbr) { firstSeen.set(key, { wrapped: true }); continue; }
      if (skipped) continue;
      firstSeen.set(key, { wrapped: false, idx: t.idx + m.index, len: key.length });
    }
  }
  const unwrapped = [...firstSeen.entries()].filter(([, v]) => !v.wrapped);
  for (const [key, v] of unwrapped.filter(([k]) => !titleFor(k))) {
    report(f, lineOf(html, v.idx), 'abbr', `first use of ${key} needs <abbr>; it has several meanings (${[...dict.get(key).keys()].join(' / ')}), so pick one`);
  }
  const missing = unwrapped.filter(([k]) => titleFor(k)).sort((a, b) => b[1].idx - a[1].idx);
  if (!missing.length) continue;
  if (FIX) {
    for (const [key, v] of missing) {
      html = html.slice(0, v.idx) + `<abbr title="${titleFor(key)}">${key}</abbr>` + html.slice(v.idx + v.len);
    }
    fs.writeFileSync(path.join(ROOT, f), html);
    fixed.push(`${f}: wrapped ${missing.map(([k]) => k).reverse().join(', ')}`);
  } else {
    for (const [key, v] of missing.reverse()) report(f, lineOf(html, v.idx), 'abbr', `first use of ${key} is not in <abbr title="${titleFor(key)}">`);
  }
}

/* ── 9. The explain API answers exactly the topics the pages ask about ── */
{
  const decode = t => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const topics = new Set();
  for (const f of content) {
    const html = read(f);
    for (const t of tokens(html)) {
      if (t.type !== 'open' || !classes(t.attrs).includes('ai-explain-btn')) continue;
      const topic = attr(t.attrs, 'data-topic');
      if (topic === undefined) report(f, lineOf(html, t.idx), 'ai-topic', '.ai-explain-btn needs a data-topic; the API only answers known topics');
      else topics.add(decode(topic));
    }
  }
  const file = 'api/topics.js';
  const want = '/* Generated by `node tools/check.js --fix` from every .ai-explain-btn data-topic in content/. */\n'
    + `export const TOPICS = ${JSON.stringify([...topics].sort(), null, 2)};\n`;
  const have = fs.existsSync(path.join(ROOT, file)) ? read(file).replace(/\r\n/g, '\n') : '';
  if (have !== want) {
    if (FIX) { fs.writeFileSync(path.join(ROOT, file), want); fixed.push(`${file}: regenerated (${topics.size} topics)`); }
    else report(file, 0, 'ai-topic', 'out of date with the data-topic attributes in content/; run node tools/check.js --fix');
  }
}

/* ── 10. Every catalog route and alias has a page ── */
(async () => {
  const { ROUTES, ALIASES } = await import(require('url').pathToFileURL(path.join(ROOT, 'js', 'catalog.js')).href);
  for (const r of [...ROUTES, ...Object.values(ALIASES)]) {
    if (!fs.existsSync(path.join(ROOT, 'content', `${r}.html`))) report('js/catalog.js', 0, 'nav', `route "${r}" has no content/${r}.html`);
  }
  const orphans = content.map(f => f.slice('content/'.length, -'.html'.length)).filter(r => !ROUTES.includes(r));
  for (const r of orphans) report(`content/${r}.html`, 0, 'nav', 'page is not in js/catalog.js, so nothing links to it');

/* ── Report ── */
if (fixed.length) console.log(`Fixed:\n  ${fixed.join('\n  ')}\n`);
const byRule = {};
for (const p of problems) (byRule[p.rule] ||= []).push(p);
for (const [rule, ps] of Object.entries(byRule)) {
  console.log(`\n${rule} (${ps.length})`);
  for (const p of ps) console.log(`  ${p.file}${p.line ? `:${p.line}` : ''}  ${p.msg}`);
}
console.log(problems.length ? `\n${problems.length} problem(s).` : 'All checks passed.');
process.exit(problems.length ? 1 : 0);
})();
