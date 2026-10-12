/* Jobs discovery page. Public job data is read from the shared backend. */
import { $, $$, esc } from '../core/dom.js';
import { getToken } from '../core/api.js';

const API_BASE_URL = window.STEPUP_API_BASE_URL || 'http://localhost:3000/api';
let allJobs = [];
let appliedJobIds = new Set();
let state = { search:'', industry:'All', sort:'Latest' };
const SAVED_KEY = 'stepupSavedJobs';
let refreshTimer = null;

function savedIds(){
  try{return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]').map(String));}
  catch{return new Set();}
}
function persistSaved(set){ localStorage.setItem(SAVED_KEY, JSON.stringify([...set])); }

function showApplyToast(message, ok=true){
  document.querySelector('.jobs-apply-toast')?.remove();
  const t=document.createElement('div');
  t.className=`jobs-apply-toast ${ok?'ok':'error'}`;
  t.textContent=message;
  document.body.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),220); },2600);
}
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

async function loadApplications(){
  appliedJobIds = new Set();
  const token = getToken();
  if(!token) return;
  try{
    const res = await fetch(`${API_BASE_URL}/student/applications`, {
      headers:{Accept:'application/json', Authorization:`Bearer ${token}`}
    });
    if(!res.ok) return;
    const result = await res.json();
    (Array.isArray(result.data) ? result.data : []).forEach(a => appliedJobIds.add(String(a.job_id)));
    if(allJobs.length) render();
  }catch{}
}

async function loadJobs(){
  const grid=$('#jobsGrid');
  try{
    const token = getToken();
    const headers = {Accept:'application/json'};
    if(token) headers.Authorization = `Bearer ${token}`;
    const res=await fetch(`${API_BASE_URL}/jobs`, {headers});
    if(!res.ok) throw new Error(`Jobs API returned ${res.status}`);
    const result=await res.json();
    allJobs=Array.isArray(result.data) ? result.data.map(normalise) : [];
  }catch(err){
    console.error(err);
    if(grid && document.body.dataset.route === 'jobs'){
      grid.innerHTML='<div class="jobs-error">Jobs could not be loaded right now. Make sure the StepUp backend is running and your team is using the shared database.</div>';
      $('#jobsCount').textContent='Unable to load companies';
    }
    return;
  }
  render();
}

function filtered(){
  const q=state.search.toLowerCase();
  let list=allJobs.filter(j=>{
const text=[j.companyName,j.jobTitle,j.description,j.industry,j.location,j.workMode].join(' ').toLowerCase();
    const matchesSaved = state.industry==='Saved' ? savedIds().has(String(j.id)) : true;
    const matchesIndustry = state.industry==='All' || state.industry==='Saved' || j.industry===state.industry;
    return (!q || text.includes(q)) && matchesIndustry && matchesSaved;
  });
  if(state.sort==='A-Z') list.sort((a,b)=>a.companyName.localeCompare(b.companyName));
  else if(state.sort==='Deadline') list.sort((a,b)=>String(a.deadline).localeCompare(String(b.deadline)));
  else list.sort((a,b)=>b.posted-a.posted);
  return list;
}


function groupByCompany(list){
  return list.map(j => ({
    companyId: j.companyId,
    jobs: [j],
    primary: j
  }));
}


function cardHTML(group){
  const j=group.primary, count=group.jobs.length, saved=savedIds().has(String(j.id));
  const desc=group.jobs.length===1 ? j.description : `${j.companyName} currently has ${count} open role${count===1?'':'s'} listed on StepUp. ${j.description}`;
  return `<article class="company-card">
    <div class="company-card-head">
      <div class="company-identity">
        <div class="company-logo">${esc(initials(j.companyName))}</div>
        <div><div class="company-name">${esc(j.companyName)}</div><div class="company-meta">${esc(j.industry)} • ${esc(j.location)}</div></div>
      </div>
      <button class="save-job ${saved?'saved':''}" data-save="${esc(String(j.id))}" aria-label="${saved?'Remove saved job':'Save job'}">${saved?'★':'☆'}</button>
    </div>
    <p class="company-description">${esc(desc)}</p>
    <div class="company-pills">
      <span class="company-pill">◉ ${esc(j.salary || 'Compensation on listing')}</span>
      <span class="company-pill">▣ ${esc(j.workMode || 'Hybrid')}</span>
    </div>
    <div class="company-open-roles">▣ ${count} Open Role${count===1?'':'s'}</div>
    <div class="company-card-footer">
      <button class="view-details-btn" data-details="${esc(String(j.id))}">View Details ›</button>
      <button class="apply-job-btn ${appliedJobIds.has(String(j.id))?'applied':''}" data-apply="${esc(String(j.id))}">${appliedJobIds.has(String(j.id))?'Applied':'Apply'}</button>
      <button class="company-save-btn ${saved?'saved':''}" data-save="${esc(String(j.id))}">${saved?'Saved':'Save'}</button>
    </div>
  </article>`;
}

function render(){
  const groups=groupByCompany(filtered()), grid=$('#jobsGrid');
  if(!grid) return;
  $('#jobsCount').textContent=`Showing ${groups.length} of ${new Set(allJobs.map(j=>j.companyId)).size} companies`;
  grid.innerHTML=groups.length ? groups.map(cardHTML).join('') : '<div class="jobs-empty">No companies or roles match your search.</div>';
  grid.querySelectorAll('[data-details]').forEach(btn=>btn.addEventListener('click',()=>{
    window.location.href=`job-details.html?id=${encodeURIComponent(btn.dataset.details)}`;
  }));
  grid.querySelectorAll('[data-apply]').forEach(btn=>btn.addEventListener('click',async()=>{
    const jobId=String(btn.dataset.apply);
    const token=getToken();
    if(!token){ window.location.href='student-login.html'; return; }
    btn.disabled=true;
    try{
      const isApplied=appliedJobIds.has(jobId);
      const res=await fetch(`${API_BASE_URL}/jobs/${encodeURIComponent(jobId)}/apply`,{
        method:isApplied?'DELETE':'POST',
        headers:{Accept:'application/json',Authorization:`Bearer ${token}`}
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error || (isApplied?'Could not withdraw application.':'Could not apply.'));
      if(isApplied){
        appliedJobIds.delete(jobId);
        showApplyToast('Application withdrawn successfully.', true);
      }else{
        appliedJobIds.add(jobId);
        showApplyToast('Application submitted successfully!', true);
      }

      render();
    }catch(err){ btn.disabled=false; showApplyToast(err.message, false); }
  }));
  grid.querySelectorAll('[data-save]').forEach(btn=>btn.addEventListener('click',()=>{
    const set=savedIds(), id=String(btn.dataset.save);
    set.has(id)?set.delete(id):set.add(id); persistSaved(set); render();
  }));
}

function refreshJobsIfVisible(){
  if(document.body.dataset.route !== 'jobs' || document.visibilityState !== 'visible') return;
  loadJobs();
  loadApplications();
}

window.addEventListener('focus', refreshJobsIfVisible);
document.addEventListener('visibilitychange', refreshJobsIfVisible);

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
  if(refreshTimer) window.clearInterval(refreshTimer);
  refreshTimer=window.setInterval(refreshJobsIfVisible,60000);
  Promise.all([loadApplications(), loadJobs()]);
}
