/* ============================================================
   home.js — Home / Dashboard
============================================================ */

import {
  $,
  esc,
  renderList
} from '../core/dom.js';

import { initChatbot } from './chatbot.js';
import { getUser, greeting, USER_EVENT } from '../core/user.js';
import { jobs } from '../data/jobs.data.js';
import { funnel, timeline } from '../data/progress.data.js';
import { profileMeta } from '../data/profile.data.js';

import {
  placementProgress,
  skillSnapshot,
  milestones
} from '../data/home.data.js';


/* ============================================================
   SKILL ROW
============================================================ */

function snapshotRow(skill) {

  return `
    <div class="row-item snapshot-row">

      <div class="skill-pct-row">

        <span>
          ${esc(skill.name)}
        </span>

        <span>
          ${skill.pct}%
        </span>

      </div>


      <div class="progress-track">

        <div
          class="progress-fill"
          style="width:${skill.pct}%"
        ></div>

      </div>

    </div>
  `;
}


/* ============================================================
   MILESTONE ROW
============================================================ */

function milestoneRow(milestone) {

  return `
    <div class="row-item">

      <span class="badge ${milestone.badgeClass}">
        ${esc(milestone.badge)}
      </span>

      <div>

        <div class="milestone-title">
          ${esc(milestone.title)}
        </div>

        <div class="milestone-meta">
          ${esc(milestone.meta)}
        </div>

      </div>

    </div>
  `;
}



/* ============================================================
   HERO (name stays in sync with the Profile page)
============================================================ */
function paintHero() {
  const u = getUser();
  const name = $('#homeName'), hi = $('#homeGreeting');
  if (name) name.textContent = u.first;
  if (hi) hi.textContent = greeting();
  const date = $('#homeDate');
  if (date) date.textContent = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function paintStats() {
  const by = (l) => funnel.find((f) => f.label === l)?.num ?? 0;
  const items = [
    { n: by('Applied'), l: 'Applications', c: 'violet' },
    { n: by('Interviewed'), l: 'Interviews', c: 'amber' },
    { n: by('Offers'), l: 'Offers', c: 'green' },
    { n: `${profileMeta.completeness}%`, l: 'Profile complete', c: 'rose' }
  ];
  $('#homeStats').innerHTML = items.map((s) => `
    <div class="home-stat stat-${s.c}"><strong>${esc(s.n)}</strong><span>${esc(s.l)}</span></div>`).join('');
}

function paintOpenings() {
  const open = jobs.filter((job) => !job.prev).slice(0, 3);
  $('#openingList').innerHTML = open.length ? open.map((job) => `
    <div class="row-item opening-row">
      <div class="opening-logo">${esc(job.title[0])}</div>
      <div class="opening-copy">
        <div class="milestone-title">${esc(job.title)} · ${esc(job.sub)}</div>
        <div class="milestone-meta">Apply before ${esc(job.applyBefore)} · ${esc(job.stipend !== '—' ? job.stipend : job.salary)}</div>
      </div>
      <span class="badge badge-amber">${esc(job.status)}</span>
    </div>`).join('') : '<p class="home-empty">No open applications right now.</p>';
}

function paintUpcoming() {
  const next = timeline.filter((t) => !t.done).slice(0, 3);
  $('#upcomingList').innerHTML = next.length ? next.map((t) => `
    <div class="row-item">
      <span class="badge badge-violet">${esc(t.date)}</span>
      <div>
        <div class="milestone-title">${esc(t.title)}</div>
        <div class="milestone-meta">${esc(t.desc)}</div>
      </div>
    </div>`).join('') : '<p class="home-empty">Nothing scheduled. Check Jobs for new drives.</p>';
}

function paintFunnel() {
  $('#funnelList').innerHTML = funnel.map((f) => `
    <div class="snapshot-row">
      <div class="skill-pct-row"><span>${esc(f.label)}</span><span>${f.num}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${f.pct}%"></div></div>
    </div>`).join('');
}

function paintQuick() {
  const links = [
    ['jobs', '💼', 'Find jobs', 'Browse new openings'],
    ['demands', '📊', 'Market demand', 'See hiring trends'],
    ['skills', '⭐', 'Build skills', 'Close your gaps'],
    ['profile', '👤', 'Update profile', 'Keep details fresh']
  ];
  $('#quickGrid').innerHTML = links.map(([to, icon, title, sub]) => `
    <button class="quick-tile" type="button" data-goto="${to}">
      <span class="quick-ic">${icon}</span><b>${title}</b><small>${sub}</small>
    </button>`).join('');
}

/* ============================================================
   MOUNT HOME PAGE
============================================================ */

export function mount() {

  initChatbot();

  paintHero();
  paintStats();
  paintOpenings();
  paintUpcoming();
  paintFunnel();
  paintQuick();

  /* Profile name changes while Home is open (or from another tab) */
  window.removeEventListener(USER_EVENT, paintHero);
  window.addEventListener(USER_EVENT, paintHero);
  window.addEventListener('storage', paintHero);

  /* "Ask Step" opens the floating assistant (same spot, bottom right) */
  $('#askStepBtn')?.addEventListener('click', () => document.getElementById('sbLauncher')?.click());

  /* ----------------------------------------------------------
     Skills
  ---------------------------------------------------------- */

  renderList(
    $('#snapshotList'),
    skillSnapshot,
    snapshotRow
  );


  /* ----------------------------------------------------------
     Milestones
  ---------------------------------------------------------- */

  renderList(
    $('#milestoneList'),
    milestones,
    milestoneRow
  );


  /* ----------------------------------------------------------
     Placement Progress
  ---------------------------------------------------------- */

  const progress = Math.max(
    0,
    Math.min(
      100,
      Number(placementProgress) || 0
    )
  );


  const ring = $('#placementRingFill');

  const value = $('#placementRingValue');


  /*
     Because the SVG circle uses:

     pathLength="100"

     we can directly use percentage values.

     Example:

     42% → offset 58
     70% → offset 30
     100% → offset 0
     0% → offset 100
  */

  if (ring) {

    ring.style.strokeDashoffset =
      String(100 - progress);

  }


  /* ----------------------------------------------------------
     Center percentage
  ---------------------------------------------------------- */

  if (value) {

    value.textContent =
      `${progress}%`;

  }

}