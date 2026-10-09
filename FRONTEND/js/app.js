/* ============================================================
   app.js — entry point

   Registers every page with the router, wires the shell level
   controls (theme toggle, avatar shortcut) and starts routing.
   This is the only script index.html loads.
============================================================ */

import * as router from './core/router.js?v=20260930d';
import * as theme  from './core/theme.js';
import { clearSession } from './core/api.js';
import { esc } from './core/dom.js';
import { getUser, USER_EVENT } from './core/user.js';

import { mount as mountHome } from './pages/home.js?v=20261005b';
import { mount as mountProfile } from './pages/profile.js';
import { mount as mountJobs } from './pages/jobs.js';
import { mount as mountDemands } from './pages/demands-dashboard.js?v=20261008c';
import { mount as mountSkills } from './pages/skills.js?v=20261009c';
import { mount as mountProgress } from './pages/progress.js';
import { mount as mountNewsDetail } from './pages/news-detail.js';
import { mount as mountRound1 } from './pages/round1.js';
import { mount as mountRound2 } from './pages/round2.js';
import { mount as mountSettings } from './pages/settings.js?v=20261005e';
import * as prefs from './core/prefs.js';
import * as notifications from './core/notifications.js';

/* Route name -> pages/<name>.html + its mount function */
router.register('home',         mountHome);
router.register('jobs',         mountJobs);
router.register('jobs-locked',  null);
router.register('demands',      mountDemands);
router.register('news-detail',  mountNewsDetail);
router.register('skills',       mountSkills);
router.register('progress',     mountProgress);
router.register('round1', mountRound1);
router.register('round2', mountRound2);
router.register('profile',      mountProfile);   // reached via the avatar, not the nav bar
router.register('settings',     mountSettings);
function getStudentYear(){
  try{
    const u=JSON.parse(localStorage.getItem('stepupStudent')||'{}');
    return Number(u.study_year ?? u.studyYear ?? 0);
  }catch{return 0;}
}

function updateYearBasedNavigation(){
  const placementYear = getStudentYear() >= 3;
  document.querySelectorAll('[data-tab="progress"]').forEach(el=>{
    el.style.display = placementYear ? '' : 'none';
  });
}

/* Shell-level behaviour */
prefs.init();
theme.init();
notifications.init();   // bell icon: shows the notifications panel
updateYearBasedNavigation();
window.addEventListener(USER_EVENT, updateYearBasedNavigation);
window.addEventListener('storage', updateYearBasedNavigation);

/* Avatar dropdown: name + register number, Profile, Settings, Logout */
const avatar = document.getElementById('avatarBtn');
const menu = document.createElement('div');
menu.className = 'user-menu';
avatar.parentElement.appendChild(menu);

function who(){ const u = getUser(); return { name:u.name, reg:u.reg }; }
function openProfile(tab){
  if(tab) sessionStorage.setItem('pfTab', tab); else sessionStorage.removeItem('pfTab');
  menu.classList.remove('open');
  router.navigate('profile');
  window.dispatchEvent(new CustomEvent('pf-tab', { detail: tab || 'Details' }));
}
function fillAvatar(){ avatar.textContent = (who().name[0] || 'S').toUpperCase(); }
fillAvatar();

avatar.addEventListener('click', (e) => {
  e.stopPropagation();
  const u = who();
  menu.innerHTML = `
    <div class="um-id"><div class="um-name">${esc(u.name)}</div><div class="um-reg">Reg No: ${esc(u.reg)}</div></div>
    <button data-act="profile">Profile</button>
    <button data-act="settings">Settings</button>
    <button data-act="logout" class="danger">Logout</button>`;
  menu.classList.toggle('open');
});
menu.addEventListener('click', (e) => {
  const act = e.target.dataset.act;
  if(act === 'profile')  openProfile();
  if(act === 'settings'){ menu.classList.remove('open'); router.navigate('settings'); }
  if(act === 'logout'){ clearSession(); location.href = 'student-login.html'; }
});
document.addEventListener('click', () => menu.classList.remove('open'));
document.addEventListener('keydown', (e) => { if(e.key === 'Escape') menu.classList.remove('open'); });
window.addEventListener('storage', () => { fillAvatar(); });
window.addEventListener(USER_EVENT, () => { fillAvatar(); });

/* Go */
router.start({ mountSelector:'#app', fallback:'home' });
