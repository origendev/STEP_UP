/* ============================================================
   home.js — Home page
   Renders the Skills Snapshot and Recent Milestones cards.
   mount() runs every time the router shows this page.
============================================================ */

import { $, esc, renderList } from '../core/dom.js';
import { skillSnapshot, milestones } from '../data/home.data.js';

function snapshotRow(s){
  return `
    <div class="row-item snapshot-row">
      <div class="skill-pct-row"><span>${esc(s.name)}</span><span>${s.pct}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${s.pct}%"></div></div>
    </div>`;
}

function milestoneRow(m){
  return `
    <div class="row-item">
      <span class="badge ${m.badgeClass}">${esc(m.badge)}</span>
      <div>
        <div class="milestone-title">${esc(m.title)}</div>
        <div class="milestone-meta">${esc(m.meta)}</div>
      </div>
    </div>`;
}

export function mount(){
  renderList($('#snapshotList'),  skillSnapshot, snapshotRow);
  renderList($('#milestoneList'), milestones,    milestoneRow);
}
