/* nav.js — Hash router, sidebar nav, home screen, domain sub-nav, fragment init */
import { initFlashcards, initMatching } from './flashcards.js';
import { initSubnetting } from './subnetting.js';
import { initAIExplain } from './ai-explain.js';

const CONTENT_ROOT = './content';
const fragmentCache = new Map();

/* IntersectionObserver instance for scroll-spy — replaced each load */
let scrollSpyObserver = null;

/* ── Skeleton loading state ─────────────────────────────────── */
function showSkeleton() {
  document.getElementById('content-area').innerHTML =
    `<div class="skeleton-loading">
      <div class="skeleton-line lg skeleton-pulse"></div>
      <div class="skeleton-line skeleton-pulse"></div>
      <div class="skeleton-line sm skeleton-pulse"></div>
      <div class="skeleton-block skeleton-pulse"></div>
      <div class="skeleton-line skeleton-pulse"></div>
      <div class="skeleton-line sm skeleton-pulse"></div>
    </div>`;
}

/* ── Sidebar open/close with backdrop ───────────────────────── */
function openSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  sidebar?.classList.add('open');
  backdrop?.classList.add('visible');
}

function closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  sidebar?.classList.remove('open');
  backdrop?.classList.remove('visible');
}

async function loadFragment(path, anchor, { push = true } = {}) {
  /* Tear down scroll-spy from previous page */
  if (scrollSpyObserver) { scrollSpyObserver.disconnect(); scrollSpyObserver = null; }
  /* Remove domain sub-nav bar from previous page */
  document.getElementById('domain-subnav-bar')?.remove();

  const url = `${CONTENT_ROOT}/${path}.html`;
  try {
    let html;
    if (fragmentCache.has(path)) {
      html = fragmentCache.get(path);
    } else {
      showSkeleton();
      const res = await fetch(url);
      if (!res.ok) { showError(path); return; }
      html = await res.text();
      fragmentCache.set(path, html);
    }
    document.getElementById('content-area').innerHTML = html;
    const hashStr = anchor ? `#/${path}#${anchor}` : `#/${path}`;
    if (push) history.pushState({ path, anchor }, '', hashStr);
    if (anchor) {
      setTimeout(() => {
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } else {
      window.scrollTo(0, 0);
    }
    updateActiveNav(path, anchor);
    injectBreadcrumb(path);
    injectPrevNext(path);
    initFragmentComponents(path);
  } catch (e) {
    showError(path);
  }
}

function showError(path) {
  const area = document.getElementById('content-area');
  area.textContent = '';
  const callout = document.createElement('div');
  callout.className = 'callout callout-red';
  const title = document.createElement('div');
  title.className = 'callout-title';
  title.textContent = 'Error';
  const msg = document.createTextNode('Could not load content: ');
  const code = document.createElement('code');
  code.textContent = path;
  callout.appendChild(title);
  callout.appendChild(msg);
  callout.appendChild(code);
  area.appendChild(callout);
}

function updateActiveNav(path, anchor) {
  document.querySelectorAll('[data-path]').forEach(el => {
    const matchPath = el.dataset.path === path;
    const matchAnchor = !el.dataset.anchor || el.dataset.anchor === anchor;
    el.classList.toggle('active', matchPath && matchAnchor);
  });
  /* Auto-open the parent domain subnav for the newly active obj-link */
  const activeObj = document.querySelector('.obj-link.active');
  if (activeObj) {
    const subnav = activeObj.closest('.domain-subnav');
    if (subnav && !subnav.classList.contains('open')) {
      subnav.classList.add('open');
      const toggle = subnav.previousElementSibling;
      if (toggle && toggle.classList.contains('domain-toggle')) {
        toggle.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    }
  }
}

/* ── Breadcrumb ─────────────────────────────────────────────── */
function injectBreadcrumb(path) {
  if (!path || path === 'home') return;
  const certMap = { netplus: 'Net+ N10-009', secplus: 'Sec+ SY0-701', az104: 'AZ-104' };
  const parts = path.split('/');
  const certKey = parts[0];
  const crumbs = [];

  crumbs.push(certMap[certKey] || certKey);

  const navEl = document.querySelector(`[data-path="${path}"]`);
  if (navEl) {
    const subnav = navEl.closest('.domain-subnav');
    if (subnav) {
      const toggle = subnav.previousElementSibling;
      if (toggle && toggle.classList.contains('domain-toggle')) {
        const domainText = toggle.querySelector('span')?.textContent?.trim();
        if (domainText) crumbs.push(domainText);
      }
    }
    crumbs.push(navEl.textContent.trim());
  }

  /* Only show breadcrumb when there's meaningful depth */
  if (crumbs.length < 2) return;

  const bc = document.createElement('nav');
  bc.id = 'breadcrumb';
  bc.className = 'breadcrumb';
  bc.setAttribute('aria-label', 'Breadcrumb');
  crumbs.forEach((label, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-sep';
      sep.textContent = '›';
      bc.appendChild(sep);
    }
    const item = document.createElement('span');
    item.className = 'breadcrumb-item' + (i === crumbs.length - 1 ? ' breadcrumb-current' : '');
    item.textContent = label;
    bc.appendChild(item);
  });

  const contentArea = document.getElementById('content-area');
  contentArea.insertBefore(bc, contentArea.firstChild);
}

/* ── Prev / Next objective footer ──────────────────────────── */
function getNavOrder(path) {
  /* Derive sidebar root from the current path's cert prefix so this works
     for any cert, not just Net+. Falls back to netplus if unknown. */
  const certKey = path ? path.split('/')[0] : 'netplus';
  const sidebarId = `sidebar-${certKey}`;
  const sidebar = document.getElementById(sidebarId) || document.getElementById('sidebar-netplus');
  return Array.from(sidebar.querySelectorAll('[data-path]'))
    .map(el => el.dataset.path);
}

function injectPrevNext(path) {
  /* Remove any existing footer from a previous page */
  document.getElementById('obj-nav-footer')?.remove();

  const order = getNavOrder(path);
  const idx = order.indexOf(path);
  if (idx === -1) return;

  const prevPath = idx > 0 ? order[idx - 1] : null;
  const nextPath = idx < order.length - 1 ? order[idx + 1] : null;
  if (!prevPath && !nextPath) return;

  const footer = document.createElement('div');
  footer.id = 'obj-nav-footer';
  footer.className = 'obj-nav-footer';

  const makeBtn = (navPath, direction) => {
    const navEl = document.querySelector(`[data-path="${navPath}"]`);
    const label = navEl?.textContent?.trim() || navPath;
    const btn = document.createElement('button');
    btn.className = `obj-nav-btn obj-nav-${direction}`;

    const arrow = document.createElement('span');
    arrow.className = 'obj-nav-arrow';
    arrow.textContent = direction === 'prev' ? '←' : '→';

    const labelWrap = document.createElement('span');
    labelWrap.className = 'obj-nav-label';
    const dir = document.createElement('span');
    dir.className = 'obj-nav-dir';
    dir.textContent = direction === 'prev' ? 'Previous' : 'Next';
    const title = document.createElement('span');
    title.className = 'obj-nav-title';
    title.textContent = label;
    labelWrap.appendChild(dir);
    labelWrap.appendChild(title);

    btn.appendChild(arrow);
    btn.appendChild(labelWrap);

    btn.addEventListener('click', () => loadFragment(navPath));
    return btn;
  };

  if (prevPath) footer.appendChild(makeBtn(prevPath, 'prev'));
  if (nextPath) footer.appendChild(makeBtn(nextPath, 'next'));

  document.getElementById('content-area').appendChild(footer);
}

/* ── Domain sticky sub-nav bar + scroll-spy ─────────────────── */
function injectDomainSubNav(path) {
  /* Only show for domain objective pages, e.g. netplus/domain1/obj-1-1 */
  const parts = path ? path.split('/') : [];
  if (parts.length < 3 || !parts[1].startsWith('domain') || !parts[2].startsWith('obj-')) return;

  /* Collect sibling obj-links from the matching domain-subnav in the sidebar */
  const activeLink = document.querySelector(`.obj-link[data-path="${path}"]`);
  if (!activeLink) return;
  const domainSubnav = activeLink.closest('.domain-subnav');
  if (!domainSubnav) return;
  const siblings = Array.from(domainSubnav.querySelectorAll('.obj-link[data-path]'));
  if (siblings.length === 0) return;

  /* Build the bar */
  const bar = document.createElement('nav');
  bar.id = 'domain-subnav-bar';
  bar.setAttribute('aria-label', 'Domain objectives');

  const linkMap = new Map(); /* data-path → bar button element */

  siblings.forEach(sib => {
    const sibPath = sib.dataset.path;
    const btn = document.createElement('button');
    btn.className = 'domain-subnav-link';
    if (sibPath === path) btn.classList.add('active');
    btn.textContent = sib.textContent.trim();
    btn.addEventListener('click', () => loadFragment(sibPath));
    bar.appendChild(btn);
    linkMap.set(sibPath, btn);
  });

  /* Insert at the top of #content-area (before breadcrumb/content) */
  const contentArea = document.getElementById('content-area');
  contentArea.insertBefore(bar, contentArea.firstChild);

  /* Scroll-spy: observe all anchored sections in the loaded fragment */
  const sections = Array.from(contentArea.querySelectorAll('[id^="obj-"]'));
  if (sections.length === 0) return;

  /* Build a mapping from section id → obj path */
  const idToPath = new Map();
  siblings.forEach(sib => {
    /* The path's last segment (e.g. "obj-1-3") is the section id */
    const objId = sib.dataset.path.split('/').pop();
    idToPath.set(objId, sib.dataset.path);
  });

  scrollSpyObserver = new IntersectionObserver(entries => {
    /* Find the topmost entry that is intersecting */
    let topEntry = null;
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
          topEntry = entry;
        }
      }
    });
    if (!topEntry) return;
    const activeObjPath = idToPath.get(topEntry.target.id);
    if (!activeObjPath) return;
    linkMap.forEach((btn, p) => btn.classList.toggle('active', p === activeObjPath));
  }, { rootMargin: '-10% 0px -70% 0px', threshold: 0 });

  sections.forEach(el => scrollSpyObserver.observe(el));
}

