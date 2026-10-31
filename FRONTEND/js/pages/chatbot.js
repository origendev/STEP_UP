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
  },
  {
    title: 'Try a mock interview',
    detail: 'One fresh question at a time, with gentle feedback',
    mockInterview: true,
    icon: '<path d="M12 3a6 6 0 0 0-6 6v3a6 6 0 0 0 12 0V9a6 6 0 0 0-6-6Z"/><path d="M4 12v1a8 8 0 0 0 16 0v-1M12 21v-3M9 21h6"/><path d="M9.5 9.5h.01M14.5 9.5h.01"/>'
  },
  {
    title: 'Take a skill challenge',
    detail: 'Three quick questions, no pressure',
    skillChallenge: true,
    icon: '<path d="M9 3h6M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3"/><path d="M8 15h8M9 18h.01M15 18h.01"/>'
  }
];
const CHAT_ROUTES = new Set(['#/home', '#/jobs', '#/skills', '#/demands', '#/progress', '#/profile']);
const MISSION_ROUTES = new Set(['#/profile', '#/skills', '#/jobs', '#/home', '#/progress']);
const MOCK_QUESTIONS = [
  { id: 'intro', text: 'Tell me about yourself and one thing you are proud of learning recently.' },
  { id: 'project', text: 'Walk me through a project you enjoyed building. What was your contribution?' },
  { id: 'challenge', text: 'Describe a tricky problem you faced in a project and how you worked through it.' },
  { id: 'teamwork', text: 'Tell me about a time you worked with others to get something done.' },
  { id: 'feedback', text: 'What is a piece of feedback that helped you improve, and what did you do with it?' },
  { id: 'learning', text: 'How do you approach learning a tool or topic that is completely new to you?' },
  { id: 'priorities', text: 'When you have several deadlines at once, how do you decide what to do first?' },
  { id: 'setback', text: 'Tell me about a setback you experienced. What did you learn from it?' },
  { id: 'strength', text: 'What is one strength you would bring to a team, and when have you used it?' },
  { id: 'motivation', text: 'What kind of work or problem makes you feel motivated to do your best?' },
  { id: 'conflict', text: 'How would you handle a disagreement with a teammate about how to solve a problem?' },
  { id: 'initiative', text: 'Tell me about a time you took initiative, even when nobody asked you to.' },
  { id: 'debugging', text: 'A feature works on your machine but fails for a teammate. How would you investigate?' },
  { id: 'testing', text: 'How would you check that a small change has not broken something that used to work?' },
  { id: 'api', text: 'In simple terms, what happens when an app makes a request to an API?' },
  { id: 'database', text: 'When might you choose a relational database for an application?' },
  { id: 'security', text: 'What is one simple step a developer can take to protect user data?' },
  { id: 'tradeoff', text: 'Tell me about a technical choice you made for a project and why you chose it.' },
  { id: 'ownership', text: 'If you realized a task might miss its deadline, what would you do?' },
  { id: 'curiosity', text: 'What is something in technology you are curious about right now, and why?' },
  { id: 'adapt', text: 'Describe a time a plan changed unexpectedly. How did you adapt?' },
  { id: 'explain', text: 'How would you explain a technical idea you know well to someone new to it?' },
  { id: 'quality', text: 'What does “good quality” mean to you when you build a feature?' },
  { id: 'growth', text: 'What is one skill you would like to strengthen, and how are you working on it?' }
];
const SKILL_CHALLENGES = [
  { id: 'http-status', topic: 'Web basics', question: 'What does an HTTP 404 response usually mean?', options: ['The page or resource was not found', 'The server is healthy', 'The user is signed out'], answer: 0, hint: 'Think of what happens when you follow a broken link.', explanation: 'A 404 means the requested resource could not be found.' },
  { id: 'http-post', topic: 'Web basics', question: 'Which HTTP method is commonly used to submit new data?', options: ['GET', 'POST', 'TRACE'], answer: 1, hint: 'It is often used for forms that create something.', explanation: 'POST commonly sends data to create or process a resource.' },
  { id: 'api', topic: 'Web basics', question: 'What is an API mainly used for?', options: ['Letting software systems communicate', 'Compressing every image', 'Replacing a database'], answer: 0, hint: 'Think about how a frontend requests information from a backend.', explanation: 'An API defines a way for software systems to communicate.' },
  { id: 'sql-filter', topic: 'Data basics', question: 'In SQL, which clause filters rows to match a condition?', options: ['WHERE', 'ORDER BY', 'CREATE'], answer: 0, hint: 'It reads like a question: keep rows ___ this condition.', explanation: 'WHERE filters rows using a condition.' },
  { id: 'sql-sort', topic: 'Data basics', question: 'Which SQL clause sorts query results?', options: ['GROUP ONLY', 'ORDER BY', 'SORT ROW'], answer: 1, hint: 'It names a field and the direction you want.', explanation: 'ORDER BY sorts results by one or more columns.' },
  { id: 'git-commit', topic: 'Developer workflow', question: 'What does a Git commit represent?', options: ['A saved snapshot of changes', 'A new programming language', 'A deployed server'], answer: 0, hint: 'It records a set of changes in version history.', explanation: 'A commit records a snapshot of changes in a repository.' },
  { id: 'git-branch', topic: 'Developer workflow', question: 'Why create a Git branch for a feature?', options: ['To work on changes separately', 'To erase the project history', 'To make a database backup'], answer: 0, hint: 'It keeps feature work separate until it is ready to merge.', explanation: 'Branches isolate work so changes can be developed and reviewed safely.' },
  { id: 'debug', topic: 'Problem solving', question: 'A bug appears only sometimes. What is a useful first step?', options: ['Change several things at once', 'Try to reproduce it and note the conditions', 'Delete the test'], answer: 1, hint: 'A repeatable example makes a problem easier to investigate.', explanation: 'Reproducing the bug and recording its conditions helps narrow down the cause.' },
  { id: 'testing', topic: 'Problem solving', question: 'What is a regression test meant to catch?', options: ['A feature that used to work but broke after a change', 'A typo in a meeting invite', 'A slow internet connection'], answer: 0, hint: 'It checks for an old behavior that changed unexpectedly.', explanation: 'Regression tests help ensure new changes do not break existing behavior.' },
  { id: 'security-password', topic: 'Safer software', question: 'How should an application store user passwords?', options: ['As readable text', 'As a secure salted password hash', 'In a public profile field'], answer: 1, hint: 'The application should not be able to read the original password back.', explanation: 'Passwords should be stored using a strong salted password-hashing algorithm.' },
  { id: 'teamwork', topic: 'Work habits', question: 'A teammate is blocked by a task you understand. What is a helpful response?', options: ['Offer to explain or pair for a few minutes', 'Wait until the deadline passes', 'Take over without asking'], answer: 0, hint: 'Good teamwork helps while still respecting the other person.', explanation: 'Offering a quick explanation or pairing is collaborative and keeps the teammate involved.' },
  { id: 'feedback', topic: 'Work habits', question: 'You receive feedback on a project. What is a constructive next step?', options: ['Ask a clarifying question and try one improvement', 'Ignore all of it', 'Assume it is a personal criticism'], answer: 0, hint: 'Focus on the work and make the feedback actionable.', explanation: 'Clarifying feedback and applying one useful change turns it into learning.' }
];

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

