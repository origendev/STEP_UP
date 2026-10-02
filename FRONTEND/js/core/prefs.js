/* ============================================================
   prefs.js — saved user preferences (font, nav layout, zoom,
   notification + privacy switches). Stored in localStorage and
   applied to <html> on every page load.
============================================================ */
const KEY = 'stepup-prefs';

const defaults = {
  font: 'default',          // default | system | serif | mono
  nav: 'top',               // top | side
  zoom: 100,                // 90 | 100 | 110 | 125 | 150
  emailAll: true,
  cats: { jobs:true, applications:true, reminders:true, demands:true, notices:true },
  privacy: { showProfile:true, personalise:true }
};

function load(){
  try{
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...defaults, ...saved,
      cats:    { ...defaults.cats,    ...(saved.cats    || {}) },
      privacy: { ...defaults.privacy, ...(saved.privacy || {}) } };
  }catch{ return structuredClone(defaults); }
}

let prefs = load();

export const get = () => prefs;

export function apply(){
  const root = document.documentElement;
  root.dataset.font = prefs.font;
  root.dataset.nav  = prefs.nav;
  root.style.zoom   = prefs.zoom === 100 ? '' : String(prefs.zoom / 100);
}

/** update(draft => { draft.zoom = 110; }) */
export function update(fn){
  const draft = structuredClone(prefs);
  fn(draft);
  prefs = draft;
  try{ localStorage.setItem(KEY, JSON.stringify(prefs)); }catch{}
  apply();
}

export function init(){ apply(); }
