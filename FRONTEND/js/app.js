/* =========================================================
   APP ENTRY POINT — registers every page with the router,
   starts the theme module, then starts routing.
========================================================= */
import { ThemeModule } from './core/theme.js';
import { AppearanceModule } from './core/appearance.js';
import { ProfileMenu } from './core/profileMenu.js';
import { register, start } from './core/router.js';

import { mount as mountHome } from './pages/home.js';
import { mount as mountProfile } from './pages/profile.js';
import { mount as mountJobs } from './pages/jobs.js';
import { mount as mountDemands } from './pages/demands.js';
import { mount as mountSkills } from './pages/skills.js';
import { mount as mountProgress } from './pages/progress.js';
import { mount as mountSettings } from './pages/settings.js';

register('home', mountHome);
register('profile', mountProfile);
register('jobs', mountJobs);
register('demands', mountDemands);
register('skills', mountSkills);
register('progress', mountProgress);
register('settings', mountSettings);

ThemeModule.init();
AppearanceModule.init();
ProfileMenu.init();
start();