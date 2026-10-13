/* Student notification bell. Notifications are loaded from the authenticated API. */
import { esc } from './dom.js';
import { api } from './api.js';

const KEY = 'stepup-notif';
const ICON = {
  job: '<path d="M3 7h18v13H3z"/><path d="M9 7V4h6v3"/>',
  announcement: '<path d="m3 11 18-5v12L3 13z"/><path d="M7 14l2 6h4l-2-6"/>',
  reminder: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  learning: '<path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
};

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { seen: Array.isArray(s.seen) ? s.seen : [], cleared: Array.isArray(s.cleared) ? s.cleared : [] };
  } catch { return { seen: [], cleared: [] }; }
}
function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}
function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export function init() {
  const btn = document.getElementById('notifBtn');
  if (!btn || btn.dataset.notificationsReady === 'true') return;
  btn.dataset.notificationsReady = 'true';
  const panel = document.createElement('div');
  panel.className = 'notif-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Notifications');
  btn.parentElement.appendChild(panel);

  let state = loadState();
  let notifications = [];
  let fresh = new Set();
  let isOpen = false;

  const visible = () => notifications.filter(n => !state.cleared.includes(n.id));
  const unread = () => visible().filter(n => !state.seen.includes(n.id));
  const paintDot = () => btn.classList.toggle('has-dot', unread().length > 0);

  function render() {
    const list = visible();
    panel.innerHTML = `
      <div class="np-head"><div><b>Notifications</b>${unread().length ? `<small>${unread().length} unread</small>` : ''}</div>
        ${list.length ? '<button class="np-clear" data-np="clear">Clear all</button>' : ''}</div>
      <div class="np-list">${list.length ? list.map(n => `
        <button class="np-item ${fresh.has(n.id) ? 'new' : ''}" data-np-go="${esc(n.goto || 'home')}" data-np-id="${esc(n.id)}">
          <span class="np-ic"><svg viewBox="0 0 24 24">${ICON[n.type] || ICON.reminder}</svg></span>
          <span class="np-body"><b>${esc(n.title)}</b><span>${esc(n.text || '')}</span><small>${esc(formatTime(n.time))}</small></span>
          ${!state.seen.includes(n.id) ? '<i class="np-new" aria-label="Unread"></i>' : ''}
        </button>`).join('') : '<div class="np-empty">You are all caught up.</div>'}</div>`;
  }
  async function refresh() {
    try {
      const result = await api('/student/notifications');
      const incoming = Array.isArray(result.data) ? result.data : [];
      const oldIds = new Set(notifications.map(n => n.id));
      incoming.forEach(n => { if (!oldIds.has(n.id) && !state.seen.includes(n.id)) fresh.add(n.id); });
      notifications = incoming;
      // Forget dismissed IDs that no longer exist in the server feed.
      const known = new Set(notifications.map(n => n.id));
      state.cleared = state.cleared.filter(id => known.has(id));
      state.seen = state.seen.filter(id => known.has(id));
      saveState(state);
      if (isOpen) render();
      paintDot();
    } catch (error) {
      // Do not replace a working notification list with an error state during a temporary network issue.
      console.warn('Notification refresh failed:', error.message);
    }
  }
  function open() {
    isOpen = true;
    fresh = new Set(unread().map(n => n.id));
    state.seen = [...new Set([...state.seen, ...visible().map(n => n.id)])];
    saveState(state);
    render();
    panel.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    paintDot();
  }
  function close() {
    isOpen = false;
    panel.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    panel.classList.contains('open') ? close() : open();
  });
  panel.addEventListener('click', e => {
    e.stopPropagation();
    if (e.target.closest('[data-np="clear"]')) {
      state.cleared = [...new Set([...state.cleared, ...visible().map(n => n.id)])];
      saveState(state); fresh.clear(); render(); paintDot(); return;
    }
    const item = e.target.closest('[data-np-go]');
    if (item) {
      close();
      location.hash = '#/' + item.dataset.npGo;
    }
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  window.addEventListener('storage', () => { state = loadState(); paintDot(); if (isOpen) render(); });

  refresh();
  window.setInterval(refresh, 60000);
  paintDot();
}
