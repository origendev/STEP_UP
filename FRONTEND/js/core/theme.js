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

function toggle(){
  const upcoming = next(read());
  apply(upcoming);
  write(upcoming);
}

export const ThemeModule = (() => {
  function init(){
    apply(read());
    document.getElementById('themeToggle')?.addEventListener('click', toggle);
  }
  function current(){
    return document.documentElement.getAttribute('data-theme') || 'system';
  }
  return { init, toggle, current };
})();