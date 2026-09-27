/* Jobs discovery page. Public job data is read from the shared backend. */
import { $, $$, esc } from '../core/dom.js';

const API_BASE_URL = window.STEPUP_API_BASE_URL || 'http://localhost:3000/api';
let allJobs = [];
let state = { search:'', industry:'All', sort:'Latest' };
const SAVED_KEY = 'stepupSavedListings';

function savedIds(){
  try{return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]').map(String));}
  catch{return new Set();}
}
function persistSaved(set){ localStorage.setItem(SAVED_KEY, JSON.stringify([...set])); }
function initials(name){
  return String(name||'S').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'S';
}
function normalise(j){
  return {
    ...j,
    id:String(j.id),
    companyId: String(j.company_id),
    companyId:String(j.company_id),
    companyName:j.company_name || 'Company',
    jobTitle: j.title || 'Job Opportunity',
    industry: j.industry || 'IT',
    description: j.description || 'Explore this opportunity on StepUp.',
    location: j.location || 'Campus / India',
    workMode: j.work_mode || 'Hybrid',
    salary: j.salary || j.stipend || 'Compensation disclosed by company',
    posted: j.created_at ? new Date(j.created_at).getTime() : 0,
    deadline: j.apply_before || ''
  };
}

async function loadJobs(){
  const grid=$('#jobsGrid');
  try{
    const res=await fetch(`${API_BASE_URL}/jobs`, {headers:{Accept:'application/json'}});
    if(!res.ok) throw new Error(`Jobs API returned ${res.status}`);
    const result=await res.json();
    allJobs=Array.isArray(result.data) ? result.data.map(normalise) : [];
    console.table(allJobs.map(j => ({
  id: j.id,
  companyId: j.companyId,
  company: j.companyName,
  title: j.jobTitle,
  industry: j.industry
})));
  }catch(err){
    console.error(err);
    grid.innerHTML='<div class="jobs-error">Jobs could not be loaded right now. Make sure the StepUp backend is running and your team is using the shared database.</div>';
    $('#jobsCount').textContent='Unable to load companies';
    return;
  }
  render();
}

function filtered(){
  const q=state.search.toLowerCase();
  let list=allJobs.filter(j=>{
const text=[j.companyName,j.jobTitle,j.description,j.industry,j.location,j.workMode].join(' ').toLowerCase();    return (!q || text.includes(q)) && (state.industry==='All' || j.industry===state.industry);
  });
  if(state.sort==='A-Z') list.sort((a,b)=>a.companyName.localeCompare(b.companyName));
  else if(state.sort==='Deadline') list.sort((a,b)=>String(a.deadline).localeCompare(String(b.deadline)));
  else list.sort((a,b)=>b.posted-a.posted);
  return list;
}
function groupByCompany(list){
  const map = new Map();

  for(const j of list){
    if(!map.has(j.companyId)){
      map.set(j.companyId, []);
    }

    map.get(j.companyId).push(j);
  }

  return [...map.entries()].map(([companyId, jobs]) => ({
    companyId,
    jobs,
    primary: jobs[0]
  }));
}

function cardHTML(group){
  const j=group.primary, count=group.jobs.length, saved=savedIds().has(String(group.companyId));
  const desc=group.jobs.length===1 ? j.description : `${j.companyName} currently has ${count} open role${count===1?'':'s'} listed on StepUp. ${j.description}`;
  return `<article class="company-card">
    <div class="company-card-head">
      <div class="company-identity">
        <div class="company-logo">${esc(initials(j.companyName))}</div>
        <div><div class="company-name">${esc(j.companyName)}</div><div class="company-meta">${esc(j.industry)} • ${esc(j.location)}</div></div>
      </div>
      <button class="save-job ${saved?'saved':''}" data-save="${esc(String(group.companyId))}" aria-label="${saved?'Remove saved company':'Save company'}">${saved?'★':'☆'}</button>
    </div>
    <p class="company-description">${esc(desc)}</p>
    <div class="company-pills">
      <span class="company-pill">◉ ${esc(j.salary || 'Compensation on listing')}</span>
      <span class="company-pill">▣ ${esc(j.workMode || 'Hybrid')}</span>
    </div>
    <div class="company-open-roles">▣ ${count} Open Role${count===1?'':'s'}</div>
    <div class="company-card-footer">
      <button class="view-details-btn" data-details="${esc(String(j.id))}">View Details ›</button>
      <button class="company-save-btn ${saved?'saved':''}" data-save="${esc(String(group.companyId))}">${saved?'Saved':'Save'}</button>
    </div>
  </article>`;
}

function render(){
  const groups=groupByCompany(filtered()), grid=$('#jobsGrid');
  $('#jobsCount').textContent=`Showing ${groups.length} of ${new Set(allJobs.map(j=>j.companyId)).size} companies`;
  grid.innerHTML=groups.length ? groups.map(cardHTML).join('') : '<div class="jobs-empty">No companies or roles match your search.</div>';
  grid.querySelectorAll('[data-details]').forEach(btn=>btn.addEventListener('click',()=>{
    window.location.href=`job-details.html?id=${encodeURIComponent(btn.dataset.details)}`;
  }));
  grid.querySelectorAll('[data-save]').forEach(btn=>btn.addEventListener('click',()=>{
    const set=savedIds(), id=String(btn.dataset.save);
    set.has(id)?set.delete(id):set.add(id); persistSaved(set); render();
  }));
}

function bindEvents(){
  const search=$('#jobSearch');
  search.addEventListener('input',e=>{state.search=e.target.value.trim();render();});
  $$('#industryChips .chip').forEach(chip=>chip.addEventListener('click',()=>{
    $$('#industryChips .chip').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active'); state.industry=chip.dataset.industry; render();
  }));
  $$('#ddApplyBy .dropdown-menu button').forEach(btn=>btn.addEventListener('click',()=>{
    state.sort=btn.dataset.val; $('#applyByLabel').textContent=state.sort;
    $$('#ddApplyBy .dropdown-menu button').forEach(x=>x.classList.toggle('sel',x===btn));
    document.querySelector('#ddApplyBy')?.removeAttribute('open'); render();
  }));
}

document.addEventListener('click',e=>$$('.dropdown[open]').forEach(d=>{if(!d.contains(e.target))d.removeAttribute('open');}));

export function mount(){
  state={search:'',industry:'All',sort:'Latest'};
  bindEvents();
  $('#jobsGrid').innerHTML='<div class="jobs-empty">Loading companies…</div>';
  loadJobs();
}
