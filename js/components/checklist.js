/* checklist.js — checklists whose tick state persists in localStorage under data-store */

export function initChecklist() {
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
