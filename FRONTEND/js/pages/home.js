/* ============================================================
   home.js — live student dashboard
============================================================ */

import { $, esc } from '../core/dom.js';
import { api } from '../core/api.js';
import { initChatbot } from './chatbot.js';
import { getUser, greeting, USER_EVENT } from '../core/user.js';

const HOME_ICONS = {
  jobs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></svg>',
  demands: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20h18M6 16v-5M12 16V5M18 16V8"/></svg>',
  skills: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
};

let requestVersion = 0;
let refreshTimer;

function refreshOnFocus(){
  if(document.body.dataset.route === 'home') void loadLiveData();
}

const value = item => item === null || item === undefined ? '' : String(item).trim();
const formatDate = date => date && !Number.isNaN(new Date(date).getTime())
  ? new Date(date).toLocaleDateString([], { day:'numeric', month:'short', year:'numeric' })
  : 'Date unavailable';
const applicationsFrom = response => {
  if(!Array.isArray(response?.data)) throw new Error('Application data had an unexpected format.');
  return response.data;
};
const jobsFrom = response => {
  if(!Array.isArray(response?.data)) throw new Error('Job data had an unexpected format.');
  return response.data;
};
const statusOf = application => String(application.status || 'Applied').toLowerCase();
const isOffer = application => ['selected','offer','offered','offer released'].includes(statusOf(application));

function paintHero(){
  const user = getUser();
  const name = $('#homeName');
  const hello = $('#homeGreeting');
  if(name) name.textContent = user.first;
  if(hello) hello.textContent = greeting();
  const date = $('#homeDate');
  if(date) date.textContent = new Date().toLocaleDateString([], {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  });
}

function profileCompleteness(profile){
  if(!profile) return null;
  const details = profile.profile_details && typeof profile.profile_details === 'object'
    ? profile.profile_details : {};
  const groups = [
    [profile.name, profile.email, profile.phone],
    [profile.college, profile.degree, profile.department, profile.graduation_year, profile.cgpa],
    [profile.skills?.length || details.skills?.length],
    [profile.projects?.length || details.more?.projects?.length, profile.experience?.length || details.more?.work?.length],
    [profile.summary, profile.achievements, profile.certifications],
    [profile.linkedin || details.social?.LinkedIn, profile.github || details.social?.GitHub, profile.portfolio || details.social?.['Portfolio Website']]
  ];
  return Math.round(groups.filter(group => group.some(item => Array.isArray(item) ? item.length : Boolean(value(item)))).length / groups.length * 100);
}

function interviewApplications(applications){
  return applications.filter(application =>
    statusOf(application) === 'interview' ||
    (Array.isArray(application.hr_interviews) && application.hr_interviews.length > 0)
  ).length;
}

function paintStats(applications, profile){
  const stats = [
    { number:applications ? applications.length : '—', label:'Applications', color:'violet' },
    { number:applications ? interviewApplications(applications) : '—', label:'Interview stages', color:'amber' },
    { number:applications ? applications.filter(isOffer).length : '—', label:'Offers', color:'green' },
    { number:profile ? `${profileCompleteness(profile)}%` : '—', label:'Profile complete', color:'rose' }
  ];
  $('#homeStats').innerHTML = stats.map(stat => `
    <div class="home-stat stat-${stat.color}"><strong>${esc(stat.number)}</strong><span>${esc(stat.label)}</span></div>
  `).join('');

}

function skillRows(profile){
  const detailedSkills = profile?.profile_details?.skills;
  const skills = Array.isArray(detailedSkills) && detailedSkills.length
    ? detailedSkills : Array.isArray(profile?.skills) ? profile.skills : [];
  if(!profile) return '<p class="home-empty">Skills could not be loaded.</p>';
  if(!skills.length) return '<p class="home-empty">Add skills to your profile to see your snapshot here.</p>';
  return skills.slice(0, 5).map(skill => {
    const name = typeof skill === 'string' ? skill : skill?.name;
    if(!name) return '';
    const level = typeof skill === 'object' ? value(skill.prof || skill.level || skill.proficiency) : '';
    return `<div class="row-item home-skill-row"><span class="milestone-title">${esc(name)}</span>${level ? `<span class="home-skill-level">${esc(level)}</span>` : '<span class="home-skill-level">On your profile</span>'}</div>`;
  }).join('') || '<p class="home-empty">Add skills to your profile to see your snapshot here.</p>';
}

