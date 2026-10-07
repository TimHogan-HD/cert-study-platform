/* pbq.js — graded performance-based questions.
   A .pbq holds fields: <select>/<input class="pbq-field"> and .pbq-slot drop targets filled
   from a .pbq-bank of .pbq-chip buttons (drag, or click a chip then a slot). Each field names
   how it is graded with data-check (a CHECKS key, default "exact") and what it expects with
   data-answer. Check grades every field, Show answers fills them, Reset clears them. */
import { parseIp, parseCidr, parsePrefix, subnet } from '../ipv4.js';

const norm = v => String(v).trim().toLowerCase().replace(/\s+/g, ' ');
const alternatives = el => (el.dataset.answer || '').split('|').map(norm);

/* Each check: (value, field element, every field in the same .pbq) → correct? */
const CHECKS = {
  exact: (v, el) => alternatives(el).includes(norm(v)),
  ip: (v, el) => {
    const ip = parseIp(v);
    return ip !== null && alternatives(el).some(a => parseIp(a) === ip);
  },
  /* A prefix length written as /26, 26 or 255.255.255.192. */
  mask: (v, el) => {
    const p = parsePrefix(v);
    return p !== null && alternatives(el).some(a => parsePrefix(a) === p);
  },
  /* Any usable host address in data-net, other than the addresses listed in data-not. */
  host: (v, el) => {
    const ip = parseIp(v), net = parseCidr(el.dataset.net);
    if (ip === null || !net) return false;
    const s = subnet(net.ip, net.prefix);
    const taken = (el.dataset.not || '').split('|').filter(Boolean).map(parseIp);
    return ip >= s.first && ip <= s.last && !taken.includes(ip);
  },
  /* One of data-answer, and different from every other field in the same data-group. */
  distinct: (v, el, fields) => CHECKS.exact(v, el)
    && !fields.some(f => f.el !== el && f.el.dataset.group === el.dataset.group && norm(f.get()) === norm(v)),
};

function slotField(el, pbq) {
  const bankOf = () => pbq.querySelector(el.dataset.bank ? `.pbq-bank[data-bank="${el.dataset.bank}"]` : '.pbq-bank');
  const empty = el.textContent;
  const set = (value) => {
    const bank = bankOf();
    const reuse = bank?.hasAttribute('data-reuse');
    if (el.dataset.value && !reuse) bank.querySelector(`.pbq-chip[data-value="${CSS.escape(el.dataset.value)}"]`)?.removeAttribute('hidden');
    const chip = value ? bank?.querySelector(`.pbq-chip[data-value="${CSS.escape(value)}"]`) : null;
    if (chip) {
      el.dataset.value = value;
      el.textContent = chip.textContent;
      el.classList.add('filled');
      if (!reuse) chip.setAttribute('hidden', '');
    } else {
      delete el.dataset.value;
      el.textContent = empty;
      el.classList.remove('filled');
    }
  };
  return { el, bankOf, get: () => el.dataset.value || '', set };
}

const inputField = el => ({ el, get: () => el.value, set: v => { el.value = v; } });


const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function startTimer(pbq) {
  const target = Number(pbq.dataset.minutes);
  const out = pbq.querySelector('.pbq-timer');
  let began = null, ended = null, id = null;
  const elapsed = () => (began ? Math.floor(((ended || Date.now()) - began) / 1000) : 0);
  const paint = () => {
    if (!target || !out) return;
    out.textContent = `${fmt(elapsed())} / ${fmt(target * 60)}`;
    out.classList.toggle('over', elapsed() > target * 60);
  };
  const stop = () => { if (began && !ended) ended = Date.now(); clearInterval(id); id = null; paint(); };
  paint();
  return {
    elapsed,
    start() {
      if (began) return;
      began = Date.now();
      id = setInterval(() => (pbq.isConnected ? paint() : stop()), 1000);
    },
    stop,
    reset() { clearInterval(id); id = null; began = ended = null; paint(); },
  };
}

/* Passed PBQs, keyed by each .pbq's data-pbq id: { [id]: { best: seconds } }. Per-browser only. */
const PROGRESS_KEY = 'csp-pbq-progress';
export function readProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch { return {}; }
}
function recordPass(id, seconds) {
  const all = readProgress();
  const best = all[id]?.best;
  all[id] = { best: best && best <= seconds ? best : seconds };
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(all)); } catch {}
}
function paintStatus(pbq) {
  const head = pbq.querySelector('.pbq-head');
  const rec = readProgress()[pbq.dataset.pbq];
  let badge = pbq.querySelector('.pbq-status');
  if (!rec || !head) { badge?.remove(); return; }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'pbq-status';
    const timer = head.querySelector('.pbq-timer');
    if (timer) timer.before(badge); else head.append(badge);
  }
  badge.textContent = `✓ Passed · best ${fmt(rec.best)}`;
}

