/* ============================================================
   jobs.js — Jobs page
   Filtering, search, sorting and table rendering.
   All job data comes from js/data/jobs.data.js
============================================================ */

import { $, $$, esc, uniq } from '../core/dom.js';
const API_BASE_URL = 'http://localhost:3000/api';
let jobs = [];

function normaliseApiJob(j){
  return {
    title: j.company_name || j.company || 'Company',
    sub: j.title || 'Job Opportunity',
    salary: j.salary || '—',
    stipend: j.stipend || '—',
    applyBefore: j.apply_before || '—',
    applyBeforeVal: j.apply_before || '9999-12-31',
    visit: j.visit_date || '—',
    visitTag: j.visit_tag || '',
    status: j.status || 'Eligible',
    statusClass: j.status_class || 'status-amber',
    batch: j.batch || '—',
    posted: j.created_at ? new Date(j.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—',
    type: j.job_type === 'Full-time' ? 'Full-time' : (j.job_type || 'Regular Intern'),
    cats: ['eligible'],
    prev: false,
    companyId: j.company_id,
    description: j.description || '',
    location: j.location || '',
    workMode: j.work_mode || ''
  };
}

async function loadLiveJobs(){
  try{
    const res = await fetch(`${API_BASE_URL}/jobs`);
    if(!res.ok) return;
    const result = await res.json();
    if(Array.isArray(result.data)){
      jobs = result.data.map(normaliseApiJob);
      renderMenus();
      render();
    }
  }catch(err){
    console.error('Jobs backend unavailable.', err);
    jobs = [];
    renderMenus();
    render();
  }
}

/* Current filter state — reset each time the page mounts */
let state;

function resetState(){
  state = {
    cat:"eligible",
    search:"",
    company:"All Companies",
    type:"All Types",
    status:"All Status",
    visit:"All Dates",
    applyByDesc:true,
    showPrev:false,
  };
}

/* ---------- Dropdown menus ---------- */

function closeAllDropdowns(){
  $$('.dropdown[open]').forEach(d => d.removeAttribute('open'));
}

function buildMenu(container, options, current, onPick){
  if(!container) return;
  container.innerHTML = "";
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.textContent = opt;
    if(opt === current) btn.classList.add('sel');
    btn.addEventListener('click', () => {
      onPick(opt);
      closeAllDropdowns();
    });
    container.appendChild(btn);
  });
}

function renderMenus(){
  buildMenu($('#ddCompanyMenu'), ["All Companies", ...uniq(jobs.map(j => j.title))],  state.company, v => { state.company = v; render(); });
  buildMenu($('#ddTypeMenu'),    ["All Types",     ...uniq(jobs.map(j => j.type))],   state.type,    v => { state.type    = v; render(); });
  buildMenu($('#ddStatusMenu'),  ["All Status",    ...uniq(jobs.map(j => j.status))], state.status,  v => { state.status  = v; render(); });
  buildMenu($('#ddVisitMenu'),   ["All Dates",     ...uniq(jobs.map(j => j.visit))],  state.visit,   v => { state.visit   = v; render(); });
}

/* ---------- Filtering ---------- */

function applyFilters(){
  let list = jobs.filter(j => j.cats.includes(state.cat));

  if(!state.showPrev)                  list = list.filter(j => !j.prev);
  if(state.company !== "All Companies")list = list.filter(j => j.title  === state.company);
  if(state.type    !== "All Types")    list = list.filter(j => j.type   === state.type);
  if(state.status  !== "All Status")   list = list.filter(j => j.status === state.status);
  if(state.visit   !== "All Dates")    list = list.filter(j => j.visit  === state.visit);
  if(state.search)                     list = list.filter(j => (j.title + " " + j.sub).toLowerCase().includes(state.search));

  return [...list].sort((a, b) => state.applyByDesc
    ? new Date(b.applyBeforeVal) - new Date(a.applyBeforeVal)
    : new Date(a.applyBeforeVal) - new Date(b.applyBeforeVal));
}

/* ---------- Rendering ---------- */

function typeLabel(type){
  if(type === 'Full-time') return 'Full-time';
  return type.includes('Summer') ? 'Summer Intern' : 'Regular Intern';
}

function rowHTML(j){
  return `
    <tr>
      <td><div class="job-title">${esc(j.title)}</div><div class="job-sub">${esc(j.sub)}</div></td>
      <td>${esc(j.salary)}<div class="cell-sub">${typeLabel(j.type)}</div></td>
      <td>${esc(j.stipend)}</td>
      <td>${esc(j.applyBefore)}<div class="cell-sub">—</div></td>
      <td>${esc(j.visit)}<div class="cell-sub">${esc(j.visitTag)}</div></td>
      <td><span class="status-pill ${j.statusClass}"><span class="sdot"></span>${esc(j.status)}</span></td>
      <td>${esc(j.batch)}</td>
      <td>${esc(j.posted)}</td>
    </tr>`;
}

function render(){
  const list = applyFilters();
  const body = $('#jobsBody');
  if(!body) return;

  $('#jobsCount').textContent = list.length + (list.length === 1 ? " Job Listed" : " Jobs Listed");

  body.innerHTML = list.length === 0
    ? `<tr><td colspan="8" class="empty-row">No jobs match these filters.</td></tr>`
    : list.map(rowHTML).join("");
}

/* ---------- Events ---------- */

function bindEvents(){
  // Apply-by sort direction
  $$('#ddApplyBy .dropdown-menu button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.applyByDesc = btn.dataset.val === "Desc";
      $('#applyByLabel').textContent = btn.dataset.val;
      $$('#ddApplyBy .dropdown-menu button').forEach(x => x.classList.toggle('sel', x === btn));
      closeAllDropdowns();
      render();
    });
  });

  // Category chips
  $$('#chipRow .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('#chipRow .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.cat = chip.dataset.cat;
      render();
    });
  });

  // Search box
  $('#jobSearch').addEventListener('input', e => {
    state.search = e.target.value.trim().toLowerCase();
    render();
  });
const prevToggle = $('#prevToggle');

if (prevToggle) {
  prevToggle.addEventListener('click', () => {
    state.showPrev = !state.showPrev;
    prevToggle.classList.toggle('on', state.showPrev);
    render();
  });
}

} // <-- CLOSE bindEvents()

/* Close dropdowns on any outside click. Registered once, not per mount,
   so navigating back and forth doesn't stack duplicate listeners. */
document.addEventListener('click', e => {
  $$('.dropdown[open]').forEach(d => {
    if (!d.contains(e.target)) d.removeAttribute('open');
  });
});

export function mount(){
  resetState();
  bindEvents();
  renderMenus();
  render();
  loadLiveJobs();
}
