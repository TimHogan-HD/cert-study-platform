/* nav.js — Hash router, sidebar nav, home screen, domain sub-nav, fragment init */
import { initAccordions } from './components/accordions.js';
import { initToggleGroups } from './components/toggle-groups.js';
import { initFlashcards } from './components/flashcards.js';
import { initMatching } from './components/matching.js';
import { initAIExplain } from './components/ai-explain.js';
import { initFlips } from './components/flips.js';
import { initDayTabs } from './components/day-tabs.js';
import { initChecklist } from './components/checklist.js';
import { initBinaryBits } from './components/binary-bits.js';
import { initGuidedSubnetting } from './components/guided-subnetting.js';
import { initPbq, initPbqProgress } from './components/pbq.js';
import { initPbqTerminals } from './components/pbq-terminal.js';
import { initPbqGenerators } from './components/pbq-generators.js';
import { initPbqExam } from './components/pbq-exam.js';
import { initSubnetTools } from './components/subnet-calc.js';
import { ALIASES } from './catalog.js';
import { renderSidebar, showCert, certFor } from './sidebar.js';

/* Every interactive component, initialised after each fragment swap. Each init is a
   no-op when its markup is absent; the ones that persist per-page state take the path. */
const COMPONENTS = [
  initAccordions, initToggleGroups, initFlashcards, initMatching, initAIExplain, initFlips,
  initDayTabs, initChecklist, initBinaryBits, initGuidedSubnetting, initPbq, initPbqProgress, initPbqGenerators, initPbqTerminals, initSubnetTools, initPbqExam,
];

renderSidebar(document.querySelector('.sidebar'));

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
  path = ALIASES[path] || path;
  showCert(path.split('/')[0]);
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
  const parts = path.split('/');
  const certKey = parts[0];
  const crumbs = [];

  crumbs.push(certFor(certKey)?.crumb || certKey);

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
  /* Only for pages grouped under a sidebar section, e.g. netplus/domain1/obj-1-1 or netplus/pbq/wireless */
  const parts = path ? path.split('/') : [];
  if (parts.length < 3) return;

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
  /* Links inside fragments (study plans, overview quicknav) call the router, so they live here, not in components/. */
  document.querySelectorAll('.inline-nav[data-path], .quicknav-card[data-path]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      loadFragment(el.dataset.path, el.dataset.anchor || null);
    });
  });

  /* Home screen cert cards */
  document.querySelectorAll('.cert-home-card[data-cert]').forEach(card => {
    if (card.classList.contains('disabled')) return;
    card.addEventListener('click', () => switchCert(card.dataset.cert));
  });

  /* One broken component must not take the rest of the page down with it. */
  for (const init of COMPONENTS) {
    try { init(path); } catch (e) { console.error(`${init.name} failed:`, e); }
  }
  injectDomainSubNav(path);
}

/* ── Cert switching (called from home screen cards) ─────────── */
function switchCert(cert) {
  loadFragment(certFor(cert).home);
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
