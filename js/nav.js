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
  initAuthProtocolFlips();
  initDayTabs();
  initChecklist();
  injectDomainSubNav(path);
}

/* ── Directory Services protocol flip rows ───────────────────── */
function initAuthProtocolFlips() {
  document.querySelectorAll('.auth-protocol-row').forEach(row => {
    if (row._flipClickFn) row.removeEventListener('click', row._flipClickFn);
    if (row._flipKeyFn) row.removeEventListener('keydown', row._flipKeyFn);

    const toggleRow = () => {
      const isFlipped = row.classList.toggle('is-flipped');
      row.setAttribute('aria-pressed', isFlipped ? 'true' : 'false');
      row.querySelectorAll('.auth-protocol-front').forEach(front => {
        front.setAttribute('aria-hidden', isFlipped ? 'true' : 'false');
      });
      row.querySelectorAll('.auth-protocol-back').forEach(back => {
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