/* ── Fragment component init ────────────────────────────────── */
function initFragmentComponents(path) {
  /* Accordions — with sessionStorage state persistence */
  document.querySelectorAll('.accordion-header').forEach((header, idx) => {
    const storageKey = path ? `csp-accordion-${path}-${idx}` : null;

    /* Restore saved state */
    if (storageKey && sessionStorage.getItem(storageKey) === '1') {
      const body = header.nextElementSibling;
      if (body) body.classList.add('open');
      header.classList.add('open');
    }

    header.removeEventListener('click', header._toggleFn);
    header._toggleFn = () => {
      const body = header.nextElementSibling;
      const isOpen = body && body.classList.contains('open');
      if (body) body.classList.toggle('open', !isOpen);
      header.classList.toggle('open', !isOpen);
      if (storageKey) sessionStorage.setItem(storageKey, isOpen ? '0' : '1');
    };
    header.addEventListener('click', header._toggleFn);
  });

  /* Inline nav links (inside content fragments, e.g. study plans, overview quicknav) */
  document.querySelectorAll('.inline-nav[data-path], .quicknav-card[data-path]').forEach(el => {
    el.removeEventListener('click', el._navFn);
    el._navFn = e => {
      e.preventDefault();
      loadFragment(el.dataset.path, el.dataset.anchor || null);
    };
    el.addEventListener('click', el._navFn);
  });

  /* Home screen cert cards */
  document.querySelectorAll('.cert-home-card[data-cert]').forEach(card => {
    if (card.classList.contains('disabled')) return;
    card.removeEventListener('click', card._certFn);
    card._certFn = () => switchCert(card.dataset.cert);
    card.addEventListener('click', card._certFn);
  });

  /* Toggle groups */
  document.querySelectorAll('.toggle-group').forEach(group => {
    group.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const container = btn.closest('.toggle-container') || btn.closest('section') || document;
        container.querySelectorAll('.toggle-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(target);
        if (panel) panel.classList.add('active');
      });
    });
  });

  initSubnetting();
  initFlashcards(path);
  initMatching();
  initAIExplain();
  initProtocolRefFlips();
  initDayTabs();
  initChecklist();
  initBinaryBits();
  initIDSIPSFlips();
  initGuidedSubnetting();
  injectDomainSubNav(path);
}

