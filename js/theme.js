/* theme.js — Dark/light theme management with flash prevention */
const THEME_KEY = 'csp-theme';
const root = document.documentElement;

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = root.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

document.addEventListener('DOMContentLoaded', () => {
  const stored = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(stored);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.addEventListener('click', toggleTheme);
});