function mockInterviewStorageKey() {
  try {
    const student = JSON.parse(localStorage.getItem('stepupStudent') || 'null');
    const registration = String(student?.reg_no || 'student').replace(/[^a-zA-Z0-9_-]/g, '');
    return `stepupMockInterview:${registration}`;
  } catch {
    return 'stepupMockInterview:student';
  }
}

function readMockInterviewState(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    const validIds = new Set(MOCK_QUESTIONS.map(question => question.id));
    return {
      asked: new Set(Array.isArray(saved.asked) ? saved.asked.filter(id => validIds.has(id)) : []),
      active: saved.active === true,
      awaitingNext: saved.awaitingNext === true,
      answers: Number.isSafeInteger(saved.answers) && saved.answers >= 0 ? saved.answers : 0
    };
  } catch {
    return { asked: new Set(), active: false, awaitingNext: false, answers: 0 };
  }
}

function studentFeatureStorageKey(feature) {
  try {
    const student = JSON.parse(localStorage.getItem('stepupStudent') || 'null');
    const registration = String(student?.reg_no || 'student').replace(/[^a-zA-Z0-9_-]/g, '');
    return `stepup${feature}:${registration}`;
  } catch {
    return `stepup${feature}:student`;
  }
}

function readSkillChallengeState(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    const validIds = new Set(SKILL_CHALLENGES.map(challenge => challenge.id));
    return {
      asked: new Set(Array.isArray(saved.asked) ? saved.asked.filter(id => validIds.has(id)) : []),
      answered: Number.isSafeInteger(saved.answered) && saved.answered >= 0 ? saved.answered : 0
    };
  } catch {
    return { asked: new Set(), answered: 0 };
  }
}

function readStudentWins(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(saved)
      ? saved.filter(item => item && typeof item.id === 'string' && !item.id.startsWith('mission-first-step:') && !item.id.startsWith('mission-complete:'))
      : [];
  } catch {
    return [];
  }
}

