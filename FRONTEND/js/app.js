/* ============================================================
   app.js — entry point

   Registers every page with the router, wires the shell level
   controls (theme toggle, avatar shortcut) and starts routing.
   This is the only script index.html loads.
============================================================ */

import * as router from './core/router.js';
import * as theme  from './core/theme.js';
import * as notifications from './core/notifications.js';

import { mount as mountHome } from './pages/home.js';
import { mount as mountProfile } from './pages/profile.js';
import { mount as mountJobs } from './pages/jobs.js';
import { mount as mountDemands } from './pages/demands.js';
import { mount as mountSkills } from './pages/skills.js';
import { mount as mountProgress } from './pages/progress.js';
import { mount as mountNewsDetail } from './pages/news-detail.js';
import { mount as mountRound1 } from './pages/round1.js';

/* Route name -> pages/<name>.html + its mount function */
router.register('home',         mountHome);
router.register('jobs',         mountJobs);
router.register('demands',      mountDemands);
router.register('news-detail',  mountNewsDetail);
router.register('skills',       mountSkills);
router.register('progress',     mountProgress);
router.register('round1', mountRound1);
router.register('profile',      mountProfile);   // reached via the avatar, not the nav bar

/* Shell-level behaviour */
theme.init();
notifications.init();

document.getElementById('avatarBtn')
  .addEventListener('click', () => router.navigate('profile'));

/* Go */
router.start({ mountSelector:'#app', fallback:'home' });
