#!/usr/bin/env node
/*
 * tools/snap.js — whole-site visual regression check.
 *
 * Screenshots every route (dark, light, mobile) from a checkout, then compares
 * two snapshot sets pixel by pixel. Use it to prove a refactor or a CSS cleanup
 * changed nothing visible:
 *
 *   git worktree add ../csp-main origin/main
 *   node tools/snap.js take /tmp/snap-main --root ../csp-main
 *   node tools/snap.js take /tmp/snap-head
 *   node tools/snap.js compare /tmp/snap-main /tmp/snap-head
 *
 * `compare` exits non-zero when any image differs and writes a red-highlighted
 * diff PNG next to the head image. `take` exits non-zero if any page throws or
 * logs a console error. Math.random is seeded and animations are
 * frozen so identical code renders identical pixels.
 *
 * Dev-only utility, like shot.js. Requires Playwright available to node.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadPlaywright, serve, open, routes } = require('./pw');

const VARIANTS = [
  { name: 'dark', theme: 'dark', viewport: { width: 1280, height: 900 } },
  { name: 'light', theme: 'light', viewport: { width: 1280, height: 900 } },
  { name: 'mobile', theme: 'dark', viewport: { width: 390, height: 844 } },
];

/* Runs in the page before any app script. */
function determinism() {
  let s = 0x2f6b9a3d;
  Math.random = () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  const fixed = new Date('2026-01-15T12:00:00Z').getTime();
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : [fixed])); }
    static now() { return fixed; }
  };
  addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    // Dotted underlines rasterize with run-to-run jitter in headless Chromium; solid ones don't.
    st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important;text-decoration-style:solid!important}';
    document.head.appendChild(st);
  });
}

/* Rasterize on the CPU in one pass so identical layouts produce identical pixels. */
const CHROMIUM_ARGS = [
  '--disable-gpu',
  '--disable-lcd-text',
  '--font-render-hinting=none',
  '--force-color-profile=srgb',
  '--disable-partial-raster',
  '--disable-skia-runtime-opts',
  '--disable-threaded-animation',
  '--disable-threaded-scrolling',
  '--disable-checker-imaging',
];
const WORKERS = 4;

async function take(outDir, root, only) {
  const { chromium } = loadPlaywright();
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const server = await serve(root);
  const base = `http://127.0.0.1:${server.address().port}`;
  const list = (await routes(root)).filter(r => !only || r.includes(only));
  const jobs = list.flatMap(route => VARIANTS.map(v => ({ route, v })));
  const errors = [];
  const shoot = async (browser, { route, v }) => {
    const page = await open(browser, base, route, v.theme, v.viewport, determinism, msg => errors.push(`${route}: ${msg}`));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, `${route.replace(/\//g, '-')}-${v.name}.png`), fullPage: true });
    await page.close();
    process.stdout.write('.');
  };
  const browsers = await Promise.all(Array.from({ length: WORKERS }, () => chromium.launch({ args: CHROMIUM_ARGS })));
  try {
    await Promise.all(browsers.map(async browser => {
      while (jobs.length) await shoot(browser, jobs.shift());
    }));
  } finally {
    await Promise.all(browsers.map(b => b.close()));
    server.close();
  }
  console.log(`\n${list.length} routes x ${VARIANTS.length} variants -> ${outDir}`);
  if (errors.length) {
    console.error(`\nPage errors:\n  ${[...new Set(errors)].join('\n  ')}`);
    process.exit(1);
  }
}

async function compare(dirA, dirB) {
  const { chromium } = loadPlaywright();
  const a = new Set(fs.readdirSync(dirA).filter(f => f.endsWith('.png')));
  const b = new Set(fs.readdirSync(dirB).filter(f => f.endsWith('.png') && !f.endsWith('.diff.png')));
  const missing = [...a].filter(f => !b.has(f));
  const added = [...b].filter(f => !a.has(f));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const differs = [];
  try {
    for (const f of [...a].filter(x => b.has(x))) {
      const bufA = fs.readFileSync(path.join(dirA, f));
      const bufB = fs.readFileSync(path.join(dirB, f));
      if (bufA.equals(bufB)) continue;
      const r = await page.evaluate(async ([ua, ub]) => {
        const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
        const [ia, ib] = await Promise.all([load(ua), load(ub)]);
        const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
        const px = img => { const c = new OffscreenCanvas(w, h); const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h); };
        const da = px(ia), db = px(ib);
        const out = new OffscreenCanvas(w, h), ox = out.getContext('2d');
        ox.drawImage(ib, 0, 0); ox.fillStyle = 'rgba(255,255,255,0.75)'; ox.fillRect(0, 0, w, h);
        const od = ox.getImageData(0, 0, w, h);
        let n = 0;
        for (let i = 0; i < da.data.length; i += 4) {
          if (da.data[i] !== db.data[i] || da.data[i + 1] !== db.data[i + 1] || da.data[i + 2] !== db.data[i + 2] || da.data[i + 3] !== db.data[i + 3]) {
            n++; od.data[i] = 255; od.data[i + 1] = 0; od.data[i + 2] = 0; od.data[i + 3] = 255;
          }
        }
        if (!n) return { n, sizeA: [ia.width, ia.height], sizeB: [ib.width, ib.height] };
        ox.putImageData(od, 0, 0);
        const blob = await out.convertToBlob({ type: 'image/png' });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let bin = ''; for (const c of bytes) bin += String.fromCharCode(c);
        return { n, sizeA: [ia.width, ia.height], sizeB: [ib.width, ib.height], diff: btoa(bin) };
      }, [`data:image/png;base64,${bufA.toString('base64')}`, `data:image/png;base64,${bufB.toString('base64')}`]);
      if (!r.n) continue;
      fs.writeFileSync(path.join(dirB, f.replace(/\.png$/, '.diff.png')), Buffer.from(r.diff, 'base64'));
      differs.push(`${f}  ${r.n} px differ  (${r.sizeA.join('x')} -> ${r.sizeB.join('x')})`);
    }
  } finally {
    await browser.close();
  }
  for (const f of missing) console.log(`MISSING in head: ${f}`);
  for (const f of added) console.log(`NEW in head:     ${f}`);
  for (const d of differs) console.log(`DIFF ${d}`);
  const bad = missing.length + added.length + differs.length;
  console.log(bad ? `\n${bad} problem(s). Diff images written beside the head snapshots.` : `\nIdentical: ${a.size} images.`);
  process.exit(bad ? 1 : 0);
}

(async () => {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'take' && args[0]) {
    const ri = args.indexOf('--root');
    const oi = args.indexOf('--only');
    const root = path.resolve(ri >= 0 ? args[ri + 1] : path.join(__dirname, '..'));
    return take(path.resolve(args[0]), root, oi >= 0 ? args[oi + 1] : null);
  }
  if (cmd === 'compare' && args[1]) return compare(path.resolve(args[0]), path.resolve(args[1]));
  console.error('usage: node tools/snap.js take <outDir> [--root <checkout>] [--only <route substring>]\n       node tools/snap.js compare <baselineDir> <headDir>');
  process.exit(1);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
