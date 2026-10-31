/* ============================================================
   chatbot.js — "Step", the StepUp AI assistant (home page only)

   Features: new chat / refresh, saved history, stop & regenerate,
   retry on error, copy, 👍/👎 feedback, timestamps, typing reveal,
   suggested questions, voice input, download transcript, expand,
   scroll-to-bottom, Enter to send / Shift+Enter for new line.

   Signed-in students use POST /api/student/chat for personalized live
   StepUp context; guests use POST /api/chat. If AI is unavailable it
   falls back to built-in answers so the bot never feels broken.
============================================================ */

import { API_BASE, api, getToken } from '../core/api.js';
import { navigate } from '../core/router.js';
import { getUser } from '../core/user.js';

const ROBOT = 'assets/robot.png';
const STORE = 'stepupChatV1';
const MAX_SAVED = 40;
const MAX_CHARS = 500;

const COPILOT_TASKS = [
  {
    title: 'Build my placement plan',
    detail: 'A practical roadmap for my next steps',
    prompt: 'Make a placement plan for me',
    icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M9 7h7M9 11h7"/>'
  },
  {
    title: 'Find my opportunities',
    detail: 'Explore roles that match my profile',
    prompt: 'Show me jobs I am eligible for',
    icon: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/><path d="M8.5 11h5M11 8.5v5"/>'
  },
  {
    title: 'Explore skill courses',
    detail: 'Find a course that fits my study path',
    prompt: 'Recommend skill courses for me',
    icon: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>'
  },
  {
    title: 'See what is coming up',
    detail: 'Check competitions and important dates',
    prompt: 'Are there upcoming competitions?',
    icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h3"/>'
  }
];
const CHAT_ROUTES = new Set(['#/home', '#/jobs', '#/skills', '#/demands', '#/progress', '#/profile']);
const MISSION_ROUTES = new Set(['#/profile', '#/skills', '#/jobs', '#/home']);

const FALLBACKS = [
  [/resume|cv/i, 'Keep your resume to one page. Lead with projects and skills, use action verbs with numbers (e.g. "cut load time by 30%"), and tailor it to each role. Add your GitHub or portfolio link.'],
  [/interview|hr|round/i, 'For interviews: revise core subjects, practise coding aloud, prepare 3 project stories using STAR (Situation, Task, Action, Result), and research the company. Try mock interviews with friends.'],
  [/skill|demand|learn|role/i, 'Open the Demands and Skills tabs to see roles and skills trending right now. Pick one skill, build a small project with it, and track it in Progress.'],
  [/job|apply|opening/i, 'Head to the Jobs tab to browse openings and apply. Keep your Profile and resume updated first, since companies see them when you apply.'],
  [/placement|prepare|preparation|aptitude/i, 'A simple plan:\n- Aptitude and logic practice daily\n- DSA basics plus one language you know well\n- Two solid projects\n- A polished resume\n- Weekly mock interviews\nTrack it all in Progress.'],
  [/stepup|use|tab|how/i, 'Home shows your overview, Jobs lists openings, Demands shows market trends, Skills helps you build abilities, and Progress tracks your placement journey. Your Profile is under the avatar.'],
  [/hi|hello|hey/i, 'Hi! I am Step. Ask me about placements, resumes, interviews or skills.']
];

const ICON = {
  send:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z"/></svg>',
  stop:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>',
  mic:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  renew: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  mission: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><path d="M12 3 4.5 6v5c0 5 3.2 8.5 7.5 10 4.3-1.5 7.5-5 7.5-10V6L12 3Z"/></svg>',
  down:  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></svg>',
  big:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
  small: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7"/></svg>',
  copy:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>',
  up:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11v9H4v-9zM7 11l4-8a2.5 2.5 0 0 1 2.5 3L13 9h5.5a2 2 0 0 1 2 2.4l-1.3 6.6a2 2 0 0 1-2 1.6H7"/></svg>',
  dn:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 13V4h3v9zM17 13l-4 8a2.5 2.5 0 0 1-2.5-3l.5-3H5.5a2 2 0 0 1-2-2.4l1.3-6.6A2 2 0 0 1 6.800 4H17"/></svg>',
  redo:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  close: '&times;'
};

