/* ============================================================
   settings.js — wires up pages/settings.html
   Preferences live in js/core/prefs.js; theme in js/core/theme.js.
============================================================ */
import * as prefs from '../core/prefs.js';
import * as theme from '../core/theme.js';
import { clearSession } from '../core/api.js';

const go = name => { location.hash = '#/' + name; };

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
  profile:  () => go('profile'),
  password: () => { location.href = 'student-change-password.html'; },
  logout:   () => {
    clearSession();
    location.href = 'student-login.html';
  },
  twofa:    () => toast('Two-factor authentication is coming soon.'),
  telegram: () => toast('Telegram alerts need a StepUp bot, which is not set up yet.'),
  update:   async () => { await clearCache(); location.reload(); },
  clear:    async () => { await clearCache(); toast('Cache cleared. Your settings and sign-in are kept.'); }
};

/* The page markup lives here (not in pages/settings.html) so a dev server can never cut it off half way. */
const TEMPLATE = `
  <h1 class="st-title">Settings</h1>
  <p class="st-sub">Make StepUp work the way you like. Changes save automatically on this device.</p>

  <!-- ========== Appearance ========== -->
  <section class="card st-card">
    <div class="card-head"><div class="card-title">Appearance</div>
      <span class="st-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></span></div>
    <div class="st-row">
      <div class="st-label"><b>Theme</b><small>Switch between light and dark mode</small></div>
      <div class="seg" data-pref="theme"><button data-v="system">System</button><button data-v="light">Light</button><button data-v="dark">Dark</button></div>
    </div>
    <div class="st-row">
      <div class="st-label"><b>Font family</b><small>Choose your preferred font</small></div>
      <select class="st-select" data-pref="font">
        <option value="default">StepUp (Sora + Inter)</option><option value="system">System fonts</option>
        <option value="serif">Serif</option><option value="mono">Monospace</option>
      </select>
    </div>
    <div class="st-row">
      <div class="st-label"><b>Navigation</b><small>Choose between top navigation and side navigation</small></div>
      <select class="st-select" data-pref="nav"><option value="top">Top nav</option><option value="side">Side nav</option></select>
    </div>
    <div class="st-row">
      <div class="st-label"><b>Zoom level</b><small>Show more content or increase size for readability</small></div>
      <select class="st-select" data-pref="zoom">
        <option value="90">90%</option><option value="100">Default (100%)</option>
        <option value="110">110%</option><option value="125">125%</option><option value="150">150%</option>
      </select>
    </div>
  </section>

  <!-- ========== Notifications ========== -->
  <section class="card st-card">
    <div class="card-head"><div class="card-title">Notifications</div>
      <span class="st-ic"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg></span></div>
    <div class="st-row">
      <div class="st-label"><b>All email notifications</b><small>Manage which emails you receive at <span id="stEmail">your email</span></small></div>
      <button class="sw" role="switch" data-sw="emailAll" aria-label="All email notifications"></button>
    </div>
    <div class="st-group">
      <div class="st-label"><b>Email categories</b><small>Turn off individual categories to stop those emails while staying subscribed to others.</small></div>
      <div class="st-row"><b>Job openings</b><button class="sw" role="switch" data-sw="cats.jobs" aria-label="Job openings"></button></div>
      <div class="st-row"><b>Application updates</b><button class="sw" role="switch" data-sw="cats.applications" aria-label="Application updates"></button></div>
      <div class="st-row"><b>Test &amp; interview reminders</b><button class="sw" role="switch" data-sw="cats.reminders" aria-label="Test and interview reminders"></button></div>
      <div class="st-row"><b>Demand news digest</b><button class="sw" role="switch" data-sw="cats.demands" aria-label="Demand news digest"></button></div>
      <div class="st-row"><b>General notices</b><button class="sw" role="switch" data-sw="cats.notices" aria-label="General notices"></button></div>
    </div>
    <button class="st-row st-link" data-act="telegram">
      <div class="st-label"><b>Link to Telegram</b><small>Get job alerts and placement updates on Telegram</small></div>
      <span class="st-ic"><svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg></span>
    </button>
  </section>

  <!-- ========== Account ========== -->
  <section class="card st-card">
    <div class="card-head"><div class="card-title">Account</div>
      <span class="st-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></span></div>
    <button class="st-row st-link" data-act="profile">
      <div class="st-label"><b>Profile information</b><small>Manage your profile details</small></div>
      <span class="st-ic"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></span>
    </button>
    <button class="st-row st-link" data-act="password">
      <div class="st-label"><b>Password</b><small>Change your account password</small></div>
      <span class="st-ic"><svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L21 2M16 7l3 3"/></svg></span>
    </button>
    <button class="st-row st-link" data-act="sessions">
      <div class="st-label"><b>Active sessions</b><small>View and manage your active login sessions</small></div>
      <span class="st-ic"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg></span>
    </button>
    <div class="st-panel" id="sessionsPanel" hidden></div>
    <button class="st-row st-link" data-act="logout">
      <div class="st-label"><b>Logout</b><small>Sign out from your account</small></div>
      <span class="st-ic"><svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg></span>
    </button>
  </section>

  <!-- ========== Privacy & Security ========== -->
  <section class="card st-card">
    <div class="card-head"><div class="card-title">Privacy &amp; Security</div>
      <span class="st-ic"><svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg></span></div>
    <button class="st-row st-link" data-act="twofa">
      <div class="st-label"><b>Two-factor authentication <span class="st-soon">Soon</span></b><small>Add an extra layer of security</small></div>
      <span class="st-ic"><svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg></span>
    </button>
    <button class="st-row st-link" data-act="privacy">
      <div class="st-label"><b>Data privacy</b><small>Manage your data privacy settings</small></div>
      <span class="st-ic"><svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>
    </button>
    <div class="st-panel" id="privacyPanel" hidden>
      <div class="st-row"><div class="st-label"><b>Show my profile to companies</b><small>Recruiters can find you in candidate searches</small></div><button class="sw" role="switch" data-sw="privacy.showProfile" aria-label="Show my profile to companies"></button></div>
      <div class="st-row"><div class="st-label"><b>Personalised recommendations</b><small>Use my activity to suggest jobs and skills</small></div><button class="sw" role="switch" data-sw="privacy.personalise" aria-label="Personalised recommendations"></button></div>
    </div>
  </section>

  <!-- ========== Data & Storage ========== -->
  <section class="card st-card">
    <div class="card-head"><div class="card-title">Data &amp; Storage</div>
      <span class="st-ic"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg></span></div>
    <div class="st-row">
      <div class="st-label"><b>Get latest update</b><small>Reload the app and fetch the newest version</small></div>
      <button class="btn-outline st-btn" data-act="update">Update now</button>
    </div>
    <div class="st-row">
      <div class="st-label"><b>Clear cache</b><small>Clear cached pages and temporary data. Your settings and sign-in stay.</small></div>
      <button class="st-ic st-btn-ic" data-act="clear" aria-label="Clear cache"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>
    </div>
  </section>
`;

export function mount(){
  const root = document.getElementById('view-settings');
  root.innerHTML = TEMPLATE;
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
