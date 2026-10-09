/* ============================================================
   skills.js — Skills page
   Renders free courses (js/data/skills.data.js) into pages/skills.html.
   Two filters: department tab (General + one per department) and
   study year (All, 1st-4th). Both open on the student's own values.
============================================================ */

import { $, $$, esc } from '../core/dom.js';
import { DEPARTMENTS, YEARS, GENERAL_GROUPS, DEPT_NOTES, COURSES } from '../data/skills.data.js?v=20261009c';

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
const CHECK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>';

const state = { tab: 'General', year: 0 };
let locked = false;   // true when the student's year is known: they only see their own year

function card(c){
  const levels = c.years.map(y => YEARS.find(v => v.key === y)?.level).filter(Boolean);
  const yearTag = c.years.length === YEARS.length ? 'All years' : c.years.map(y => y + (y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th')).join(' · ') + ' year';
  return `
    <article class="card sk-card">
      <div class="sk-top">
        <span class="sk-co">${esc(c.company)}</span>
        <span class="badge badge-green sk-cert">${CHECK} Free ${esc(c.cert.toLowerCase())}</span>
      </div>
      <h3 class="sk-title">${esc(c.title)}</h3>
      <p class="sk-desc">${esc(c.desc)}</p>
      <div class="sk-bottom">
        <a class="btn-solid sk-go" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">
          Start course ${ARROW}
        </a>
        <span class="sk-yr" title="${esc(levels.join(' / '))}">${esc(yearTag)}</span>
      </div>
    </article>`;
}

function grid(list){ return `<div class="sk-grid">${list.map(card).join('')}</div>`; }

function matches(c){
  const tabOk = state.tab === 'General' ? !!c.general : (c.depts === 'ALL' || c.depts.includes(state.tab));
  const yearOk = state.year === 0 || c.years.includes(state.year);
  return tabOk && yearOk;
}

function render(){
  const body = $('#skBody');
  if(!body) return;

  $$('#skTabs .sk-tab').forEach(b => {
    const on = b.dataset.tab === state.tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $$('#skYears .sk-year').forEach(b => {
    const on = Number(b.dataset.year) === state.year;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  const y = YEARS.find(v => v.key === state.year);
  $('#skBlurb').textContent = y
    ? (locked ? `${y.label} · ${y.level} — ${y.blurb}` : y.blurb)
    : 'Showing courses for every year. Pick a year to see what suits you now.';

  const list = COURSES.filter(matches);
  $('#skCount').textContent = list.length + (list.length === 1 ? ' course' : ' courses');

  const note = $('#skNote');
  note.hidden = !DEPT_NOTES[state.tab];
  note.textContent = DEPT_NOTES[state.tab] || '';

  if(!list.length){
    const where = state.tab === 'General' ? 'General' : state.tab;
    const when = y ? ` for ${y.label}` : '';
    body.innerHTML = `<div class="card sk-empty">No free certificate courses added yet for ${esc(where)}${esc(when)}.<br>Try another year or the General tab.</div>`;
    return;
  }

  if(state.tab === 'General'){
    body.innerHTML = GENERAL_GROUPS.map(g => {
      const items = list.filter(c => c.group === g.key);
      return items.length ? `<h3 class="sk-group">${esc(g.label)}</h3>${grid(items)}` : '';
    }).join('');
    return;
  }

  body.innerHTML = grid(list);
}

export function mount(){
  const tabs = $('#skTabs');
  const years = $('#skYears');
  if(!tabs || !years) return;

  const mine = studentDept();
  const myYear = studentYear();
  locked = myYear !== 0;

  tabs.innerHTML = ['General', ...DEPARTMENTS.map(d => d.key)].map(k => {
    const label = k === 'General' ? 'General' : DEPARTMENTS.find(d => d.key === k).label;
    const tag = k === mine ? '<span class="sk-mine">Your department</span>' : '';
    return `<button class="sk-tab" role="tab" data-tab="${esc(k)}">${esc(label)}${tag}</button>`;
  }).join('');

  years.innerHTML = [{ key: 0, label: 'All years', level: '' }, ...YEARS].map(y => {
    const tag = y.key && y.key === myYear ? '<span class="sk-mine">You</span>' : '';
    const level = y.level ? `<span class="sk-level">${esc(y.level)}</span>` : '';
    return `<button class="sk-year" data-year="${y.key}">${esc(y.label)}${level}${tag}</button>`;
  }).join('');

  tabs.addEventListener('click', e => {
    const b = e.target.closest('.sk-tab');
    if(b){ state.tab = b.dataset.tab; render(); }
  });
  years.addEventListener('click', e => {
    if(locked) return;
    const b = e.target.closest('.sk-year');
    if(b){ state.year = Number(b.dataset.year); render(); }
  });
  years.hidden = locked;   // a student with a known year never sees the other years

  state.tab = mine || 'General';
  state.year = myYear;
  render();
}
