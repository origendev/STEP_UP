/* ============================================================
   theme.js — light / dark / follow-system toggle

   Cycles:  system → dark → light → system
   The choice is stored in localStorage so it survives a refresh.
============================================================ */

const KEY = 'stepup-theme';

function apply(mode){
  const root = document.documentElement;
  if(mode === 'dark' || mode === 'light'){
    root.setAttribute('data-theme', mode);
  }else{
    root.removeAttribute('data-theme');   // follow the OS
  }
}

function next(current){
  if(current === 'dark')  return 'light';
  if(current === 'light') return 'system';
  return 'dark';
}

function read(){
  try{ return localStorage.getItem(KEY) || 'system'; }
  catch{ return 'system'; }
}

function write(mode){
  try{ localStorage.setItem(KEY, mode); }
  catch{ /* private mode — not worth failing over */ }
}

/** Used by the Settings page. mode = 'system' | 'light' | 'dark' */
export function getMode(){ return read(); }
export function setMode(mode){ write(mode); apply(mode); }

export function init(){
  apply(read());

  const btn = document.getElementById('themeToggle');
  if(!btn) return;

  btn.addEventListener('click', () => {
    const mode = next(read());
    write(mode);
    apply(mode);
    btn.title = `Theme: ${mode}`;
  });
}
