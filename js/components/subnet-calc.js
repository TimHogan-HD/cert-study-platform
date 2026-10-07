/* subnet-calc.js — subnet calculator, VLSM planner and timed subnetting drill (PBQ section). */
import { parseIp, parsePrefix, parseCidr, fmtIp, subnet, prefixFor, classify, toBinary } from '../ipv4.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rows = pairs => pairs.map(([k, v]) => `<div class="sc-key">${k}</div><div class="sc-val">${v}</div>`).join('');

function initCalculator(root) {
  const ipIn = root.querySelector('.sc-ip');
  const prefixIn = root.querySelector('.sc-prefix');
  const out = root.querySelector('.sc-results');
  const bin = root.querySelector('.sc-binary');
  const err = root.querySelector('.sc-error');

  function paint() {
    const ip = parseIp(ipIn.value), prefix = parsePrefix(prefixIn.value);
    const bad = ip === null ? 'Enter an IPv4 address such as 192.168.10.77.'
      : prefix === null ? 'Enter a prefix (/26 or 26) or a contiguous mask (255.255.255.192).' : '';
    err.hidden = !bad;
    err.textContent = bad;
    if (bad) return;
    const s = subnet(ip, prefix), c = classify(ip);
    out.innerHTML = rows([
      ['Network address', `${fmtIp(s.network)}/${prefix}`],
      ['Subnet mask', fmtIp(s.mask)],
      ['Wildcard mask', fmtIp(s.wildcard)],
      ['First usable host', fmtIp(s.first)],
      ['Last usable host', fmtIp(s.last)],
      ['Broadcast address', prefix >= 31 ? 'none (point-to-point or host route)' : fmtIp(s.broadcast)],
      ['Usable hosts', s.usable.toLocaleString()],
      ['Block size', prefix >= 24 ? `${s.total} in the 4th octet` : prefix >= 16 ? `${s.total / 256} in the 3rd octet` : prefix >= 8 ? `${s.total / 65536} in the 2nd octet` : `${s.total / 16777216} in the 1st octet`],
      ['Classful class', c.cls],
      ['Address type', c.scope],
    ]);
    /* Network bits in blue, host bits in amber: the boundary is the whole lesson. */
    const split = b => {
      let seen = 0;
      return [...b].map(ch => {
        if (ch === '.') return '<span class="sc-dot">.</span>';
        return `<span class="${seen++ < prefix ? 'sc-net' : 'sc-host'}">${ch}</span>`;
      }).join('');
    };
    bin.innerHTML = rows([
      ['IP address', split(toBinary(ip))],
      ['Mask', split(toBinary(s.mask))],
      ['Network', split(toBinary(s.network))],
      ['Broadcast', split(toBinary(s.broadcast))],
    ]);
  }
  ipIn.addEventListener('input', paint);
  prefixIn.addEventListener('input', paint);
  paint();
}

