/* Light theme only — dark mode disabled */

export function getMode() {
  return 'light';
}

export function setMode() {
  document.documentElement.setAttribute('data-theme', 'light');
}

export function init() {
  document.documentElement.setAttribute('data-theme', 'light');

  try {
    localStorage.setItem('stepup-theme', 'light');
  } catch {
    // Ignore storage errors
  }
}