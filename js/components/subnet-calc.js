/* subnet-calc.js — subnet calculator, VLSM planner and timed subnetting drill (PBQ section). */
import { parseIp, parsePrefix, parseCidr, fmtIp, subnet, prefixFor, classify } from '../ipv4.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const octets = n => [24, 16, 8, 0].map(s => (n >>> s) & 255);
const ORDINAL = ['1st', '2nd', '3rd', '4th'];

/* The magic number method from objective 1.7, written out for this address. */
function steps(ip, prefix, s) {
  const [net, bc, first, last] = [s.network, s.broadcast, s.first, s.last].map(fmtIp);
  if (prefix === 32) return ['A /32 is a single host address (a host route). There is no network or broadcast address to find.'];
  if (prefix === 31) return [`A /31 is a point-to-point link (RFC 3021). Both addresses, ${first} and ${last}, are usable and there is no broadcast.`];
  const usable = `Usable hosts = 2<sup>${32 - prefix}</sup> − 2 = <strong>${s.usable.toLocaleString()}</strong>, from ${first} to ${last}.`;
  const i = Math.floor(prefix / 8), bits = prefix % 8;
  if (bits === 0) {
    return [
      `/${prefix} ends exactly at the end of the ${ORDINAL[i - 1]} octet, so the first ${i} octet${i > 1 ? 's are' : ' is'} network and the rest are host.`,
      `Network address: set every host octet to 0. <strong>${net}</strong>`,
      `Broadcast address: set every host octet to 255. <strong>${bc}</strong>`,
      usable,
    ];
  }
  const block = 2 ** (8 - bits), mask = 256 - block, v = octets(ip)[i];
  const start = Math.floor(v / block) * block;
  const starts = [0, block, block * 2, block * 3].filter(n => n < 256).join(', ');
  const after = i < 3 ? ', and every octet after it becomes' : '';
  return [
    `/${prefix} is ${bits} bit${bits > 1 ? 's' : ''} into the ${ORDINAL[i]} octet, so that is the octet where network meets host. Its mask value is ${[128, 64, 32, 16, 8, 4, 2, 1].slice(0, bits).join(' + ')} = <strong>${mask}</strong>.`,
    `Block size (the magic number) = 256 − ${mask} = <strong>${block}</strong>. Subnets in that octet start at ${starts}${block * 4 < 256 ? ', …' : ''}`,
    `The address has <strong>${v}</strong> in the ${ORDINAL[i]} octet. The last block start at or below ${v} is ${start}${after}${i < 3 ? ' 0' : ''}. Network address: <strong>${net}</strong>`,
    `The next block would start at ${start + block}, so this one ends at ${start + block - 1}${after}${i < 3 ? ' 255' : ''}. Broadcast address: <strong>${bc}</strong>`,
    usable,
  ];
}

/* One octet of the 1.7 anatomy bar. A split octet colours each bit and marks the boundary. */
function cell(value, netBits) {
  const part = netBits === 8 ? 'net' : netBits === 0 ? 'host' : 'split';
  const bits = value.toString(2).padStart(8, '0');
  const bin = part === 'split'
    ? [...bits].map((b, k) => `${k === netBits ? '<span class="ip-v2-cut">|</span>' : ''}<span data-part="${k < netBits ? 'net' : 'host'}">${b}</span>`).join('')
    : `${bits.slice(0, 4)} ${bits.slice(4)}`;
  return `<div class="ip-v2-cell ip-v2-cell-${part}"><div class="ip-v2-dec ip-v2-dec-${part}">${value}</div><div class="ip-v2-bin">${bin}</div></div>`;
}