/* ── IDS/IPS flip cards ──────────────────────────────────────── */
function initIDSIPSFlips() {
  document.querySelectorAll('.ids-ips-flip-card').forEach(card => {
    if (card._idsIpsFlipFn) card.removeEventListener('click', card._idsIpsFlipFn);
    if (card._idsIpsKeyFn) card.removeEventListener('keydown', card._idsIpsKeyFn);

    const toggle = () => {
      const flipped = card.classList.toggle('is-flipped');
      card.setAttribute('aria-expanded', flipped ? 'true' : 'false');
      const hint = card.querySelector('.ids-ips-flip-hint');
      if (hint) hint.textContent = flipped ? 'click to flip back ↩' : 'click to flip ↩';
    };

    card._idsIpsFlipFn = () => toggle();
    card._idsIpsKeyFn = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    };

    card.addEventListener('click', card._idsIpsFlipFn);
    card.addEventListener('keydown', card._idsIpsKeyFn);
  });
}

/* ── Protocol/service reference flip rows ────────────────────── */
function initProtocolRefFlips() {
  document.querySelectorAll('.protocol-ref-row').forEach(row => {
    if (row._flipClickFn) row.removeEventListener('click', row._flipClickFn);
    if (row._flipKeyFn) row.removeEventListener('keydown', row._flipKeyFn);

    const toggleRow = () => {
      const isFlipped = row.classList.toggle('is-flipped');
      row.setAttribute('aria-expanded', isFlipped ? 'true' : 'false');
      row.querySelectorAll('.protocol-ref-front').forEach(front => {
        front.setAttribute('aria-hidden', isFlipped ? 'true' : 'false');
      });
      row.querySelectorAll('.protocol-ref-back').forEach(back => {
        back.setAttribute('aria-hidden', isFlipped ? 'false' : 'true');
      });
    };

    row._flipClickFn = () => toggleRow();
    row._flipKeyFn = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleRow();
      }
    };

    row.addEventListener('click', row._flipClickFn);
    row.addEventListener('keydown', row._flipKeyFn);
  });
}

