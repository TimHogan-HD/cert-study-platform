#!/usr/bin/env node
/*
 * tools/shot.js — render check for a content route.
 *
 * The site has no build, lint, or test step, so layout bugs are invisible in a
 * text diff. This serves the repo, loads a route, and screenshots it in dark,
 * light, and mobile — the three checks CLAUDE.md asks for before committing.
 *
 *   node tools/shot.js <route> [selector]
 *
 *   node tools/shot.js netplus/domain1/obj-1-7
 *   node tools/shot.js netplus/domain1/obj-1-7 .addr-class-wrap
 *
 * With a selector, shoots just that element and prints its computed colours so
 * the "readable text uses --text, never --muted/--hint" rule can be checked.
 * Without one, shoots the full page.
 *
 * Dev-only utility. It is not a build step and adds no runtime dependency —
 * the site is still plain static files. Requires Playwright available to node
 * (globally installed is fine); it never downloads a browser.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', // ES modules — must not be text/plain
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/* ── Playwright resolution ──────────────────────────────────── */
/* Try the normal require first, then the usual global install roots. */
function loadPlaywright() {
  const candidates = [];
  try {
    candidates.push(require.resolve('playwright'));
  } catch {}
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (globalRoot) candidates.push(path.join(globalRoot, 'playwright'));
  } catch {}
  candidates.push(
    '/opt/node22/lib/node_modules/playwright',
    '/usr/lib/node_modules/playwright',
    '/usr/local/lib/node_modules/playwright'
  );

  for (const c of candidates) {
    try {
      return createRequire(__filename)(c);
    } catch {}
  }

  console.error(
    'Could not find Playwright.\n\n' +
      'Install it globally:  npm i -g playwright\n\n' +
      'Do NOT run "playwright install" in the Claude Code web environment —\n' +
      'Chromium is already present at /opt/pw-browsers.'
  );
  process.exit(1);
}

/* ── Static server ──────────────────────────────────────────── */
function serve() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let rel = urlPath === '/' ? '/index.html' : urlPath;
    const file = path.join(ROOT, path.normalize(rel));

    // Never serve outside the repo.
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/* ── Page helpers ───────────────────────────────────────────── */
async function open(browser, base, route, theme, viewport) {
  const page = await browser.newPage({ viewport });
  // Set the theme the way the app does, before its inline script reads it.
  await page.addInitScript(t => {
    try { localStorage.setItem('csp-theme', t); } catch {}
  }, theme);
  await page.goto(`${base}/index.html#/${route}`, { waitUntil: 'load' });
  // nav.js fetches the fragment and injects it, so wait for real content.
  await page.waitForFunction(
    () => {
      const el = document.querySelector('#content-area');
      return el && el.children.length > 0;
    },
    { timeout: 15000 }
  );
  return page;
}

async function probe(page, selector) {
  return page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      color: cs.color,
      background: cs.backgroundColor,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }, selector);
}

/* ── Main ───────────────────────────────────────────────────── */
(async () => {
  const [route, selector] = process.argv.slice(2);
  if (!route) {
    console.error('usage: node tools/shot.js <route> [selector]\n' + '   eg: node tools/shot.js netplus/domain1/obj-1-7 .addr-class-wrap');
    process.exit(1);
  }

  const { chromium } = loadPlaywright();
  const outDir = path.join(__dirname, 'shots');
  fs.mkdirSync(outDir, { recursive: true });

  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const slug = route.replace(/\//g, '-');
  const written = [];
  let missing = false;

  // Stale files from an earlier run must not be mistaken for this run's output.
  for (const v of ['dark', 'light', 'mobile']) {
    fs.rmSync(path.join(outDir, `${slug}-${v}.png`), { force: true });
  }

  const shoot = async (page, label, out) => {
    if (!selector) {
      await page.screenshot({ path: out, fullPage: true });
      console.log(`  ${label.padEnd(6)} full page`);
      return true;
    }
    const el = await page.$(selector);
    if (!el) {
      console.error(`  ${label.padEnd(6)} selector not found — ${selector}`);
      missing = true;
      return false;
    }
    await el.screenshot({ path: out });
    const info = await probe(page, selector);
    console.log(`  ${label.padEnd(6)} ${info.width}x${info.height}  text ${info.color}  bg ${info.background}`);
    return true;
  };

  try {
    for (const theme of ['dark', 'light']) {
      const page = await open(browser, base, route, theme, { width: 1280, height: 900 });
      const out = path.join(outDir, `${slug}-${theme}.png`);
      if (await shoot(page, theme, out)) written.push(path.basename(out));
      await page.close();
    }

    // Mobile — the breakpoint most layout bugs hide behind.
    const page = await open(browser, base, route, 'dark', { width: 390, height: 844 });
    const out = path.join(outDir, `${slug}-mobile.png`);
    if (await shoot(page, 'mobile', out)) written.push(path.basename(out));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }

  const dir = path.relative(ROOT, outDir);
  if (written.length) console.log(`\nWrote ${written.map(f => `${dir}/${f}`).join('\n      ')}`);
  else console.error('\nNothing written.');
  if (missing) process.exit(1);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
