/* ============================================================
   notifications.js — bell icon in the top bar.
   Click the bell to open the panel; opening it marks everything
   as seen (the red dot goes away). Seen/cleared state is kept in
   localStorage ('stepup-notif').
============================================================ */
import { esc } from './dom.js';
import { notifications } from '../data/notifications.data.js';

const KEY = 'stepup-notif';
const ICON = {
  job:      '<path d="M3 7h18v13H3z"/><path d="M9 7V4h6v3"/>',
  reminder: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  learning: '<path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
};

function load(){
  try{ const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return { seen: s.seen || [], cleared: s.cleared || [] }; }
  catch{ return { seen: [], cleared: [] }; }
}
function save(st){ try{ localStorage.setItem(KEY, JSON.stringify(st)); }catch{} }

export function init(){
  const btn = document.getElementById('notifBtn');
  if(!btn) return;
  const panel = document.createElement('div');
  panel.className = 'notif-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Notifications');
  btn.parentElement.appendChild(panel);

  let state = load(), fresh = new Set();
  const visible = () => notifications.filter(n => !state.cleared.includes(n.id));
  const unread  = () => visible().filter(n => !state.seen.includes(n.id));
  const paintDot = () => btn.classList.toggle('has-dot', unread().length > 0);

  function render(){
    const list = visible();
    panel.innerHTML = `
      <div class="np-head"><div><b>Notifications</b>${fresh.size ? `<small>${fresh.size} new</small>` : ''}</div>
        ${list.length ? '<button class="np-clear" data-np="clear">Clear all</button>' : ''}</div>
      <div class="np-list">${list.length ? list.map(n => `
        <button class="np-item ${fresh.has(n.id) ? 'new' : ''}" data-np-go="${esc(n.goto)}">
          <span class="np-ic"><svg viewBox="0 0 24 24">${ICON[n.type] || ICON.reminder}</svg></span>
          <span class="np-body"><b>${esc(n.title)}</b><span>${esc(n.text)}</span><small>${esc(n.time)}</small></span>
          ${fresh.has(n.id) ? '<i class="np-new" aria-hidden="true"></i>' : ''}
        </button>`).join('') : '<div class="np-empty">You are all caught up.</div>'}</div>`;
  }
  function open(){
    fresh = new Set(unread().map(n => n.id));      // highlight what was new when you opened it
    state.seen = [...new Set([...state.seen, ...visible().map(n => n.id)])]; save(state);
    render(); panel.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); paintDot();
  }
  function close(){ panel.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }

  btn.addEventListener('click', e => { e.stopPropagation(); panel.classList.contains('open') ? close() : open(); });
  panel.addEventListener('click', e => {
    e.stopPropagation();
    if(e.target.closest('[data-np="clear"]')){ state.cleared = notifications.map(n => n.id); save(state); fresh.clear(); render(); paintDot(); return; }
    const item = e.target.closest("[data-np-go]");
    if(item){ close(); location.hash = '#/' + item.dataset.npGo; }
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', e => { if(e.key === 'Escape') close(); });
  window.addEventListener('storage', () => { state = load(); paintDot(); });
  paintDot();
}
