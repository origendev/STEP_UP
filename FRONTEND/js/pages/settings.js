/* ============================================================
   settings.js — wires up pages/settings.html
   Preferences live in js/core/prefs.js; theme in js/core/theme.js.
============================================================ */
import * as prefs from '../core/prefs.js';
import * as theme from '../core/theme.js';
import { navigate } from '../core/router.js';

/* Captured at startup (app.js imports this file) so "Install app" can use it later */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

function toast(msg){
  document.querySelector('.st-toast')?.remove();
  const t = Object.assign(document.createElement('div'), { className:'st-toast', textContent:msg });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function student(){
  try{ return JSON.parse(localStorage.getItem('stepupStudent') || '{}'); }catch{ return {}; }
}

function browserName(){
  const u = navigator.userAgent;
  return /Edg\//.test(u) ? 'Edge' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Browser';
}

async function clearCache(){
  try{ if('caches' in window) for(const k of await caches.keys()) await caches.delete(k); }catch{}
  try{ sessionStorage.clear(); }catch{}
}

const actions = {
  profile:  () => navigate('profile'),
  password: () => { location.href = 'student-change-password.html'; },
  logout:   () => {
    ['stepupStudentToken', 'stepupStudent'].forEach(k => localStorage.removeItem(k));
    location.href = 'student-login.html';
  },
  twofa:    () => toast('Two-factor authentication is coming soon.'),
  telegram: () => toast('Telegram alerts need a StepUp bot, which is not set up yet.'),
  install:  async () => {
    if(!installEvt) return toast('Use your browser menu, then "Install app" or "Add to Home screen".');
    installEvt.prompt(); await installEvt.userChoice; installEvt = null;
  },
  update:   async () => { await clearCache(); location.reload(); },
  clear:    async () => { await clearCache(); toast('Cache cleared. Your settings and sign-in are kept.'); }
};

export function mount(){
  const root = document.getElementById('view-settings');
  const toggle = id => { const el = root.querySelector('#' + id); el.hidden = !el.hidden; };

  /* Theme: System / Light / Dark */
  const seg = root.querySelector('[data-pref="theme"]');
  const paintSeg = () => seg.querySelectorAll('button')
    .forEach(b => b.classList.toggle('on', b.dataset.v === theme.getMode()));
  seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    theme.setMode(b.dataset.v); paintSeg();
  });
  paintSeg();

  /* Font, navigation, zoom */
  root.querySelectorAll('select[data-pref]').forEach(sel => {
    const key = sel.dataset.pref;
    sel.value = String(prefs.get()[key]);
    sel.addEventListener('change', () => prefs.update(d => { d[key] = key === 'zoom' ? Number(sel.value) : sel.value; }));
  });

  /* On/off switches (data-sw="emailAll" | "cats.jobs" | "privacy.showProfile") */
  const switches = root.querySelectorAll('.sw');
  const valueOf = path => path.split('.').reduce((o, k) => o[k], prefs.get());
  const paintSwitches = () => {
    switches.forEach(b => b.setAttribute('aria-checked', String(!!valueOf(b.dataset.sw))));
    root.querySelectorAll('[data-sw^="cats."]').forEach(b => { b.disabled = !prefs.get().emailAll; });
  };
  switches.forEach(b => b.addEventListener('click', () => {
    const path = b.dataset.sw.split('.'), last = path.pop();
    prefs.update(d => { const o = path.reduce((x, k) => x[k], d); o[last] = !o[last]; });
    paintSwitches();
  }));
  paintSwitches();

  /* Who is signed in (only available when the student login page was used) */
  const me = student();
  if(me.email) root.querySelector('#stEmail').textContent = me.email;
  root.querySelector('#sessionsPanel').innerHTML =
    `<b>This device</b><br>${browserName()} on ${navigator.platform || 'your device'}<br>` +
    `<span class="st-muted">${me.email ? 'Signed in as ' + me.email : 'Active now'}</span>`;

  /* Buttons */
  root.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if(!a) return;
    if(a.dataset.act === 'sessions') return toggle('sessionsPanel');
    if(a.dataset.act === 'privacy')  return toggle('privacyPanel');
    actions[a.dataset.act]?.();
  });
}
