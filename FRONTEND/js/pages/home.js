/* ============================================================
   home.js — Home / Dashboard
============================================================ */

import {
  $,
  esc,
  renderList
} from '../core/dom.js';

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
   MOUNT HOME PAGE
============================================================ */

export function mount() {

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