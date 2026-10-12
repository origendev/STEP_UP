/* ============================================================
   skills.js — Skills page
   Renders free courses (js/data/skills.data.js) into pages/skills.html.

   Layout
     General courses     one row, scrolls sideways
     Department courses  two rows, scrolls sideways (tabs pick the department)

   A student whose study year is known only sees that year's courses.
   If the year is unknown, year chips let them pick one.
============================================================ */

import { $, $$, esc } from '../core/dom.js';
import { DEPARTMENTS, YEARS, GENERAL_GROUPS, DEPT_NOTES, COURSES, PROG_LANGS, PROG_COURSES } from '../data/skills.data.js?v=20261009h';

function read(key){ try{ return JSON.parse(localStorage.getItem(key) || 'null'); }catch{ return null; } }

/** Turn whatever the student typed ("Computer Science", "B.E. ECE"...) into one of our keys. */
function toDeptKey(text){
  const t = String(text || '').toLowerCase();
  if(!t) return null;
  if(/information\s*tech|\bit\b/.test(t)) return 'IT';
  if(/computer|\bcse\b|\bcs\b/.test(t)) return 'CSE';
  if(/electronics|communication|\bece\b/.test(t)) return 'ECE';
  if(/electrical|\beee\b/.test(t)) return 'EEE';
  if(/mech/.test(t)) return 'Mechanical';
  if(/civil/.test(t)) return 'Civil';
  return null;
}

function studentDept(){
  const s = read('stepupStudent') || {};
  const edited = (read('stepupProfile:' + s.reg_no) || {}).d || {};
  return toDeptKey(edited.branch) || toDeptKey(s.department) || toDeptKey(s.dept) || toDeptKey(s.branch);
}

/** 1-4 if the student's year is known, otherwise 0 (= show all years). */
function studentYear(){
  const s = read('stepupStudent') || {};
  const y = Number(s.study_year ?? s.studyYear ?? 0);
  return y >= 1 && y <= 4 ? y : 0;
}


/* ---------- Certificates: students attach proof of a finished course ----------
   Saved in this browser, per student (key stepupCerts:<reg_no>).
   Images are shrunk first; PDFs are kept as they are up to MAX_PDF bytes. */
const MAX_PDF = 1.5 * 1024 * 1024;
const certKey = () => 'stepupCerts:' + ((read('stepupStudent') || {}).reg_no || 'guest');
const courseId = c => (c.company + '|' + c.title).toLowerCase();
function loadCerts(){ return read(certKey()) || {}; }
function saveCerts(all){
  try{ localStorage.setItem(certKey(), JSON.stringify(all)); return true; }
  catch{ toast('Could not save — browser storage is full. Remove an old certificate and try again.'); return false; }
}
function toast(msg){
  let t = document.getElementById('skToast');
  if(!t){ t = document.createElement('div'); t.id = 'skToast'; t.className = 'sk-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200);
}
function shrink(file, max = 1400){
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const r = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', .8));
    };
    im.onerror = () => { URL.revokeObjectURL(url); no(new Error('bad image')); };
    im.src = url;
  });
}
function readAsDataURL(file){
  return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
}
function viewCert(rec){
  const wrap = document.createElement('div');
  wrap.className = 'sk-lb';
  const isPdf = rec.data.startsWith('data:application/pdf');
  wrap.innerHTML = `<div class="sk-lb-box" role="dialog" aria-label="Certificate">
      ${isPdf ? `<iframe src="${rec.data}" title="Certificate"></iframe>` : `<img src="${rec.data}" alt="Certificate">`}
      <button type="button" class="btn-solid" data-close>Close</button></div>`;
  wrap.addEventListener('click', e => { if(e.target === wrap || e.target.closest('[data-close]')) wrap.remove(); });
  document.body.appendChild(wrap);
}

/* Company -> website, used to fetch that company's own logo (favicon). If the logo cannot
   load (offline, blocked), the card falls back to a coloured badge with the company's initials.
   A company that is not listed here uses the host of the course link. */
