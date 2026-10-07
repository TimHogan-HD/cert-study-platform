/* accordions.js — accordions whose open state persists per page in sessionStorage */

export function initAccordions(path) {
  document.querySelectorAll('.accordion-header').forEach((header, idx) => {
    const storageKey = path ? `csp-accordion-${path}-${idx}` : null;

    /* Restore saved state */
    if (storageKey && sessionStorage.getItem(storageKey) === '1') {
      const body = header.nextElementSibling;
      if (body) body.classList.add('open');
      header.classList.add('open');
    }

    header.addEventListener('click', () => {
      const body = header.nextElementSibling;
      const isOpen = body && body.classList.contains('open');
      if (body) body.classList.toggle('open', !isOpen);
      header.classList.toggle('open', !isOpen);
      if (storageKey) sessionStorage.setItem(storageKey, isOpen ? '0' : '1');
    });
  });
}
