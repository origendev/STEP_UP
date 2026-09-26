/* =========================================================
   SETTINGS PAGE MODULE — appearance, notifications, account,
   privacy & security, data & storage.
========================================================= */
import { $, $$, renderList } from '../core/dom.js';
import { ThemeModule } from '../core/theme.js';
import { AppearanceModule } from '../core/appearance.js';
import { fontOptions, zoomOptions, notificationCategories, activeSessions } from '../data/settings.data.js';

const NOTIF_KEY = 'stepup-notif-categories';

export function mount(){
  renderThemeButton();
  renderFontSelect();
  renderZoomSelect();
  renderNotifications();
  renderSessions();
  bindMisc();
}

function renderThemeButton(){
  const btn = $('#themeSettingBtn');
  const label = () => {
    const t = ThemeModule.current();
    btn.textContent = t === 'dark' ? 'Dark Mode' : t === 'light' ? 'Light Mode' : 'System Default';
  };
  label();
  btn.addEventListener('click', () => { ThemeModule.toggle(); label(); });
}

function renderFontSelect(){
  const sel = $('#fontSelect');
  sel.innerHTML = fontOptions.map(f => `<option value="${f}">${f}</option>`).join('');
  sel.value = AppearanceModule.getFont();
  sel.addEventListener('change', () => AppearanceModule.setFont(sel.value));
}

function renderZoomSelect(){
  const sel = $('#zoomSelect');
  sel.innerHTML = zoomOptions.map(z => `<option value="${z}">${z}%</option>`).join('');
  sel.value = AppearanceModule.getZoom();
  sel.addEventListener('change', () => AppearanceModule.setZoom(Number(sel.value)));
}

function loadNotifState(){
  try {
    const saved = JSON.parse(localStorage.getItem(NOTIF_KEY));
    if(saved) return saved;
  } catch(err){ /* fall through to defaults */ }
  const state = {};
  notificationCategories.forEach(c => state[c.key] = c.on);
  return state;
}

function saveNotifState(state){
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(state)); } catch(err){ console.warn(err); }
}

function renderNotifications(){
  const state = loadNotifState();
  const master = $('#masterNotifToggle');
  master.classList.toggle('on', Object.values(state).every(Boolean));

  renderList($('#notifCategoryList'), notificationCategories, (cat) => `
    <div class="settings-row">
      <div class="settings-label">${cat.label}</div>
      <div class="switch ${state[cat.key] ? 'on' : ''}" data-notif-key="${cat.key}"></div>
    </div>
  `);

  $$('#notifCategoryList [data-notif-key]').forEach(sw => {
    sw.addEventListener('click', () => {
      const key = sw.dataset.notifKey;
      state[key] = !state[key];
      sw.classList.toggle('on', state[key]);
      master.classList.toggle('on', Object.values(state).every(Boolean));
      saveNotifState(state);
    });
  });

  master.addEventListener('click', () => {
    const turnOn = !master.classList.contains('on');
    notificationCategories.forEach(c => state[c.key] = turnOn);
    master.classList.toggle('on', turnOn);
    $$('#notifCategoryList [data-notif-key]').forEach(sw => sw.classList.toggle('on', turnOn));
    saveNotifState(state);
  });
}

function renderSessions(){
  renderList($('#sessionsList'), activeSessions, (s) => `
    <div class="session-row">
      <div class="session-ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
      <div style="flex:1;">${s.device}</div>
      <div class="session-meta">${s.meta}${s.current ? ' · this device' : ''}</div>
    </div>
  `);
}

function bindMisc(){
  $('#twoFactorToggle').addEventListener('click', (e) => e.currentTarget.classList.toggle('on'));

  // These need a real backend — wired as clear placeholders for now.
  $('#passwordBtn').addEventListener('click', () => alert('Password change form coming soon — no backend yet.'));
  $('#dataPrivacyBtn').addEventListener('click', () => alert('Data privacy settings coming soon.'));
  $('#settingsLogoutBtn').addEventListener('click', () => alert('Logged out (demo only — no backend yet).'));

  $('#installBtn').addEventListener('click', () => {
    if(window.deferredInstallPrompt){
      window.deferredInstallPrompt.prompt();
    } else {
      alert("Install isn't available yet — this needs a PWA manifest + service worker first.");
    }
  });

  $('#reloadBtn').addEventListener('click', () => location.reload());

  $('#clearCacheBtn').addEventListener('click', () => {
    ['stepup-theme', 'stepup-font', 'stepup-zoom', 'stepup-notif-categories'].forEach(k => {
      try { localStorage.removeItem(k); } catch(err){ console.warn(err); }
    });
    location.reload();
  });
}
