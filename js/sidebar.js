/* sidebar.js — renders the per-cert sidebars from catalog.js and switches between them */
import { CERTS } from './catalog.js';

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v);
  }
  el.append(...children);
  return el;
}

const link = ({ path, label, className }) => h('button', { className, 'data-path': path, text: label });

function renderCert(cert, visible) {
  const root = h('div', { id: `sidebar-${cert.key}` });
  if (!visible) root.style.display = 'none';
  root.append(h('div', { className: 'sidebar-cert-label', text: cert.label }));
  if (cert.domains) {
    root.append(h('div', { className: 'sidebar-controls' },
      h('button', { id: 'sidebar-collapse-all', className: 'sidebar-ctrl-btn', text: 'Collapse all' })));
  }
  if (cert.note) root.append(h('div', { className: 'sidebar-note', text: cert.note }));
  for (const l of cert.before || []) root.append(link(l));
  (cert.domains || []).forEach((d, i) => {
    const open = d.open ? ' open' : '';
    root.append(
      h('button', { className: `domain-toggle${open}`, 'aria-expanded': String(!!d.open) },
        h('span', { text: d.title }),
        ...(d.weight ? [h('span', { className: `domain-pct domain-pct-${i + 1}`, text: `${d.weight}%` })] : []),
        h('span', { className: 'toggle-arrow', text: '▶' })),
      h('div', { className: `domain-subnav${open}` },
        ...d.objectives.map(([path, label]) => link({ path, label, className: 'obj-link' }))),
    );
  });
  for (const l of cert.after || []) {
    if (l.divider) root.append(h('div', { className: 'sidebar-divider' }));
    root.append(link(l));
  }
  return root;
}

export function renderSidebar(container) {
  container.replaceChildren(...CERTS.map((c, i) => renderCert(c, i === 0)));
}

/* Show the sidebar for `key`; paths outside any cert (home) leave it as it is. */
export function showCert(key) {
  if (!CERTS.some(c => c.key === key)) return;
  for (const c of CERTS) {
    const el = document.getElementById(`sidebar-${c.key}`);
    if (el) el.style.display = c.key === key ? 'block' : 'none';
  }
}

export const certFor = key => CERTS.find(c => c.key === key);