function fallbackReply(text) {
  const hit = FALLBACKS.find(([re]) => re.test(text));
  return hit ? hit[1] : 'I can help with placement prep, resumes, interviews, skills and using StepUp. Try asking one of those!';
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function clock(t) {
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Small, safe markdown: **bold**, bullet / numbered lines, paragraphs. */
function format(text) {
  let html = '', inList = false;
  for (const raw of esc(text).split('\n')) {
    const line = raw
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, target) => {
        if (CHAT_ROUTES.has(target)) {
          return `<a href="${target}" data-chat-route="${target.slice(2)}">${label}</a>`;
        }
        if (/^https?:\/\/[^\s]+$/i.test(target)) {
          return `<a href="${target}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        }
        return match;
      });
    const m = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (m) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${m[1]}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (line.trim()) html += `<p>${line}</p>`;
    }
  }
  return html + (inList ? '</ul>' : '');
}

function chatStorageKey() {
  try {
    const student = JSON.parse(localStorage.getItem('stepupStudent') || 'null');
    return student?.reg_no ? `${STORE}:${student.reg_no}` : STORE;
  } catch {
    return STORE;
  }
}
function load(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function save(list, key) {
  try { localStorage.setItem(key, JSON.stringify(list.slice(-MAX_SAVED))); } catch { /* storage unavailable */ }
}

function currentMissionWeek() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const year = date.getFullYear();
  const firstDay = new Date(year, 0, 1);
  const week = Math.ceil((((date - firstDay) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function missionProgressKey(week) {
  try {
    const student = JSON.parse(localStorage.getItem('stepupStudent') || 'null');
    const registration = String(student?.reg_no || 'student').replace(/[^a-zA-Z0-9_-]/g, '');
    return `stepupMission:${registration}:${week}`;
  } catch {
    return `stepupMission:student:${week}`;
  }
}

function readMissionProgress(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(saved) ? saved.filter(item => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

function buildMissionTasks(context) {
  const student = context.student || {};
  const tasks = [];
  const skills = Array.isArray(student.skills) ? student.skills : [];
  const opportunities = Array.isArray(context.eligibleOpenJobs) ? context.eligibleOpenJobs : [];
  const skillGaps = Array.isArray(context.skillGapJobs) ? context.skillGapJobs : [];
  const courses = Array.isArray(context.availableCourses) ? context.availableCourses : [];
  const competitions = Array.isArray(context.upcomingCompetitions) ? context.upcomingCompetitions : [];
  const skillGap = skillGaps.find(item => Array.isArray(item.missingSkills) && item.missingSkills.length);

  if (!student.profileCompleted || !skills.length || !student.projectCount) {
    const missing = [
      !student.profileCompleted ? 'complete your profile' : '',
      !skills.length ? 'add your skills' : '',
      !student.projectCount ? 'add a project' : ''
    ].filter(Boolean);
    tasks.push({
      id: 'profile',
      title: 'Get your profile application-ready',
      detail: `This week, ${missing.join(', ')}.`,
      label: 'Update profile',
      href: '#/profile'
    });
  } else {
    tasks.push({
      id: 'profile',
      title: 'Refresh your placement profile',
      detail: 'Keep your experience, projects and links ready for recruiters.',
      label: 'Review profile',
      href: '#/profile'
    });
  }

  if (skillGap) {
    const skill = String(skillGap.missingSkills[0]);
    const course = courses.find(item =>
      `${item.title || ''} ${item.description || ''}`.toLowerCase().includes(skill.toLowerCase())
    );
    tasks.push({
      id: 'skill',
      title: `Practice ${skill}`,
      detail: `A skill gap for ${skillGap.title}${skillGap.company ? ` at ${skillGap.company}` : ''}.`,
      label: course ? 'Open course' : 'Explore Skills',
      href: course && /^https?:\/\//i.test(course.url || '') ? course.url : '#/skills',
      external: Boolean(course && /^https?:\/\//i.test(course.url || ''))
    });
  } else {
    const course = courses[0];
    tasks.push({
      id: 'skill',
      title: course ? `Start ${course.title}` : 'Choose one skill to strengthen',
      detail: course
        ? `${course.provider ? `${course.provider} · ` : ''}Take one step toward a stronger placement profile.`
        : 'Pick a skill you want to improve and build a weekly practice habit.',
      label: course && /^https?:\/\//i.test(course.url || '') ? 'Open course' : 'Explore Skills',
      href: course && /^https?:\/\//i.test(course.url || '') ? course.url : '#/skills',
      external: Boolean(course && /^https?:\/\//i.test(course.url || ''))
    });
  }

  const opportunity = opportunities[0];
  tasks.push({
    id: 'opportunity',
    title: opportunity ? `Review ${opportunity.title}` : 'Explore current opportunities',
    detail: opportunity
      ? `${opportunity.company || 'Eligible employer'}${opportunity.deadline ? ` · apply before ${new Date(opportunity.deadline).toLocaleDateString([], { day: 'numeric', month: 'short' })}` : ''}.`
      : 'Check current openings and review their eligibility details.',
    label: 'View opportunities',
    href: '#/jobs'
  });

  const competition = competitions[0];
  if (competition && /^https?:\/\//i.test(competition.url || '')) {
    tasks.push({
      id: 'deadline',
      title: `Prepare for ${competition.title}`,
      detail: `An upcoming competition${competition.deadline ? ` · deadline ${new Date(competition.deadline).toLocaleDateString([], { day: 'numeric', month: 'short' })}` : ''}.`,
      label: 'View competition',
      href: competition.url,
      external: true
    });
  } else {
    tasks.push({
      id: 'practice',
      title: 'Practice one interview answer',
      detail: 'Build confidence with a short, focused practice session.',
      label: 'Practice with Step',
      prompt: 'Help me practice one placement interview answer. Ask me a question, wait for my answer, then give specific feedback.'
    });
  }
  return tasks;
}

export function initChatbot() {
  if (document.getElementById('sbChat')) return;   // already on the page

  const wrap = document.createElement('div');
  wrap.className = 'sb-chat';
  wrap.id = 'sbChat';
  wrap.innerHTML = `
    <section class="sb-panel" id="sbPanel" role="dialog" aria-label="StepUp assistant" aria-hidden="true">
      <header class="sb-head">
        <span class="sb-avatar-wrap"><img class="sb-avatar" src="${ROBOT}" alt=""></span>
        <div class="sb-title"><small>STEPUP CAREER COPILOT</small><b>Step</b><span><i class="sb-dot"></i><em id="sbStatus">Ready to help</em></span></div>
        <button class="sb-hb sb-mission-toggle" id="sbMission" title="Open weekly mission" aria-label="Open weekly mission" aria-pressed="false" hidden>${ICON.mission}</button>
        <button class="sb-hb" id="sbNew"  title="New chat"            aria-label="Start a new chat">${ICON.renew}</button>
        <button class="sb-hb" id="sbSave" title="Download chat"       aria-label="Download this chat">${ICON.down}</button>
        <button class="sb-hb" id="sbBig"  title="Expand"              aria-label="Expand chat window">${ICON.big}</button>
        <button class="sb-hb sb-x" id="sbClose" title="Close"         aria-label="Close chat">${ICON.close}</button>
      </header>
      <div class="sb-confirm" id="sbConfirm" hidden>
        <span>Start a new chat? This clears the current conversation.</span>
        <button type="button" id="sbNo">Cancel</button>
        <button type="button" id="sbYes" class="go">New chat</button>
      </div>
      <div class="sb-body" id="sbBody" aria-live="polite"></div>
      <button class="sb-jump" id="sbJump" aria-label="Scroll to latest message" hidden>↓</button>
      <form class="sb-form" id="sbForm" autocomplete="off">
        <button type="button" class="sb-mic" id="sbMic" aria-label="Speak your question" title="Speak" hidden>${ICON.mic}</button>
        <div class="sb-field">
          <textarea id="sbInput" rows="1" maxlength="${MAX_CHARS}" placeholder="Ask Step anything…" aria-label="Message"></textarea>
          <small id="sbCount" hidden></small>
        </div>
        <button type="submit" class="sb-send" id="sbSend" aria-label="Send">${ICON.send}</button>
      </form>
    </section>
    <button class="sb-launcher" id="sbLauncher" aria-label="Chat with Step, the StepUp assistant" aria-expanded="false">
      <span class="sb-bubble">Your placement copilot</span>
      <img src="${ROBOT}" alt="">
    </button>`;
  document.body.appendChild(wrap);

  const $ = id => wrap.querySelector('#' + id);
  const panel = $('sbPanel'), body = $('sbBody'), input = $('sbInput'), form = $('sbForm');
  const launcher = $('sbLauncher'), sendBtn = $('sbSend');
  const missionButton = $('sbMission');
  const jump = $('sbJump'), confirmBar = $('sbConfirm'), count = $('sbCount'), status = $('sbStatus');

  const historyKey = chatStorageKey();
  let history = load(historyKey); // [{role, content, t, fb?, offline?}]
  let busy = false;
  let abort = null;              // AbortController for the request in flight
  let revealTimer = null;        // typing-reveal interval
  let revealing = null;          // {row, textEl, full, item}
  let missionContext = null;
  let missionTasks = [];
  let missionDone = new Set();
  let missionKey = '';
  let missionLoading = false;
  let missionError = '';
  let showingMission = false;

  /* ---------- rendering ---------- */
  const nearBottom = () => body.scrollHeight - body.scrollTop - body.clientHeight < 60;
  const toBottom = (smooth = true) => body.scrollTo({ top: body.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });

  function bubble(role, html, item) {
    const row = document.createElement('div');
    row.className = 'sb-msg ' + role;
    if (role === 'bot') row.insertAdjacentHTML('beforeend', `<img src="${ROBOT}" alt="">`);
    const col = document.createElement('div');
    col.className = 'sb-col';
    const b = document.createElement('div');
    b.className = 'sb-text';
    b.innerHTML = html;
    col.appendChild(b);
    if (item) {
      const meta = document.createElement('div');
      meta.className = 'sb-meta';
      meta.innerHTML = `<time>${clock(item.t)}</time>${item.offline ? '<span class="sb-off" title="The AI service was unreachable, so this is a built-in answer">offline answer</span>' : ''}`;
      col.appendChild(meta);
    }
    row.appendChild(col);
    body.appendChild(row);
    return row;
  }

  function actionsFor(row, item, isLast) {
    const meta = row.querySelector('.sb-meta');
    const bar = document.createElement('span');
    bar.className = 'sb-acts';
    bar.innerHTML = `
      <button data-a="copy" title="Copy" aria-label="Copy answer">${ICON.copy}</button>
      <button data-a="up" title="Helpful" aria-label="Helpful" class="${item.fb === 'up' ? 'on' : ''}">${ICON.up}</button>
      <button data-a="down" title="Not helpful" aria-label="Not helpful" class="${item.fb === 'down' ? 'on' : ''}">${ICON.dn}</button>
      ${isLast ? `<button data-a="redo" title="Regenerate" aria-label="Regenerate answer">${ICON.redo}</button>` : ''}`;
    meta.appendChild(bar);
    bar.addEventListener('click', e => {
      const btn = e.target.closest('button'); if (!btn) return;
      const a = btn.dataset.a;
      if (a === 'copy') {
        (navigator.clipboard ? navigator.clipboard.writeText(item.content) : Promise.reject()).catch(() => {}).finally(() => {
          btn.classList.add('on'); setTimeout(() => btn.classList.remove('on'), 1200);
        });
      } else if (a === 'up' || a === 'down') {
        item.fb = item.fb === a ? undefined : a;
        bar.querySelectorAll('[data-a=up],[data-a=down]').forEach(x => x.classList.toggle('on', x.dataset.a === item.fb));
        save(history, historyKey);
      } else if (a === 'redo') regenerate();
    });
  }

  function missionMarkup(compact = false) {
    if (missionLoading && !missionContext) {
      return `<section class="sb-mission sb-mission-loading" aria-live="polite">
        <div class="sb-mission-head"><span class="sb-mission-kicker">THIS WEEK'S PLACEMENT MISSION</span><span class="sb-mission-week">${esc(currentMissionWeek())}</span></div>
        <p>Building a plan around your StepUp profile and live opportunities…</p>
        <div class="sb-mission-skeleton"></div><div class="sb-mission-skeleton short"></div>
      </section>`;
    }
    if (missionError && !missionContext) {
      return `<section class="sb-mission sb-mission-error" role="status">
        <div class="sb-mission-head"><span class="sb-mission-kicker">THIS WEEK'S PLACEMENT MISSION</span></div>
        <p>${esc(missionError)}</p>
        <button type="button" class="sb-mission-retry" data-mission-retry>Try again</button>
      </section>`;
    }
    if (!missionContext || !missionTasks.length) return '';

    const completed = missionTasks.filter(task => missionDone.has(task.id)).length;
    const percent = Math.round(completed / missionTasks.length * 100);
    const taskRows = missionTasks.map(task => {
      const done = missionDone.has(task.id);
      const action = task.prompt
        ? `<button type="button" class="sb-mission-action" data-mission-prompt="${esc(task.prompt)}">${esc(task.label)}</button>`
        : task.external
          ? `<a class="sb-mission-action" href="${esc(task.href)}" target="_blank" rel="noopener noreferrer">${esc(task.label)} <span aria-hidden="true">↗</span></a>`
          : `<a class="sb-mission-action" href="${esc(task.href)}" data-mission-route="${esc(task.href.slice(2))}">${esc(task.label)} <span aria-hidden="true">→</span></a>`;
      return `<article class="sb-mission-task${done ? ' is-done' : ''}">
        <button type="button" class="sb-mission-check" data-mission-toggle="${esc(task.id)}" aria-label="${done ? 'Mark incomplete' : 'Mark complete'}: ${esc(task.title)}" aria-pressed="${done}">${done ? '✓' : ''}</button>
        <div class="sb-mission-task-copy"><b>${esc(task.title)}</b><p>${esc(task.detail)}</p>${action}</div>
      </article>`;
    }).join('');

    return `<section class="sb-mission${compact ? ' sb-mission-compact' : ''}" aria-label="Weekly placement mission">
      <div class="sb-mission-head">
        <div><span class="sb-mission-kicker">THIS WEEK'S PLACEMENT MISSION</span><b>${completed === missionTasks.length ? 'Mission complete!' : 'Small steps. Real progress.'}</b></div>
        <span class="sb-mission-week">${esc(currentMissionWeek())}</span>
      </div>
      <div class="sb-mission-progress">
        <div><span>${completed} of ${missionTasks.length} steps complete</span><b>${percent}%</b></div>
        <div class="sb-mission-track" role="progressbar" aria-label="Weekly mission progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>
      </div>
      <div class="sb-mission-list">${taskRows}</div>
      <p class="sb-mission-footnote">${missionError ? esc(missionError) : 'Your checklist saves in this browser and resets with your new weekly mission.'}</p>
    </section>`;
  }

  function missionView() {
    return `<div class="sb-mission-screen">
      <div class="sb-mission-screen-top"><span class="sb-mission-screen-icon">${ICON.mission}</span><div><small>YOUR PERSONAL ROADMAP</small><h2>Placement Mission</h2></div></div>
      <p class="sb-mission-screen-intro">A focused checklist built from your profile and live StepUp opportunities. Pick one step and keep moving forward.</p>
      ${missionMarkup()}
    </div>`;
  }

  async function loadMission() {
    if (!getToken() || missionLoading) return;
    if (missionContext && missionKey !== missionProgressKey(currentMissionWeek())) {
      missionContext = null;
      missionTasks = [];
      missionDone = new Set();
      missionKey = '';
    }
    missionLoading = true;
    missionError = '';
    missionButton.hidden = false;
    if (!missionContext && !history.length) renderAll();
    try {
      const response = await api('/student/mission');
      missionContext = response.data;
      missionTasks = buildMissionTasks(missionContext);
      missionKey = missionProgressKey(currentMissionWeek());
      missionDone = readMissionProgress(missionKey);
      missionError = '';
    } catch (error) {
      missionError = error.message || 'Could not load your weekly mission.';
    } finally {
      missionLoading = false;
      renderAll();
    }
  }

  function toggleMissionTask(taskId) {
    if (!missionTasks.some(task => task.id === taskId) || !missionKey) return;
    if (missionDone.has(taskId)) missionDone.delete(taskId);
    else missionDone.add(taskId);
    try {
      localStorage.setItem(missionKey, JSON.stringify([...missionDone]));
    } catch {
      missionError = 'Could not save mission progress in this browser.';
    }
    renderAll();
  }

  function renderAll() {
    body.innerHTML = '';
    const signedIn = Boolean(getToken());
    missionButton.hidden = !signedIn;
    missionButton.setAttribute('aria-pressed', String(showingMission));
    missionButton.title = showingMission ? 'Return to chat' : 'Open weekly mission';
    missionButton.setAttribute('aria-label', showingMission ? 'Return to chat' : 'Open weekly mission');
    if (showingMission && signedIn) {
      body.innerHTML = missionView();
    } else if (!history.length) {
      const personalized = Boolean(getToken());
      const name = personalized ? getUser().first : '';
      body.innerHTML = `
        <section class="sb-welcome">
          <div class="sb-welcome-top">
            <div class="sb-orb" aria-hidden="true"><span></span><img src="${ROBOT}" alt=""></div>
            <span class="sb-welcome-badge">${personalized ? 'PERSONALIZED FOR YOU' : 'YOUR CAREER, IN FOCUS'}</span>
          </div>
          <p class="sb-eyebrow">YOUR STEPUP PLACEMENT COPILOT</p>
          <h2>${name ? `Hey ${esc(name)},` : 'Meet your next step.'}<br><span>let’s make it count.</span></h2>
          <p class="sb-welcome-copy">${personalized
            ? 'Turn your goals into a clear plan. Step can use your study path, skills and live StepUp opportunities to make its guidance relevant.'
            : 'Get clear, practical guidance for placements, interviews, resumes and skills. Sign in to unlock suggestions based on your profile and live opportunities.'}</p>
        </section>
        ${personalized ? missionMarkup(true) : ''}
        <div class="sb-task-heading"><span>What would you like to work on?</span><small>${personalized ? 'PICK A STARTING POINT' : 'QUICK START'}</small></div>
        <div class="sb-task-grid">${COPILOT_TASKS.map((task, index) => `
          <button type="button" class="sb-task" data-chat-prompt="${esc(task.prompt)}">
            <span class="sb-task-icon sb-task-icon-${index + 1}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${task.icon}</svg></span>
            <span class="sb-task-copy"><b>${esc(task.title)}</b><small>${esc(task.detail)}</small></span>
            <span class="sb-task-arrow" aria-hidden="true">↗</span>
          </button>`).join('')}</div>
        <p class="sb-privacy-note"><span aria-hidden="true">✦</span> ${personalized
          ? 'Personalized answers use your study details, not your name or contact information.'
          : 'Your assistant for the StepUp placement journey.'}</p>`;
    } else {
      history.forEach((m, i) => {
        const row = bubble(m.role === 'user' ? 'user' : 'bot', m.role === 'user' ? esc(m.content) : format(m.content), m);
        if (m.role === 'assistant') actionsFor(row, m, i === history.length - 1);
      });
    }
    if (history.length) toBottom(false);
    else body.scrollTop = 0;
    updateJump();
  }

  function updateJump() { jump.hidden = !history.length || nearBottom(); }

  /* ---------- sending ---------- */
  function setBusy(state) {
    busy = state;
    sendBtn.innerHTML = state ? ICON.stop : ICON.send;
    sendBtn.classList.toggle('stop', state);
    sendBtn.setAttribute('aria-label', state ? 'Stop generating' : 'Send');
    status.textContent = state ? 'Thinking through it…' : 'Ready to help';
  }

  function typingRow() {
    return bubble('bot', '<span class="sb-typing"><i></i><i></i><i></i></span>');
  }

  async function ask(signal) {
    const local = new AbortController();
    const token = getToken();
    const endpoint = token ? '/student/chat' : '/chat';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; local.abort(); }, 35000);   // never spin forever
    signal.addEventListener('abort', () => local.abort());
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: local.signal
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && token) {
        return { text: 'Your sign-in session has expired. Sign in again to get personalized answers based on current StepUp data.', offline: false };
      }
      if (!res.ok || !data.reply) throw new Error(data.error || 'No reply');
      return { text: data.reply, offline: false };
    } catch (err) {
      if (timedOut) return { text: `${token ? 'I could not load your live StepUp data in time. ' : ''}Sorry, I am taking too long to answer right now. Please try again in a moment (tap the refresh arrow under this message).`, offline: true };
      if (err.name === 'AbortError') throw err;
      const last = history[history.length - 1];
      const prefix = token ? 'I could not reach your live StepUp data just now, so this is general guidance. ' : '';
      return { text: prefix + fallbackReply(last ? last.content : ''), offline: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async function respond() {
    setBusy(true);
    const typing = typingRow();
    toBottom();
    abort = new AbortController();
    let result;
    try {
      result = await ask(abort.signal);
    } catch {            // stopped while waiting
      typing.remove(); abort = null; setBusy(false); input.focus(); renderAll(); return;
    }
    abort = null;
    typing.remove();

    const item = { role: 'assistant', content: result.text, t: Date.now(), offline: result.offline };
    history.push(item);
    save(history, historyKey);

    const row = bubble('bot', '', item);
    const textEl = row.querySelector('.sb-text');
    const words = result.text.split(/(\s+)/);
    let i = 0;
    revealing = { row, item, textEl };
    const keep = nearBottom();
    revealTimer = setInterval(() => {
      i = Math.min(words.length, i + 3);
      textEl.innerHTML = format(words.slice(0, i).join(''));
      if (keep) toBottom(false);
      if (i >= words.length) finishReveal(true);
    }, 28);
  }

  function finishReveal(complete) {
    clearInterval(revealTimer); revealTimer = null;
    if (revealing) {
      const { row, item, textEl } = revealing;
      if (!complete) {            // stopped part-way: keep what has been shown
        const shown = textEl.innerText.trim();
        item.content = shown ? shown + ' …' : item.content;
      }
      textEl.innerHTML = format(item.content);
      actionsFor(row, item, true);
      save(history, historyKey);
      revealing = null;
    }
    setBusy(false);
    updateJump();
  }

  function stop() {
    if (abort) abort.abort();
    else if (revealing) finishReveal(false);
  }

  function send(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    history.push({ role: 'user', content: text, t: Date.now() });
    save(history, historyKey);
    input.value = ''; autosize();
    renderAll();
    respond();
  }

  function regenerate() {
    if (busy) return;
    while (history.length && history[history.length - 1].role === 'assistant') history.pop();
    if (!history.length) return;
    save(history, historyKey);
    renderAll();
    respond();
  }

  /* ---------- new chat / refresh ---------- */
  function newChat() {
    stop();
    history = [];
    save(history, historyKey);
    confirmBar.hidden = true;
    renderAll();
    input.value = ''; autosize();
    input.focus();
  }
  function askNew() {
    if (!history.length) { newChat(); return; }   // nothing to lose: refresh straight away
    confirmBar.hidden = false;
    $('sbYes').focus();
  }

  /* ---------- download ---------- */
  function download() {
    if (!history.length) return;
    const lines = history.map(m => `[${new Date(m.t).toLocaleString()}] ${m.role === 'user' ? 'You' : 'Step'}:\n${m.content}\n`);
    const blob = new Blob([`StepUp chat with Step\n\n${lines.join('\n')}`], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'stepup-chat.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- input helpers ---------- */
  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 110) + 'px';
    const n = input.value.length;
    count.hidden = n < MAX_CHARS * 0.8;
    count.textContent = `${n}/${MAX_CHARS}`;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const mic = $('sbMic'); mic.hidden = false;
    let rec = null;
    mic.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = navigator.language || 'en-IN'; rec.interimResults = true;
      mic.classList.add('on');
      const base = input.value ? input.value + ' ' : '';
      rec.onresult = e => { input.value = base + [...e.results].map(r => r[0].transcript).join(''); autosize(); };
      rec.onend = rec.onerror = () => { mic.classList.remove('on'); rec = null; input.focus(); };
      rec.start();
    });
  }

  /* ---------- open / close ---------- */
  function open(state) {
    wrap.classList.toggle('open', state);
    panel.setAttribute('aria-hidden', String(!state));
    launcher.setAttribute('aria-expanded', String(state));
    if (state) {
      if (!body.children.length) renderAll();
      if (getToken() && (!missionContext || missionKey !== missionProgressKey(currentMissionWeek()))) void loadMission();
      setTimeout(() => {
        if (history.length) toBottom(false);
        else body.scrollTop = 0;
        if (showingMission) body.scrollTop = 0;
        input.focus();
      }, 280);
    }
  }

  /* ---------- events ---------- */
  launcher.addEventListener('click', () => open(!wrap.classList.contains('open')));
  $('sbClose').addEventListener('click', () => open(false));
  missionButton.addEventListener('click', () => {
    showingMission = !showingMission;
    renderAll();
    if (showingMission && !missionContext) void loadMission();
    body.scrollTop = 0;
  });
  $('sbNew').addEventListener('click', askNew);
  $('sbYes').addEventListener('click', newChat);
  $('sbNo').addEventListener('click', () => { confirmBar.hidden = true; input.focus(); });
  $('sbSave').addEventListener('click', download);
  $('sbBig').addEventListener('click', () => {
    const big = wrap.classList.toggle('big');
    $('sbBig').innerHTML = big ? ICON.small : ICON.big;
    $('sbBig').title = big ? 'Shrink' : 'Expand';
  });
  jump.addEventListener('click', () => toBottom());
  body.addEventListener('scroll', updateJump, { passive: true });
  body.addEventListener('click', e => {
    const toggle = e.target.closest('[data-mission-toggle]');
    if (toggle) {
      toggleMissionTask(toggle.dataset.missionToggle);
      return;
    }
    if (e.target.closest('[data-mission-retry]')) {
      void loadMission();
      return;
    }
    const task = e.target.closest('[data-chat-prompt],[data-mission-prompt]');
    if (task) {
      showingMission = false;
      send(task.dataset.chatPrompt || task.dataset.missionPrompt);
      return;
    }
    const missionLink = e.target.closest('a[data-mission-route]');
    if (missionLink && MISSION_ROUTES.has(missionLink.getAttribute('href'))) {
      e.preventDefault();
      navigate(missionLink.dataset.missionRoute);
      return;
    }
  });
  form.addEventListener('submit', e => { e.preventDefault(); if (busy) stop(); else send(input.value); });
  body.addEventListener('click', e => {
    const link = e.target.closest('a[data-chat-route]');
    if (!link || !CHAT_ROUTES.has(link.getAttribute('href'))) return;
    e.preventDefault();
    navigate(link.dataset.chatRoute);
  });
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!busy) send(input.value); }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !wrap.classList.contains('open')) return;
    if (!confirmBar.hidden) confirmBar.hidden = true; else open(false);
  });

  renderAll();
}
