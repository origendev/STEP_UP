/* =========================================================
   APPEARANCE — font family + zoom level, persisted to
   localStorage and restored on every app load (like theme.js).
========================================================= */
const FONT_KEY = 'stepup-font';
const ZOOM_KEY = 'stepup-zoom';

const FONT_STACKS = {
  'System Fonts': `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  'Inter': `'Inter', sans-serif`,
  'Sora': `'Sora', sans-serif`,
  'Serif': `Georgia, 'Times New Roman', serif`,
};

function applyFont(name){
  const stack = FONT_STACKS[name] || FONT_STACKS['System Fonts'];
  document.documentElement.style.setProperty('--app-font', stack);
}

function applyZoom(pct){
  document.documentElement.style.zoom = `${pct}%`;
}

function restore(){
  try {
    const font = localStorage.getItem(FONT_KEY);
    if(font) applyFont(font);
    const zoom = localStorage.getItem(ZOOM_KEY);
    if(zoom) applyZoom(zoom);
  } catch(err){
    console.warn('Appearance: could not restore preferences', err);
  }
}

function setFont(name){
  applyFont(name);
  try { localStorage.setItem(FONT_KEY, name); } catch(err){ console.warn(err); }
}

function setZoom(pct){
  applyZoom(pct);
  try { localStorage.setItem(ZOOM_KEY, pct); } catch(err){ console.warn(err); }
}

function getFont(){
  try { return localStorage.getItem(FONT_KEY) || 'System Fonts'; }
  catch(err){ return 'System Fonts'; }
}

function getZoom(){
  try { return Number(localStorage.getItem(ZOOM_KEY)) || 100; }
  catch(err){ return 100; }
}

export const AppearanceModule = (() => {
  function init(){ restore(); }
  return { init, setFont, setZoom, getFont, getZoom };
})();