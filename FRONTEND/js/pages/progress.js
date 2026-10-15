/* STEP_UP recruitment progress + secure assessment client.
 * Assessment security is enforced server-side for timing, attempt ownership and scoring.
 * Browser monitoring is a deterrent, not a guarantee against all cheating. */
import { api } from '../core/api.js';
import { esc } from '../core/dom.js';
import * as router from '../core/router.js';
import { connectHrInterview } from '../core/hr-interview.js?v=20261014a';
import { runAiInterview } from '../core/ai-interview.js?v=20261015a';

const ACTIVE_STATUSES = ['selected','shortlisted','interview'];
const statusClass = value => {
  const s = String(value || 'Applied').toLowerCase();
  if (ACTIVE_STATUSES.includes(s)) return 'selected';
  if (['rejected','not selected'].includes(s)) return 'rejected';
  if (s === 'waitlisted') return 'waitlisted';
  return 'applied';
};
function parseRounds(raw) {
  if (Array.isArray(raw)) return raw.map((r,i)=>typeof r==='string'?{name:r}:({...r,name:r.name||r.title||r.roundName||`Round ${i+1}`}));
  const text=String(raw||'').trim(); if(!text || text==='Not specified') return [];
  try { const p=JSON.parse(text); if(Array.isArray(p)) return parseRounds(p); if(p&&Array.isArray(p.rounds)) return parseRounds(p.rounds); } catch {}
  return text.split(/\r?\n/).map(x=>x.replace(/^\s*\d+[.)]\s*/,'').trim()).filter(Boolean).map(name=>({name}));
}
const roundDuration = r => { const v=r.durationMinutes??r.duration??r.duration_minutes; return v?( /^\d+$/.test(String(v))?`${v} min`:String(v)):''; };
const roundType = r => r.type||r.assessmentType||r.assessment_type||r.mode||'';
const isHrInterview = r => /hr interview|human resources/i.test(`${r.name||''} ${roundType(r)}`);
const isAiRound = r => /technical interview|hr interview|human resources|group discussion/i.test(`${r.name||''} ${roundType(r)}`);
const safeMeetingUrl = r => { try { const url=new URL(r.meetingUrl||r.meeting_url||''); return url.protocol==='https:'?url.href:''; } catch { return ''; } };
const roundTopics = r => r.topics||r.skills||r.description||r.instructions||'';
const isTest = r => /aptitude|coding|programming|assessment|online test|written test|quiz|technical test|mcq/i.test(`${r.name||''} ${roundType(r)}`);
function progressMarkup(app) {
  const rounds=parseRounds(app.interview_rounds), status=String(app.status||'Applied'), applicationActive=ACTIVE_STATUSES.includes(status.toLowerCase());
  const attempts=Array.isArray(app.assessment_attempts)?app.assessment_attempts:[];
  const roundReviews=Array.isArray(app.round_reviews)?app.round_reviews:[];
  const passed = index => {
    const round=rounds[index];
    const isTest=/aptitude|coding|programming|assessment|online test|written test|quiz|technical test|mcq/i.test(`${round?.name||''} ${roundType(round||{})}`);
    if(isTest){
      const attempt=attempts.find(x=>Number(x.round_index)===index&&x.status==='submitted');
      return Boolean(attempt&&attempt.company_verified===true&&attempt.company_decision==='Pass');
    }
    return roundReviews.some(review=>Number(review.round_index)===index&&review.decision==='Pass');
  };
  const completed = rounds.filter((r,i)=>passed(i)).length;
  const notSelected=['rejected','not selected'].includes(status.toLowerCase());
  const applicationReviewed=['shortlisted','selected','interview','rejected','not selected','waitlisted'].includes(status.toLowerCase());
  const applicationState=notSelected?'Not selected':status.toLowerCase()==='waitlisted'?'Waitlisted':applicationReviewed?'Completed':'On Going';
  const applicationClass=applicationState==='Completed'?'passed':applicationState==='Waitlisted'?'waitlisted':applicationState==='Not selected'?'rejected':'ready';
  const applicationHistory=Array.isArray(app.status_history)?app.status_history:[];
  const screeningDetails=`<p class="pr-round-topics">Application status: <b>${esc(status)}</b></p><p class="pr-round-topics">Submitted ${esc(app.applied_at?new Date(app.applied_at).toLocaleString():'date unavailable')}. ${applicationReviewed?'The company has recorded a decision on your application.':'Your application is awaiting the company’s review.'}</p>${applicationHistory.length?`<ul class="pr-round-history">${applicationHistory.map(item=>`<li><b>${esc(item.status)}</b> · ${esc(new Date(item.created_at).toLocaleString())}</li>`).join('')}</ul>`:''}`;
  const roundRows=rounds.map((r,i)=>{
    const name=r.name||`Round ${i+1}`, topics=roundTopics(r), meta=[roundType(r),roundDuration(r)].filter(Boolean).join(' · '), test=isTest(r);
    const attempt=attempts.find(a=>Number(a.round_index)===i), roundReview=roundReviews.find(review=>Number(review.round_index)===i);
    const hrInterview=(Array.isArray(app.hr_interviews)?app.hr_interviews:[]).find(item=>Number(item.round_index)===i);
    const aiSession=(Array.isArray(app.ai_interviews)?app.ai_interviews:[]).find(item=>Number(item.round_index)===i);
    const aiRound=isAiRound(r)&&!hrInterview, aiAwaiting=aiRound&&aiSession?.status==='completed'&&!roundReview;
    const done=attempt?.status==='submitted'||Boolean(roundReview)||aiAwaiting;
    const failed=attempt?.company_verified===true&&attempt?.company_decision==='Fail'||roundReview?.decision==='Fail';
    const previousPassed=i===0||passed(i-1), scheduledAt=isHrInterview(r)&&hrInterview?.scheduled_at||r.scheduledAt||r.scheduled_at;
    const scheduledDate=scheduledAt?new Date(scheduledAt):null, notYetScheduled=scheduledDate&&!Number.isNaN(scheduledDate.getTime())&&scheduledDate>Date.now();
    const roundActive=r.active!==false, available=!done&&previousPassed&&roundActive&&!notYetScheduled&&applicationActive;
    const waitingState=!roundActive?'Inactive':notYetScheduled?'Scheduled':'Locked';
    const state=done?(passed(i)?'Completed':(failed?'Not passed':'Awaiting review')):!roundActive?'Inactive':notSelected?'Not proceeding':available?'On Going':applicationActive&&previousPassed?waitingState:'Upcoming';
    const stateClass=done?(passed(i)?'passed':(failed?'completed':'pending')):notSelected?'completed':available?'ready':'upcoming';
    let action='';
    if(test&&done&&attempt?.company_verified===true) action=`<button type="button" class="pr-secondary-action" data-result-id="${esc(attempt.id)}">View score · ${esc(String(attempt.score??0))}%</button>`;
    else if(test&&done) action='<span class="pr-interview-note">Submitted · awaiting company verification</span>';
    else if(test&&available) action=`<button type="button" class="pr-primary-action" data-start-round="${i}" data-application-id="${esc(app.id)}">Start assessment <span>→</span></button>`;
    else if(test) action=`<button type="button" class="pr-secondary-action" disabled title="${previousPassed?'This assessment is not active or has not reached its scheduled time':'Pass the previous round to unlock this assessment'}">${previousPassed?esc(waitingState):'Locked until previous round is passed'}</button>`;
    else if(aiAwaiting) action='<span class="pr-interview-note">AI interview completed · your transcript was shared with the company. Awaiting their decision.</span>';
    else if(aiRound&&available) action=`<button type="button" class="pr-primary-action" data-start-ai="${i}" data-application-id="${esc(app.id)}" data-round-name="${esc(name)}">${aiSession?.status==='in_progress'?'Resume AI interview':'Start AI interview'} <span>→</span></button>`;
    else if(isHrInterview(r)&&hrInterview?.status==='active') action=`<button type="button" class="pr-primary-action" data-join-hr="${esc(hrInterview.id)}">Join one-on-one HR interview <span>→</span></button>`;
    else if(isHrInterview(r)&&hrInterview?.status==='scheduled') action=`<span class="pr-interview-note">HR interview scheduled for ${esc(new Date(hrInterview.scheduled_at).toLocaleString())}. The Join button appears when the company starts the call.</span>`;
    else if(isHrInterview(r)&&hrInterview?.status==='ended') action='<span class="pr-interview-note">This HR interview has ended. Contact the company if a follow-up is needed.</span>';
    else action=`<span class="pr-interview-note">${!applicationActive?'This stage unlocks after shortlisting':!roundActive?'This round is not active yet':(notYetScheduled?`Scheduled for ${esc(scheduledDate.toLocaleString())}`:roundReview?.decision==='Pass'?'The company approved this round.':roundReview?.decision==='Fail'?'The company did not pass this round.':roundReview?.decision==='Needs review'?'The company is reviewing this round.':'Recruiter will schedule this round')}</span>`;
    const externalMeetingUrl=safeMeetingUrl(r);
    if(externalMeetingUrl&&available) action=`<a class="pr-primary-action" href="${esc(externalMeetingUrl)}" target="_blank" rel="noopener noreferrer">Join external meeting <span>↗</span></a>${action}`;
    const key=`${app.id}-${i}`;
    const decisionFeedback=roundReview?.feedback?`<div class="pr-company-feedback"><strong>Company feedback</strong><p>${esc(roundReview.feedback)}</p>${roundReview.reviewed_at?`<small>Updated ${esc(new Date(roundReview.reviewed_at).toLocaleString())}</small>`:''}</div>`:'';
    const details=`${meta?`<p class="pr-round-topics">${esc(meta)}</p>`:''}${topics?`<p class="pr-round-topics">${esc(topics)}</p>`:''}${scheduledDate&&!Number.isNaN(scheduledDate.getTime())?`<p class="pr-round-topics">Scheduled: ${esc(scheduledDate.toLocaleString())}</p>`:''}${test?`<p class="pr-round-topics">Qualifying score: ${esc(r.passingScore?String(r.passingScore).includes('%')?r.passingScore:`${r.passingScore}%`:'60%')}</p>`:''}${decisionFeedback}<div class="pr-round-actions">${roundActive?`<button class="pr-secondary-action" type="button" data-prep-round="${i}">AI preparation plan</button>`:''}${action}</div><div class="pr-prep-panel" data-prep-panel="${i}" hidden><div class="pr-prep-loading">Generating a preparation plan…</div></div>`;
    const stageState=!applicationReviewed?'Upcoming':state;
    const stageStateClass=!applicationReviewed?'upcoming':stateClass;
    return `<li class="pr-round-item ${available&&applicationReviewed?'is-current':''} ${done&&passed(i)?'is-complete':''}"><span class="pr-round-marker">${done&&passed(i)?'✓':i+2}</span><div class="pr-round-content"><button type="button" class="pr-round-toggle" data-toggle-round="${esc(key)}" aria-expanded="false" aria-controls="round-details-${esc(key)}"><span class="pr-round-title"><strong>${esc(name)}</strong><span class="pr-round-state ${stageStateClass}">${esc(stageState)}</span>${meta?`<small>${esc(meta)}</small>`:''}</span><span class="pr-round-chevron" aria-hidden="true">⌄</span></button><div class="pr-round-details" id="round-details-${esc(key)}" data-round-details="${esc(key)}" hidden>${details}</div></div></li>`;
  }).join('');
  const pct=Math.round((completed+(applicationReviewed?1:0))/(rounds.length+1)*100);
  const nextRoundIndex=rounds.findIndex((round,index)=>{
    const previousPassed=index===0||passed(index-1);
    const attempt=attempts.find(item=>Number(item.round_index)===index);
    const review=roundReviews.find(item=>Number(item.round_index)===index);
    const interview=(Array.isArray(app.hr_interviews)?app.hr_interviews:[]).find(item=>Number(item.round_index)===index);
    const scheduledAt=round.scheduledAt||round.scheduled_at;
    const scheduledDate=scheduledAt?new Date(scheduledAt):null;
    const waitingForSchedule=scheduledDate&&!Number.isNaN(scheduledDate.getTime())&&scheduledDate>Date.now();
    const aiDone=(Array.isArray(app.ai_interviews)?app.ai_interviews:[]).some(item=>Number(item.round_index)===index&&item.status==='completed');
    return applicationActive&&previousPassed&&!attempt&&!review&&!interview&&!aiDone&&round.active!==false&&!waitingForSchedule;
  });
  const nextStep=nextRoundIndex>=0
    ? `<div class="pr-next-step is-ready"><span class="pr-next-step-icon" aria-hidden="true">→</span><div><strong>You’re eligible for ${esc(rounds[nextRoundIndex].name||`Round ${nextRoundIndex+1}`)}</strong><p>${isTest(rounds[nextRoundIndex])?'Start the assessment when you’re ready.':isAiRound(rounds[nextRoundIndex])?'Start your AI interview when you’re ready.':'The company can schedule or review this stage.'}</p></div></div>`
    : completed===rounds.length&&rounds.length
      ? '<div class="pr-next-step is-complete"><span class="pr-next-step-icon" aria-hidden="true">✓</span><div><strong>All configured rounds passed</strong><p>Watch for the company’s final decision or next update.</p></div></div>'
      : '';
  const screening=`<li class="pr-round-item ${!applicationReviewed?'is-current':''} ${applicationReviewed?'is-complete':''}"><span class="pr-round-marker">${applicationReviewed?'✓':'1'}</span><div class="pr-round-content"><button type="button" class="pr-round-toggle" data-toggle-round="${esc(`${app.id}-screening`)}" aria-expanded="false" aria-controls="round-details-${esc(`${app.id}-screening`)}"><span class="pr-round-title"><strong>Application Screening</strong><span class="pr-round-state ${applicationClass}">${esc(applicationState)}</span><small>Application review · ${esc(status)}</small></span><span class="pr-round-chevron" aria-hidden="true">⌄</span></button><div class="pr-round-details" id="round-details-${esc(`${app.id}-screening`)}" data-round-details="${esc(`${app.id}-screening`)}" hidden>${screeningDetails}</div></div></li>`;
  const list=`${screening}${roundRows}`;
  const extra=rounds.length?`<div class="pr-integrity-note"><span>盾</span><div><strong>Assessment integrity</strong><p>Timed attempts, server-side scoring and activity flags are recorded. Each online round permits one attempt. Contact the placement team for an approved retake.</p></div></div>`:'<div class="pr-rounds-empty">Further interview stages will appear here once the company announces them.</div>';
  return `<section class="pr-recruitment-panel"><div class="pr-panel-title"><div><span class="pr-eyebrow">YOUR RECRUITMENT JOURNEY</span><h4>Hiring process</h4><p>${esc(app.company_name||'The company')} · ${rounds.length+1} stage${rounds.length===0?'':'s'}</p></div><div class="pr-progress-ring"><strong>${pct}%</strong><small>complete</small></div></div><div class="pr-progress-track"><span style="width:${pct}%"></span></div>${nextStep}<ol class="pr-round-timeline">${list}</ol>${extra}</section>`;
}
function applicationCard(app) {
  const company=app.company_name||'Company', title=app.title||'Job role', status=app.status||'Applied', salary=app.salary||app.stipend||'Not disclosed';
  const selected=ACTIVE_STATUSES.includes(String(status).toLowerCase());
  const roundCount=parseRounds(app.interview_rounds).length;
  const hasRecruitmentRounds=roundCount>0;
  const expanded=hasRecruitmentRounds;
  const history=Array.isArray(app.status_history)?app.status_history:[];
  const historyMarkup=history.length?`<details class="pr-status-history"><summary>Application decision history (${history.length})</summary><ul>${history.map(item=>`<li><b>${esc(item.status)}</b> · ${esc(new Date(item.created_at).toLocaleString())}</li>`).join('')}</ul></details>`:'';
  const detailsId=`application-progress-${String(app.id).replace(/[^a-zA-Z0-9_-]/g,'')}`;
  const appliedDate=app.applied_at?new Date(app.applied_at).toLocaleDateString(): 'Date unavailable';
  return `<article class="card progress-applied-card ${selected?'has-recruitment':''} ${expanded?'is-expanded':''}" data-application-card="${esc(app.id)}">
    <div class="pr-card-accent"></div>
    <button type="button" class="pr-application-summary" data-toggle-progress="${esc(app.id)}" aria-expanded="${expanded}" aria-controls="${esc(detailsId)}">
      <span class="pr-summary-role"><strong>${esc(company)}</strong><span>${esc(title)}</span><em class="pr-summary-round-count">${hasRecruitmentRounds?`${roundCount} recruitment stage${roundCount===1?'':'s'} announced`:selected?'Waiting for the company to announce rounds':'Application submitted · waiting for review'}</em></span>
      <span class="pr-summary-date"><small>Applied</small><strong>${esc(appliedDate)}</strong></span>
      <span class="progress-applied-status ${statusClass(status)}">${esc(status)}</span>
      <span class="pr-summary-expand"><span data-toggle-label>${expanded?'Hide details':'View details'}</span><span class="pr-summary-chevron" aria-hidden="true">${expanded?'⌃':'⌄'}</span></span>
    </button>
    <div class="pr-application-details" id="${esc(detailsId)}" data-progress-content="${esc(app.id)}" ${expanded?'':'hidden'}>
      <div class="progress-applied-meta">
        <div><small>Role</small><strong>${esc(title)}</strong></div>
        <div><small>Compensation</small><strong>${esc(salary)}</strong></div>
        <div><small>Application status</small><strong>${esc(status)}</strong></div>
        <div><small>Job review</small><strong>${esc(app.approval_status||'Approved')}</strong></div>
        <div><small>Applied on</small><strong>${esc(app.applied_at?new Date(app.applied_at).toLocaleString():'Date unavailable')}</strong></div>
      </div>
      ${historyMarkup}
      <div class="pr-inline-progress">${progressMarkup(app)}</div>
    </div>
  </article>`;
}
function openAssessmentShell(title, subtitle) {
  document.querySelector('#prAssessmentModal')?.remove();
  const modal=document.createElement('div'); modal.id='prAssessmentModal'; modal.className='pr-modal-backdrop'; modal.innerHTML=`<section class="pr-assessment-modal" role="dialog" aria-modal="true" aria-labelledby="prAssessmentTitle"><header><div><span class="pr-eyebrow">STEP_UP SECURE ASSESSMENT</span><h2 id="prAssessmentTitle">${esc(title)}</h2><p>${esc(subtitle||'Read the instructions before continuing.')}</p></div><button type="button" class="pr-modal-close" data-close-assessment aria-label="Close">×</button></header><div class="pr-modal-body" id="prAssessmentBody"><div class="pr-loading"><span class="pr-spinner"></span><p>Preparing your assessment securely…</p></div></div></section>`; document.body.append(modal); return modal;
}
function installIntegrityMonitoring(modal, attemptId, stream, onViolation) {
  let active=true, pending=Promise.resolve();
  const flag=reason=>{
    if(!active)return;
    pending=pending.then(async()=>{
      const r=await api(`/student/assessments/${attemptId}/violation`,{method:'POST',body:JSON.stringify({reason})});
      onViolation(r.data||{});
    }).catch(error=>onViolation(null,error));
  };
  const prevent=e=>{ if(active){e.preventDefault(); flag('Blocked clipboard/context-menu action');} };
  const visibility=()=>{if(active&&document.hidden)flag('Assessment tab became hidden');};
  const blur=()=>{if(active)flag('Assessment window lost focus');};
  const fullscreen=()=>{if(active&&!document.fullscreenElement)flag('Exited fullscreen during assessment');};
  const beforeUnload=e=>{if(active){flag('Attempted to leave or reload during assessment');e.preventDefault();e.returnValue='Your assessment is in progress. Leaving may affect your attempt.';return e.returnValue;}};
  const key=e=>{if(active&&((e.ctrlKey||e.metaKey)&&['c','v','x','p','s'].includes(e.key.toLowerCase()))){e.preventDefault();flag('Blocked copy/paste/print/save shortcut');} if(active&&e.key==='Escape'){e.preventDefault();flag('Escape key pressed during assessment');}};
  const reportedTracks=new Set();
  const checkTrack=track=>{
    if((track.readyState==='ended'||track.muted)&&!reportedTracks.has(track)){
      reportedTracks.add(track);
      flag(`${track.kind==='video'?'Camera':'Microphone'} was disabled or disconnected`);
    }
  };
  const tracks=stream.getTracks(), trackListeners=new Map();
  tracks.forEach(track=>{
    const listener=()=>checkTrack(track);
    trackListeners.set(track,listener);
    track.addEventListener('mute',listener);track.addEventListener('ended',listener);
  });
  document.addEventListener('contextmenu',prevent); document.addEventListener('copy',prevent); document.addEventListener('paste',prevent); document.addEventListener('cut',prevent); document.addEventListener('visibilitychange',visibility); window.addEventListener('blur',blur); document.addEventListener('fullscreenchange',fullscreen); window.addEventListener('beforeunload',beforeUnload); document.addEventListener('keydown',key);
  return ()=>{active=false;document.removeEventListener('contextmenu',prevent);document.removeEventListener('copy',prevent);document.removeEventListener('paste',prevent);document.removeEventListener('cut',prevent);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur);document.removeEventListener('fullscreenchange',fullscreen);window.removeEventListener('beforeunload',beforeUnload);document.removeEventListener('keydown',key);tracks.forEach(track=>{const listener=trackListeners.get(track);track.removeEventListener('mute',listener);track.removeEventListener('ended',listener);});};
}
async function startAssessment(applicationId, roundIndex, roundName) {
  const modal=openAssessmentShell(roundName,'Timed assessment · Keep this window active · Your progress is saved by the server.');
  const body=modal.querySelector('#prAssessmentBody');
  let cleanup=()=>{}, stream=null, locked=false, enteredFullscreen=false;
  const exitFullscreen=()=>{
    if(enteredFullscreen&&document.fullscreenElement){
      document.exitFullscreen().catch(error=>console.warn('Could not exit assessment fullscreen',error));
      enteredFullscreen=false;
    }
  };
  const close=()=>{if(locked)return;cleanup();stream?.getTracks().forEach(track=>track.stop());exitFullscreen();modal.remove();};
  modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-close-assessment]'))close();});
  const showPreflight=message=>{
    body.innerHTML=`<div class="pr-proctor-consent"><h3>Before you begin</h3><p>This test requires camera and microphone access to check that both remain active. Video and audio are processed only in this browser: they are not recorded, saved, or sent to the company. Only integrity event counts, descriptions, and timestamps are reported.</p><label><input id="prProctorConsent" type="checkbox"> I understand and agree to the live camera and microphone check.</label><p class="pr-proctor-error" role="alert">${message?esc(message):''}</p><button class="pr-primary-action" id="prBeginAssessment" type="button" disabled>Enable camera &amp; microphone and begin</button><button class="pr-secondary-action" type="button" data-close-assessment>Cancel</button></div>`;
    const consent=body.querySelector('#prProctorConsent'), button=body.querySelector('#prBeginAssessment');
    consent.addEventListener('change',()=>{button.disabled=!consent.checked;});
    button.addEventListener('click',async()=>{
      if(!consent.checked)return;
      locked=true;button.disabled=true;modal.classList.add('is-locked');
      try {
        if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera and microphone access requires a supported browser on HTTPS or localhost.');
        stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});
        try { if(!document.fullscreenElement&&document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen();enteredFullscreen=Boolean(document.fullscreenElement);} } catch {}
        const {data}=await api('/student/assessments/start',{method:'POST',body:JSON.stringify({applicationId:Number(applicationId),roundIndex:Number(roundIndex)})});
        let questions=data.questions||[], answers=data.savedAnswers||{}, current=questions.findIndex(question=>answers[question.id]===undefined), seconds=Math.max(0,Number(data.remainingSeconds??data.durationSeconds??1800)), submitting=false, timer=null;
        if(current<0)current=Math.max(0,questions.length-1);
        const formatTime=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
        const deviceActive=kind=>stream.getTracks().some(track=>track.kind===kind&&track.readyState==='live'&&!track.muted);
        const updateDeviceStatus=()=>{
          const camera=body.querySelector('[data-media-state="video"]'), microphone=body.querySelector('[data-media-state="audio"]');
          if(camera)camera.textContent=deviceActive('video')?'Active':'Unavailable';
          if(microphone)microphone.textContent=deviceActive('audio')?'Active':'Unavailable';
        };
        const mediaStatus=()=>`<aside class="pr-proctor-status"><video class="pr-proctor-preview" autoplay playsinline muted></video><span><b>Camera</b> <span data-media-state="video">${deviceActive('video')?'Active':'Unavailable'}</span> · <b>Microphone</b> <span data-media-state="audio">${deviceActive('audio')?'Active':'Unavailable'}</span><small>Live device check only · no recording</small></span></aside>`;
        const render=()=>{
          const q=questions[current]; if(!q){body.innerHTML='<p>No questions were returned. Please contact the placement team.</p>';return;}
          body.innerHTML=`${mediaStatus()}<div class="pr-test-toolbar"><span>QUESTION ${current+1} OF ${questions.length}</span><span class="pr-test-timer" id="prTestTimer">${formatTime(seconds)}</span></div><div class="pr-test-progress"><span style="width:${((current+1)/questions.length)*100}%"></span></div><div class="pr-question"><span class="pr-question-tag">${esc(q.topic||'Assessment')}</span><h3>${esc(q.question)}</h3><div class="pr-options">${(q.options||[]).map((opt,i)=>`<label class="pr-option ${answers[q.id]===i?'is-picked':''}"><input type="radio" name="prAnswer" value="${i}" ${answers[q.id]===i?'checked':''}><span class="pr-option-letter">${String.fromCharCode(65+i)}</span><span>${esc(opt)}</span></label>`).join('')}</div></div><div class="pr-test-footer"><button class="pr-secondary-action" type="button" id="prPrevious" ${current===0?'disabled':''}>Previous</button><span>${Object.keys(answers).length} answered</span>${current<questions.length-1?'<button class="pr-primary-action" type="button" id="prNext">Next question →</button>':'<button class="pr-primary-action" type="button" id="prSubmit">Submit assessment</button>'}</div><p class="pr-test-warning" role="status">${data.resumed?'Resumed your existing attempt with saved answers and remaining time. ':''}Integrity monitoring is active. Repeated irregularities may automatically submit this attempt.</p>`;
          const preview=body.querySelector('.pr-proctor-preview'); if(preview)preview.srcObject=stream;
          body.querySelectorAll('input[name="prAnswer"]').forEach(el=>el.addEventListener('change',async()=>{answers[q.id]=Number(el.value);try{await api(`/student/assessments/${data.attemptId}/answer`,{method:'PUT',body:JSON.stringify({questionId:q.id,answerIndex:answers[q.id]})});render();}catch(e){const warning=body.querySelector('.pr-test-warning');if(warning)warning.textContent=`Answer could not be saved: ${e.message||'Please retry.'}`;}}));
          body.querySelector('#prPrevious')?.addEventListener('click',()=>{current=Math.max(0,current-1);render();}); body.querySelector('#prNext')?.addEventListener('click',()=>{current=Math.min(questions.length-1,current+1);render();}); body.querySelector('#prSubmit')?.addEventListener('click',()=>submit(false));
        };
        const submit=async auto=>{
          if(submitting)return;submitting=true;
          try {
            const r=await api(`/student/assessments/${data.attemptId}/submit`,{method:'POST',body:JSON.stringify({answers,autoSubmitted:auto})});
            cleanup();stream?.getTracks().forEach(track=>track.stop());exitFullscreen();locked=false;modal.classList.remove('is-locked');
            body.innerHTML=`<div class="pr-result-state"><div class="pr-result-icon">✓</div><span class="pr-eyebrow">ASSESSMENT SUBMITTED</span><h3>Submission recorded</h3><p>Your assessment has been submitted successfully.</p><p class="pr-muted">Your score will appear here after the company verifies your assessment.</p><button class="pr-primary-action" type="button" data-close-assessment>Return to Progress</button></div>`;
            modal.querySelectorAll('[data-close-assessment]').forEach(b=>b.addEventListener('click',()=>{close();loadApplicationsRef?.();}));
          } catch(e) {
            submitting=false;const warning=body.querySelector('.pr-test-warning');if(warning)warning.textContent=`Submission failed: ${e.message||'Please retry.'}`;
          }
        };
        cleanup=installIntegrityMonitoring(modal,data.attemptId,stream,(violation,error)=>{
          const box=body.querySelector('.pr-test-warning');
          if(error){if(box)box.textContent=`Could not report an integrity event: ${error.message||'Please check your connection.'}`;return;}
          if(box)box.textContent=`Integrity irregularity recorded (${violation.violationCount||'updated'}). ${violation.autoSubmitted?'The attempt was submitted due to repeated irregularities.':'Please remain on this assessment screen.'}`;
          if(violation.autoSubmitted)submit(true);
        });
        render();
        timer=setInterval(()=>{seconds--;const el=body.querySelector('#prTestTimer');if(el)el.textContent=formatTime(Math.max(0,seconds));updateDeviceStatus();if(seconds<=0){clearInterval(timer);submit(true);}},1000);
        const stopMonitoring=cleanup;
        cleanup=()=>{clearInterval(timer);stopMonitoring();};
      } catch(e) {
        stream?.getTracks().forEach(track=>track.stop());stream=null;exitFullscreen();locked=false;modal.classList.remove('is-locked');
        showPreflight(e.message||'Could not enable the camera and microphone or start the assessment.');
      }
    });
  };
  showPreflight('');
}
let loadApplicationsRef=null;
let progressRefreshTimer=null;
export function mount() {
  const list=document.getElementById('appliedJobsList'); if(!list)return;
  if(progressRefreshTimer)clearInterval(progressRefreshTimer);
  let requestVersion=0;
  let hasLoadedApplications=false;
  async function loadApplications(){loadApplicationsRef=loadApplications;const version=++requestVersion;if(!hasLoadedApplications)list.innerHTML='<div class="progress-applied-empty"><span class="pr-spinner"></span><p>Loading your recruitment journey…</p></div>';try{const result=await api('/student/applications',{headers:{Accept:'application/json'}});if(version!==requestVersion)return;const expandedState=new Map([...list.querySelectorAll('[data-progress-content]')].map(content=>[String(content.dataset.progressContent),!content.hidden]));const apps=Array.isArray(result.data)?result.data:[];list.innerHTML=apps.length?apps.map(applicationCard).join(''):'<div class="progress-applied-empty"><strong>No applications yet</strong><p>Jobs you apply for will appear here with their recruitment progress.</p><button type="button" class="pr-primary-action" data-open-jobs>Explore jobs →</button></div>';for(const [id,expanded] of expandedState){const content=[...list.querySelectorAll('[data-progress-content]')].find(item=>String(item.dataset.progressContent)===id);const toggle=[...list.querySelectorAll('[data-toggle-progress]')].find(item=>String(item.dataset.toggleProgress)===id);if(content&&toggle){content.hidden=!expanded;toggle.setAttribute('aria-expanded',String(expanded));toggle.querySelector('[data-toggle-label]').textContent=expanded?'Hide details':'View details';toggle.querySelector('.pr-summary-chevron').textContent=expanded?'⌃':'⌄';toggle.closest('.progress-applied-card')?.classList.toggle('is-expanded',expanded);}}hasLoadedApplications=true;}catch(err){console.error(err);if(!hasLoadedApplications)list.innerHTML=`<div class="progress-applied-empty"><strong>Applications could not be loaded</strong><p>${esc(err.message||'Please sign in again and retry.')}</p><button type="button" class="pr-secondary-action" data-retry-progress>Retry</button></div>`;}}
  list.addEventListener('click',async event=>{
    const toggle=event.target.closest('[data-toggle-progress]');if(toggle){const content=list.querySelector(`[data-progress-content="${CSS.escape(toggle.dataset.toggleProgress)}"]`);if(content){const expanded=content.hidden;content.hidden=!expanded;toggle.setAttribute('aria-expanded',String(expanded));toggle.closest('.progress-applied-card')?.classList.toggle('is-expanded',expanded);const label=toggle.querySelector('[data-toggle-label]');if(label)label.textContent=expanded?'Hide details':'View details';const chevron=toggle.querySelector('.pr-summary-chevron');if(chevron)chevron.textContent=expanded?'⌃':'⌄';}return;}
    const roundToggle=event.target.closest('[data-toggle-round]');if(roundToggle){const key=roundToggle.dataset.toggleRound;const details=list.querySelector(`[data-round-details="${CSS.escape(key)}"]`);if(details){const expanded=details.hidden;details.hidden=!expanded;roundToggle.setAttribute('aria-expanded',String(expanded));roundToggle.closest('.pr-round-item')?.classList.toggle('is-expanded',expanded);const chevron=roundToggle.querySelector('.pr-round-chevron');if(chevron)chevron.textContent=expanded?'⌃':'⌄';}return;}
    const prep=event.target.closest('[data-prep-round]');if(prep){const idx=prep.dataset.prepRound, panel=list.querySelector(`[data-prep-panel="${CSS.escape(idx)}"]`);if(!panel)return;panel.hidden=!panel.hidden;if(!panel.hidden&&!panel.dataset.loaded){panel.dataset.loaded='1';try{const card=prep.closest('[data-application-card]');const appId=card?.dataset.applicationCard;const result=await api('/student/assessments/prepare',{method:'POST',body:JSON.stringify({applicationId:Number(appId),roundIndex:Number(idx)})});panel.innerHTML=`<h5>${esc(result.data.title||'Your AI preparation plan')}</h5><p>${esc(result.data.summary||'Focus on the core competencies for this round.')}</p><ul>${(result.data.tasks||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul><p class="pr-muted">AI suggestions are preparation guidance, not a hiring decision.</p>`;}catch(e){panel.innerHTML=`<p>${esc(e.message||'Preparation plan unavailable.')}</p>`;panel.dataset.loaded='';}}return;}
    const startAi=event.target.closest('[data-start-ai]');if(startAi){startAi.disabled=true;try{await runAiInterview({applicationId:Number(startAi.dataset.applicationId),roundIndex:Number(startAi.dataset.startAi),roundName:startAi.dataset.roundName||'AI interview',request:async(path,options)=>{const result=await api(path,options);return result.data;}});loadApplicationsRef?.();}catch(e){alert(e.message||'Could not start the AI interview.');}finally{if(startAi.isConnected)startAi.disabled=false;}return;}
    const joinHr=event.target.closest('[data-join-hr]');if(joinHr){joinHr.disabled=true;try{await connectHrInterview({sessionId:joinHr.dataset.joinHr,role:'student',request:async(path,options)=>{const result=await api(path,options);return result.data;}});loadApplicationsRef?.();}catch(e){alert(e.message||'Could not join the HR interview.');}finally{if(joinHr.isConnected)joinHr.disabled=false;}return;}
    const resultBtn=event.target.closest('[data-result-id]');if(resultBtn){try{const r=await api(`/student/assessments/${resultBtn.dataset.resultId}/result`);const d=r.data;const modal=openAssessmentShell('Assessment result',d.round_name||'Completed round');modal.querySelector('#prAssessmentBody').innerHTML=`<div class="pr-result-state"><div class="pr-result-icon">✓</div><span class="pr-eyebrow">SAVED RESULT</span><h3>${esc(String(d.score))}%</h3><p>${esc(String(d.correct_count))} of ${esc(String(d.total_questions))} correct answers</p><p class="pr-muted">Integrity events recorded: ${esc(String(d.violation_count||0))}${d.auto_submitted?' · Automatically submitted':''}</p><button class="pr-primary-action" data-close-assessment type="button">Close</button></div>`;modal.querySelector('[data-close-assessment]').addEventListener('click',()=>modal.remove());}catch(e){alert(e.message||'Could not load result.');}return;}
    const start=event.target.closest('[data-start-round]');if(start){startAssessment(start.dataset.applicationId,start.dataset.startRound,start.closest('.pr-round-content')?.querySelector('.pr-round-title > strong')?.textContent||'Assessment');return;}
    if(event.target.closest('[data-open-jobs]')){router.navigate('jobs');return;}if(event.target.closest('[data-retry-progress]'))loadApplications();
  });
  loadApplications();
  window.addEventListener('focus',loadApplications);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadApplications();});
  progressRefreshTimer=setInterval(()=>{if(!list.isConnected){clearInterval(progressRefreshTimer);progressRefreshTimer=null;return;}if(!document.hidden)loadApplications();},15000);
}