/* ── AZ-900 day tabs ─────────────────────────────────────────── */
function initDayTabs() {
  document.querySelectorAll('.cram-day-tabs').forEach(tabBar => {
    tabBar.querySelectorAll('.cram-day-btn').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        tabBar.querySelectorAll('.cram-day-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const group = tabBar.closest('.cram-day-group');
        if (!group) return;
        group.querySelectorAll(':scope > .cram-day-panel').forEach(p => p.classList.remove('active'));
        const panels = group.querySelectorAll(':scope > .cram-day-panel');
        if (panels[i]) panels[i].classList.add('active');
      });
    });
  });
}

/* ── Binary bit toggle for C9 binary explainer ───────────────── */
function initBinaryBits() {
  const grid = document.getElementById('bit-grid');
  const totalDisplay = document.getElementById('bit-total');
  if (!grid || !totalDisplay) return;

  function updateTotal() {
    let total = 0;
    grid.querySelectorAll('.binary-bit-cell').forEach(cell => {
      if (cell.classList.contains('bit-on')) total += parseInt(cell.dataset.value, 10);
    });
    totalDisplay.textContent = total;
  }

  grid.querySelectorAll('.binary-bit-cell').forEach(cell => {
    if (cell._bitToggleFn) cell.removeEventListener('click', cell._bitToggleFn);
    cell._bitToggleFn = () => {
      const isOn = cell.classList.toggle('bit-on');
      cell.textContent = isOn ? '1' : '0';
      updateTotal();
    };
    cell.addEventListener('click', cell._bitToggleFn);
  });

  updateTotal();
}