function paintSkills(profile){
  $('#snapshotList').innerHTML = skillRows(profile);
}

function paintMilestones(applications){
  const host = $('#milestoneList');
  if(!applications){
    host.innerHTML = '<p class="home-empty">Application activity could not be loaded.</p>';
    return;
  }
  const recent = [...applications]
    .sort((a,b) => new Date(b.updated_at || b.applied_at || 0) - new Date(a.updated_at || a.applied_at || 0))
    .slice(0,3);
  host.innerHTML = recent.length ? recent.map(application => {
    const status = application.status || 'Applied';
    const color = isOffer(application) ? 'badge-green' : statusOf(application) === 'rejected' ? 'badge-rose' :
      statusOf(application) === 'applied' ? 'badge-amber' : 'badge-violet';
    return `<div class="row-item">
      <span class="badge ${color}">${esc(status)}</span>
      <div><div class="milestone-title">${esc(application.company_name || 'Company')} · ${esc(application.title || 'Job')}</div>
      <div class="milestone-meta">Updated ${esc(formatDate(application.updated_at || application.applied_at))}</div></div>
    </div>`;
  }).join('') : '<p class="home-empty">Your application updates will appear here.</p>';
}

function paintOpenings(jobs, applications){
  const host = $('#openingList');
  if(!jobs || !applications){
    host.innerHTML = '<p class="home-empty">Current opportunities could not be loaded.</p>';
    return;
  }
  const appliedIds = new Set(applications.map(application => String(application.job_id)));
  const open = jobs.filter(job => job.eligible_to_apply && !appliedIds.has(String(job.id))).slice(0,3);
  host.innerHTML = open.length ? open.map(job => `
    <div class="row-item opening-row">
      <div class="opening-logo">${esc(String(job.company_name || job.title || 'J').slice(0,1).toUpperCase())}</div>
      <div class="opening-copy">
        <div class="milestone-title">${esc(job.company_name || 'Company')} · ${esc(job.title || 'Open role')}</div>
        <div class="milestone-meta">Apply before ${esc(formatDate(job.apply_before))} · ${esc(job.stipend || job.salary || 'Compensation not listed')}</div>
      </div>
      <span class="badge badge-amber">Open</span>
    </div>`).join('') : '<p class="home-empty">No new eligible opportunities right now.</p>';
}

function roundList(application){
  try{
    const config = typeof application.interview_rounds === 'string'
      ? JSON.parse(application.interview_rounds) : application.interview_rounds;
    return Array.isArray(config) ? config : Array.isArray(config?.rounds) ? config.rounds : [];
  }catch{return [];}
}

function paintUpcoming(applications){
  const host = $('#upcomingList');
  if(!applications){
    host.innerHTML = '<p class="home-empty">Scheduled stages could not be loaded.</p>';
    return;
  }
  const now = Date.now();
  const events = [];
  applications.forEach(application => {
    if(!['shortlisted','selected','interview'].includes(statusOf(application))) return;
    const sessions = Array.isArray(application.hr_interviews) ? application.hr_interviews : [];
    roundList(application).forEach((round,index) => {
      const session = sessions.find(item => Number(item.round_index) === index);
      const date = session?.scheduled_at || round.scheduledAt || round.scheduled_at;
      if(!date || Number.isNaN(new Date(date).getTime()) || new Date(date).getTime() < now) return;
      events.push({
        date:new Date(date), title:`${application.company_name || 'Company'} · ${round.name || `Round ${index+1}`}`,
        description:session?.status === 'active' ? 'Interview in progress' : application.title || 'Recruitment stage'
      });
    });
  });
  events.sort((a,b) => a.date - b.date);
  host.innerHTML = events.length ? events.slice(0,3).map(event => `
    <div class="row-item">
      <span class="badge badge-violet">${esc(event.date.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</span>
      <div><div class="milestone-title">${esc(event.title)}</div><div class="milestone-meta">${esc(event.description)}</div></div>
    </div>`).join('') : '<p class="home-empty">No upcoming rounds have been scheduled.</p>';
}

