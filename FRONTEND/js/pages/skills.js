/* ============================================================
   skills.js — Skills page
   Renders free courses (js/data/skills.data.js) into pages/skills.html.

   Layout
     Title "General courses", then chips  All | CSE | IT | ...  then the courses (two rows, scrolls sideways)
       All = general courses + every department's courses; a department chip = that department only

   A student whose study year is known only sees that year's courses.
   If the year is unknown, year chips let them pick one.
============================================================ */

import { $, $$, esc } from '../core/dom.js';
import { DEPARTMENTS, YEARS, GENERAL_GROUPS, DEPT_NOTES, COURSES, PROG_LANGS, PROG_COURSES } from '../data/skills.data.js?v=20261022a';

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

const ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';

const CHECK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>';
const CLIP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4L15 7"/></svg>';

const state = { dept: 'ALL', year: 0, lang: 'Python', query: '' };
const PROG_LEVELS = [{ key: 'Beginner' }, { key: 'Intermediate' }, { key: 'Advanced' }];
let locked = false;   // true when the student's year is known: they only see their own year

function ordinal(y){ return y + (y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'); }

function focusCourseSearch(event){
  if(document.body.dataset.route !== 'skills') return;
  if(event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
  event.preventDefault();
  document.getElementById('skSearch')?.focus();
}


/* ---------- Course picture + provider logo ----------
   Logo: the provider's own icon, loaded from its website (falls back to the first letter if it can't load).
   Picture: a banner drawn for the course's topic (Python, Java, aptitude, circuits...). */
const LOGO_DOMAIN = {
  'Cisco':'cisco.com', 'IBM':'ibm.com', 'Google':'google.com', 'Microsoft':'microsoft.com',
  'Harvard':'harvard.edu', 'Infosys':'infosys.com', 'Univ. of Helsinki':'helsinki.fi',
  'Open University':'open.edu', 'MathWorks':'mathworks.com', 'ELCAI':'kelcaigroup.com',
  'Great Learning':'mygreatlearning.com', 'C++ Institute':'cppinstitute.org',
};
function logoDomain(c){
  if(LOGO_DOMAIN[c.company]) return LOGO_DOMAIN[c.company];
  try{ return new URL(c.url).hostname.replace(/^www\./, ''); }catch{ return ''; }
}
function banner(c){
  const dom = logoDomain(c);
  const initial = esc((c.company || '?').trim().charAt(0).toUpperCase());
  const logo = dom
    ? `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=128" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : '';
  return `<div class="sk-banner" role="img" aria-label="${esc(c.title)}">
      <span class="sk-logo" title="${esc(c.company)}"><b>${initial}</b>${logo}</span>
    </div>`;
}

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
      ${banner(c)}
      <div class="sk-top">
        <span class="sk-co">${esc(c.company)}</span>
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
  const query = state.query.trim().toLowerCase();
  const searchResults = $('#skSearchResults');
  const searchList = $('#skSearchResultsList');
  const searching = Boolean(query);

  $$('#skTabs .sk-tab').forEach(b => {
    const on = b.dataset.tab === state.dept;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $$('#skYears .sk-year').forEach(b => {
    const on = Number(b.dataset.year) === state.year;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  $('#skBlurb').textContent = y
    ? (locked ? `${y.label} · ${y.level} — ${y.blurb}` : y.blurb)
    : 'Showing courses for every year. Pick a year to see what suits you now.';

  const sections = [$('#skDeptSec'), $('#skProgTitle')?.closest('.sk-section')].filter(Boolean);
  sections.forEach(section => { section.hidden = searching; });
  searchResults.hidden = !searching;
  $('#skSearchClear').hidden = !searching;
  if(searching){
    const uniqueCourses = new Map([...COURSES, ...PROG_COURSES].filter(yearOk).map(course => [courseId(course), course]));
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = [...uniqueCourses.values()].filter(course => {
      const searchable = Object.values(course).flat().join(' ').toLowerCase();
      return terms.every(term => searchable.includes(term));
    });
    $('#skSearchResultCount').textContent = `${matches.length} found`;
    $('#skCount').textContent = `${matches.length} course${matches.length === 1 ? '' : 's'}`;
    searchList.innerHTML = matches.length
      ? matches.map(card).join('')
      : `<div class="card sk-empty">No courses match “${esc(state.query.trim())}”. Try another skill, provider or topic.</div>`;
    return;
  }

  /* All = general courses first (fixed group order), then every other course.
     A department chip = only that department's courses. */
  const order = GENERAL_GROUPS.map(g => g.key);
  const showAll = state.dept === 'ALL';
  const deptLabel = DEPARTMENTS.find(d => d.key === state.dept)?.label || state.dept;
  const general = COURSES.filter(c => c.general && yearOk(c))
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  const others = COURSES.filter(c => !c.general && yearOk(c) &&
    (showAll || c.depts === 'ALL' || c.depts.includes(state.dept)));
  const dept = showAll ? [...general, ...others] : others;
  $('#skDeptSub').textContent = showAll
    ? 'Showing general courses along with every department\'s courses'
    : `Showing ${deptLabel} courses`;

  const programming = PROG_COURSES.filter(c => c.lang === state.lang && yearOk(c));
  const visibleCount = new Set([...dept, ...programming].map(courseId)).size;
  $('#skCount').textContent = `${visibleCount} course${visibleCount === 1 ? '' : 's'}`;
  fill($('#skDept'), dept, showAll
    ? `No courses added yet${yearWords}.`
    : `No ${deptLabel} courses added yet${yearWords}. Try All to see the general courses.`);

  const note = $('#skNote');
  note.hidden = showAll || !DEPT_NOTES[state.dept];
  note.textContent = showAll ? '' : (DEPT_NOTES[state.dept] || '');

    /* Programming: the chosen language's courses */
  $$('#skProgTabs .sk-tab').forEach(b => {
    const on = b.dataset.tab === state.lang;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
    PROG_LEVELS.forEach(lv => {
    const list = PROG_COURSES.filter(c =>
      c.lang === state.lang && (c.level || 'Beginner') === lv.key && yearOk(c));
    fill($('#skProgLevels' + lv.key), list, `${lv.key} ${state.lang} courses coming soon.`);
  });
}

export function mount(){
  const tabs = $('#skTabs');
  const years = $('#skYears');
  const view = $('#view-skills');
  if(!tabs || !years || !view) return;
  const search = $('#skSearch');
  const clearSearch = $('#skSearchClear');
  state.query = '';
  if(search) search.value = '';

  const mine = studentDept();
  const myYear = studentYear();
  locked = myYear !== 0;

  tabs.innerHTML = [{ key: 'ALL', label: 'All' }, ...DEPARTMENTS].map(d => {
    const tag = d.key === mine ? '<span class="sk-mine">Your department</span>' : '';
    return `<button class="sk-tab" role="tab" data-tab="${esc(d.key)}">${esc(d.label)}${tag}</button>`;
  }).join('');

  years.innerHTML = [{ key: 0, label: 'All years', level: '' }, ...YEARS].map(yr => {
    const level = yr.level ? `<span class="sk-level">${esc(yr.level)}</span>` : '';
    return `<button class="sk-year" data-year="${yr.key}">${esc(yr.label)}${level}</button>`;
  }).join('');
  years.hidden = locked;   // a student with a known year never sees the other years

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
  years.addEventListener('click', e => {
    if(locked) return;
    const b = e.target.closest('.sk-year');
    if(b){ state.year = Number(b.dataset.year); render(); }
  });
  search?.addEventListener('input', () => {
    state.query = search.value;
    render();
  });
  clearSearch?.addEventListener('click', () => {
    state.query = '';
    search.value = '';
    render();
    search.focus();
  });
  search?.addEventListener('keydown', event => {
    if(event.key === 'Escape' && search.value){
      state.query = '';
      search.value = '';
      render();
    }
  });
  document.removeEventListener('keydown', focusCourseSearch);
  document.addEventListener('keydown', focusCourseSearch);

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

  state.dept = 'ALL';   // opens on "All"; the student's own department is tagged in the chips
  state.year = myYear;
  render();
}
