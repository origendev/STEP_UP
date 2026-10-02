/* ============================================================
   app.js — entry point

   Registers every page with the router, wires the shell level
   controls (theme toggle, avatar shortcut) and starts routing.
   This is the only script index.html loads.
============================================================ */

import * as router from './core/router.js';
import * as theme  from './core/theme.js';

import { mount as mountHome } from './pages/home.js';
import { mount as mountProfile } from './pages/profile.js';
import { mount as mountJobs } from './pages/jobs.js';
import { mount as mountDemands } from './pages/demands.js';
import { mount as mountSkills } from './pages/skills.js';
import { mount as mountProgress } from './pages/progress.js';
import { mount as mountNewsDetail } from './pages/news-detail.js';
import { mount as mountRound1 } from './pages/round1.js';
import { mount as mountSettings } from './pages/settings.js';
import * as prefs from './core/prefs.js';

/* Route name -> pages/<name>.html + its mount function */
router.register('home',         mountHome);
router.register('jobs',         mountJobs);
router.register('demands',      mountDemands);
router.register('news-detail',  mountNewsDetail);
router.register('skills',       mountSkills);
router.register('progress',     mountProgress);
router.register('round1', mountRound1);
router.register('profile',      mountProfile);   // reached via the avatar, not the nav bar
router.register('settings',     mountSettings);  // reached via the avatar menu

/* Shell-level behaviour */
prefs.init();
theme.init();

/* Avatar menu: Profile / Settings */
const avatar = document.getElementById('avatarBtn');
const menu   = document.getElementById('userMenu');
avatar.addEventListener('click', e => { e.stopPropagation(); menu.hidden = !menu.hidden; });
menu.addEventListener('click', e => {
  const b = e.target.closest('[data-go], [data-act]');
  if(!b) return;
  menu.hidden = true;
  if(b.dataset.act === 'logout'){
    ['stepupStudentToken', 'stepupStudent'].forEach(k => localStorage.removeItem(k));
    location.href = 'student-login.html';
    return;
  }
  router.navigate(b.dataset.go);
});
document.addEventListener('click', () => { menu.hidden = true; });
document.addEventListener('keydown', e => { if(e.key === 'Escape') menu.hidden = true; });

/* Go */
router.start({ mountSelector:'#app', fallback:'home' });
