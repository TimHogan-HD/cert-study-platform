/* flips.js — every click-to-reveal card and row: one behaviour, five variants */

/* Each variant: which elements, the class that marks the revealed state, the ARIA
   attribute that mirrors it, and anything else that changes with it. */
const VARIANTS = [
  {
    selector: '.osi-flip-card', state: 'is-open', aria: 'aria-expanded',
    sync: (el, on) => { const c = el.querySelector('.osi-card-chevron'); if (c) c.textContent = on ? '▴' : '▾'; },
  },
  { selector: '.arch-flip-card', state: 'is-flipped', aria: 'aria-pressed' },
  { selector: '.flip-card', state: 'is-flipped', aria: 'aria-expanded', sync: hint('.flip-hint') },
  { selector: '.ids-ips-flip-card', state: 'is-flipped', aria: 'aria-expanded', sync: hint('.ids-ips-flip-hint') },
  {
    selector: '.protocol-ref-row', state: 'is-flipped', aria: 'aria-expanded',
    sync: (el, on) => {
      el.querySelectorAll('.protocol-ref-front').forEach(f => f.setAttribute('aria-hidden', String(on)));
      el.querySelectorAll('.protocol-ref-back').forEach(b => b.setAttribute('aria-hidden', String(!on)));
    },
  },
];

function hint(selector) {
  return (el, on) => {
    const h = el.querySelector(selector);
    if (h) h.textContent = on ? 'click to flip back ↩' : 'click to flip ↩';
  };
}

export function initFlips() {
  for (const { selector, state, aria, sync } of VARIANTS) {
    document.querySelectorAll(selector).forEach(el => {
      const toggle = () => {
        const on = el.classList.toggle(state);
        el.setAttribute(aria, String(on));
        sync?.(el, on);
      };
      el.addEventListener('click', toggle);
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  }
}
