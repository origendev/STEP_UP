/* ============================================================
   progress.js — Placement Progress page
============================================================ */
import { $, esc } from '../core/dom.js';
import { getToken } from '../core/api.js';

const API = window.STEPUP_API_BASE_URL || 'http://localhost:3000/api';

function statusClass(status){
  return String(status || 'Applied').toLowerCase();
}

async function loadApplications(){
  const section=$('#appliedJobsSection');
  const list=$('#appliedJobsList');
  if(!section || !list) return;

  const token=getToken();
  if(!token){
    list.innerHTML='<div class="card progress-applied-empty">Sign in as a student to see your applied jobs.</div>';
    return;
  }

  try{
    const r=await fetch(`${API}/student/applications`,{
      headers:{Accept:'application/json',Authorization:`Bearer ${token}`}
    });
    const d=await r.json();
    if(!r.ok) throw Error(d.error||'Could not load applications.');
    const apps=Array.isArray(d.data)?d.data:[];

    if(!apps.length){
      list.innerHTML='<div class="card progress-applied-empty">You have not applied to any jobs yet.</div>';
      return;
    }

    // Once a student has applications, Progress focuses on those applications.
    document.querySelector('.progress-placement-info')?.remove();
    document.querySelector('.round1-result-update')?.remove();
    document.querySelector('.progress-rounds')?.remove();

    list.innerHTML=apps.map(a=>`
      <article class="progress-applied-card">
        <div class="progress-applied-top">
          <div>
            <h3>${esc(a.title)}</h3>
            <p>${esc(a.company_name)} • Applied on ${a.applied_at?new Date(a.applied_at).toLocaleDateString():'-'}</p>
          </div>
          <span class="progress-applied-status ${statusClass(a.status)}">${esc(a.status)}</span>
        </div>
        <div class="progress-applied-meta">
          <div><small>Job type</small><strong>${esc(a.job_type||'-')}</strong></div>
          <div><small>Location</small><strong>${esc(a.location||a.company_location||'-')}</strong></div>
          <div><small>Apply before</small><strong>${esc(String(a.apply_before||'').slice(0,10))}</strong></div>
        </div>
      </article>`).join('');
  }catch(e){
    list.innerHTML=`<div class="card progress-applied-empty">${esc(e.message)}</div>`;
  }
}

export function mount(){
  const resultUpdate=document.getElementById("round1ResultUpdate");
  if(resultUpdate){
    const round1Completed=localStorage.getItem("stepupRound1Completed")==="true";
    resultUpdate.style.display=round1Completed?"grid":"none";
  }
  loadApplications();
}