function readMissionProgress(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) {
      return {
        done: new Set(),
        inProgress: new Set(saved.filter(item => typeof item === 'string')),
        verification: new Map()
      };
    }
    if (!saved || typeof saved !== 'object') {
      return { done: new Set(), inProgress: new Set(), verification: new Map() };
    }
    const done = new Set(Array.isArray(saved.done) ? saved.done.filter(item => typeof item === 'string') : []);
    const inProgress = new Set(Array.isArray(saved.inProgress) ? saved.inProgress.filter(item => typeof item === 'string') : []);
    const verification = new Map(
      Object.entries(saved.verification || {}).filter(([, value]) => value === 'profile')
    );
    for (const id of done) inProgress.delete(id);
    return { done, inProgress, verification };
  } catch {
    return { done: new Set(), inProgress: new Set(), verification: new Map() };
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
      href: '#/profile',
      verification: 'profile'
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
    label: 'Start mock interview',
    mockInterview: true
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
  const mockInterviewKey = mockInterviewStorageKey();
  const challengeKey = studentFeatureStorageKey('SkillChallenge');
  const winsKey = studentFeatureStorageKey('CareerWins');
  let history = load(historyKey); // [{role, content, t, fb?, offline?}]
  let busy = false;
  let abort = null;              // AbortController for the request in flight
  let revealTimer = null;        // typing-reveal interval
  let revealing = null;          // {row, textEl, full, item}
  let missionContext = null;
  let missionTasks = [];
  let missionDone = new Set();
  let missionInProgress = new Set();
  let missionVerification = new Map();
  let missionKey = '';
  let selectedMissionTaskId = '';
  let missionLoading = false;
  let missionError = '';
  let showingMission = false;
  let showingWeeklyTasks = false;
  let showingCareerTools = false;
  let showingChallenge = false;
  let challengeSession = null;
  let winMessage = '';
  const interviewState = readMockInterviewState(mockInterviewKey);
  const challengeState = readSkillChallengeState(challengeKey);
  let careerWins = readStudentWins(winsKey);

  function persistCareerWins() {
    try {
      localStorage.setItem(winsKey, JSON.stringify(careerWins));
    } catch (error) {
      console.error('Could not save career achievements:', error);
      status.textContent = 'Achievement could not be saved';
    }
  }

  function celebrateWin(id, title, detail) {
    if (careerWins.some(win => win.id === id)) return;
    careerWins = [...careerWins, { id, title, detail, earnedAt: Date.now() }];
    persistCareerWins();
    winMessage = `${title} — ${detail}`;
    renderWinNotice();
    const wins = body.querySelector('.sb-career-wins');
    if (wins) {
      const replacement = document.createElement('div');
      replacement.innerHTML = careerWinsMarkup();
      wins.replaceWith(replacement.firstElementChild);
    }
  }

  function renderWinNotice() {
    if (!winMessage) return;
    let notice = body.querySelector('[data-win-notice]');
    if (!notice) {
      notice = document.createElement('div');
      notice.className = 'sb-win-celebration';
      notice.dataset.winNotice = '';
      notice.setAttribute('role', 'status');
      body.prepend(notice);
    }
    notice.innerHTML = `<span>✦</span><p>${esc(winMessage)}</p><button type="button" data-dismiss-win aria-label="Dismiss celebration">×</button>`;
  }

  function persistMockInterview() {
    try {
      localStorage.setItem(mockInterviewKey, JSON.stringify({
        asked: [...interviewState.asked],
        active: interviewState.active,
        awaitingNext: interviewState.awaitingNext,
        answers: interviewState.answers || 0
      }));
    } catch (error) {
      console.error('Could not save mock interview question history:', error);
      status.textContent = 'Question history could not be saved';
    }
  }

  function nextMockQuestion() {
    const available = MOCK_QUESTIONS.filter(question => !interviewState.asked.has(question.id));
    if (!available.length) {
      interviewState.active = false;
      interviewState.awaitingNext = false;
      persistMockInterview();
      history.push({
        role: 'assistant',
        content: 'You have practiced every question in this set. Great work! I will add more questions before asking these again.',
        t: Date.now()
      });
      save(history, historyKey);
      renderAll();
      input.focus();
      return;
    }
    const question = available[Math.floor(Math.random() * available.length)];
    interviewState.asked.add(question.id);
    interviewState.active = true;
    interviewState.awaitingNext = false;
    persistMockInterview();
    const item = {
      role: 'assistant',
      content: `No pressure—take your time, and you can skip any question.\n\n**Practice question:** ${question.text}`,
      t: Date.now(),
      mockQuestionId: question.id
    };
    history.push(item);
    save(history, historyKey);
    renderAll();
    input.focus();
  }

  function startMockInterview() {
    showingMission = false;
    if (history.length) {
      interviewState.active = false;
      interviewState.awaitingNext = false;
      persistMockInterview();
      history.push({
        role: 'assistant',
        content: 'Let’s keep this relaxed. I will ask one fresh question at a time, give supportive feedback, and avoid repeats. You can skip any question.',
        t: Date.now()
      });
      save(history, historyKey);
    } else {
      interviewState.active = true;
      interviewState.awaitingNext = false;
      persistMockInterview();
    }
    nextMockQuestion();
  }

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
      ${isLast && interviewState.active && item.mockQuestionId && !interviewState.awaitingNext ? '<button data-a="mock-next" title="Skip this question" aria-label="Skip this question">Skip</button>' : ''}
      ${isLast && interviewState.active && item.mockFeedback && interviewState.awaitingNext ? '<button data-a="mock-next" title="Ask a fresh question" aria-label="Ask the next interview question">Next question</button>' : ''}
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
      } else if (a === 'mock-next') {
        nextMockQuestion();
      } else if (a === 'redo') regenerate();
    });
  }

  function persistSkillChallenge() {
    try {
      localStorage.setItem(challengeKey, JSON.stringify({
        asked: [...challengeState.asked],
        answered: challengeState.answered
      }));
    } catch (error) {
      console.error('Could not save skill challenge history:', error);
      status.textContent = 'Challenge history could not be saved';
    }
  }

  function chooseChallengeQuestion() {
    let available = SKILL_CHALLENGES.filter(question => !challengeState.asked.has(question.id));
    if (!available.length) {
      challengeState.asked.clear();
      available = SKILL_CHALLENGES;
    }
    const question = available[Math.floor(Math.random() * available.length)];
    challengeState.asked.add(question.id);
    persistSkillChallenge();
    return question;
  }

  function startSkillChallenge() {
    showingMission = false;
    showingChallenge = true;
    challengeSession = { question: chooseChallengeQuestion(), selected: null, answered: 0, correct: 0 };
    renderAll();
  }

  function answerChallenge(index) {
    if (!challengeSession || challengeSession.selected !== null || !Number.isInteger(index)) return;
    if (index < 0 || index >= challengeSession.question.options.length) return;
    challengeSession.selected = index;
    challengeSession.answered += 1;
    challengeState.answered += 1;
    if (index === challengeSession.question.answer) challengeSession.correct += 1;
    persistSkillChallenge();
    renderAll();
  }

  function advanceChallenge() {
    if (!challengeSession || challengeSession.selected === null) return;
    if (challengeSession.answered >= 3) {
      const { correct } = challengeSession;
      challengeSession.complete = true;
      if (challengeSession.answered === 3) {
        celebrateWin('challenge-first-finish', 'Challenge complete', `You got ${correct} of 3 this time and kept learning.`);
      }
      renderAll();
      return;
    }
    challengeSession.question = chooseChallengeQuestion();
    challengeSession.selected = null;
    renderAll();
  }

  function challengeView() {
    if (!challengeSession) return '';
    if (challengeSession.complete) {
      return `<section class="sb-challenge-screen">
        <button type="button" class="sb-feature-back" data-challenge-exit>← Back to Step</button>
        <div class="sb-challenge-complete"><span class="sb-challenge-trophy">✦</span><small>CHALLENGE COMPLETE</small><h2>Nice work showing up.</h2><p>You answered ${challengeSession.answered} short questions. Keep what you learned; there is no score to chase.</p><button type="button" class="sb-challenge-next" data-challenge-restart>Try another set</button></div>
      </section>`;
    }
    const question = challengeSession.question;
    const selected = challengeSession.selected;
    const answered = selected !== null;
    const options = question.options.map((option, index) => {
      const correct = index === question.answer;
      const chosen = index === selected;
      const className = answered ? (correct ? ' is-correct' : chosen ? ' is-incorrect' : '') : '';
      return `<button type="button" class="sb-challenge-option${className}" data-challenge-answer="${index}"${answered ? ' disabled' : ''}>
        <span>${String.fromCharCode(65 + index)}</span>${esc(option)}${answered && correct ? '<b aria-label="Correct answer">✓</b>' : ''}
      </button>`;
    }).join('');
    const feedback = answered
      ? `<div class="sb-challenge-feedback${selected === question.answer ? ' is-correct' : ''}" role="status"><b>${selected === question.answer ? 'That’s right!' : 'Good try—here’s a clue for next time.'}</b><p>${esc(question.explanation)}</p></div>`
      : `<p class="sb-challenge-hint">Need a hint? <span>${esc(question.hint)}</span></p>`;
    return `<section class="sb-challenge-screen">
      <button type="button" class="sb-feature-back" data-challenge-exit>← Back to Step</button>
      <div class="sb-challenge-top"><span class="sb-challenge-icon">✦</span><div><small>QUICK SKILL CHALLENGE</small><h2>${esc(question.topic)}</h2></div><span class="sb-challenge-count">${Math.min(challengeSession.answered + (answered ? 0 : 1), 3)} / 3</span></div>
      <p class="sb-challenge-prompt">${esc(question.question)}</p>
      <div class="sb-challenge-options">${options}</div>
      ${feedback}
      ${answered ? `<button type="button" class="sb-challenge-next" data-challenge-next>${challengeSession.answered === 3 ? 'See how you did' : 'Next question'} <span aria-hidden="true">→</span></button>` : ''}
      <p class="sb-challenge-note">Just for practice—no timer, leaderboard, or pressure.</p>
    </section>`;
  }

  function careerProgressMarkup() {
    if (!missionContext) return '';
    const student = missionContext.student || {};
    const applications = Array.isArray(missionContext.applications) ? missionContext.applications : [];
    const statuses = applications.map(application => String(application.status || '').toLowerCase());
    const milestones = [
      { title: 'Profile ready', detail: 'Your StepUp profile is complete.', done: Boolean(student.profileCompleted), href: '#/profile' },
      { title: 'Skills added', detail: `${Array.isArray(student.skills) ? student.skills.length : 0} skill${student.skills?.length === 1 ? '' : 's'} on your profile.`, done: Boolean(student.skills?.length), href: '#/profile' },
      { title: 'Project experience', detail: `${student.projectCount || 0} project${student.projectCount === 1 ? '' : 's'} added.`, done: Boolean(student.projectCount), href: '#/profile' },
      { title: 'First application', detail: applications.length ? `${applications.length} application${applications.length === 1 ? '' : 's'} in progress.` : 'Your applications will show here.', done: applications.length > 0, href: '#/progress' },
      { title: 'Interview stage', detail: statuses.some(value => value.includes('interview')) ? 'You have reached an interview stage.' : 'Keep preparing; interview updates appear here.', done: statuses.some(value => value.includes('interview')), href: '#/progress' },
      { title: 'Offer milestone', detail: statuses.some(value => ['selected', 'offer', 'offered'].includes(value)) ? 'An offer milestone is on your journey.' : 'Every step forward counts.', done: statuses.some(value => ['selected', 'offer', 'offered'].includes(value)), href: '#/progress' }
    ];
    const completeCount = milestones.filter(item => item.done).length;
    const percent = Math.round(completeCount / milestones.length * 100);
    const rows = milestones.map(item => `<a class="sb-career-step${item.done ? ' is-done' : ''}" href="${item.href}" data-mission-route="${item.href.slice(2)}">
      <span class="sb-career-check">${item.done ? '✓' : ''}</span><span><b>${esc(item.title)}</b><small>${esc(item.detail)}</small></span><i>${item.done ? 'Reached' : 'Next'}</i>
    </a>`).join('');
    return `<section class="sb-career-map" aria-label="Career progress map">
      <div class="sb-feature-heading"><div><small>YOUR CAREER JOURNEY</small><h3>Progress map</h3></div><span>${completeCount} / ${milestones.length}</span></div>
      <div class="sb-career-progress"><span style="width:${percent}%"></span></div>
      <div class="sb-career-steps">${rows}</div>
      <p class="sb-feature-footnote">Milestones use your current StepUp profile and application updates.</p>
    </section>`;
  }

  function jobMatchMarkup() {
    if (!missionContext) return '';
    const eligible = Array.isArray(missionContext.eligibleOpenJobs) ? missionContext.eligibleOpenJobs : [];
    const gaps = Array.isArray(missionContext.skillGapJobs) ? missionContext.skillGapJobs : [];
    const cards = [
      ...eligible.slice(0, 3).map(job => `<article class="sb-match-card">
        <span class="sb-match-status">ELIGIBLE TO EXPLORE</span><b>${esc(job.title || 'Open role')}</b><small>${esc(job.company || 'StepUp employer')}</small>
        <p>StepUp currently lists you as eligible. Open the role details to compare its requirements with your experience.</p><a href="#/jobs" data-mission-route="jobs">Review role <span aria-hidden="true">→</span></a>
      </article>`),
      ...gaps.slice(0, Math.max(0, 3 - eligible.length)).map(job => `<article class="sb-match-card is-growth">
        <span class="sb-match-status">SKILL GROWTH OPPORTUNITY</span><b>${esc(job.title || 'Role to explore')}</b><small>${esc(job.company || 'StepUp employer')}</small>
        <p>Build familiarity with ${esc((job.missingSkills || []).slice(0, 3).join(', '))} to strengthen your fit.</p><a href="#/skills" data-mission-route="skills">Explore Skills <span aria-hidden="true">→</span></a>
      </article>`)
    ].join('');
    return `<section class="sb-job-matches" aria-label="Job match explanations">
      <div class="sb-feature-heading"><div><small>LIVE STEPUP OPPORTUNITIES</small><h3>Why these roles?</h3></div></div>
      ${cards || '<p class="sb-feature-empty">No current role matches to explain yet. New opportunities will appear here when available.</p>'}
      <p class="sb-feature-footnote">Eligibility is a starting point, not a hiring guarantee. Always review each listing.</p>
    </section>`;
  }

  function careerWinsMarkup() {
    const latestWins = [...careerWins].slice(-4).reverse();
    const wins = latestWins.length
      ? latestWins.map(win => `<span class="sb-win-badge" title="${esc(win.detail)}"><i>✦</i><b>${esc(win.title)}</b></span>`).join('')
      : '<p class="sb-feature-empty">Your first small win will show up here. There is no streak to maintain.</p>';
    return `<section class="sb-career-wins" aria-label="Career wins"><div class="sb-feature-heading"><div><small>WORTH CELEBRATING</small><h3>Small wins</h3></div><span>${careerWins.length}</span></div>
      <div class="sb-win-list">${wins}</div>
    </section>`;
  }

  function weeklyTasksSummary() {
    if (missionLoading && !missionContext) return 'Loading your tasks…';
    if (!missionTasks.length) return 'Your weekly next steps';
    const completed = missionTasks.filter(task => missionDone.has(task.id)).length;
    const active = missionTasks.filter(task => missionInProgress.has(task.id) && !missionDone.has(task.id)).length;
    return completed === missionTasks.length
      ? 'Weekly plan complete'
      : `${completed} of ${missionTasks.length} done${active ? ` · ${active} underway` : ''}`;
  }

  function missionTaskStatus(task) {
    if (missionDone.has(task.id)) return { label: 'Done', className: 'is-done' };
    if (missionInProgress.has(task.id)) return { label: 'In progress', className: 'is-active' };
    return { label: 'Up next', className: '' };
  }

  function missionAction(task) {
    const started = missionInProgress.has(task.id);
    const label = started ? 'Continue' : task.label;
    const start = `data-mission-start="${esc(task.id)}"`;
    if (task.mockInterview) {
      return `<button type="button" class="sb-mission-action is-primary" ${start} data-mock-start>${started ? 'Continue interview' : esc(label)} <span aria-hidden="true">→</span></button>`;
    }
    if (task.prompt) {
      return `<button type="button" class="sb-mission-action is-primary" ${start} data-mission-prompt="${esc(task.prompt)}">${esc(label)} <span aria-hidden="true">→</span></button>`;
    }
    if (task.external) {
      return `<a class="sb-mission-action is-primary" ${start} href="${esc(task.href)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>`;
    }
    return `<a class="sb-mission-action is-primary" ${start} href="${esc(task.href)}" data-mission-route="${esc(task.href.slice(2))}">${esc(label)} <span aria-hidden="true">→</span></a>`;
  }

  function missionMarkup(compact = false) {
    const missionLabel = compact ? 'WEEKLY TASKS' : 'TASKS FOR THIS WEEK';
    if (missionLoading && !missionContext) {
      return `<section class="sb-mission sb-mission-loading" aria-live="polite">
        <div class="sb-mission-head"><span class="sb-mission-kicker">${missionLabel}</span><span class="sb-mission-week">${esc(currentMissionWeek())}</span></div>
        <p>Building a plan around your StepUp profile and live opportunities…</p>
        <div class="sb-mission-skeleton"></div><div class="sb-mission-skeleton short"></div>
      </section>`;
    }
    if (missionError && !missionContext) {
      return `<section class="sb-mission sb-mission-error" role="status">
        <div class="sb-mission-head"><span class="sb-mission-kicker">${missionLabel}</span></div>
        <p>${esc(missionError)}</p>
        <button type="button" class="sb-mission-retry" data-mission-retry>Try again</button>
      </section>`;
    }
    if (!missionContext || !missionTasks.length) return '';

    const completed = missionTasks.filter(task => missionDone.has(task.id)).length;
    const percent = Math.round(completed / missionTasks.length * 100);
    const featured = missionTasks.find(task => task.id === selectedMissionTaskId && !missionDone.has(task.id))
      || missionTasks.find(task => !missionDone.has(task.id));
    if (featured) selectedMissionTaskId = featured.id;
    const featureStatus = featured ? missionTaskStatus(featured) : null;
    const otherTasks = missionTasks.filter(task => task.id !== featured?.id);
    const taskRows = otherTasks.map(task => {
      const state = missionTaskStatus(task);
      return `<button type="button" class="sb-mission-task${state.className ? ` ${state.className}` : ''}" data-mission-select="${esc(task.id)}">
        <span class="sb-mission-task-status ${state.className}">${esc(state.label)}</span>
        <span class="sb-mission-task-copy"><b>${esc(task.title)}</b><small>${esc(task.detail)}</small></span>
        <span class="sb-mission-task-arrow" aria-hidden="true">›</span>
      </button>`;
    }).join('');

    return `<section class="sb-mission${compact ? ' sb-mission-compact' : ''}" aria-label="Weekly placement mission">
      <div class="sb-mission-head">
        <div><span class="sb-mission-kicker">${missionLabel}</span><b data-mission-status>${completed === missionTasks.length ? 'Your weekly plan is complete' : 'One step at a time'}</b></div>
        <span class="sb-mission-week">${esc(currentMissionWeek())}</span>
      </div>
      <div class="sb-mission-progress">
        <div><span data-mission-count>${completed} of ${missionTasks.length} complete</span><b data-mission-percent>${percent}%</b></div>
        <div class="sb-mission-track" data-mission-progress role="progressbar" aria-label="Weekly mission progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>
      </div>
      ${featured ? `<article class="sb-mission-featured${featureStatus.className ? ` ${featureStatus.className}` : ''}" data-mission-featured="${esc(featured.id)}">
        <div class="sb-mission-featured-top"><span class="sb-mission-kicker">YOUR NEXT STEP</span><span class="sb-mission-task-status ${featureStatus.className}" data-mission-feature-status>${esc(featureStatus.label)}</span></div>
        <h3>${esc(featured.title)}</h3><p>${esc(featured.detail)}</p>
        <div class="sb-mission-featured-actions">${missionAction(featured)}
          ${missionInProgress.has(featured.id) && !featured.verification && !featured.mockInterview
            ? `<button type="button" class="sb-mission-confirm" data-mission-confirm="${esc(featured.id)}">I’ve completed this</button>`
            : ''}
        </div>
      </article>` : `<div class="sb-mission-finished"><span aria-hidden="true">✦</span><b>You made progress on every step.</b><p>Your next plan will be ready next week.</p></div>`}
      ${otherTasks.length ? `<details class="sb-mission-more">
        <summary>More tasks <span>${otherTasks.length}</span></summary>
        <div class="sb-mission-list">${taskRows}</div>
      </details>` : ''}
      <p class="sb-mission-footnote" data-mission-note>${missionError ? esc(missionError) : 'Starting a task only marks it in progress. StepUp verifies what it can; for other tasks, confirm when you’re done.'}</p>
    </section>`;
  }

  function missionView() {
    return `<div class="sb-mission-screen">
      <div class="sb-mission-screen-top"><span class="sb-mission-screen-icon">${ICON.mission}</span><div><small>YOUR STEPUP NEXT STEPS</small><h2>Tasks for this week</h2></div></div>
      <p class="sb-mission-screen-intro">Start with one step. Your progress only counts when the work is done.</p>
      ${missionMarkup()}
      <details class="sb-extra-tools" data-career-tools${showingCareerTools ? ' open' : ''}>
        <summary>Career map, opportunities &amp; small wins</summary>
        ${careerProgressMarkup()}
        ${jobMatchMarkup()}
        ${careerWinsMarkup()}
      </details>
    </div>`;
  }

  async function loadMission() {
    if (!getToken() || missionLoading) return;
    if (missionContext && missionKey !== missionProgressKey(currentMissionWeek())) {
      missionContext = null;
      missionTasks = [];
      missionDone = new Set();
      missionInProgress = new Set();
      missionVerification = new Map();
      missionKey = '';
      selectedMissionTaskId = '';
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
      const saved = readMissionProgress(missionKey);
      const validTaskIds = new Set(missionTasks.map(task => task.id));
      missionDone = new Set([...saved.done].filter(id => validTaskIds.has(id)));
      missionInProgress = new Set([...saved.inProgress].filter(id => validTaskIds.has(id) && !missionDone.has(id)));
      missionVerification = new Map([...saved.verification].filter(([id]) => missionInProgress.has(id)));
      for (const task of missionTasks) {
        if (missionInProgress.has(task.id) && task.verification && !missionVerification.has(task.id)) {
          missionVerification.set(task.id, task.verification);
        }
      }
      verifyMissionTasks();
      persistMissionProgress();
      missionError = '';
    } catch (error) {
      missionError = error.message || 'Could not load your weekly mission.';
    } finally {
      missionLoading = false;
      renderAll();
    }
  }

  function updateMissionProgressUI() {
    const completed = missionTasks.filter(task => missionDone.has(task.id)).length;
    const percent = missionTasks.length ? Math.round(completed / missionTasks.length * 100) : 0;
    body.querySelectorAll('[data-mission-status]').forEach(element => {
      element.textContent = completed === missionTasks.length ? 'Your weekly plan is complete' : 'One step at a time';
    });
    body.querySelectorAll('[data-mission-count]').forEach(element => {
      element.textContent = `${completed} of ${missionTasks.length} complete`;
    });
    body.querySelectorAll('[data-mission-percent]').forEach(element => {
      element.textContent = `${percent}%`;
    });
    body.querySelectorAll('[data-mission-progress]').forEach(element => {
      element.setAttribute('aria-valuenow', String(percent));
      element.firstElementChild.style.width = `${percent}%`;
    });
    body.querySelectorAll('[data-mission-note]').forEach(element => {
      element.textContent = missionError || 'Starting a task only marks it in progress. StepUp verifies what it can; for other tasks, confirm when you’re done.';
    });
    const summary = body.querySelector('.sb-weekly-trigger-copy small');
    if (summary) summary.textContent = weeklyTasksSummary();
    for (const task of missionTasks) {
      const state = missionTaskStatus(task);
      const row = [...body.querySelectorAll('[data-mission-select]')].find(item => item.dataset.missionSelect === task.id);
      if (row) {
        row.classList.toggle('is-done', state.className === 'is-done');
        row.classList.toggle('is-active', state.className === 'is-active');
        const status = row.querySelector('.sb-mission-task-status');
        status.className = `sb-mission-task-status ${state.className}`;
        status.textContent = state.label;
      }
      if (body.querySelector('[data-mission-featured]')?.dataset.missionFeatured === task.id) {
        const feature = body.querySelector('[data-mission-featured]');
        feature.classList.toggle('is-done', state.className === 'is-done');
        feature.classList.toggle('is-active', state.className === 'is-active');
        const featureStatus = feature.querySelector('[data-mission-feature-status]');
        featureStatus.className = `sb-mission-task-status ${state.className}`;
        featureStatus.textContent = state.label;
        let confirm = feature.querySelector('[data-mission-confirm]');
        if (state.className === 'is-active' && !task.verification && !task.mockInterview && !confirm) {
          confirm = document.createElement('button');
          confirm.type = 'button';
          confirm.className = 'sb-mission-confirm';
          confirm.dataset.missionConfirm = task.id;
          confirm.textContent = 'I’ve completed this';
          feature.querySelector('.sb-mission-featured-actions').appendChild(confirm);
        } else if ((state.className !== 'is-active' || task.verification || task.mockInterview) && confirm) {
          confirm.remove();
        }
      }
    }
  }

  function persistMissionProgress() {
    try {
      localStorage.setItem(missionKey, JSON.stringify({
        done: [...missionDone],
        inProgress: [...missionInProgress],
        verification: Object.fromEntries(missionVerification)
      }));
      return true;
    } catch (error) {
      console.error('Could not save weekly mission progress:', error);
      missionError = 'Could not save mission progress in this browser.';
      status.textContent = 'Mission progress could not be saved';
      return false;
    }
  }

  function setMissionTaskStarted(taskId) {
    const task = missionTasks.find(item => item.id === taskId);
    if (!task || !missionKey || missionDone.has(taskId) || missionInProgress.has(taskId)) return;
    missionInProgress.add(taskId);
    if (task.verification) missionVerification.set(taskId, task.verification);
    persistMissionProgress();
    updateMissionProgressUI();
  }

  function setMissionTaskDone(taskId, { verified = false } = {}) {
    const task = missionTasks.find(item => item.id === taskId);
    if (!task || !missionKey || missionDone.has(taskId) || !missionInProgress.has(taskId)) return;
    if (missionVerification.has(taskId) && !verified) return;
    const wasFirst = missionDone.size === 0;
    missionDone.add(taskId);
    missionInProgress.delete(taskId);
    missionVerification.delete(taskId);
    persistMissionProgress();
    if (wasFirst) {
      celebrateWin(`mission-first-step:${currentMissionWeek()}`, 'First mission step complete', `You finished: ${task.title}.`);
    }
    if (missionDone.size === missionTasks.length) {
      celebrateWin(`mission-complete:${currentMissionWeek()}`, 'Weekly mission complete', 'You completed every step in this week’s plan.');
    }
    if (selectedMissionTaskId === taskId) {
      selectedMissionTaskId = missionTasks.find(item => !missionDone.has(item.id))?.id || '';
    }
    updateMissionProgressUI();
    if (showingMission || !history.length) renderAll();
  }

  function verifyMissionTasks() {
    const student = missionContext?.student || {};
    const profileReady = Boolean(student.profileCompleted && student.skills?.length && student.projectCount);
    for (const taskId of [...missionInProgress]) {
      if (missionVerification.get(taskId) === 'profile' && profileReady) {
        setMissionTaskDone(taskId, { verified: true });
      }
    }
  }

  function confirmMissionTask(taskId) {
    if (missionVerification.has(taskId)) return;
    setMissionTaskDone(taskId);
  }

  function renderAll() {
    body.innerHTML = '';
    const signedIn = Boolean(getToken());
    form.hidden = showingChallenge;
    missionButton.hidden = !signedIn;
    missionButton.setAttribute('aria-pressed', String(showingMission || showingChallenge));
    missionButton.title = showingMission || showingChallenge ? 'Return to chat' : 'Tasks for this week';
    missionButton.setAttribute('aria-label', showingMission || showingChallenge ? 'Return to chat' : 'Tasks for this week');
    if (showingChallenge) {
      body.innerHTML = challengeView();
    } else if (showingMission && signedIn) {
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
        ${personalized ? `<section class="sb-weekly-fold">
          <button type="button" class="sb-weekly-trigger" data-weekly-toggle aria-expanded="${showingWeeklyTasks}" aria-controls="sbWeeklyTasksPanel">
            <span class="sb-weekly-trigger-icon">${ICON.mission}</span>
            <span class="sb-weekly-trigger-copy"><b>Tasks for this week</b><small>${esc(weeklyTasksSummary())}</small></span>
            <span class="sb-weekly-trigger-chevron" aria-hidden="true">${showingWeeklyTasks ? '−' : '+'}</span>
          </button>
          <div id="sbWeeklyTasksPanel" class="sb-weekly-content"${showingWeeklyTasks ? '' : ' hidden'}>${missionMarkup(true)}</div>
        </section>` : ''}
        <div class="sb-task-heading"><span>What would you like to work on?</span><small>${personalized ? 'PICK A STARTING POINT' : 'QUICK START'}</small></div>
        <div class="sb-task-grid">${COPILOT_TASKS.map((task, index) => `
          <button type="button" class="sb-task"${task.mockInterview ? ' data-mock-start' : task.skillChallenge ? ' data-skill-challenge' : ` data-chat-prompt="${esc(task.prompt)}"`}>
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
    renderWinNotice();
    const careerTools = body.querySelector('.sb-extra-tools');
    if (careerTools) careerTools.addEventListener('toggle', () => { showingCareerTools = careerTools.open; });
    const weeklyToggle = body.querySelector('[data-weekly-toggle]');
    if (weeklyToggle) weeklyToggle.addEventListener('click', () => {
      showingWeeklyTasks = !showingWeeklyTasks;
      renderAll();
      if (showingWeeklyTasks && !missionContext) void loadMission();
    });
    if (showingWeeklyTasks && !history.length && !showingMission && !showingChallenge) body.scrollTop = 0;
    else if (history.length) toBottom(false);
    else body.scrollTop = 0;
    updateJump();
  }

  function updateJump() { jump.hidden = showingChallenge || !history.length || nearBottom(); }

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

  async function ask(signal, mockAnswer = false) {
    const local = new AbortController();
    const token = getToken();
    const endpoint = token ? '/student/chat' : '/chat';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; local.abort(); }, 35000);   // never spin forever
    signal.addEventListener('abort', () => local.abort());
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const messages = history.map(({ role, content }) => ({ role, content }));
      if (mockAnswer && messages.length) {
        messages[messages.length - 1].content += '\n\n[Mock interview mode: Respond to the student\'s answer with brief, supportive feedback. Mention one thing they did well and one specific improvement they could try. Keep it low-pressure, do not score or judge them, and do not ask another interview question; the student chooses when to continue.]';
      }
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages }),
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
    const lastMessage = history[history.length - 1];
    const activeQuestion = [...history].reverse().find(item => item.role === 'assistant' && item.mockQuestionId);
    const mockAnswer = Boolean(
      interviewState.active &&
      !interviewState.awaitingNext &&
      lastMessage?.role === 'user' &&
      activeQuestion
    );
    let result;
    try {
      result = await ask(abort.signal, mockAnswer);
    } catch {            // stopped while waiting
      typing.remove(); abort = null; setBusy(false); input.focus(); renderAll(); return;
    }
    abort = null;
    typing.remove();

    const item = {
      role: 'assistant',
      content: result.text,
      t: Date.now(),
      offline: result.offline,
      mockFeedback: mockAnswer && !result.offline,
      mockQuestionId: mockAnswer && result.offline ? activeQuestion.mockQuestionId : undefined
    };
    if (item.mockFeedback) {
      interviewState.awaitingNext = true;
      interviewState.answers = (interviewState.answers || 0) + 1;
      persistMockInterview();
      if (interviewState.answers === 1) celebrateWin('mock-first-answer', 'First answer practiced', 'You showed up and gave it a try.');
      if (interviewState.answers === 3) celebrateWin('mock-three-answers', 'Three answers practiced', 'That is real interview practice.');
      if (missionInProgress.has('practice')) setMissionTaskDone('practice', { verified: true });
    }
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
    if (interviewState.active && interviewState.awaitingNext) {
      interviewState.active = false;
      interviewState.awaitingNext = false;
      persistMockInterview();
    }
    history.push({ role: 'user', content: text, t: Date.now() });
    save(history, historyKey);
    input.value = ''; autosize();
    renderAll();
    respond();
  }

  function regenerate() {
    if (busy) return;
    if (interviewState.active && interviewState.awaitingNext) {
      interviewState.awaitingNext = false;
      persistMockInterview();
    }
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
    showingChallenge = false;
    challengeSession = null;
    winMessage = '';
    interviewState.active = false;
    interviewState.awaitingNext = false;
    persistMockInterview();
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
    if (showingMission) showingMission = false;
    else {
      showingChallenge = false;
      showingMission = true;
    }
    renderAll();
    if (showingMission) void loadMission();
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
    const missionStart = e.target.closest('[data-mission-start]');
    if (missionStart) {
      const task = missionTasks.find(item => item.id === missionStart.dataset.missionStart);
      setMissionTaskStarted(missionStart.dataset.missionStart);
      if (task?.href && !task.external && !task.mockInterview && MISSION_ROUTES.has(task.href)) {
        e.preventDefault();
        navigate(task.href.slice(2));
        return;
      }
    }
    const missionSelection = e.target.closest('[data-mission-select]');
    if (missionSelection) {
      selectedMissionTaskId = missionSelection.dataset.missionSelect;
      renderAll();
      return;
    }
    const missionConfirmation = e.target.closest('[data-mission-confirm]');
    if (missionConfirmation) {
      confirmMissionTask(missionConfirmation.dataset.missionConfirm);
      return;
    }
    if (e.target.closest('[data-skill-challenge],[data-challenge-restart]')) {
      startSkillChallenge();
      return;
    }
    if (e.target.closest('[data-challenge-exit]')) {
      showingChallenge = false;
      challengeSession = null;
      renderAll();
      return;
    }
    const challengeAnswer = e.target.closest('[data-challenge-answer]');
    if (challengeAnswer) {
      answerChallenge(Number(challengeAnswer.dataset.challengeAnswer));
      return;
    }
    if (e.target.closest('[data-challenge-next]')) {
      advanceChallenge();
      return;
    }
    if (e.target.closest('[data-dismiss-win]')) {
      winMessage = '';
      renderAll();
      return;
    }
    if (e.target.closest('[data-mock-start]')) {
      showingChallenge = false;
      startMockInterview();
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