const COMPANY_DOMAINS = {
  'Cisco':'cisco.com', 'Simplilearn':'simplilearn.com', 'Sololearn':'sololearn.com',
  'Scaler':'scaler.com', 'Great Learning':'mygreatlearning.com', 'Coddy Tech':'coddy.tech',
  'MathWorks':'mathworks.com', 'Infosys':'infosys.com', 'IBM':'ibm.com', 'DataCamp':'datacamp.com',
  'freeCodeCamp':'freecodecamp.org', 'Univ. of Helsinki':'helsinki.fi', 'Open University':'open.ac.uk',
  'Microsoft':'microsoft.com', 'Harvard':'harvard.edu', 'HackerRank':'hackerrank.com',
  'Google':'google.com', 'ELCAI':'kelcaigroup.com', 'DataFlair':'data-flair.training',
  'Coodeverse':'coodeverse.com', 'CodeChef':'codechef.com', 'C++ Institute':'cppinstitute.org',
};
function logoDomain(c){
  if(COMPANY_DOMAINS[c.company]) return COMPANY_DOMAINS[c.company];
  try{ return new URL(c.url).hostname.replace(/^www\./, ''); }catch{ return ''; }
}
function initials(name){
  const w = String(name).replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return (w[1] ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).toUpperCase();
}
function logo(c){
  const d = logoDomain(c);
  const fb = `<span class="sk-logo-fb">${esc(initials(c.company))}</span>`;
  return `<span class="sk-logo" aria-hidden="true">${fb}${d
    ? `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : ''}</span>`;
}

const ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';

const CHECK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>';
const CLIP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4L15 7"/></svg>';

const ALL_KEY = 'ALL';
const state = { dept: ALL_KEY, year: 0, lang: 'Python' };
const PROG_LEVELS = [{ key: 'Beginner' }, { key: 'Intermediate' }, { key: 'Advanced' }];
let locked = false;   // true when the student's year is known: they only see their own year

function ordinal(y){ return y + (y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'); }

function card(c){
  const levels = c.years.map(y => YEARS.find(v => v.key === y)?.level).filter(Boolean);
  const yearTag = c.years.length === YEARS.length ? 'All years' : c.years.map(ordinal).join(' · ') + ' year';
  const id = courseId(c);
  const rec = loadCerts()[id];
  const certRow = rec
    ? `<div class="sk-cert-row has">
         <span class="sk-cert-ok">${CHECK} Attached</span>
         <span class="sk-cert-actions">
           <button type="button" class="sk-link" data-cert-view="${esc(id)}">View</button>
           <button type="button" class="sk-link" data-cert-add="${esc(id)}">Replace</button>
           <button type="button" class="sk-link danger" data-cert-del="${esc(id)}">Remove</button>
         </span>
       </div>`
    : `<div class="sk-cert-row">
         <button type="button" class="sk-attach" data-cert-add="${esc(id)}">${CLIP} Attach certificate</button>
       </div>`;
  return `
    <article class="card sk-card">
      <div class="sk-top">
        ${logo(c)}<span class="sk-co">${esc(c.company)}</span>
      </div>
      <h4 class="sk-title">${esc(c.title)}</h4>
      <p class="sk-desc">${esc(c.desc)}</p>
      <div class="sk-bottom">
        <a class="btn-solid sk-go" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">
          Start course ${ARROW}
        </a>
        <span class="sk-yr" title="${esc(levels.join(' / '))}">${esc(yearTag)}</span>
      </div>
      ${certRow}
    </article>`;
}

const yearOk = c => state.year === 0 || c.years.includes(state.year);

/** Fill a scroller: cards, or one friendly message when there are none. */
function fill(el, list, emptyText){
  el.classList.toggle('is-empty', !list.length);
  el.scrollLeft = 0;
  el.innerHTML = list.length ? list.map(card).join('') : `<div class="card sk-empty">${esc(emptyText)}</div>`;
}

/** Build the Beginner / Intermediate / Advanced rows once, before they are filled. */
function ensureLevels(){
  const box = $('#skProgLevels');
  if(!box || box.children.length) return;
  box.innerHTML = PROG_LEVELS.map(lv => `
    <div class="sk-sub">
      <div class="sk-sub-head">
        <h4>${lv.key}</h4>
        <div class="sk-arrows">
          <button type="button" class="sk-arrow" data-scroll="skProgLevels${lv.key}" data-dir="-1" aria-label="Scroll ${lv.key} courses left">&#8249;</button>
          <button type="button" class="sk-arrow" data-scroll="skProgLevels${lv.key}" data-dir="1" aria-label="Scroll ${lv.key} courses right">&#8250;</button>
        </div>
      </div>
      <div class="sk-scroller sk-one-row" id="skProgLevels${lv.key}" tabindex="0" role="region" aria-label="${lv.key} courses"></div>
    </div>`).join('');
}

function render(){
  ensureLevels();
  const y = YEARS.find(v => v.key === state.year);
  const yearWords = y ? ` for ${y.label}` : '';

  $$('#skTabs .sk-tab').forEach(b => {
    const on = b.dataset.tab === state.dept;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  const blurb = $('#skBlurb');
  blurb.textContent = y ? `${y.label} · ${y.level} — ${y.blurb}` : '';
  blurb.hidden = !y;

  /* General: everything flagged `general`, grouped in a fixed order */
  const order = GENERAL_GROUPS.map(g => g.key);
  /* ALL tab: general courses first, then every department's courses, in one grid.
     A department tab: only that department's courses. */
  const isAll = state.dept === ALL_KEY;
  const dept = COURSES.filter(c => yearOk(c) && (isAll
    ? true
    : !c.general && (c.depts === 'ALL' || c.depts.includes(state.dept))));
  if(isAll) dept.sort((a, b) => (b.general ? 1 : 0) - (a.general ? 1 : 0) ||
    (a.general ? order.indexOf(a.group) - order.indexOf(b.group) : 0));

  fill($('#skDept'), dept, isAll
    ? `No courses added yet${yearWords}.`
    : `No ${state.dept}-specific free certificate courses added yet${yearWords}.`);

  const note = $('#skNote');
  note.hidden = !DEPT_NOTES[state.dept];
  note.textContent = DEPT_NOTES[state.dept] || '';

    /* Programming: the chosen language's courses */
  $$('#skProgTabs .sk-tab').forEach(b => {
    const on = b.dataset.tab === state.lang;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
    PROG_LEVELS.forEach(lv => {
    const list = PROG_COURSES.filter(c =>
      c.lang === state.lang &&
      (c.level || 'Beginner') === lv.key &&
      yearOk(c)
    );
    fill(
      $(`#skProgLevels${lv.key}`),
      list,
      `${lv.key} ${state.lang} courses coming soon.`
    );
  });
    PROG_LEVELS.forEach(lv => {
    const list = PROG_COURSES.filter(c =>
      c.lang === state.lang && (c.level || 'Beginner') === lv.key && yearOk(c));
    fill($('#skProgLevels' + lv.key), list, `${lv.key} ${state.lang} courses coming soon.`);
  });
}

