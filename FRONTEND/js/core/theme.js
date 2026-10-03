/* ============================================================
   theme.js — light / dark toggle (2 states only)

   First visit: follows the computer's theme.
   After that: the saved choice is used.
============================================================ */

const KEY = 'stepup-theme';

function systemMode(){
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function read(){
  try{
    const saved = localStorage.getItem(KEY);
    if(saved === 'dark' || saved === 'light') return saved;
  }catch{ /* private mode */ }
  return systemMode();
}

function write(mode){
  try{ localStorage.setItem(KEY, mode); }
  catch{ /* private mode — not worth failing over */ }
}

function apply(mode){
  document.documentElement.setAttribute('data-theme', mode);
}

export function init(){
  apply(read());

  const btn = document.getElementById('themeToggle');
  if(!btn) return;

  btn.title = `Theme: ${read()}`;

  btn.addEventListener('click', () => {
    const mode = read() === 'dark' ? 'light' : 'dark';
    write(mode);
    apply(mode);
    btn.title = `Theme: ${mode}`;
  });
}