function initVlsm(root) {
  const base = root.querySelector('.vlsm-base');
  const list = root.querySelector('.vlsm-rows');
  const out = root.querySelector('.vlsm-out');

  function addRow(name = '', hosts = '') {
    const row = document.createElement('div');
    row.className = 'vlsm-row';
    row.innerHTML = `<input class="lab-input vlsm-name" aria-label="Segment name" placeholder="Segment name" value="${esc(name)}">`
      + `<input class="lab-input vlsm-hosts" aria-label="Hosts needed" inputmode="numeric" placeholder="Hosts" value="${esc(hosts)}">`
      + '<button type="button" class="vlsm-remove" aria-label="Remove segment">✕</button>';
    row.querySelector('.vlsm-remove').addEventListener('click', () => { row.remove(); paint(); });
    row.addEventListener('input', paint);
    list.append(row);
  }

  function paint() {
    const block = parseCidr(base.value);
    if (!block) { out.innerHTML = '<p class="sc-error">Enter the address block in CIDR form, such as 192.168.50.0/24.</p>'; return; }
    const whole = subnet(block.ip, block.prefix);
    const segs = [...list.querySelectorAll('.vlsm-row')]
      .map(r => ({ name: r.querySelector('.vlsm-name').value.trim() || 'Unnamed', hosts: parseInt(r.querySelector('.vlsm-hosts').value, 10) }))
      .filter(s => s.hosts > 0)
      .sort((a, b) => b.hosts - a.hosts);
    /* Largest first, so every block lands on a boundary of its own size without gaps. */
    let cursor = whole.network;
    const body = segs.map(seg => {
      const p = prefixFor(seg.hosts);
      const size = p === null ? Infinity : 2 ** (32 - p);
      const start = Math.ceil(cursor / size) * size;
      if (p === null || p < block.prefix || start + size - 1 > whole.broadcast) {
        return `<tr class="vlsm-nofit"><td>${esc(seg.name)}</td><td>${seg.hosts}</td><td colspan="5">Does not fit in what is left of ${esc(base.value.trim())}</td></tr>`;
      }
      cursor = start + size;
      const s = subnet(start, p);
      return `<tr><td>${esc(seg.name)}</td><td>${seg.hosts}</td><td><code>${fmtIp(s.network)}/${p}</code></td><td><code>${fmtIp(s.mask)}</code></td>`
        + `<td><code>${fmtIp(s.first)} – ${fmtIp(s.last)}</code></td><td><code>${fmtIp(s.broadcast)}</code></td><td>${s.usable - seg.hosts}</td></tr>`;
    }).join('');
    const left = whole.broadcast + 1 - cursor;
    out.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Segment</th><th>Needs</th><th>Subnet</th><th>Mask</th><th>Usable range</th><th>Broadcast</th><th>Spare</th></tr></thead><tbody>${body}</tbody></table></div>`
      + `<p class="vlsm-left">${left.toLocaleString()} of ${whole.total.toLocaleString()} addresses left unallocated, starting at <code>${fmtIp(Math.min(cursor, whole.broadcast))}</code>.</p>`;
  }

  (root.dataset.segments || '').split(',').filter(Boolean).forEach(s => addRow(...s.split(':')));
  root.querySelector('.vlsm-add').addEventListener('click', () => { addRow(); list.lastElementChild.querySelector('input').focus(); });
  base.addEventListener('input', paint);
  paint();
}

const LEVELS = {
  easy: { prefixes: [25, 26, 27, 28, 29, 30], firsts: [192] },
  medium: { prefixes: [17, 18, 19, 20, 21, 22, 23], firsts: [172, 10] },
  mixed: { prefixes: [17, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30], firsts: [10, 172, 192] },
};
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const rand = n => Math.floor(Math.random() * n);

function question(level) {
  const { prefixes, firsts } = LEVELS[level];
  const first = pick(firsts);
  const second = first === 192 ? 168 : first === 172 ? 16 + rand(16) : rand(256);
  const ip = parseIp(`${first}.${second}.${rand(256)}.${1 + rand(254)}`);
  return { ip, prefix: pick(prefixes) };
}

function initDrill(root) {
  const prompt = root.querySelector('.drill-q');
  const fields = [...root.querySelectorAll('.drill-field')];
  const status = root.querySelector('.drill-status');
  const level = root.querySelector('.drill-level');
  const score = { asked: 0, right: 0, streak: 0 };
  let q, began, answered;

  const expected = () => {
    const s = subnet(q.ip, q.prefix);
    return { network: fmtIp(s.network), broadcast: fmtIp(s.broadcast), first: fmtIp(s.first), last: fmtIp(s.last), hosts: String(s.usable) };
  };
  const tally = () => `${score.right} of ${score.asked} fully correct · streak ${score.streak}`;

  function next(focus = true) {
    q = question(level.value);
    began = Date.now();
    answered = false;
    prompt.textContent = `${fmtIp(q.ip)}/${q.prefix}`;
    fields.forEach(f => { f.value = ''; delete f.dataset.state; });
    status.className = 'drill-status';
    status.textContent = tally();
    if (focus) fields[0].focus({ preventScroll: true });
  }

  function check() {
    const want = expected();
    let ok = 0;
    for (const f of fields) {
      const key = f.dataset.key;
      const good = key === 'hosts'
        ? f.value.replace(/[,\s]/g, '') === want.hosts
        : parseIp(f.value) !== null && fmtIp(parseIp(f.value)) === want[key];
      f.dataset.state = good ? 'right' : 'wrong';
      if (good) ok++;
    }
    const all = ok === fields.length;
    if (!answered) {
      answered = true;
      score.asked++;
      if (all) { score.right++; score.streak++; } else score.streak = 0;
    }
    const secs = Math.round((Date.now() - began) / 1000);
    status.className = `drill-status ${all ? 'pass' : 'fail'}`;
    status.textContent = all
      ? `Correct in ${secs}s. ${tally()}. Press Enter for the next one.`
      : `${ok} / ${fields.length}. Network ${want.network}, broadcast ${want.broadcast}, hosts ${want.first} – ${want.last} (${want.hosts} usable). ${tally()}`;
  }

  root.querySelector('.drill-form').addEventListener('submit', e => {
    e.preventDefault();
    if (answered && status.classList.contains('pass')) next(); else check();
  });
  root.querySelector('.drill-next').addEventListener('click', () => next());
  level.addEventListener('change', () => next());
  fields.forEach(f => f.addEventListener('input', () => delete f.dataset.state));
  next(false);
}

export function initSubnetTools() {
  document.querySelectorAll('.subnet-calc').forEach(initCalculator);
  document.querySelectorAll('.vlsm').forEach(initVlsm);
  document.querySelectorAll('.subnet-drill').forEach(initDrill);
}
