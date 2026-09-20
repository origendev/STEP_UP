/* =========================================================
   PROFILE PAGE MODULE — profile summary, editable personal
   details, read-only academic details, social links, documents.
========================================================= */
import { $, $$, renderList } from '../core/dom.js';
import { profileMeta, personalFields, academicFields, socialLinks, documents } from '../data/profile.data.js';

export function mount(){
  renderSummary();
  renderPersonalFields();
  renderAcademicFields();
  renderSocialLinks();
  renderDocuments();
  bindEditFlow();
  bindDocumentActions();
}

function renderSummary(){
  $('#profileAvatar').textContent = profileMeta.initial;
  $('#profileName').textContent = profileMeta.name;
  $('#profileRole').textContent = profileMeta.role;
  $('#profileRegNo').textContent = `Reg No: ${profileMeta.regNo}`;
  $('#profileCgpa').textContent = `CGPA: ${profileMeta.cgpa}`;
  $('#pctLabel').textContent = `${profileMeta.completeness}%`;
  $('#pctFill').style.width = `${profileMeta.completeness}%`;
}

function fieldHTML(field){
  return `
    <div class="field${field.full ? ' full' : ''}">
      <label>${field.label}</label>
      <input type="text" data-key="${field.key}" value="${field.value}" disabled>
    </div>
  `;
}

function renderPersonalFields(){
  renderList($('#personalFieldsGrid'), personalFields, fieldHTML);
}

function renderAcademicFields(){
  renderList($('#academicFieldsGrid'), academicFields, fieldHTML);
}

function renderSocialLinks(){
  renderList($('#socialList'), socialLinks, (link) => `
    <div class="social-row">
      <div class="social-ic">${link.icon}</div>
      <input type="text" value="${link.value}" disabled>
    </div>
  `);
}

function formatToday(){
  const d = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sept','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function renderDocuments(){
  renderList($('#documentsList'), documents, (doc) => {
    const uploaded = doc.status === 'uploaded';
    const actionButtons = uploaded
      ? `<button class="btn-tiny uploaded" data-action="replace" data-key="${doc.key}">Replace</button>
         <button class="btn-tiny danger" data-action="remove" data-key="${doc.key}">Remove</button>`
      : `<button class="btn-tiny" data-action="upload" data-key="${doc.key}">Upload</button>`;
    return `
      <div class="list-row" data-doc-row="${doc.key}">
        <div class="list-ic">${doc.icon}</div>
        <div style="flex:1;"><div class="list-title">${doc.name}</div><div class="list-meta">${doc.meta}</div></div>
        <div class="doc-actions">${actionButtons}</div>
      </div>
    `;
  });
}

function bindDocumentActions(){
  const fileInput = $('#docFileInput');
  let pendingKey = null;

  $('#documentsList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if(!btn) return;
    const key = btn.dataset.key;
    const doc = documents.find(d => d.key === key);
    if(!doc) return;

    if(btn.dataset.action === 'remove'){
      doc.status = 'missing';
      doc.meta = 'Not uploaded yet';
      renderDocuments();
      return;
    }

    // 'upload' or 'replace' → open the file picker for this document
    pendingKey = key;
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if(!file || !pendingKey) return;
    const doc = documents.find(d => d.key === pendingKey);
    if(!doc) return;

    // TODO: upload `file` to a real backend once one exists — this only
    // updates local state so the UI reflects the change immediately.
    doc.status = 'uploaded';
    doc.meta = `Uploaded ${formatToday()} · ${file.name}`;
    renderDocuments();
    pendingKey = null;
  });
}

function bindEditFlow(){
  const editBtn = $('#editToggleBtn');
  const editActions = $('#editActions');
  const inputs = () => $$('#personalFieldsGrid input');
  let savedValues = [];

  editBtn.addEventListener('click', () => {
    savedValues = inputs().map(i => i.value);
    inputs().forEach(i => i.disabled = false);
    editActions.classList.add('show');
    editBtn.style.display = 'none';
  });

  $('#cancelBtn').addEventListener('click', () => {
    inputs().forEach((i, idx) => { i.value = savedValues[idx]; i.disabled = true; });
    editActions.classList.remove('show');
    editBtn.style.display = '';
  });

  $('#saveBtn').addEventListener('click', () => {
    // TODO: send inputs() values to a real backend/API once one exists.
    inputs().forEach(i => i.disabled = true);
    editActions.classList.remove('show');
    editBtn.style.display = '';
  });
}