function paintFunnel(applications){
  const host = $('#funnelList');
  if(!applications){
    host.innerHTML = '<p class="home-empty">Application funnel could not be loaded.</p>';
    return;
  }
  const total = applications.length;
  const interviews = interviewApplications(applications);
  const offers = applications.filter(isOffer).length;
  const rows = [
    { label:'Applied', count:total },
    { label:'Screened', count:applications.filter(application => statusOf(application) !== 'applied').length },
    { label:'Interviewed', count:interviews },
    { label:'Offers', count:offers }
  ];
  host.innerHTML = rows.map(row => {
    const percent = total ? Math.round(row.count / total * 100) : 0;
    return `<div class="snapshot-row">
      <div class="skill-pct-row"><span>${esc(row.label)}</span><span>${row.count} · ${percent}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
    </div>`;
  }).join('');
}

function paintQuick(){
  const links = [
    ['jobs','Find jobs','Browse current openings'],
    ['demands','Market demand','See hiring trends'],
    ['skills','Build skills','Close your gaps'],
    ['profile','Update profile','Keep details fresh']
  ];
  $('#quickGrid').innerHTML = links.map(([to,title,sub]) => `
    <button class="quick-tile" type="button" data-goto="${to}">
      <span class="quick-ic">${HOME_ICONS[to]}</span><b>${title}</b><small>${sub}</small>
    </button>`).join('');
}

async function loadLiveData(){
  const version = ++requestVersion;
  const status = $('#homeLiveStatus');
  if(status) status.textContent = 'Refreshing your latest placement data…';
  const results = await Promise.allSettled([
    api('/student/me'),
    api('/student/applications'),
    api('/jobs')
  ]);
  if(version !== requestVersion) return;
  const profile = results[0].status === 'fulfilled' ? results[0].value.data : null;
  let applications = null, jobs = null;
  try{ if(results[1].status === 'fulfilled') applications = applicationsFrom(results[1].value); }catch(error){ results[1] = {status:'rejected',reason:error}; }
  try{ if(results[2].status === 'fulfilled') jobs = jobsFrom(results[2].value); }catch(error){ results[2] = {status:'rejected',reason:error}; }
  paintStats(applications, profile);
  paintSkills(profile);
  paintMilestones(applications);
  paintOpenings(jobs, applications);
  paintUpcoming(applications);
  paintFunnel(applications);
  const failed = results.some(result => result.status === 'rejected');
  if(status){
    status.innerHTML = failed
      ? `Some live data could not be refreshed. <button type="button" data-home-refresh>Retry</button>`
      : `Live data · updated ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
  }
  results.forEach((result,index) => {
    if(result.status === 'rejected') console.error(`Home live data request ${index+1} failed:`, result.reason);
  });
}

export function mount(){
  initChatbot();
  paintHero();
  paintQuick();
  window.removeEventListener(USER_EVENT, paintHero);
  window.addEventListener(USER_EVENT, paintHero);
  window.removeEventListener('storage', paintHero);
  window.addEventListener('storage', paintHero);
  $('#askStepBtn')?.addEventListener('click', () => document.getElementById('sbLauncher')?.click());
  $('#homeLiveStatus')?.addEventListener('click', event => {
    if(event.target.closest('[data-home-refresh]')) loadLiveData();
  });
  clearInterval(refreshTimer);
  void loadLiveData();
  refreshTimer = setInterval(() => {
    if(document.visibilityState === 'visible' && document.body.dataset.route === 'home') void loadLiveData();
  }, 60000);
  window.removeEventListener('focus', refreshOnFocus);
  window.addEventListener('focus', refreshOnFocus);
}
