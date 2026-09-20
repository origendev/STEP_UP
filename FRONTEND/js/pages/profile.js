/* ============================================================
   profile.js — Profile page
   Renders the document list and handles edit / save / cancel
   on the Personal Details card.
============================================================ */

import { $, $$, esc, renderList } from '../core/dom.js';
import { documents } from '../data/profile.data.js';

/* Inline SVGs keyed by the `icon` field in profile.data.js */
const ICONS = {
  book:  `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  sheet: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>`,
  card:  `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 9h16"/></svg>`,
  check: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
};

function docRow(d){
  return `
    <div class="doc-row">
      <div class="doc-ic">${ICONS[d.icon] || ICONS.sheet}</div>
      <div class="doc-body">
        <div class="doc-name">${esc(d.name)}</div>
        <div class="doc-meta">${esc(d.meta)}</div>
      </div>
      <div class="doc-action">
        <button class="btn-tiny${d.uploaded ? ' uploaded' : ''}"${d.disabled ? ' disabled' : ''}>${esc(d.action)}</button>
      </div>
    </div>`;
}

/* ---------- Edit mode ---------- */

let savedValues = [];

/** Only the Personal Details inputs are editable. */
function getInputs(){
  return $$('#view-profile .profile-details .field input');
}

function enterEditMode(){
  const inputs = getInputs();
  savedValues = inputs.map(i => i.value);          // snapshot for Cancel
  inputs.forEach(i => { i.disabled = false; });
  $('#editActions').classList.add('show');
  $('#editToggleBtn').style.display = 'none';
}

function cancelEdit(){
  getInputs().forEach((input, idx) => {
    input.value = savedValues[idx];
    input.disabled = true;
  });
  $('#editActions').classList.remove('show');
  $('#editToggleBtn').style.display = '';
}

function saveEdit(){
  // Hook a real API call in here later.
  getInputs().forEach(i => { i.disabled = true; });
  $('#editActions').classList.remove('show');

  const btn = $('#editToggleBtn');
  btn.style.display = '';
  btn.textContent = 'Edit';
}

export function mount(){
  renderList($('#docList'), documents, docRow);

  $('#editToggleBtn').addEventListener('click', enterEditMode);
  $('#cancelBtn').addEventListener('click', cancelEdit);
  $('#saveBtn').addEventListener('click', saveEdit);
}