function anatomy(ip, prefix, s) {
  const netBits = [0, 1, 2, 3].map(j => Math.max(0, Math.min(8, prefix - 8 * j)));
  const row = (label, n) => `<div class="ip-v2-row-label">${label}</div><div class="ip-v2-row">${octets(n).map((o, j) => cell(o, netBits[j])).join('')}</div>`;
  const role = b => (b === 8 ? ['net', 'Network'] : b === 0 ? ['host', 'Host'] : ['split', `${b} network + ${8 - b} host`]);
  return '<div class="ip-v2-container">'
    + `<div class="ip-v2-header-row">${ORDINAL.map(o => `<div class="ip-v2-header-cell">${o} octet</div>`).join('')}</div>`
    + row(`IP address — ${fmtIp(ip)} <code class="addr-sub">/${prefix}</code>`, ip)
    + row(`Subnet mask — ${fmtIp(s.mask)}`, s.mask)
    + row(`Network address (IP AND mask) — ${fmtIp(s.network)}`, s.network)
    + `<div class="ip-v2-footer">${netBits.map(b => { const [k, t] = role(b); return `<div class="ip-v2-footer-cell"><span class="ip-v2-footer-val" data-col="${k}">${t}</span></div>`; }).join('')}</div>`
    + '</div>'
    + `<div class="ip-v2-legend"><span><span class="ip-v2-legend-dot" data-color="net"></span>Network bits: ${prefix}</span><span><span class="ip-v2-legend-dot" data-color="host"></span>Host bits: ${32 - prefix}</span></div>`;
}

function initCalculator(root) {
  const ipIn = root.querySelector('.sc-ip');
  const prefixIn = root.querySelector('.sc-prefix');
  const out = root.querySelector('.sc-out');
  const err = root.querySelector('.sc-error');

  function paint() {
    const ip = parseIp(ipIn.value), prefix = parsePrefix(prefixIn.value);
    const bad = ip === null ? 'Enter an IPv4 address such as 192.168.10.77.'
      : prefix === null ? 'Enter a prefix (/26 or 26) or a mask (255.255.255.192).' : '';
    err.hidden = !bad;
    err.textContent = bad;
    out.hidden = !!bad;
    if (bad) return;
    const s = subnet(ip, prefix), c = classify(ip);
    const tile = (label, value) => `<div class="sc-tile"><div class="sc-tile-label">${label}</div><div class="sc-tile-val">${value}</div></div>`;
    out.innerHTML = '<div class="sc-tiles">'
      + tile('Network address', `${fmtIp(s.network)}/${prefix}`)
      + tile('First usable host', fmtIp(s.first))
      + tile('Last usable host', fmtIp(s.last))
      + tile('Broadcast address', prefix >= 31 ? 'None' : fmtIp(s.broadcast))
      + tile('Usable hosts', s.usable.toLocaleString())
      + tile('Subnet mask', fmtIp(s.mask))
      + '</div>'
      + `<p class="sc-meta">Wildcard mask <code>${fmtIp(s.wildcard)}</code> · Class ${c.cls} · ${c.scope}</p>`
      + '<h3 class="sc-h">How to work it out by hand</h3>'
      + `<ol class="sc-steps">${steps(ip, prefix, s).map(t => `<li>${t}</li>`).join('')}</ol>`
      + '<h3 class="sc-h">The same answer in binary</h3>'
      + anatomy(ip, prefix, s);
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
    row.innerHTML = `<input class="lab-input vlsm-name" aria-label="Group name" placeholder="Group name" value="${esc(name)}">`
      + `<input class="lab-input vlsm-hosts" aria-label="Hosts needed" inputmode="numeric" placeholder="Hosts" value="${esc(hosts)}">`
      + '<button type="button" class="vlsm-remove" aria-label="Remove group">✕</button>';
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
      const sizing = p === null ? '—' : `${seg.hosts} + 2 = ${seg.hosts + 2} → <strong>${size}</strong> (/${p})`;
      if (p === null || p < block.prefix || start + size - 1 > whole.broadcast) {
        return `<tr class="vlsm-nofit"><td>${esc(seg.name)}</td><td>${sizing}</td><td colspan="3">Does not fit in what is left of the block</td></tr>`;
      }
      cursor = start + size;
      const s = subnet(start, p);
      return `<tr><td>${esc(seg.name)}</td><td>${sizing}</td><td><code>${fmtIp(s.network)}/${p}</code></td>`
        + `<td><code>${fmtIp(s.first)} – ${fmtIp(s.last)}</code></td><td><code>${fmtIp(s.broadcast)}</code></td></tr>`;
    }).join('');
    const left = whole.broadcast + 1 - cursor;
    out.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Group</th><th>Hosts + 2, rounded up</th><th>Subnet</th><th>Usable range</th><th>Broadcast</th></tr></thead><tbody>${body}</tbody></table></div>`
      + `<p class="vlsm-left">${left.toLocaleString()} of ${whole.total.toLocaleString()} addresses are still free${left ? `, starting at <code>${fmtIp(cursor)}</code>` : ''}.</p>`;
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
