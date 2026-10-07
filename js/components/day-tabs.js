/* day-tabs.js — AZ-900 day tabs */

export function initDayTabs() {
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