/* ── Guided Subnetting Practice ──────────────────────────────────────────── */
function initGuidedSubnetting() {
  const guide = document.getElementById('subnet-guide');
  if (!guide || guide._sgInit) return;
  guide._sgInit = true;

  // helpers
  function sgMask(p) {
    const b = '1'.repeat(p) + '0'.repeat(32 - p);
    return [0, 8, 16, 24].map(i => parseInt(b.slice(i, i + 8), 2));
  }
  function sgNet(ip, p)   { const oc = ip.split('.').map(Number), m = sgMask(p); return oc.map((x,i) => x & m[i]); }
  function sgBcast(ip, p) { const oc = ip.split('.').map(Number), m = sgMask(p); return oc.map((x,i) => (x & m[i]) | (~m[i] & 0xff)); }
  function sgAdd1(oc) { const r=[...oc]; let c=1; for(let i=3;i>=0&&c;i--){const s=r[i]+c;r[i]=s&0xff;c=s>>8;} return r; }
  function sgSub1(oc) { const r=[...oc]; let b=1; for(let i=3;i>=0&&b;i--){const s=r[i]-b;r[i]=s<0?s+256:s;b=s<0?1:0;} return r; }
  function sgStr(oc) { return oc.join('.'); }
  function sgBin8(n) { return n.toString(2).padStart(8, '0'); }
  function sgEsc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  const POOLS = {
    magic: [
      {ip:'192.168.1.100',prefix:26},{ip:'10.0.0.200',prefix:27},
      {ip:'172.16.5.150',prefix:28},{ip:'192.168.50.75',prefix:25},
      {ip:'10.10.10.130',prefix:29},{ip:'172.31.100.200',prefix:30},
      {ip:'192.168.10.50',prefix:26},{ip:'10.1.2.85',prefix:27},
    ],
    powers: [
      {prefix:25},{prefix:26},{prefix:27},{prefix:28},
      {prefix:29},{prefix:30},{prefix:20},{prefix:22},
    ],
    and: [
      {ip:'10.0.5.200',prefix:27},{ip:'192.168.1.175',prefix:26},
      {ip:'172.16.20.100',prefix:28},{ip:'10.100.50.220',prefix:29},
      {ip:'192.168.200.50',prefix:25},{ip:'10.10.10.250',prefix:30},
      {ip:'172.20.35.66',prefix:27},{ip:'192.168.99.130',prefix:26},
    ],
  };

  function buildMagicSteps(p) {
    const {ip,prefix}=p, mask=sgMask(prefix), maskStr=sgStr(mask);
    const magic=256-mask[3], net=sgNet(ip,prefix), bcast=sgBcast(ip,prefix);
    const first=sgAdd1(net), last=sgSub1(bcast), ipOc=ip.split('.').map(Number);
    const bitsInLast=prefix-24;
    const bitVals=[128,64,32,16,8,4,2,1].slice(0,bitsInLast).join(' + ');
    return [
      {instruction:`What is the subnet mask for /${prefix}?`,
       hint:`The first three octets are always 255. For the 4th octet: /${prefix} goes ${bitsInLast} bit(s) past /24, so add ${bitsInLast} value(s) from the left of the bit chart — ${bitVals}.`,
       placeholder:'255.255.255.___',answer:maskStr,type:'ip'},
      {instruction:`Your mask is ${maskStr}. Subtract the last active octet from 256. What is the magic number (block size)?`,
       hint:`256 − ${mask[3]} = ? This number is how far apart each subnet boundary is.`,
       placeholder:'Magic number',answer:String(magic),type:'number'},
      {instruction:`Block size is ${magic}, so subnets start at 0, ${magic}, ${magic*2}, ${magic*3}… The host's last octet is ${ipOc[3]}. Which block start is it in?`,
       hint:`Find the largest multiple of ${magic} that is ≤ ${ipOc[3]}.`,
       placeholder:'Last octet of network address',answer:String(net[3]),type:'number'},
      {instruction:`The block starting at ${net[3]} ends just before the next one. What is the last octet of the broadcast address?`,
       hint:`Next block starts at ${net[3] + magic}. Broadcast is one before that: ${net[3] + magic} − 1.`,
       placeholder:'Last octet of broadcast',answer:String(bcast[3]),type:'number'},
      {instruction:'Write the full network address:',
       hint:`The first three octets are the same as the host IP: ${ipOc[0]}.${ipOc[1]}.${ipOc[2]}.___`,
       placeholder:'x.x.x.x',answer:sgStr(net),type:'ip'},
      {instruction:'Write the full broadcast address:',
       hint:`Same first three octets: ${ipOc[0]}.${ipOc[1]}.${ipOc[2]}.___`,
       placeholder:'x.x.x.x',answer:sgStr(bcast),type:'ip'},
      {instruction:'What is the first usable host address?',
       hint:'First usable = network address + 1 (the network ID itself is not assignable)',
       placeholder:'x.x.x.x',answer:sgStr(first),type:'ip'},
      {instruction:'What is the last usable host address?',
       hint:'Last usable = broadcast address − 1 (the broadcast itself is not assignable)',
       placeholder:'x.x.x.x',answer:sgStr(last),type:'ip'},
    ];
  }

  function buildPowersSteps(p) {
    const {prefix}=p, hb=32-prefix, total=Math.pow(2,hb);
    const usable=prefix===31?2:prefix===32?1:total-2;
    const bitsInLast=prefix-24;
    const bitVals=[128,64,32,16,8,4,2,1].slice(0,bitsInLast).join(' + ');
    return [
      {instruction:`How many host bits are in a /${prefix} network?`,
       hint:`An IP address has 32 bits total. The prefix uses ${prefix} for the network — the rest are host bits.`,
       placeholder:'Host bits',answer:String(hb),type:'number'},
      {instruction:`How many total addresses does ${hb} host bit${hb===1?'':'s'} give you? (2^${hb})`,
       hint:`2^1=2, 2^2=4, 2^3=8, 2^4=16, 2^5=32, 2^6=64, 2^7=128, 2^8=256`,
       placeholder:`2^${hb} = ?`,answer:String(total),type:'number'},
      {instruction:'How many addresses are usable by hosts? (total minus the two reserved addresses)',
       hint:`One address is the network ID (all host bits 0), one is the broadcast (all host bits 1). Both are reserved. Exception: /31 = 2 usable, /32 = 1.`,
       placeholder:'Usable hosts',answer:String(usable),type:'number'},
      {instruction:`What is the subnet mask for /${prefix}?`,
       hint:`The first three octets are always 255. For the 4th octet: /${prefix} goes ${bitsInLast} bit(s) past /24, so add ${bitsInLast} value(s) from the left of the bit chart — ${bitVals}.`,
       placeholder:'255.255.255.___',answer:sgStr(sgMask(prefix)),type:'ip'},
    ];
  }

  function buildAndSteps(p) {
    const {ip,prefix}=p, mask=sgMask(prefix), maskStr=sgStr(mask);
    const ipOc=ip.split('.').map(Number), net=sgNet(ip,prefix);
    const intOct=ipOc[3], maskOct=mask[3], netOct=net[3];
    const bitsInLast=prefix-24;
    const bitVals=[128,64,32,16,8,4,2,1].slice(0,bitsInLast).join(' + ');
    return [
      {instruction:`What is the subnet mask for /${prefix}?`,
       hint:`The first three octets are always 255. For the 4th octet: /${prefix} goes ${bitsInLast} bit(s) past /24, so add ${bitsInLast} value(s) from the left of the bit chart — ${bitVals}.`,
       placeholder:'255.255.255.___',answer:maskStr,type:'ip'},
      {instruction:`Convert the last octet of the IP address (${intOct}) to 8-bit binary:`,
       hint:'Bit values left to right: 128, 64, 32, 16, 8, 4, 2, 1. Write all 8 digits, including leading zeros.',
       placeholder:'e.g. 11001000',answer:sgBin8(intOct),type:'binary'},
      {instruction:`Convert the last octet of the subnet mask (${maskOct}) to 8-bit binary:`,
       hint:'Mask octets are always 1s on the left, 0s on the right — never mixed.',
       placeholder:'e.g. 11100000',answer:sgBin8(maskOct),type:'binary'},
      {instruction:'AND the two binary values column by column. Write the 8-bit result.',
       hint:`Rule: 1 AND 1 = 1. Anything else = 0.\nIP:   ${sgBin8(intOct)}\nMask: ${sgBin8(maskOct)}`,
       placeholder:'8-bit result',answer:sgBin8(netOct),type:'binary'},
      {instruction:'Convert your binary result to decimal, then write the full network address:',
       hint:`Your result (${sgBin8(netOct)}) = ${netOct}. The first three octets stay the same: ${ipOc[0]}.${ipOc[1]}.${ipOc[2]}.___`,
       placeholder:'x.x.x.x',answer:sgStr(net),type:'ip'},
    ];
  }

  let method=null, problem=null, steps=null;
  const idxMap={};
  const body=document.getElementById('sg-body');
  const probEl=document.getElementById('sg-problem-text');
  const list=document.getElementById('sg-steps-list');
  const sumEl=document.getElementById('sg-summary');

  function render() {
    probEl.textContent = method==='powers' ? `Given: /${problem.prefix} subnet` : `Given: ${problem.ip} /${problem.prefix}`;
    sumEl.hidden=true; sumEl.innerHTML='';
    list.innerHTML=steps.map((s,i)=>`
      <div class="sg-step" data-step="${i}">
        <div class="sg-step-num">${i+1}</div>
        <div class="sg-step-content">
          <div class="sg-step-instruction">${sgEsc(s.instruction)}</div>
          <div class="sg-step-hint">${sgEsc(s.hint)}</div>
          <input class="sg-step-input" type="text" placeholder="${sgEsc(s.placeholder)}" autocomplete="off" spellcheck="false"/>
          <div class="sg-step-msg" hidden></div>
        </div>
      </div>`).join('');
  }

  function selectMethod(m) {
    method=m;
    guide.querySelectorAll('.sg-method-btn').forEach(b=>b.classList.toggle('active',b.dataset.method===m));
    const pool=POOLS[m];
    if(idxMap[m]==null) idxMap[m]=Math.floor(Math.random()*pool.length);
    problem=pool[idxMap[m]];
    steps=m==='magic'?buildMagicSteps(problem):m==='powers'?buildPowersSteps(problem):buildAndSteps(problem);
    body.hidden=false;
    render();
  }

  function newProblem() {
    const pool=POOLS[method];
    idxMap[method]=(idxMap[method]+1)%pool.length;
    problem=pool[idxMap[method]];
    steps=method==='magic'?buildMagicSteps(problem):method==='powers'?buildPowersSteps(problem):buildAndSteps(problem);
    render();
  }

  function normalize(val,type) {
    return val.trim().replace(/\s+/g,'');
  }

  function checkAnswers() {
    let correct=0;
    list.querySelectorAll('.sg-step').forEach((el,i)=>{
      const s=steps[i];
      const inp=el.querySelector('.sg-step-input');
      const msg=el.querySelector('.sg-step-msg');
      const ok=normalize(inp.value,s.type)===normalize(s.answer,s.type);
      if(ok) correct++;
      inp.className='sg-step-input '+(ok?'sg-input-correct':'sg-input-incorrect');
      msg.hidden=false;
      msg.className='sg-step-msg '+(ok?'sg-correct':'sg-incorrect');
      msg.textContent=ok?'✓ Correct':`✗ Got "${inp.value||'(blank)'}"`;
    });
    sumEl.hidden=false;
    sumEl.className='sg-summary '+(correct===steps.length?'sg-summary-pass':'sg-summary-fail');
    sumEl.innerHTML=correct===steps.length
      ?`<strong>✓ All ${steps.length} correct!</strong> Hit "New ↻" to practice another problem.`
      :`<strong>${correct} / ${steps.length} correct.</strong> Fix the steps marked ✗ and check again — or hit Reveal to see all answers.`;
  }

  function revealAnswers() {
    steps.forEach((s,i)=>{
      const el=list.querySelector(`[data-step="${i}"]`);
      const inp=el.querySelector('.sg-step-input');
      const msg=el.querySelector('.sg-step-msg');
      inp.value=s.answer;
      inp.className='sg-step-input sg-input-revealed';
      msg.hidden=false;
      msg.className='sg-step-msg sg-revealed';
      msg.textContent='↑ Revealed';
    });
    sumEl.hidden=false;
    sumEl.className='sg-summary sg-summary-reveal';
    sumEl.innerHTML='Answers revealed. Try a <strong>New Problem ↻</strong> to practice on your own.';
  }

  guide.querySelectorAll('.sg-method-btn').forEach(btn=>{
    if(btn._sgM) btn.removeEventListener('click',btn._sgM);
    btn._sgM=()=>selectMethod(btn.dataset.method);
    btn.addEventListener('click',btn._sgM);
  });
  const checkBtn=document.getElementById('sg-check-btn');
  const revealBtn=document.getElementById('sg-reveal-btn');
  const newBtn=document.getElementById('sg-new-btn');
  if(checkBtn){if(checkBtn._sgC)checkBtn.removeEventListener('click',checkBtn._sgC);checkBtn._sgC=checkAnswers;checkBtn.addEventListener('click',checkBtn._sgC);}
  if(revealBtn){if(revealBtn._sgR)revealBtn.removeEventListener('click',revealBtn._sgR);revealBtn._sgR=revealAnswers;revealBtn.addEventListener('click',revealBtn._sgR);}
  if(newBtn){if(newBtn._sgN)newBtn.removeEventListener('click',newBtn._sgN);newBtn._sgN=newProblem;newBtn.addEventListener('click',newBtn._sgN);}
}

