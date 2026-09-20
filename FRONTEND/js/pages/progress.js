/* ============================================================
   progress.js — Progress page
   Renders the funnel, the journey timeline and the readiness rows.
============================================================ */

import { $, esc, renderList } from '../core/dom.js';
import { funnel, timeline, readiness } from '../data/progress.data.js';

function funnelStep(s){
  return `
    <div class="funnel-step">
      <div class="num">${s.num}</div>
      <div class="lbl">${esc(s.label)}</div>
      <div class="funnel-bar"><div style="width:${s.pct}%"></div></div>
    </div>`;
}

function timelineItem(t){
  return `
    <div class="tl-item">
      <div class="tl-dot${t.done ? ' done' : ''}"></div>
      <div class="tl-date">${esc(t.date)}</div>
      <div class="tl-title">${esc(t.title)}</div>
      <div class="tl-desc">${esc(t.desc)}</div>
    </div>`;
}

function readinessRow(r){
  return `
    <div class="row-item">
      <div class="readiness-label">${esc(r.label)}</div>
      <div class="readiness-value">${esc(r.value)}</div>
    </div>`;
}

export function mount(){
  renderList($('#funnel'),        funnel,    funnelStep);
  renderList($('#timeline'),      timeline,  timelineItem);
  renderList($('#readinessList'), readiness, readinessRow);
}
