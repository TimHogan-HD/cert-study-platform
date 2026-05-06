/* nav.js — Hash router, sidebar nav, cert tab switching, fragment init */
import { initFlashcards, initMatching } from './flashcards.js';
import { initSubnetting } from './subnetting.js';
import { initAIExplain } from './ai-explain.js';

const CONTENT_ROOT = './content';
const fragmentCache = new Map();

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

async function loadFragment(path, anchor) {
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
    history.pushState({ path, anchor }, '', hashStr);
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
function getNavOrder() {
  /* Derive ordered path list from sidebar DOM so it's always in sync */
  return Array.from(document.querySelectorAll('#sidebar-netplus [data-path]'))
    .map(el => el.dataset.path);
}

function injectPrevNext(path) {
  /* Remove any existing footer from a previous page */
  document.getElementById('obj-nav-footer')?.remove();

  const order = getNavOrder();
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
    btn.innerHTML = direction === 'prev'
      ? `<span class="obj-nav-arrow">←</span>
         <span class="obj-nav-label">
           <span class="obj-nav-dir">Previous</span>
           <span class="obj-nav-title">${label}</span>
         </span>`
      : `<span class="obj-nav-label">
           <span class="obj-nav-dir">Next</span>
           <span class="obj-nav-title">${label}</span>
         </span>
         <span class="obj-nav-arrow">→</span>`;
    btn.addEventListener('click', () => loadFragment(navPath));
    return btn;
  };

  if (prevPath) footer.appendChild(makeBtn(prevPath, 'prev'));
  if (nextPath) footer.appendChild(makeBtn(nextPath, 'next'));

  document.getElementById('content-area').appendChild(footer);
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
}

/* ── Cert tab switching ─────────────────────────────────────── */
function switchCert(cert) {
  document.querySelectorAll('.cert-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.cert === cert)
  );
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
      /* Close mobile sidebar */
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.classList.remove('open');
    });
  });

  /* Cert tabs */
  document.querySelectorAll('.cert-tab').forEach(tab => {
    if (!tab.classList.contains('disabled')) {
      tab.addEventListener('click', () => switchCert(tab.dataset.cert));
    }
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

  /* Hamburger */
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.querySelector('.sidebar');
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', e => {
      e.stopPropagation();
      sidebar.classList.toggle('open');
    });
    document.addEventListener('click', e => {
      if (sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) && e.target !== hamburger) {
        sidebar.classList.remove('open');
      }
    });

    /* Mobile: swipe-left to close sidebar */
    let touchStartX = 0;
    document.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    document.addEventListener('touchend', e => {
      const delta = touchStartX - e.changedTouches[0].clientX;
      if (delta > 50 && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    }, { passive: true });
  }

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
    loadFragment('netplus/overview');
  }

  /* Popstate for back/forward navigation */
  window.addEventListener('popstate', e => {
    if (e.state && e.state.path) {
      loadFragment(e.state.path, e.state.anchor || null);
    }
  });
});