/* ── Pre-exam checklist with localStorage persistence ────────── */
function initChecklist() {
  document.querySelectorAll('.checklist[data-store]').forEach(list => {
    const key = list.dataset.store;
    let state = {};
    try { state = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    list.querySelectorAll('.check-item').forEach((item, i) => {
      if (state['c' + i]) item.classList.add('checked');
      item.addEventListener('click', () => {
        item.classList.toggle('checked');
        state['c' + i] = item.classList.contains('checked');
        try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
      });
    });
  });
}

/* ── Cert switching (called from home screen cards) ─────────── */
function switchCert(cert) {
  const sidebars = {
    netplus: document.getElementById('sidebar-netplus'),
    secplus: document.getElementById('sidebar-secplus'),
    az104: document.getElementById('sidebar-az104'),
  };
  Object.keys(sidebars).forEach(k => {
    if (sidebars[k]) sidebars[k].style.display = k === cert ? 'block' : 'none';
  });
  if (cert === 'netplus') loadFragment('netplus/overview');
  else if (cert === 'secplus') loadFragment('secplus/stub');
  else if (cert === 'az104') loadFragment('az104/stub');
}

document.addEventListener('DOMContentLoaded', () => {
  /* Nav links */
  document.querySelectorAll('[data-path]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      loadFragment(el.dataset.path, el.dataset.anchor || null);
      closeSidebar();
    });
  });

  /* Domain collapsible toggles */
  document.querySelectorAll('.domain-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const sub = toggle.nextElementSibling;
      if (sub && sub.classList.contains('domain-subnav')) {
        sub.classList.toggle('open');
        toggle.classList.toggle('open');
        toggle.setAttribute('aria-expanded', toggle.classList.contains('open') ? 'true' : 'false');
      }
    });
  });

  /* Collapse/expand all sidebar button */
  const collapseAll = document.getElementById('sidebar-collapse-all');
  if (collapseAll) {
    collapseAll.addEventListener('click', () => {
      const anyOpen = document.querySelectorAll('.domain-subnav.open').length > 0;
      document.querySelectorAll('.domain-subnav').forEach(s =>
        s.classList.toggle('open', !anyOpen)
      );
      document.querySelectorAll('.domain-toggle').forEach(t => {
        t.classList.toggle('open', !anyOpen);
        t.setAttribute('aria-expanded', String(!anyOpen));
      });
      collapseAll.textContent = anyOpen ? 'Expand all' : 'Collapse all';
    });
  }

  /* Hamburger + sidebar backdrop */
  const hamburger = document.getElementById('hamburger');
  const backdrop = document.getElementById('sidebar-backdrop');
  const sidebar = document.querySelector('.sidebar');
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', e => {
      e.stopPropagation();
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });
    backdrop?.addEventListener('click', closeSidebar);

    /* Mobile: swipe-left to close sidebar */
    let touchStartX = 0;
    document.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    document.addEventListener('touchend', e => {
      const delta = touchStartX - e.changedTouches[0].clientX;
      if (delta > 50 && sidebar.classList.contains('open')) {
        closeSidebar();
      }
    }, { passive: true });
  }

  /* Logo → home */
  document.getElementById('home-logo')?.addEventListener('click', () => {
    loadFragment('home');
  });

  /* Sidebar collapse toggle (desktop) */
  const sidebarDesktopToggle = document.getElementById('sidebar-desktop-toggle');
  const SIDEBAR_COLLAPSED_KEY = 'csp-sidebar-collapsed';
  const desktopMQ = window.matchMedia('(min-width: 769px)');

  function applySidebarCollapsed(collapsed) {
    sidebar?.classList.toggle('sidebar-collapsed', collapsed);
    if (sidebar) {
      if (collapsed) {
        sidebar.setAttribute('aria-hidden', 'true');
        sidebar.inert = true;
      } else {
        sidebar.removeAttribute('aria-hidden');
        sidebar.inert = false;
      }
    }
    if (sidebarDesktopToggle) {
      sidebarDesktopToggle.textContent = collapsed ? '›' : '‹';
      sidebarDesktopToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
      sidebarDesktopToggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    }
  }

  /* Restore collapsed state on desktop; ensure clean state on mobile */
  if (desktopMQ.matches) {
    applySidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
  } else {
    applySidebarCollapsed(false);
  }

  /* When the viewport shrinks to mobile, clear any desktop-collapsed state */
  desktopMQ.addEventListener('change', (e) => {
    if (!e.matches) {
      applySidebarCollapsed(false);
    }
  });

  sidebarDesktopToggle?.addEventListener('click', () => {
    const collapsed = !sidebar?.classList.contains('sidebar-collapsed');
    applySidebarCollapsed(collapsed);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  });

  /* Reading-progress bar + back-to-top visibility */
  const progressBar = document.getElementById('reading-progress');
  const backToTop = document.getElementById('back-to-top');
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar) {
      progressBar.style.width = docHeight > 0 ? `${(scrollTop / docHeight) * 100}%` : '0%';
    }
    if (backToTop) {
      backToTop.classList.toggle('visible', scrollTop > 400);
    }
  }, { passive: true });

  /* Back-to-top click */
  backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* Initial load from hash */
  const hash = location.hash.replace('#/', '');
  if (hash) {
    const parts = hash.split('#');
    loadFragment(parts[0], parts[1] || null);
  } else {
    loadFragment('home');
  }

  /* Popstate for back/forward navigation */
  window.addEventListener('popstate', e => {
    if (e.state && e.state.path) {
      loadFragment(e.state.path, e.state.anchor || null, { push: false });
    } else {
      /* Fallback: derive path/anchor from location.hash */
      const hash = location.hash.replace('#/', '');
      if (hash) {
        const parts = hash.split('#');
        loadFragment(parts[0], parts[1] || null, { push: false });
      }
    }
  });
});
