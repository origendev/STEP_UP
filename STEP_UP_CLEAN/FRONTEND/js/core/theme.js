/* STEP_UP is intentionally light-theme only. */
const KEY = 'stepup-theme';

function applyLight(){
  document.documentElement.setAttribute('data-theme', 'light');
  try { localStorage.setItem(KEY, 'light'); } catch { /* storage may be unavailable */ }
}

export function getMode(){ return 'light'; }
export function setMode(_mode){ applyLight(); }

export function init(){
  applyLight();
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.setAttribute('aria-hidden', 'true');
    btn.style.display = 'none';
  }
}
