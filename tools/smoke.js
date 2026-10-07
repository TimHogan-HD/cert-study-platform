#!/usr/bin/env node
/*
 * tools/smoke.js — click through every interactive component and the router.
 *
 *   node tools/smoke.js [--root <checkout>]
 *
 * Each scenario opens a route, acts the way a student would, and asserts the
 * observable result (a class, a counter, the URL). /api/explain is stubbed, so
 * nothing leaves the machine. Exits non-zero on the first failing scenario in
 * each route, or on any page error. Dev-only, like shot.js and snap.js.
 */

'use strict';

const path = require('path');
const { loadPlaywright, serve, open } = require('./pw');

const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
const hash = page => page.evaluate(() => location.hash);
const loaded = page => page.waitForFunction(() => {
  const el = document.querySelector('#content-area');
  return el && el.children.length && !el.querySelector('.skeleton-loading');
});
const routeIs = async (page, route) => {
  await page.waitForFunction(r => location.hash === `#/${r}`, route);
  await loaded(page);
};

/* Open whatever hides an element (a closed accordion, an inactive day tab) the way a student would. */
async function reveal(page, selector) {
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    for (let n = el; n; n = n.parentElement) {
      if (n.classList.contains('accordion-body') && !n.classList.contains('open')) n.previousElementSibling.click();
      if (n.classList.contains('cram-day-panel') && !n.classList.contains('active')) {
        const group = n.closest('.cram-day-group');
        const i = [...group.querySelectorAll(':scope > .cram-day-panel')].indexOf(n);
        group.querySelectorAll('.cram-day-btn')[i].click();
      }
    }
  }, selector);
}

