/* ============================================================
   dom.js — tiny helpers so the page modules stay readable
============================================================ */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Unique values, preserving order. */
export const uniq = arr => [...new Set(arr)];

/** Escape text before dropping it into an innerHTML template. */
export function esc(str){
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/** Render an array into a container using a template function. */
export function renderList(container, items, template){
  if(!container) return;
  container.innerHTML = items.map(template).join('');
}
