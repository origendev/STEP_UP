/* ============================================================
   notifications.js — the dropdown panel that opens from the
   bell icon in the topbar. Lives in the shell (outside #app),
   same pattern as the avatar: toggle on click, close on
   outside click, render from a data file.
============================================================ */
import { notifications } from '../data/notifications.data.js';

function unreadCount(){
  return notifications.filter(n => n.unread).length;
}

function renderDot(){
  const dot = document.getElementById('notifDot');
  const count = unreadCount();
  if(!dot) return;
  dot.hidden = count === 0;
  dot.textContent = count > 9 ? '9+' : String(count || '');
}

function renderList(){
  const list = document.getElementById('notifList');
  if(!list) return;

  if(notifications.length === 0){
    list.innerHTML = `<div class="notif-empty">You're all caught up — no notifications yet.</div>`;
    return;
  }

  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.unread ? 'unread' : ''}" data-id="${n.id}">
      <div class="notif-ic">${n.icon}</div>
      <div class="notif-body">
        <div class="notif-title">${n.title}</div>
        <div class="notif-meta">${n.meta}</div>
        <div class="notif-time">${n.time}</div>
      </div>
      ${n.unread ? '<span class="notif-unread-dot"></span>' : ''}
    </div>
  `).join('');
}

function markAllRead(){
  notifications.forEach(n => n.unread = false);
  renderList();
  renderDot();
}

function markOneRead(id){
  const n = notifications.find(x => x.id === id);
  if(n && n.unread){
    n.unread = false;
    renderList();
    renderDot();
  }
}

export function init(){
  const btn = document.getElementById('notifBtn');
  const menu = document.getElementById('notifMenu');
  const panel = document.getElementById('notifPanel');
  if(!btn || !menu || !panel) return;

  renderList();
  renderDot();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
  });

  document.getElementById('notifMarkAllBtn')?.addEventListener('click', markAllRead);

  panel.addEventListener('click', (e) => {
    const item = e.target.closest('.notif-item');
    if(item) markOneRead(item.dataset.id);
  });

  document.addEventListener('click', (e) => {
    // composedPath (captured at dispatch time) is used instead of
    // menu.contains(e.target), because clicking a notification re-renders
    // the list — which would detach e.target from the document while this
    // same click is still bubbling, making menu.contains(e.target) wrongly
    // report "outside" and close the panel the instant you click an item.
    if(menu.classList.contains('open') && !e.composedPath().includes(menu)){
      menu.classList.remove('open');
    }
  });
}