/* Click the first unmatched item, then the target it belongs to. */
async function matchOnePair(page, game) {
  const g = page.locator(game);
  const item = g.locator('.match-item').first();
  const id = await item.getAttribute('data-match');
  await item.click();
  await g.locator(`.match-target[data-id="${id}"]`).click();
  assert(await item.evaluate(e => e.classList.contains('matched')), `${game}: correct pair did not match`);
  assert(/^1 \//.test(await g.locator('.match-score').textContent()), `${game}: score did not reach 1`);
}

const SCENARIOS = {
  home: [
    ['cert card opens the Net+ overview', async p => {
      await p.click('.cert-home-card[data-cert="netplus"]');
      await routeIs(p, 'netplus/overview');
    }],
  ],
  'netplus/overview': [
    ['quicknav card navigates', async p => {
      const card = p.locator('.quicknav-card[data-path]').first();
      const target = await card.getAttribute('data-path');
      await card.click();
      await routeIs(p, target);
    }],
  ],
  'netplus/study-plans': [
    ['toggle group switches panel', async p => {
      const btn = p.locator('.toggle-group .toggle-btn:not(.active)').first();
      const target = await btn.getAttribute('data-target');
      await btn.click();
      assert(await p.locator(`#${target}`).evaluate(e => e.classList.contains('active')), 'toggle panel did not activate');
    }],
    ['inline nav link navigates', async p => {
      const link = p.locator('.inline-nav[data-path]:visible').first();
      const target = await link.getAttribute('data-path');
      await link.click();
      await routeIs(p, target);
    }],
  ],
  'netplus/domain1/obj-1-1': [
    ['OSI card expands', async p => {
      const card = p.locator('.osi-flip-card').first();
      await card.click();
      assert(await card.getAttribute('aria-expanded') === 'true', 'osi card did not expand');
    }],
    ['matching game pairs', p => matchOnePair(p, '.matching-game')],
  ],
  'netplus/domain1/obj-1-2': [
    ['IDS/IPS card flips', async p => {
      const card = p.locator('.ids-ips-flip-card').first();
      await card.click();
      assert(await card.evaluate(e => e.classList.contains('is-flipped')), 'ids-ips card did not flip');
    }],
  ],
  'netplus/domain1/obj-1-4': [
    ['flashcard deck advances and flips', async p => {
      const deck = p.locator('.flashcard-deck').first();
      await deck.locator('.next-btn').click();
      assert(/^2 \//.test(await deck.locator('.card-counter').textContent()), 'deck counter did not advance');
      const card = deck.locator('.flashcard:visible');
      await card.click();
      assert(await card.evaluate(e => e.classList.contains('flipped')), 'flashcard did not flip');
    }],
    ['protocol reference row flips', async p => {
      const row = p.locator('.protocol-ref-row').first();
      await row.click();
      assert(await row.getAttribute('aria-expanded') === 'true', 'protocol row did not flip');
    }],
  ],
  'netplus/domain1/obj-1-6': [
    ['architecture card flips', async p => {
      const card = p.locator('.arch-flip-card').first();
      await card.click();
      assert(await card.getAttribute('aria-pressed') === 'true', 'arch card did not flip');
    }],
  ],
  'netplus/domain1/obj-1-7': [
    ['binary bit toggles the total', async p => {
      await reveal(p, '#bit-grid');
      const before = await p.locator('#bit-total').textContent();
      await p.locator('#bit-grid .binary-bit-cell').first().click();
      assert(await p.locator('#bit-total').textContent() !== before, 'bit total did not change');
    }],
    ['guided subnetting checks and reveals', async p => {
      await p.locator('#subnet-guide .sg-method-btn').first().click();
      assert(await p.locator('#sg-body').isVisible(), 'guide body did not open');
      await p.click('#sg-check-btn');
      assert(/correct/.test(await p.locator('#sg-summary').textContent()), 'check produced no summary');
      await p.click('#sg-reveal-btn');
      assert(await p.locator('.sg-input-revealed').count() > 0, 'reveal filled no answers');
    }],
    ['accordion opens and survives a reload', async p => {
      const header = p.locator('.accordion-header').first();
      await header.click();
      assert(await header.evaluate(e => e.classList.contains('open')), 'accordion did not open');
      await p.reload();
      await loaded(p);
      assert(await p.locator('.accordion-header').first().evaluate(e => e.classList.contains('open')), 'accordion state did not persist');
    }],
    ['footer next goes to the next objective', async p => {
      await p.click('.obj-nav-next');
      await routeIs(p, 'netplus/domain1/obj-1-8');
      await p.goBack();
      await routeIs(p, 'netplus/domain1/obj-1-7');
    }],
    ['breadcrumb and domain sub-nav are injected', async p => {
      assert(await p.locator('#breadcrumb').count() === 1, 'no breadcrumb');
      assert(await p.locator('#domain-subnav-bar .domain-subnav-link').count() === 8, 'domain sub-nav should list 8 objectives');
    }],
    ['AI explain renders a (stubbed) answer', async p => {
      await p.locator('.ai-explain-btn').first().click();
      const out = p.locator('.ai-explain-output').first();
      await out.waitFor();
      assert(/stubbed explanation/.test(await out.textContent()), 'explanation not rendered');
    }],
  ],
  'netplus/domain2/obj-2-2': [
    ['STP security card flips', async p => {
      const card = p.locator('.flip-card').first();
      await card.click();
      assert(await card.evaluate(e => e.classList.contains('is-flipped')), 'flip card did not flip');
    }],
  ],
  'netplus/domain3/obj-3-4': [['DNS matching game pairs', p => matchOnePair(p, '.matching-game')]],
  'netplus/domain4/obj-4-2': [['attack matching game pairs', p => matchOnePair(p, '.matching-game')]],
  'netplus/pbq/subnet-calculator': [
    ['calculator recomputes as you type', async p => {
      await p.fill('.sc-ip', '10.0.0.200');
      await p.fill('.sc-prefix', '255.255.255.224');
      const text = await p.locator('.sc-results').textContent();
      assert(text.includes('10.0.0.192/27') && text.includes('10.0.0.223'), `wrong subnet: ${text}`);
    }],
    ['VLSM planner allocates largest first', async p => {
      const text = await p.locator('.vlsm-out').textContent();
      assert(text.includes('192.168.50.0/26') && text.includes('192.168.50.112/30'), `unexpected plan: ${text}`);
      await p.click('.vlsm-add');
      await p.locator('.vlsm-row').last().locator('.vlsm-hosts').fill('500');
      assert(/Does not fit/.test(await p.locator('.vlsm-out').textContent()), 'oversized segment not flagged');
    }],
    ['drill grades a correct answer', async p => {
      const want = await p.evaluate(async () => {
        const m = await import('/js/ipv4.js');
        const [ip, prefix] = document.querySelector('.drill-q').textContent.split('/');
        const s = m.subnet(m.parseIp(ip), +prefix);
        return { network: m.fmtIp(s.network), broadcast: m.fmtIp(s.broadcast), first: m.fmtIp(s.first), last: m.fmtIp(s.last), hosts: String(s.usable) };
      });
      for (const [key, value] of Object.entries(want)) await p.fill(`.drill-field[data-key="${key}"]`, value);
      await p.click('.subnet-drill .pbq-check');
      assert(/^Correct/.test(await p.locator('.drill-status').textContent()), 'correct answer not accepted');
    }],
  ],
  'netplus/pbq/cli-troubleshooting': [
    ['console answers abbreviated IOS commands per host', async p => {
      const term = p.locator('.pbq-term').first();
      await term.locator('.pbq-term-tab', { hasText: 'SW2' }).click();
      await term.locator('.pbq-term-line input').fill('sh mac add');
      await term.locator('.pbq-term-line input').press('Enter');
      const out = await term.locator('.pbq-term-out:visible').textContent();
      assert(out.includes('00a0.c914.7e21') && out.includes('Fa0/14'), 'show mac address-table output missing');
      await term.locator('.pbq-term-line input').fill('show bogus');
      await term.locator('.pbq-term-line input').press('Enter');
      assert((await term.locator('.pbq-term-out:visible').textContent()).includes('% Invalid input'), 'unknown command not rejected');
    }],
    ['PBQ grades, reveals and resets', async p => {
      const q = p.locator('.pbq').first();
      await q.locator('select').first().selectOption('00a0.c914.7e12');
      await q.locator('.pbq-check').click();
      assert(await q.locator('select').first().getAttribute('data-state') === 'wrong', 'wrong answer not marked');
      assert(await q.locator('.pbq-explain').isVisible(), 'explanation not shown after check');
      await q.locator('.pbq-reveal').click();
      await q.locator('.pbq-check').click();
      assert(/^All 4 correct/.test(await q.locator('.pbq-result').textContent()), 'revealed answers do not pass');
      await q.locator('.pbq-reset').click();
      assert(await q.locator('select').first().inputValue() === '' && await q.locator('.pbq-result').isHidden(), 'reset did not clear');
    }],
  ],
  'netplus/pbq/ip-addressing': [
    ['chips place by click and return when cleared', async p => {
      const q = p.locator('.pbq').first();
      const chip = q.locator('.pbq-chip[data-value="0-26"]');
      const slot = q.locator('.pbq-slot').first();
      await chip.click();
      await slot.click();
      assert(await slot.getAttribute('data-value') === '0-26' && await chip.isHidden(), 'chip not placed');
      await slot.click();
      assert(!(await slot.getAttribute('data-value')) && await chip.isVisible(), 'chip not returned');
    }],
    ['host field accepts any usable address but not the gateway', async p => {
      const q = p.locator('.pbq').first();
      const host = q.locator('.pbq-field[data-check="host"]');
      await host.fill('192.168.50.90');
      await q.locator('.pbq-check').click();
      assert(await host.getAttribute('data-state') === 'right', 'valid host rejected');
      await host.fill('192.168.50.65');
      await q.locator('.pbq-check').click();
      assert(await host.getAttribute('data-state') === 'wrong', 'gateway accepted as a host');
    }],
  ],
  'netplus/pbq/wireless': [
    ['channels must be distinct non-overlapping', async p => {
      const q = p.locator('.pbq').first();
      const ch = q.locator('.pbq-field[data-group="ch24"]');
      for (const i of [0, 1, 2]) await ch.nth(i).selectOption('6');
      await q.locator('.pbq-check').click();
      assert(await ch.nth(0).getAttribute('data-state') === 'wrong', 'duplicate channel accepted');
      for (const [i, c] of [[0, '11'], [1, '1'], [2, '6']]) await ch.nth(i).selectOption(c);
      await q.locator('.pbq-check').click();
      assert(await ch.nth(2).getAttribute('data-state') === 'right', 'valid channel plan rejected');
    }],
  ],
  'netplus/pbq/ports-methodology': [
    ['chips place by drag and drop', async p => {
      const q = p.locator('.pbq').first();
      const slot = q.locator('.pbq-slot').first();
      await q.locator('.pbq-chip[data-value="22"]').dragTo(slot);
      assert(await slot.getAttribute('data-value') === '22', 'drag did not place the chip');
    }],
  ],
  'az104/stub': [
    ['old route resolves and shows its own sidebar', async p => {
      await routeIs(p, 'az104/az900-cram');
      assert(await p.locator('#sidebar-az104').isVisible(), 'AZ sidebar not shown');
      assert(!(await p.locator('#sidebar-netplus').isVisible()), 'Net+ sidebar still shown');
      assert(await p.locator('#sidebar-az104 .obj-link.active').count() === 1, 'AZ page not highlighted');
    }],
  ],
  'az104/az900-cram': [
    ['day tab switches panel', async p => {
      const group = p.locator('.cram-day-group').first();
      await group.locator('.cram-day-btn').nth(1).click();
      assert(await group.locator(':scope > .cram-day-panel').nth(1).evaluate(e => e.classList.contains('active')), 'day panel did not switch');
    }],
    ['checklist ticks and persists', async p => {
      await reveal(p, '.checklist[data-store]');
      const list = p.locator('.checklist[data-store]').first();
      const key = await list.getAttribute('data-store');
      await list.locator('.check-item').first().click();
      const stored = await p.evaluate(k => localStorage.getItem(k), key);
      assert(stored && JSON.parse(stored).c0 === true, 'checklist state not stored');
    }],
  ],
};

(async () => {
  const ri = process.argv.indexOf('--root');
  const root = path.resolve(ri >= 0 ? process.argv[ri + 1] : path.join(__dirname, '..'));
  const { chromium } = loadPlaywright();
  const server = await serve(root);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  let failed = 0, passed = 0;
  try {
    for (const [route, scenarios] of Object.entries(SCENARIOS)) {
      for (const [name, run] of scenarios) {
        const errors = [];
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await ctx.route('**/api/explain', r => r.fulfill({ json: { explanation: 'A stubbed explanation.' } }));
        const page = await open(ctx, base, route, 'dark', undefined, undefined, m => errors.push(m));
        try {
          await run(page);
          assert(!errors.length, `page error: ${errors.join('; ')}`);
          passed++;
          console.log(`  ok    ${route}  ${name}`);
        } catch (e) {
          failed++;
          console.log(`  FAIL  ${route}  ${name}\n        ${e.message.split('\n')[0]}`);
        } finally {
          await ctx.close();
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
