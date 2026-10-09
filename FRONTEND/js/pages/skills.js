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
import { DEPARTMENTS, YEARS, GENERAL_GROUPS, DEPT_NOTES, COURSES } from '../data/skills.data.js?v=20261009d';

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

const ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';

const state = { dept: 'CSE', year: 0, q: '' };
let locked = false;   // true when the student's year is known: they only see their own year

function ordinal(y){ return y + (y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'); }

function card(c){
  const levels = c.years.map(y => YEARS.find(v => v.key === y)?.level).filter(Boolean);
  const yearTag = c.years.length === YEARS.length ? 'All years' : c.years.map(ordinal).join(' · ') + ' year';
  return `
    <article class="card sk-card">
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
    </article>`;
}

const yearOk = c => state.year === 0 || c.years.includes(state.year);

/** Words typed in the search box; a course matches when it contains every word. */
const terms = () => state.q.toLowerCase().split(/\s+/).filter(Boolean);
const haystack = c => [c.title, c.company, c.desc, c.cert,
  (GENERAL_GROUPS.find(g => g.key === c.group) || {}).label,
  c.depts === 'ALL' ? '' : c.depts.join(' ')].join(' ').toLowerCase();
const searchOk = (c, words) => words.every(w => haystack(c).includes(w));

/** Fill a scroller: cards, or one friendly message when there are none. */
function fill(el, list, emptyText){
  el.classList.toggle('is-empty', !list.length);
  el.scrollLeft = 0;
  el.innerHTML = list.length ? list.map(card).join('') : `<div class="card sk-empty">${esc(emptyText)}</div>`;
}

function render(){
  const y = YEARS.find(v => v.key === state.year);
  const yearWords = y ? ` for ${y.label}` : '';

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

  /* General: everything flagged `general`, grouped in a fixed order */
  const words = terms();
  const searching = words.length > 0;
  const order = GENERAL_GROUPS.map(g => g.key);
  const general = COURSES
    .filter(c => c.general && yearOk(c) && searchOk(c, words))
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));

  /* Department: this department's courses, minus the ones already in the General row.
     While searching, look in every department so nothing is hidden by the tab. */
  const dept = COURSES.filter(c =>
    !c.general && yearOk(c) && searchOk(c, words) &&
    (searching || c.depts === 'ALL' || c.depts.includes(state.dept)));

  fill($('#skGeneral'), general, `No general courses added yet${yearWords}.`);
  fill($('#skDept'), dept,
    `No ${state.dept}-specific free certificate courses added yet${yearWords}. Check the General courses above.`);

  /* Searching: hide empty sections and the department tabs, say what is being shown */
  $('#skGenSec').hidden = searching && !general.length;
  $('#skDeptSec').hidden = searching && !dept.length;
  $('#skTabs').hidden = searching;
  const none = $('#skNone');
  none.hidden = !(searching && !general.length && !dept.length);
  none.textContent = `No courses match \u201c${state.q.trim()}\u201d${yearWords}. Try a different word, like a company or a skill.`;
  $('#skSearchClear').hidden = !state.q;

  const note = $('#skNote');
  if(searching){
    note.hidden = false;
    note.textContent = 'Showing matches from all departments.';
  }else{
    note.hidden = !DEPT_NOTES[state.dept];
    note.textContent = DEPT_NOTES[state.dept] || '';
  }

  const total = general.length + dept.length;
  $('#skCount').textContent = total + (total === 1 ? ' course' : ' courses');
}

export function mount(){
  const tabs = $('#skTabs');
  const years = $('#skYears');
  const view = $('#view-skills');
  if(!tabs || !years || !view) return;

  const mine = studentDept();
  const myYear = studentYear();
  locked = myYear !== 0;

  tabs.innerHTML = DEPARTMENTS.map(d => {
    const tag = d.key === mine ? '<span class="sk-mine">Your department</span>' : '';
    return `<button class="sk-tab" role="tab" data-tab="${esc(d.key)}">${esc(d.label)}${tag}</button>`;
  }).join('');

  years.innerHTML = [{ key: 0, label: 'All years', level: '' }, ...YEARS].map(yr => {
    const level = yr.level ? `<span class="sk-level">${esc(yr.level)}</span>` : '';
    return `<button class="sk-year" data-year="${yr.key}">${esc(yr.label)}${level}</button>`;
  }).join('');
  years.hidden = locked;   // a student with a known year never sees the other years

  const search = $('#skSearch');
  const clear = $('#skSearchClear');
  if(search){
    search.addEventListener('input', () => { state.q = search.value; render(); });
    search.addEventListener('keydown', e => {
      if(e.key === 'Escape' && search.value){ search.value = ''; state.q = ''; render(); }
    });
    clear.addEventListener('click', () => { search.value = ''; state.q = ''; render(); search.focus(); });
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

  /* ‹ › buttons nudge a row sideways (handy with a mouse that has no sideways wheel) */
  view.addEventListener('click', e => {
    const b = e.target.closest('.sk-arrow');
    if(!b) return;
    const row = document.getElementById(b.dataset.scroll);
    if(row) row.scrollBy({ left: Number(b.dataset.dir) * Math.max(280, row.clientWidth * 0.8), behavior: 'smooth' });
  });

  state.dept = mine || 'CSE';
  state.year = myYear;
  state.q = '';
  render();
}