export function mount(){
  /* error/load do not bubble, so listen in the capture phase */
  document.addEventListener('load', e => {
    const im = e.target;
    if(im.tagName === 'IMG' && im.closest('.sk-logo') && im.naturalWidth > 16) im.parentElement.classList.add('ok');
  }, true);
  document.addEventListener('error', e => {
    const im = e.target;
    if(im.tagName === 'IMG' && im.closest('.sk-logo')) im.remove();
  }, true);

  const tabs = $('#skTabs');
  const view = $('#view-skills');
  if(!tabs || !view) return;

  const mine = studentDept();
  const myYear = studentYear();
  locked = myYear !== 0;

  tabs.innerHTML = `<button class="sk-tab" role="tab" data-tab="${ALL_KEY}">ALL</button>` + DEPARTMENTS.map(d => {
    const tag = d.key === mine ? '<span class="sk-mine">Your department</span>' : '';
    return `<button class="sk-tab" role="tab" data-tab="${esc(d.key)}">${esc(d.label)}${tag}</button>`;
  }).join('');

    const progTabs = $('#skProgTabs');
  if(progTabs){
    progTabs.innerHTML = PROG_LANGS.map(l =>
      `<button class="sk-tab" role="tab" data-tab="${esc(l.key)}">${esc(l.label)}</button>`).join('');
    progTabs.addEventListener('click', e => {
      const b = e.target.closest('.sk-tab');
      if(b){ state.lang = b.dataset.tab; render(); }
    });
  }

    

  tabs.addEventListener('click', e => {
    const b = e.target.closest('.sk-tab');
    if(b){ state.dept = b.dataset.tab; render(); }
  });
  /* ‹ › buttons nudge a row sideways (handy with a mouse that has no sideways wheel) */
  view.addEventListener('click', e => {
    const b = e.target.closest('.sk-arrow');
    if(!b) return;
    const row = document.getElementById(b.dataset.scroll);
    if(row) row.scrollBy({ left: Number(b.dataset.dir) * Math.max(280, row.clientWidth * 0.8), behavior: 'smooth' });
  });

  /* Attach / view / replace / remove a certificate (one hidden file picker, shared by every card) */
  const picker = document.createElement('input');
  picker.type = 'file'; picker.accept = 'image/*,application/pdf'; picker.hidden = true;
  view.appendChild(picker);
  let pending = null;

  picker.addEventListener('change', async () => {
    const f = picker.files[0]; picker.value = '';
    if(!f || !pending) return;
    const id = pending; pending = null;
    try{
      let data;
      if(f.type === 'application/pdf'){
        if(f.size > MAX_PDF) return toast('That PDF is too large (max 1.5 MB). Attach a photo or screenshot instead.');
        data = await readAsDataURL(f);
      }else if(f.type.startsWith('image/')){
        data = await shrink(f);
      }else return toast('Please choose an image or a PDF.');
      const all = loadCerts();
      all[id] = { data, name: f.name, added: new Date().toISOString() };
      if(saveCerts(all)){ render(); toast('Certificate attached'); }
    }catch{ toast('Could not read that file'); }
  });

  view.addEventListener('click', e => {
    const add = e.target.closest('[data-cert-add]');
    const see = e.target.closest('[data-cert-view]');
    const del = e.target.closest('[data-cert-del]');
    if(add){ pending = add.dataset.certAdd; picker.click(); }
    else if(see){ const r = loadCerts()[see.dataset.certView]; if(r) viewCert(r); }
    else if(del){
      if(!confirm('Remove this certificate?')) return;
      const all = loadCerts(); delete all[del.dataset.certDel];
      if(saveCerts(all)) render();
    }
  });

  state.dept = mine || ALL_KEY;
  state.year = myYear;
  render();
}
