/* user.js — one source of truth for the signed-in student's name.
   Profile edits are stored under 'stepupProfile:<regNo>'; login data under 'stepupStudent'.
   The newest profile edit wins, so Home / avatar / menu always match the Profile page. */
import { profileMeta } from '../data/profile.data.js';

export const USER_EVENT = 'stepup-user-updated';

function read(key){ try{ return JSON.parse(localStorage.getItem(key) || 'null'); }catch{ return null; } }

export function getUser(){
  const s = read('stepupStudent') || {};
  const reg = s.reg_no || profileMeta.regNo;
  const edited = (read('stepupProfile:' + reg) || {}).d || {};
  const name = (edited.name || s.name || profileMeta.name).trim();
  return { name, first: name.split(/\s+/)[0] || name, reg };
}

/** Call after the profile is saved so open views refresh. */
export function announceUser(){ window.dispatchEvent(new CustomEvent(USER_EVENT)); }

export function greeting(){
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
