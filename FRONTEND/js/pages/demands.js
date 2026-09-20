/* ============================================================
   demands.js — Demands page
   Renders the request cards from js/data/demands.data.js
============================================================ */

import { $, esc, renderList } from '../core/dom.js';
import { demands } from '../data/demands.data.js';

function demandCard(d){
  return `
    <div class="placeholder-card">
      <div class="placeholder-left">
        <div class="co-logo">${esc(d.code)}</div>
        <div>
          <div class="co-name">${esc(d.name)}</div>
          <div class="co-meta">${esc(d.meta)}</div>
        </div>
      </div>
      <span class="badge ${d.statusClass}">${esc(d.status)}</span>
    </div>`;
}

export function mount(){
  renderList($('#demandList'), demands, demandCard);

  $('#newDemandBtn').addEventListener('click', () => {
    // Replace with a real modal / form when the backend is ready.
    alert('New demand form coming soon.');
  });
}
