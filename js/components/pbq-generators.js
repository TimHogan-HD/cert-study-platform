/* pbq-generators.js — "New scenario" for PBQs whose answers can be computed.
   A .pbq[data-generator] gets a New scenario button. Its generator rewrites only the elements
   marked data-gen inside that PBQ: the numbers in the brief, each field's data-answer, the chip
   labels, and the explanation. The hand-written markup is the first scenario. */
import { parseIp, fmtIp, subnet, maskOf } from '../ipv4.js';

const rand = n => Math.floor(Math.random() * n);
const pick = arr => arr[rand(arr.length)];
const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const ip = (...o) => o.join('.');
const LETTERS = 'ABCDEFGH';

function hooks(pbq) {
  const one = key => pbq.querySelector(`[data-gen="${key}"]`);
  const all = key => [...pbq.querySelectorAll(`[data-gen="${key}"]`)];
  return { one, all };
}

/* A random private /24 to carve up. */
function randomBlock() {
  return pick([
    () => parseIp(ip(192, 168, 1 + rand(254), 0)),
    () => parseIp(ip(10, rand(256), rand(256), 0)),
    () => parseIp(ip(172, 16 + rand(16), rand(256), 0)),
  ])();
}

const GENERATORS = {
  /* Four segments with strictly shrinking subnets, allocated largest first from a /24. */
  vlsm(pbq) {
    const { one, all } = hooks(pbq);
    const p1 = pick([25, 26]), p2 = p1 + 1 + rand(27 - p1), p3 = p2 + 1 + rand(29 - p2);
    const prefixes = [p1, p2, p3, 30];
    const hostsFor = p => (p === 30 ? 2 : 2 ** (31 - p) - 1 + rand(2 ** (31 - p)));
    const base = randomBlock();
    let offset = 0;
    const segs = ['sales', 'eng', 'mgmt', 'wan'].map((key, i) => {
      const p = prefixes[i];
      const seg = { key, p, offset, hosts: hostsFor(p), s: subnet(base + offset, p) };
      offset += 2 ** (32 - p);
      return seg;
    });
    const names = { sales: 'Sales', eng: 'Engineering', mgmt: 'Management', wan: 'WAN' };
    const cidr = seg => `${fmtIp(seg.s.network)}/${seg.p}`;

    one('block').textContent = `${fmtIp(base)}/24`;
    one('start').textContent = fmtIp(base);
    for (const seg of segs) {
      if (seg.key !== 'wan') one(`hosts-${seg.key}`).textContent = `${seg.hosts} hosts`;
      one(`slot-${seg.key}`).dataset.answer = `${seg.offset}-${seg.p}`;
      one(`gw-${seg.key}`).dataset.answer = fmtIp(seg.s.first);
    }
    /* Distractors: the right start with one size too small, and the WAN start as a /29. */
    const chips = shuffle([
      ...segs.map(seg => [`${seg.offset}-${seg.p}`, cidr(seg)]),
      ...segs.slice(0, 3).map(seg => [`${seg.offset}-${seg.p + 1}`, `${fmtIp(seg.s.network)}/${seg.p + 1}`]),
      [`${segs[3].offset}-29`, `${fmtIp(segs[3].s.network)}/29`],
    ]);
    all('chip').forEach((chip, i) => { [chip.dataset.value, chip.textContent] = chips[i]; });
    const eng = segs[1], mgmt = segs[2];
    Object.assign(one('pc-ip').dataset, { net: cidr(eng), not: fmtIp(eng.s.first), show: fmtIp(eng.s.first + 5) });
    one('pc-mask').dataset.answer = fmtIp(eng.s.mask);
    one('mgmt-bc').dataset.answer = fmtIp(mgmt.s.broadcast);
    one('mgmt-last').dataset.answer = fmtIp(mgmt.s.last);

    const rows = segs.map(seg => `<tr><td>${names[seg.key]}</td><td>${seg.hosts}</td><td>/${seg.p} (${seg.s.usable} usable)</td><td><code>${cidr(seg)}</code></td><td><code>${fmtIp(seg.s.first)} – ${fmtIp(seg.s.last)}</code></td><td><code>${fmtIp(seg.s.broadcast)}</code></td></tr>`).join('');
    one('explain').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Segment</th><th>Hosts</th><th>Smallest fit</th><th>Subnet</th><th>Usable range</th><th>Broadcast</th></tr></thead><tbody>${rows}</tbody></table></div>
      <ul>
        <li><strong>Smallest fit:</strong> add 2 to the hosts, then round up to a power of 2. ${segs.slice(0, 3).map(seg => `${names[seg.key]}: ${seg.hosts} + 2 = ${seg.hosts + 2} → ${2 ** (32 - seg.p)}, a /${seg.p}`).join('. ')}. The WAN link needs 2 + 2 = 4, a /30.</li>
        <li><strong>Largest first:</strong> each subnet starts where the previous one ended, so nothing overlaps.</li>
        <li><strong>The distractors</strong> are the right starting address with a subnet one size too small, plus the WAN start as a wasteful /29.</li>
        <li><strong>ENG-PC14</strong> can use any address from ${fmtIp(eng.s.first + 1)} to ${fmtIp(eng.s.last)}. ${fmtIp(eng.s.first)} is the gateway. The /${eng.p} mask is ${fmtIp(eng.s.mask)}.</li>
      </ul>`;
  },

  /* Six hosts on a /21–/23, each either correct or wrong in one setting. */
  misconfig(pbq) {
    const { one, all } = hooks(pbq);
    const prefix = pick([21, 22, 23]), b = 2 ** (24 - prefix);
    /* t leaves room for at least one more block above it, which the 'outside' host uses. */
    const s2 = 16 + rand(16), t = b * rand(256 / b - 1);
    const net = parseIp(ip(172, s2, t, 0)), sn = subnet(net, prefix);
    const mask = fmtIp(maskOf(prefix)), gw = fmtIp(sn.first);
    const inner = () => t + 1 + rand(b - 1);
    const KINDS = {
      ok: () => { const h = ip(172, s2, t + rand(b), 2 + rand(250)); return [h, mask, gw, 'None', `<strong>${h}</strong> is inside the range and everything else matches.`]; },
      trap: () => { const h = ip(172, s2, inner(), 0); return [h, mask, gw, 'None', `<strong>${h}</strong> ends in .0, but in a /${prefix} it is an ordinary host address. Only ${fmtIp(sn.network)} is the network address.`]; },
      broadcast: () => [fmtIp(sn.broadcast), mask, gw, 'IP address', `<strong>${fmtIp(sn.broadcast)}</strong> is the broadcast address of the subnet.`],
      mask: () => { const h = ip(172, s2, inner(), 2 + rand(250)); return [h, '255.255.255.0', gw, 'Subnet mask', `<strong>${h}</strong> has a /24 mask, so it thinks the gateway ${gw} is on another network.`]; },
      gateway: () => { const g = ip(172, s2, inner(), 1); return [ip(172, s2, t + rand(b), 2 + rand(250)), mask, g, 'Default gateway', `The gateway <strong>${g}</strong> is a valid host address, but not the router.`]; },
      outside: () => { const h = ip(172, s2, t + b + rand(b), 2 + rand(250)); return [h, mask, gw, 'IP address', `<strong>${h}</strong> is in the neighbouring /${prefix}, not this one.`]; },
    };
    const rows = shuffle(['ok', 'trap', 'broadcast', 'mask', 'gateway', 'outside']).map(k => KINDS[k]());
    all('net').forEach(el => { el.textContent = `${fmtIp(sn.network)}/${prefix}`; });
    one('gateway').textContent = gw;
    all('row').forEach((tr, i) => {
      const [h, m, g, answer] = rows[i];
      tr.querySelector('[data-gen="ip"]').textContent = h;
      tr.querySelector('[data-gen="mask"]').textContent = m;
      tr.querySelector('[data-gen="gw"]').textContent = g;
      tr.querySelector('.pbq-field').dataset.answer = answer;
    });
    one('explain').innerHTML = `<p>A /${prefix} has a block size of ${b} in the third octet, so ${fmtIp(sn.network)}/${prefix} runs from <code>${fmtIp(sn.network)}</code> (network) to <code>${fmtIp(sn.broadcast)}</code> (broadcast). Usable hosts are ${fmtIp(sn.first)} through ${fmtIp(sn.last)}.</p>
      <ul>${rows.map((r, i) => `<li><strong>FIN-0${i + 1}: ${r[3]}.</strong> ${r[4]}</li>`).join('')}</ul>`;
  },

  /* Six destinations against R1's fixed table: one per route, plus a boundary case. */
  lpm(pbq) {
    const { one, all } = hooks(pbq);
    const KINDS = {
      p25: () => [ip(10, 20, 30, 128 + rand(128)), 'Gi0/3', 'falls in 10.20.30.128/25 (.128 to .255), the longest match'],
      p24: () => [ip(10, 20, 30, rand(128)), 'Gi0/2', 'is in the lower half of 10.20.30.0/24, outside the /25, so the /24 is the longest match'],
      p16: () => [ip(10, 20, pick([...Array(256).keys()].filter(n => n !== 30)), rand(256)), 'Gi0/1', 'only matches 10.20.0.0/16'],
      near: () => [ip(10, pick([19, 21, 22, 120]), rand(256), 1 + rand(254)), 'Gi0/0', 'looks close but is not inside 10.20.0.0/16, so only the default route matches'],
      far: () => [ip(pick([8, 172, 203]), rand(256), rand(256), 1 + rand(254)), 'Gi0/0', 'matches nothing but the default route'],
      conn: () => [ip(192, 168, 1, 1 + rand(254)), 'Gi0/4', 'is on the directly connected 192.168.1.0/24'],
    };
    const rows = shuffle(Object.keys(KINDS)).map(k => KINDS[k]());
    all('row').forEach((tr, i) => {
      tr.querySelector('[data-gen="dst"]').textContent = rows[i][0];
      tr.querySelector('.pbq-field').dataset.answer = rows[i][1];
    });
    one('explain').innerHTML = `<ul>${rows.map(([d, out, why], i) => `<li><strong>${LETTERS[i]}, ${d}</strong> ${why}: <strong>${out}</strong>.</li>`).join('')}</ul>
      <p>Longest prefix decides first. Administrative distance only compares routes for the same prefix, so the EIGRP /25 beats the static /24 for addresses inside it.</p>`;
  },

  /* Six packets against the fixed DMZ policy, covering every rule. */
  acl(pbq) {
    const { one, all } = hooks(pbq);
    const lan = () => ip(10, 0, 1, pick([...Array(250).keys()].map(n => n + 2).filter(n => n !== 50)));
    const net = () => `${pick(['198.51.100', '203.0.113'])}.${1 + rand(254)}`;
    const dmz = () => pick(['10.0.5.10', '10.0.5.25', '10.0.5.53']);
    const KINDS = {
      r1: () => ['10.0.1.50', dmz(), 'TCP', '22', 1, 'the admin workstation matches rule 1 and is permitted before rule 2 can deny it'],
      r2: () => [lan(), dmz(), 'TCP', '22', 2, 'any other LAN host trying SSH skips rule 1 and is denied by rule 2'],
      r3: () => [pick([net(), lan()]), '10.0.5.10', 'TCP', '443', 3, "rule 3's source is Any, so any host reaches HTTPS on the web server"],
      r4: () => [lan(), '10.0.5.53', 'UDP', '53', 4, 'a LAN DNS lookup over UDP matches rule 4'],
      tcp53: () => [lan(), '10.0.5.53', 'TCP', '53', 5, 'rule 4 allows UDP only, so TCP 53 falls through to the deny'],
      http: () => [net(), '10.0.5.10', 'TCP', '80', 5, 'only 443 is open on the web server, so plain HTTP is denied'],
      netssh: () => [net(), dmz(), 'TCP', '22', 5, "SSH from the internet matches neither rule 1 nor rule 2, whose sources are on the LAN"],
      rdp: () => ['10.0.1.50', '10.0.5.10', 'TCP', '3389', 5, 'even the admin workstation only has SSH allowed, so RDP is denied'],
    };
    const keys = shuffle(['r1', 'r2', 'r3', 'r4', ...shuffle(['tcp53', 'http', 'netssh', 'rdp']).slice(0, 2)]);
    const rows = keys.map(k => KINDS[k]());
    all('row').forEach((tr, i) => {
      ['src', 'dst', 'proto', 'port'].forEach((c, j) => { tr.querySelector(`[data-gen="${c}"]`).textContent = rows[i][j]; });
      tr.querySelector('.pbq-field').dataset.answer = String(rows[i][4]);
    });
    one('explain').innerHTML = `<ul>${rows.map((r, i) => `<li><strong>${LETTERS[i]}, rule ${r[4]}:</strong> ${r[5]}.</li>`).join('')}</ul>`;
  },
};

export function initPbqGenerators() {
  document.querySelectorAll('.pbq[data-generator]').forEach(pbq => {
    const generate = GENERATORS[pbq.dataset.generator];
    const actions = pbq.querySelector('.pbq-actions');
    if (!generate || !actions) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pbq-new';
    btn.textContent = 'New scenario ↻';
    btn.addEventListener('click', () => {
      /* Reset first: it returns placed chips by their current values, which generate() changes. */
      pbq.querySelector('.pbq-reset')?.click();
      generate(pbq);
    });
    actions.append(btn);
  });
}

export { GENERATORS };
