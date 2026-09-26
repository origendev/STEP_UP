/* =========================================================
   PROFILE MENU — the dropdown that opens when the avatar
   (top-right circle) is clicked. Shows name + reg no, then
   Profile / Settings / Log out.

   NOTE: this dropdown lives in the topbar, outside <main id="app">,
   so router.js's automatic [data-goto] binding (which only scans
   inside #app) doesn't reach it — this module calls navigate()
   directly instead.
========================================================= */
import { profileMeta } from '../data/profile.data.js';
import { navigate } from './router.js';

export const ProfileMenu = (() => {
  function fillHeader(){
    const initialEl = document.getElementById('menuAvatarInitial');
    const nameEl = document.getElementById('menuName');
    const regEl = document.getElementById('menuRegNo');
    if(initialEl) initialEl.textContent = profileMeta.initial;
    if(nameEl) nameEl.textContent = profileMeta.name;
    if(regEl) regEl.textContent = `Reg No: ${profileMeta.regNo}`;
  }

  function bind(){
    const avatarBtn = document.getElementById('avatarBtn');
    const menu = document.getElementById('profileMenu');
    if(!avatarBtn || !menu) return;

    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });

    menu.querySelectorAll('[data-goto]').forEach(item => {
      item.addEventListener('click', () => {
        menu.classList.remove('open');
        navigate(item.dataset.goto);
      });
    });

    document.addEventListener('click', (e) => {
      if(menu.classList.contains('open') && !menu.contains(e.target)){
        menu.classList.remove('open');
      }
    });

    document.getElementById('menuLogoutBtn')?.addEventListener('click', () => {
      menu.classList.remove('open');
      // TODO: replace with a real sign-out call once auth exists.
      alert('Logged out (demo only — no backend yet).');
    });
  }

  function init(){
    fillHeader();
    bind();
  }

  return { init };
})();