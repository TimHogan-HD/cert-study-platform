'use strict';
/*
 * Shared helpers for the dev-only render tools (shot.js, snap.js): find
 * Playwright, serve a repo checkout, and open a route the way a user lands on it.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { execSync } = require('child_process');
const { pathToFileURL } = require('url');

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

function serve(root) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const rel = urlPath === '/' ? '/index.html' : urlPath;
    const file = path.join(root, path.normalize(rel));

    // Never serve outside the repo.
    if (!file.startsWith(root)) {
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

async function open(browser, base, route, theme, viewport, initScript, onError) {
  const page = await browser.newPage({ viewport });
  if (onError) {
    page.on('pageerror', e => onError(e.message));
    page.on('console', m => m.type() === 'error' && onError(`console: ${m.text()}`));
  }
  // Set the theme the way the app does, before its inline script reads it.
  await page.addInitScript(t => {
    try { localStorage.setItem('csp-theme', t); } catch {}
  }, theme);
  if (initScript) await page.addInitScript(initScript);
  await page.goto(`${base}/index.html#/${route}`, { waitUntil: 'load' });
  // nav.js fetches the fragment and injects it, so wait for real content.
  await page.waitForFunction(
    () => {
      const el = document.querySelector('#content-area');
      return el && el.children.length > 0 && !el.querySelector('.skeleton-loading');
    },
    { timeout: 15000 }
  );
  // loadFragment catches fetch and component-init failures and renders this callout instead.
  if (onError && await page.$('#content-area > .callout-red > code')) {
    onError(`fragment failed to load or a component init threw: ${await page.textContent('#content-area')}`);
  }
  return page;
}

/* Every routable page. Checkouts from before js/catalog.js listed them in index.html. */
async function routes(root) {
  const catalog = path.join(root, 'js', 'catalog.js');
  if (fs.existsSync(catalog)) return (await import(pathToFileURL(catalog).href)).ROUTES;
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  return ['home', ...new Set([...html.matchAll(/data-path="([^"]+)"/g)].map(m => m[1]))];
}

module.exports = { loadPlaywright, serve, open, routes };
