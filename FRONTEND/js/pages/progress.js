/* Placement Progress page. Keeps the existing My Applied Jobs layout and
   reveals the job-specific recruitment journey in-place for shortlisted students. */
import { api } from '../core/api.js';
import { esc } from '../core/dom.js';
import * as router from '../core/router.js';

const statusClass = value => {
  const s = String(value || 'Applied').toLowerCase();
  if (['selected','shortlisted','interview'].includes(s)) return 'selected';
  if (['rejected','not selected'].includes(s)) return 'rejected';
  return 'applied';
};
function parseRounds(raw) {
  if (Array.isArray(raw)) return raw.map((r, i) => typeof r === 'string' ? { name:r } : ({...r, name:r.name || r.title || r.roundName || `Round ${i+1}`}));
  const text = String(raw || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parseRounds(parsed);
    if (parsed && Array.isArray(parsed.rounds)) return parseRounds(parsed.rounds);
  } catch {}
  return text.split(/\r?\n/).map(x => x.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean).map(name => ({name}));
}
function duration(round) {
  const value = round.durationMinutes ?? round.duration ?? round.duration_minutes;
  if (!value) return '';
  return /^\d+$/.test(String(value)) ? `${value} min` : String(value);
}
function roundType(round) { return round.type || round.assessmentType || round.assessment_type || round.mode || 'Assessment'; }
function roundTopics(round) { return round.topics || round.skills || round.description || round.instructions || ''; }
function progressMarkup(app) {
  const rounds = parseRounds(app.interview_rounds);
  const status = String(app.status || 'Applied');
  const advanced = ['selected','shortlisted','interview'].includes(status.toLowerCase());
  if (!advanced) return `<div class="progress-rounds-gate"><span class="pr-gate-icon">◷</span><div><strong>Recruitment rounds will appear here when you are shortlisted or selected.</strong><p>Your application status is currently <b>${esc(status)}</b>. Check notifications for company updates.</p></div></div>`;
  if (!rounds.length) return `<div class="progress-rounds-gate"><span class="pr-gate-icon">ⓘ</span><div><strong>You have been shortlisted.</strong><p>The company has not configured interview rounds for this role yet. Your recruitment progress will appear here when they are available.</p></div></div>`;
  const list = rounds.map((r, i) => {
    const name = typeof r === 'string' ? r : r.name || `Round ${i+1}`;
    const topics = typeof r === 'string' ? '' : roundTopics(r);
    const meta = [roundType(typeof r === 'string' ? {} : r), duration(typeof r === 'string' ? {} : r)].filter(Boolean).join(' · ');
    const typeText = `${name} ${meta}`.toLowerCase();
    const practiceRoute = /aptitude|coding|assessment|test|technical/.test(typeText) ? (/coding|programming/.test(typeText) ? 'round2' : 'round1') : '';
    return `<li class="pr-round-item ${i===0?'is-current':''}">
      <span class="pr-round-marker">${i+1}</span><div class="pr-round-content">
        <div class="pr-round-head"><div><h4>${esc(name)}</h4>${meta ? `<small>${esc(meta)}</small>` : ''}</div><span class="pr-round-state ${i===0?'ready':'upcoming'}">${i===0?'Ready to prepare':'Upcoming'}</span></div>
        ${topics ? `<p class="pr-round-topics">${esc(topics)}</p>` : ''}
        ${typeof r === 'object' && r.passingScore ? `<p class="pr-round-topics">Qualifying score: ${esc(r.passingScore)}${String(r.passingScore).includes('%')?'':'%'}</p>` : ''}
        ${i===0 && practiceRoute ? `<button type="button" class="pr-round-action" data-practice="${i}" data-round-name="${esc(name)}" data-round-topics="${esc(topics)}">View round details <span aria-hidden="true">→</span></button><div class="pr-practice-inline" data-practice-panel="${i}" hidden><strong>${esc(name)} preparation</strong><p>${esc(topics || 'Review the role requirements and prepare for this round.')}</p><p class="pr-progress-note">The round is shown here in your Progress page. Live test questions, timer, submission and saved scores must be connected to the assessment engine before this can become a real test.</p></div>` : ''}
      </div></li>`;
  }).join('');
  return `<section class="progress-rounds-panel" aria-label="Recruitment rounds">
    <div class="pr-panel-title"><div><h4>Recruitment journey</h4><p>Rounds configured by ${esc(app.company_name || 'the company')} for this role</p></div><span class="pr-round-count">${rounds.length} round${rounds.length===1?'':'s'}</span></div>
    <ol class="pr-round-timeline">${list}</ol>
    <p class="pr-progress-note">Round outcomes, schedules and scores will be shown here when they are recorded by the assessment system or recruiter. No results have been assumed.</p>
  </section>`;
}
function applicationCard(app) {
  const company = app.company_name || 'Company';
  const title = app.title || 'Job role';
  const status = app.status || 'Applied';
  const salary = app.salary || app.stipend || 'Not disclosed';
  const selected = ['selected','shortlisted','interview'].includes(String(status).toLowerCase());
  return `<article class="card progress-applied-card ${selected?'has-recruitment':''}" data-application-card="${esc(app.id)}">
    <div class="progress-applied-top"><div><h3>${esc(company)}</h3><p>${esc(title)}</p></div><span class="progress-applied-status ${statusClass(status)}">${esc(status)}</span></div>
    <div class="progress-applied-meta"><div><small>Role</small><strong>${esc(title)}</strong></div><div><small>CTC</small><strong>${esc(salary)}</strong></div><div><small>Status</small><strong>${esc(status)}</strong></div></div>
    ${selected ? `<button type="button" class="pr-toggle" aria-expanded="true" data-toggle-progress="${esc(app.id)}">Hide recruitment progress <span>⌃</span></button><div class="pr-inline-progress" data-progress-content="${esc(app.id)}">${progressMarkup(app)}</div>` : `<div class="pr-inline-progress">${progressMarkup(app)}</div>`}
  </article>`;
}
export function mount() {
  const list = document.getElementById('appliedJobsList');
  if (!list) return;
  let requestVersion = 0;
  async function loadApplications() {
    const version = ++requestVersion;
    list.innerHTML = '<div class="progress-applied-empty">Loading your applications…</div>';
    try {
      const result = await api('/student/applications', {headers:{Accept:'application/json'}});
      if (version !== requestVersion) return;
      const applications = Array.isArray(result.data) ? result.data : [];
      if (!applications.length) {
        list.innerHTML = '<div class="progress-applied-empty"><strong>No applications yet</strong><p>Jobs you apply for will appear here, along with their recruitment progress.</p><button type="button" class="pr-round-action" data-open-jobs>Explore jobs →</button></div>';
        return;
      }
      list.innerHTML = applications.map(applicationCard).join('');
    } catch (err) {
      console.error('Progress applications could not be loaded:', err);
      list.innerHTML = `<div class="progress-applied-empty"><strong>Applications could not be loaded</strong><p>${esc(err.message || 'Please sign in again and retry.')}</p><button type="button" class="pr-round-action" data-retry-progress>Retry</button></div>`;
    }
  }
  list.addEventListener('click', event => {
    const toggle = event.target.closest('[data-toggle-progress]');
    if (toggle) {
      const content = list.querySelector(`[data-progress-content="${CSS.escape(toggle.dataset.toggleProgress)}"]`);
      if (content) {
        const hidden = content.hidden;
        content.hidden = !hidden;
        toggle.setAttribute('aria-expanded', String(hidden));
        toggle.innerHTML = hidden ? 'Hide recruitment progress <span>⌃</span>' : 'View recruitment progress <span>⌄</span>';
      }
      return;
    }
    const practice = event.target.closest('[data-practice]');
    if (practice) { const panel=list.querySelector(`[data-practice-panel="${CSS.escape(practice.dataset.practice)}"]`); if(panel){panel.hidden=!panel.hidden;practice.innerHTML=panel.hidden?'View round details <span aria-hidden="true">→</span>':'Hide round details <span aria-hidden="true">↑</span>';} return; }
    if (event.target.closest('[data-open-jobs]')) { router.navigate('jobs'); return; }
    if (event.target.closest('[data-retry-progress]')) loadApplications();
  });
  loadApplications();
}