/* Wires one .pbq. Returns its controls so exam mode and scenario generators can drive it. */
export function setupPbq(pbq) {
  const fields = [
    ...[...pbq.querySelectorAll('.pbq-field')].map(inputField),
    ...[...pbq.querySelectorAll('.pbq-slot')].map(el => slotField(el, pbq)),
  ];
  const result = pbq.querySelector('.pbq-result');
  const explain = pbq.querySelector('.pbq-explain');
  const timer = startTimer(pbq);
  let selected = null;
  let revealed = false;

  const select = chip => {
    selected?.classList.remove('selected');
    selected = chip === selected ? null : chip;
    selected?.classList.add('selected');
  };
  const touched = f => { timer.start(); delete f.el.dataset.state; };

  pbq.querySelectorAll('.pbq-chip').forEach(chip => {
    chip.draggable = true;
    chip.addEventListener('click', () => select(chip));
    chip.addEventListener('dragstart', e => {
      select(null); select(chip);
      e.dataTransfer.setData('text/plain', chip.dataset.value);
    });
  });

  fields.forEach(f => {
    if (!f.bankOf) {
      f.el.addEventListener('input', () => touched(f));
      return;
    }
    const accepts = () => selected && f.bankOf()?.contains(selected);
    const place = () => {
      touched(f);
      f.set(selected.dataset.value);
      select(null);
    };
    f.el.addEventListener('click', () => {
      if (accepts()) place();
      else if (f.get()) { touched(f); f.set(''); }
    });
    f.el.addEventListener('dragover', e => { if (accepts()) e.preventDefault(); });
    f.el.addEventListener('drop', e => { e.preventDefault(); if (accepts()) place(); });
  });

  const summarise = (cls, text) => {
    result.hidden = false;
    result.className = `pbq-result ${cls}`;
    result.textContent = text;
    if (explain) explain.hidden = false;
  };

  function grade() {
    let right = 0;
    for (const f of fields) {
      const ok = !!f.get() && (CHECKS[f.el.dataset.check || 'exact'])(f.get(), f.el, fields);
      f.el.dataset.state = ok ? 'right' : 'wrong';
      if (ok) right++;
    }
    const all = right === fields.length;
    if (all) timer.stop();
    if (all && !revealed && pbq.dataset.pbq) { recordPass(pbq.dataset.pbq, timer.elapsed()); paintStatus(pbq); }
    summarise(all ? 'pass' : 'fail', all
      ? `All ${fields.length} correct in ${fmt(timer.elapsed())}. Read the explanation to confirm your reasoning matched.`
      : `${right} / ${fields.length} correct. Fields outlined in red are wrong or empty. Change them and check again, or show the answers.`);
    return { right, total: fields.length };
  }

  function reveal() {
    revealed = true;
    fields.forEach(f => f.set(''));
    for (const f of fields) {
      f.set(f.el.dataset.show || f.el.dataset.answer.split('|')[0]);
      f.el.dataset.state = 'revealed';
    }
    select(null);
    timer.stop();
    summarise('revealed', 'Answers shown, so this attempt does not count as a pass. Work through the explanation, then press Reset and try again from memory.');
  }

  function reset() {
    revealed = false;
    for (const f of fields) { f.set(''); delete f.el.dataset.state; }
    select(null);
    timer.reset();
    result.hidden = true;
    if (explain) explain.hidden = true;
  }

  pbq.querySelector('.pbq-check')?.addEventListener('click', grade);
  pbq.querySelector('.pbq-reveal')?.addEventListener('click', reveal);
  pbq.querySelector('.pbq-reset')?.addEventListener('click', reset);
  paintStatus(pbq);
  return { grade, reveal, reset, timer };
}

export function initPbq() {
  document.querySelectorAll('.pbq').forEach(setupPbq);
}

/* "2 / 3 passed" on every card or link that lists PBQ ids in data-pbqs. */
function paintProgress() {
  const done = readProgress();
  document.querySelectorAll('[data-pbqs]').forEach(el => {
    const ids = el.dataset.pbqs.split(' ');
    const passed = ids.filter(id => done[id]).length;
    let badge = el.querySelector('.pbq-progress');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'pbq-progress';
      el.append(badge);
    }
    badge.dataset.complete = String(passed === ids.length);
    badge.textContent = `${passed} / ${ids.length} passed`;
  });
  const total = document.querySelector('.pbq-total');
  if (total) {
    const ids = [...document.querySelectorAll('[data-pbqs]')].flatMap(el => el.dataset.pbqs.split(' '));
    total.textContent = `You have passed ${ids.filter(id => done[id]).length} of ${ids.length} PBQs in this browser.`;
  }
}

export function initPbqProgress() {
  paintProgress();
  document.querySelector('.pbq-progress-reset')?.addEventListener('click', () => {
    try { localStorage.removeItem(PROGRESS_KEY); } catch {}
    paintProgress();
  });
}
