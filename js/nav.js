/* nav.js — Hash router, sidebar nav, cert tab switching, fragment init */
const CONTENT_ROOT = './content';

async function loadFragment(path, anchor) {
  const url = `${CONTENT_ROOT}/${path}.html`;
  try {
    const res = await fetch(url);
    if (!res.ok) { showError(path); return; }
    const html = await res.text();
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
    initFragmentComponents();
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
}

function initFragmentComponents() {
  /* Accordions */
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.removeEventListener('click', header._toggleFn);
    header._toggleFn = () => {
      const body = header.nextElementSibling;
      const isOpen = body && body.classList.contains('open');
      if (body) body.classList.toggle('open', !isOpen);
      header.classList.toggle('open', !isOpen);
    };
    header.addEventListener('click', header._toggleFn);
  });

  /* Inline nav links (inside content fragments, e.g. study plans) */
  document.querySelectorAll('.inline-nav[data-path]').forEach(el => {
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

  if (typeof initSubnetting === 'function') initSubnetting();
  if (typeof initFlashcards === 'function') initFlashcards();
  if (typeof initMatching === 'function') initMatching();
  if (typeof initAIExplain === 'function') initAIExplain();
}

/* Cert tab switching */
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
  }

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
