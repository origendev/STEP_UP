/* =========================================================
   PROFILE PAGE — header card + tabs (Details, Academics,
   Skills, More, Documents). Everything the student edits is
   kept in localStorage ('stepup-profile') until a backend exists.
========================================================= */
import { $, esc } from '../core/dom.js';
import { navigate } from '../core/router.js';
import { defaults, moreSections, platforms, languageList, skillLevels } from '../data/profile.data.js';

const KEY = 'stepup-profile';
const TABS = [['details', 'Details'], ['academics', 'Academics'], ['skills', 'Skills'], ['more', 'More'], ['documents', 'Documents']];
const ICON = {
  cam: '<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
};

let S, tab = 'details', ui = {}, root;

function load(){
  const base = structuredClone(defaults);
  try{ return { ...base, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }catch{ return base; }
}
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }
  catch{ toast('Could not save. Browser storage is full.'); }
}
function toast(msg){
  document.querySelector('.st-toast')?.remove();
  const t = Object.assign(document.createElement('div'), { className: 'st-toast', textContent: msg });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
const today = () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const field = (sec, k) => S.sections[sec].fields.find(x => x.k === k)?.value || '';
const val = sel => (root.querySelector(sel)?.value || '').trim();
const fixUrl = u => (/^https?:\/\//i.test(u) ? u : 'https://' + u);
const host = u => { try{ return new URL(fixUrl(u)).hostname.replace(/^www\./, ''); }catch{ return u; } };

const INC = [['education', 'Education'], ['skills', 'Skills'], ['projects', 'Projects'], ['experience', 'Work experience'], ['certifications', 'Certifications'], ['awards', 'Patents, scholarships and volunteering'], ['languages', 'Languages'], ['links', 'Links']];
const RES_CSS = 'body{font-family:Calibri,Arial,sans-serif;color:#111;line-height:1.4;margin:32px}h1{font-size:24px;margin:0}.c{margin:2px 0 10px;color:#444}h2{font-size:14px;border-bottom:1px solid #999;margin:14px 0 6px;text-transform:uppercase}ul{margin:0;padding-left:18px}p{margin:0}';

/* files that are too big for localStorage (the uploaded resume) go to IndexedDB */
const idb = () => new Promise((ok, no) => { const r = indexedDB.open('stepup-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const idbDo = async (mode, fn) => { const d = await idb(); return new Promise((ok, no) => { const t = d.transaction('f', mode), q = fn(t.objectStore('f')); t.oncomplete = () => ok(q?.result); t.onerror = () => no(t.error); }); };
const idbPut = (k, v) => idbDo('readwrite', st => st.put(v, k));
const idbGet = k => idbDo('readonly', st => st.get(k));
const idbDel = k => idbDo('readwrite', st => st.delete(k));

function download(name, blob){
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const shrink = (file, max, q) => new Promise((ok, no) => {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const r = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', q));
  };
  img.onerror = () => no(new Error('bad image')); img.src = url;
});
const join = (...a) => a.filter(Boolean).join(', ');

/* resume built from the profile (used for the preview, Word download and print) */
function resumeBody(){
  const inc = S.resume.include, e = esc, out = [];
  const name = field('overview', 'fullName') || 'Your name';
  const contact = [field('contact', 'email'), field('contact', 'phone'), join(field('address', 'city'), field('address', 'state'))].filter(Boolean).join(' | ');
  const sec = (t, html) => html ? `<h2>${t}</h2>${html}` : '';
  const items = id => S.more[id].map(it => `<li><b>${e(it.a)}</b>${join(it.b, it.c) ? ' - ' + e(join(it.b, it.c)) : ''}</li>`).join('');
  out.push(`<h1>${e(name)}</h1><p class="c">${e(contact)}</p>`);
  if(S.resume.objective.trim()) out.push(sec('Objective', `<p>${e(S.resume.objective.trim())}</p>`));
  if(inc.education) out.push(sec('Education', S.colleges.length ? `<ul>${S.colleges.map(c => `<li><b>${e(c.name)}</b>${join(c.course, c.branch) ? ' - ' + e(join(c.course, c.branch)) : ''}${c.years ? ' (' + e(c.years) + ')' : ''}${c.score ? ' | ' + e(c.score) : ''}</li>`).join('')}</ul>` : ''));
  if(inc.skills) out.push(sec('Skills', S.skills.length ? `<p>${S.skills.map(x => e(x.name)).join(', ')}</p>` : ''));
  if(inc.projects) out.push(sec('Projects', items('projects') && `<ul>${items('projects')}</ul>`));
  if(inc.experience) out.push(sec('Work experience', items('experience') && `<ul>${items('experience')}</ul>`));
  if(inc.certifications) out.push(sec('Certifications', items('certifications') && `<ul>${items('certifications')}</ul>`));
  if(inc.awards) [['patents', 'Patents'], ['scholarships', 'Scholarships'], ['volunteering', 'Volunteering']].forEach(([id, t]) => out.push(sec(t, items(id) && `<ul>${items(id)}</ul>`)));
  if(inc.languages) out.push(sec('Languages', S.languages.length ? `<p>${S.languages.map(e).join(', ')}</p>` : ''));
  if(inc.links){
    const ls = [...Object.entries(S.socials).map(([p, u]) => `${p}: ${u}`), ...S.links.map(l => l.url)];
    out.push(sec('Links', ls.length ? `<ul>${ls.map(l => `<li>${e(l)}</li>`).join('')}</ul>` : ''));
  }
  return out.join('');
}
const resumeDoc = () => `<html><head><meta charset="utf-8"><title>Resume</title><style>${RES_CSS}</style></head><body>${resumeBody()}</body></html>`;
const fileBase = () => (field('overview', 'fullName') || 'Resume').replace(/[^\w-]+/g, '_');

function completeness(){
  const checks = Object.values(S.sections).flatMap(s => s.fields.map(x => !!x.value.trim()));
  checks.push(!!S.photo, S.skills.length > 0, S.languages.length > 0, S.more.projects.length > 0,
    Object.keys(S.socials).length > 0, S.documents.some(d => d.status === 'uploaded') || !!S.resumeFile);
  return Math.round(100 * checks.filter(Boolean).length / checks.length);
}

/* ---------------- header ---------------- */
function renderHeader(){
  const name = field('overview', 'fullName') || 'Student', pct = completeness();
  const sub = [field('overview', 'dept'), field('overview', 'degree'), field('overview', 'batch')].filter(Boolean).join(' · ');
  const v = S.verification;
  $('#pfHeader').innerHTML = `
    <div class="pf-photo">
      ${S.photo ? `<img src="${esc(S.photo)}" alt="Profile photo">` : `<span>${esc(name[0].toUpperCase())}</span>`}
      <button class="pf-cam" data-act="photo" aria-label="Change photo">${ICON.cam}</button>
    </div>
    <div class="pf-info">
      <h1>${esc(name)}</h1>
      <div class="pf-line"><span>${esc(field('overview', 'regNo'))}</span>
        <span class="badge ${v === 'verified' ? 'badge-green' : 'badge-amber'}">${v === 'verified' ? 'Verified' : 'Unverified'}</span></div>
      ${v === 'unverified' ? `<p class="pf-note">Your profile is not verified yet. <button class="pf-linkbtn" data-act="verify">Request profile verification</button></p>`
        : v === 'requested' ? `<p class="pf-note">Verification requested. Your college placement team will review it.</p>` : ''}
      <p class="pf-sub">${esc(sub)}</p>
      <div class="pf-meta"><span><b>${S.applied}</b> applied</span>
        <span>${esc(field('contact', 'email'))}</span><span>${esc(field('contact', 'phone'))}</span></div>
      <div class="pf-links">
        ${S.links.map((l, i) => `<span class="pf-chip"><a href="${esc(fixUrl(l.url))}" target="_blank" rel="noopener noreferrer">${esc(host(l.url))}</a><button data-act="link-del" data-i="${i}" aria-label="Remove link">${ICON.x}</button></span>`).join('')}
        ${ui.addLink ? `<input class="pf-in pf-in-sm" id="pfLinkIn" placeholder="Paste a link" aria-label="Link"><button class="btn-tiny" data-act="link-save">Add</button><button class="btn-tiny" data-act="link-cancel">Cancel</button>`
          : `<button class="pf-add" data-act="link-add">${ICON.plus}Add link</button>`}
      </div>
      <div class="pf-complete"><div class="pf-ctop"><span>Profile completeness</span><b>${pct}%</b></div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div>
    </div>
    <div class="pf-short">
      <button class="btn-outline" data-act="go" data-to="jobs">Browse jobs</button>
      <button class="btn-outline" data-act="go" data-to="progress">My progress</button>
      <button class="btn-outline" data-act="tab" data-t="documents">Resume</button>
    </div>`;
}
function renderTabs(){
  $('#pfTabs').innerHTML = TABS.map(([id, label]) =>
    `<button role="tab" aria-selected="${id === tab}" class="${id === tab ? 'on' : ''}" data-act="tab" data-t="${id}">${label}</button>`).join('');
}

/* ---------------- Details ---------------- */
function secCard(id){
  const sec = S.sections[id], edit = ui.edit === id;
  return `<section class="card pf-card" data-sec="${id}">
    <div class="card-head"><div class="card-title">${sec.title}</div>
      ${edit ? `<div class="pf-btns"><button class="btn-solid pf-sm" data-act="sec-save" data-id="${id}">Save</button><button class="btn-cancel pf-sm" data-act="sec-cancel">Cancel</button></div>`
             : `<button class="btn-tiny" data-act="sec-edit" data-id="${id}">Edit</button>`}</div>
    <div class="pf-grid">${sec.fields.map(x => edit
      ? `<label class="pf-f${x.full ? ' full' : ''}"><span>${esc(x.label)}</span><input class="pf-in" data-k="${x.k}" value="${esc(x.value)}"></label>`
      : `<div class="pf-kv${x.full ? ' full' : ''}" data-hay="${esc((x.label + ' ' + x.value).toLowerCase())}"><span>${esc(x.label)}</span><b>${esc(x.value) || '<i>Not added</i>'}</b></div>`).join('')}</div>
  </section>`;
}
function details(){
  return `<div class="pf-search"><input class="pf-in" id="pfSearch" type="search" placeholder="Search any field or value…" value="${esc(ui.q || '')}" aria-label="Search fields"></div>
    ${['overview', 'contact', 'address', 'parents'].map(secCard).join('')}
    <div class="empty-state" id="pfNone" hidden><h3>No matching field</h3><p>Try another word.</p></div>`;
}
function applySearch(){
  const q = (ui.q || '').toLowerCase().trim(); let any = false;
  root.querySelectorAll('.pf-card[data-sec]').forEach(card => {
    let n = 0;
    card.querySelectorAll('.pf-kv').forEach(kv => { const hit = !q || kv.dataset.hay.includes(q); kv.hidden = !hit; if(hit) n++; });
    card.hidden = !!q && n === 0; if(!card.hidden) any = true;
  });
  const none = $('#pfNone'); if(none) none.hidden = any;
}

/* ---------------- Academics ---------------- */
const CF = [['name', 'Institution'], ['course', 'Course'], ['branch', 'Branch'], ['years', 'Years'], ['score', 'CGPA / percentage'], ['backlogs', 'Current backlogs'], ['history', 'History of backlogs']];
function academics(){
  const list = S.colleges, i = Math.min(ui.col || 0, list.length - 1), c = list[i], edit = ui.editCol;
  const side = `<div class="pf-side">${list.map((x, n) => `<button class="${n === i ? 'on' : ''}" data-act="col" data-i="${n}"><b>${esc(x.name) || 'Untitled'}</b><small>${esc(x.score)}</small></button>`).join('')}
    <button class="pf-add" data-act="col-add">${ICON.plus}Add education</button></div>`;
  if(!c) return `<div class="pf-two">${side}<div class="empty-state"><h3>No education added</h3></div></div>`;
  const body = `<section class="card pf-card">
    <div class="card-head"><div class="card-title">${esc(c.name) || 'Education'}</div>
      ${edit ? `<div class="pf-btns"><button class="btn-solid pf-sm" data-act="col-save">Save</button><button class="btn-cancel pf-sm" data-act="col-cancel">Cancel</button><button class="btn-cancel pf-sm pf-danger" data-act="col-del">Delete</button></div>`
             : `<button class="btn-tiny" data-act="col-edit">Edit</button>`}</div>
    <div class="pf-grid">${CF.map(([k, label]) => edit
      ? `<label class="pf-f"><span>${label}</span><input class="pf-in" data-c="${k}" value="${esc(c[k])}"></label>`
      : `<div class="pf-kv"><span>${label}</span><b>${esc(c[k]) || '<i>Not added</i>'}</b></div>`).join('')}</div>
    ${(c.semesters.length || edit) ? `<h4 class="pf-h4">Semester scores</h4>
      <div class="pf-sems">${c.semesters.map((s, n) => edit
        ? `<label class="pf-f"><span>${esc(s.label)}</span><input class="pf-in" data-s="${n}" value="${esc(s.gpa)}"></label>`
        : `<div class="pf-sem"><span>${esc(s.label)}</span><b>${esc(s.gpa) || '—'}</b></div>`).join('')}
        ${edit ? `<button class="pf-add" data-act="sem-add">${ICON.plus}Add semester</button>` : ''}</div>` : ''}
  </section>`;
  return `<div class="pf-two">${side}${body}</div>`;
}

/* ---------------- Skills ---------------- */
function skills(){
  return `<section class="card pf-card">
    <div class="card-head"><div class="card-title">Skills (${S.skills.length})</div>
      <div class="pf-toggle" role="group" aria-label="Layout"><button class="${S.view === 'grid' ? 'on' : ''}" data-act="view" data-v="grid">Grid</button><button class="${S.view === 'list' ? 'on' : ''}" data-act="view" data-v="list">List</button></div></div>
    <div class="pf-addrow"><input class="pf-in" id="skName" placeholder="Skill, e.g. Python" aria-label="Skill name" maxlength="40">
      <select class="pf-in" id="skLevel" aria-label="Level">${skillLevels.map(l => `<option>${l}</option>`).join('')}</select>
      <button class="btn-solid pf-sm" data-act="sk-add">Add skill</button></div>
    ${S.skills.length ? `<div class="pf-skills ${S.view}">${S.skills.map((s, i) => `<div class="pf-skill"><div><b>${esc(s.name)}</b><span class="badge badge-violet">${esc(s.level)}</span></div><button data-act="sk-del" data-i="${i}" aria-label="Remove ${esc(s.name)}">${ICON.x}</button></div>`).join('')}</div>`
      : `<p class="pf-empty">No skills added yet.</p>`}
  </section>`;
}

/* ---------------- More ---------------- */
function more(){
  const cards = moreSections.map(m => {
    const items = S.more[m.id] || [], open = ui.add === m.id;
    return `<section class="card pf-card"><div class="card-head"><div class="card-title">${m.title} (${items.length})</div>
      <button class="btn-solid pf-sm" data-act="more-open" data-id="${m.id}">${open ? 'Close' : '+ ' + m.add.replace(/^Add /, 'Add ')}</button></div>
      ${open ? `<div class="pf-addrow">${m.ph.map((p, n) => `<input class="pf-in" data-m="${n}" placeholder="${p}" aria-label="${p}" maxlength="80" value="${esc((ui.draft || [])[n] || '')}">`).join('')}</div>
        <div class="pf-proofrow"><button class="btn-outline pf-sm" data-act="proof-pick" data-id="${m.id}" data-i="new">${ui.pending ? 'Change photo proof' : 'Attach photo proof'}</button>
          ${ui.pending ? `<img class="pf-thumb" src="${esc(ui.pending)}" alt="Proof preview"><button class="pf-linkbtn" data-act="proof-new-clear">Remove</button>` : '<small>Optional: certificate, offer letter, award photo…</small>'}
          <button class="btn-solid pf-sm pf-right" data-act="more-save" data-id="${m.id}">Save</button></div>` : ''}
      ${items.length ? `<ul class="pf-items">${items.map((it, i) => `<li>${it.proof ? `<button class="pf-thumbbtn" data-act="proof-view" data-id="${m.id}" data-i="${i}" aria-label="View photo proof"><img class="pf-thumb" src="${esc(it.proof)}" alt="Photo proof"></button>` : ''}
          <div class="pf-grow"><b>${esc(it.a)}</b><small>${esc([it.b, it.c].filter(Boolean).join(' · '))}</small></div>
          ${it.proof ? '' : `<button class="pf-linkbtn" data-act="proof-pick" data-id="${m.id}" data-i="${i}">+ Add photo proof</button>`}
          <button data-act="more-del" data-id="${m.id}" data-i="${i}" aria-label="Remove">${ICON.x}</button></li>`).join('')}</ul>` : `<p class="pf-empty">Nothing added yet.</p>`}</section>`;
  }).join('');
  const soc = `<section class="card pf-card"><div class="card-head"><div class="card-title">Social media (${Object.keys(S.socials).length})</div></div>
    <p class="pf-hint">Click a platform to add or edit your link.</p>
    <div class="pf-chips">${platforms.map(p => `<button class="pf-pick ${S.socials[p] ? 'on' : ''}" data-act="soc-open" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>
    ${ui.soc ? `<div class="pf-addrow"><input class="pf-in" id="socIn" placeholder="${esc(ui.soc)} link" value="${esc(S.socials[ui.soc] || '')}" aria-label="${esc(ui.soc)} link"><button class="btn-solid pf-sm" data-act="soc-save">Save</button>${S.socials[ui.soc] ? `<button class="btn-cancel pf-sm" data-act="soc-del">Remove</button>` : ''}</div>` : ''}
  </section>`;
  const lang = `<section class="card pf-card"><div class="card-head"><div class="card-title">Languages (${S.languages.length})</div></div>
    <p class="pf-hint">Click the languages you know.</p>
    <div class="pf-chips">${languageList.map(l => `<button class="pf-pick ${S.languages.includes(l) ? 'on' : ''}" data-act="lang" data-l="${l}">${l}</button>`).join('')}</div></section>`;
  return cards + soc + lang;
}

/* ---------------- Documents ---------------- */
function resumeCard(){
  const f = S.resumeFile, ed = ui.editResume;
  const editor = ed ? `<div class="pf-editor"><div>
      <label class="pf-f"><span>Career objective / summary</span><textarea class="pf-in" id="resObj" rows="4" maxlength="500" placeholder="One or two lines about what you are looking for">${esc(S.resume.objective)}</textarea></label>
      <div class="pf-inc"><span>Include sections</span>${INC.map(([k, l]) => `<label class="pf-chk"><input type="checkbox" data-inc="${k}" ${S.resume.include[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      <p class="pf-hint">Name and contact come from the Details tab, education from Academics, and the rest from Skills and More. Change those tabs and the resume updates.</p></div>
      <div class="pf-paper" id="resPaper">${resumeBody()}</div></div>` : '';
  return `<section class="card pf-card"><div class="card-head"><div class="card-title">Resume</div></div>
    <div class="pf-rrow"><div class="pf-grow"><b>Uploaded resume</b><small>${f ? esc(f.name) + ' · ' + Math.max(1, Math.round(f.size / 1024)) + ' KB · ' + esc(f.date) : 'No file uploaded yet'}</small></div>
      <div class="pf-btns"><button class="btn-outline" data-act="res-up">${f ? 'Replace' : 'Upload'}</button>
      ${f ? `<button class="btn-solid pf-sm" data-act="res-dl">Download</button><button class="pf-xbtn" data-act="res-del" aria-label="Remove uploaded resume">${ICON.x}</button>` : ''}</div></div>
    <div class="pf-rrow"><div class="pf-grow"><b>Resume from your profile</b><small>Built from your details, skills and projects. Edit it, then download.</small></div>
      <div class="pf-btns"><button class="btn-outline" data-act="res-edit">${ed ? 'Close editor' : 'Edit resume'}</button>
      <button class="btn-solid pf-sm" data-act="res-doc">Download (Word)</button><button class="btn-outline" data-act="res-pdf">Print / PDF</button></div></div>
    ${editor}</section>`;
}
function documents(){
  return resumeCard() + `<section class="card pf-card"><div class="card-head"><div class="card-title">Other documents</div>
    <button class="btn-solid pf-sm" data-act="doc-new">+ Add new</button></div>
    ${ui.newDoc ? `<div class="pf-addrow"><input class="pf-in" id="docName" placeholder="Document name" aria-label="Document name" maxlength="60"><button class="btn-solid pf-sm" data-act="doc-create">Add</button></div>` : ''}
    <ul class="pf-items">${S.documents.map((d, i) => d.name === 'Resume' ? '' : `<li><div><b>${esc(d.name)}</b><small>${esc(d.meta)}</small></div>
      <div class="pf-btns"><span class="badge ${d.status === 'uploaded' ? 'badge-green' : 'badge-amber'}">${d.status === 'uploaded' ? 'Uploaded' : 'Missing'}</span>
      <button class="btn-outline" data-act="doc-up" data-i="${i}">${d.status === 'uploaded' ? 'Replace' : 'Upload'}</button>
      <button data-act="doc-del" data-i="${i}" aria-label="Remove ${esc(d.name)}">${ICON.x}</button></div></li>`).join('')}</ul>
    <p class="pf-hint">For now only the file name is saved on this device. Real uploads need the backend.</p></section>`;
}

const PANELS = { details, academics, skills, more, documents };
function renderPanel(){
  $('#pfPanel').innerHTML = PANELS[tab]();
  if(tab === 'details') applySearch();
}
function render(){ renderHeader(); renderTabs(); renderPanel(); }
const commit = () => { save(); render(); };

/* ---------------- actions ---------------- */
function photo(file){
  if(!file || !file.type.startsWith('image/')) return toast('Please choose an image file.');
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
    const r = Math.max(s / img.width, s / img.height), w = img.width * r, h = img.height * r;
    c.getContext('2d').drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
    S.photo = c.toDataURL('image/jpeg', 0.82); URL.revokeObjectURL(url); commit();
  };
  img.onerror = () => toast('Could not read that image.');
  img.src = url;
}

function closeProof(){ root.querySelector('#pfLb')?.remove(); ui.lb = null; }
function showProof(id, i){
  const it = S.more[id][i]; if(!it?.proof) return;
  closeProof(); ui.lb = { id, i };
  root.insertAdjacentHTML('beforeend', `<div class="pf-lb" id="pfLb"><div class="pf-lbbox" role="dialog" aria-label="Photo proof">
    <img src="${esc(it.proof)}" alt="Photo proof for ${esc(it.a)}"><p>${esc(it.a)}</p>
    <div class="pf-btns"><button class="btn-outline" data-act="proof-pick" data-id="${id}" data-i="${i}">Replace</button>
    <button class="btn-cancel pf-danger" data-act="proof-del">Remove</button><button class="btn-solid pf-sm" data-act="lb-close">Close</button></div></div></div>`);
}

/* keeps what was typed in the add form while the page re-draws */
const keepDraft = () => { ui.draft = [0, 1, 2].map(n => val(`[data-m="${n}"]`)); };

const A = {
  tab: d => { closeProof(); tab = d.t; ui = {}; render(); window.scrollTo({ top: 0 }); },
  go: d => navigate(d.to),
  photo: () => $('#pfPhotoIn').click(),
  verify: () => { S.verification = 'requested'; commit(); toast('Verification requested.'); },
  'link-add': () => { ui.addLink = true; renderHeader(); $('#pfLinkIn')?.focus(); },
  'link-cancel': () => { ui.addLink = false; renderHeader(); },
  'link-save': () => { const u = val('#pfLinkIn'); if(!u) return; S.links.push({ url: u }); ui.addLink = false; commit(); },
  'link-del': d => { S.links.splice(+d.i, 1); commit(); },

  'sec-edit': d => { ui.edit = d.id; renderPanel(); },
  'sec-cancel': () => { ui.edit = null; renderPanel(); },
  'sec-save': d => {
    const sec = S.sections[d.id];
    for(const x of sec.fields){
      const v = (root.querySelector(`[data-k="${x.k}"]`)?.value ?? x.value).trim();
      if((x.k === 'email' || x.k === 'altEmail' || x.k === 'fEmail' || x.k === 'mEmail') && v && !/^\S+@\S+\.\S+$/.test(v)) return toast(`"${x.label}" is not a valid email.`);
      x.value = v;
    }
    ui.edit = null; commit(); toast('Saved.');
  },

  col: d => { ui.col = +d.i; ui.editCol = false; renderPanel(); },
  'col-add': () => { S.colleges.push({ name: 'New institution', course: '', branch: '', years: '', score: '', backlogs: '', history: '', semesters: [] }); ui.col = S.colleges.length - 1; ui.editCol = true; commit(); },
  'col-edit': () => { ui.editCol = true; renderPanel(); },
  'col-cancel': () => { ui.editCol = false; renderPanel(); },
  'col-save': () => {
    const c = S.colleges[ui.col || 0];
    CF.forEach(([k]) => { c[k] = val(`[data-c="${k}"]`); });
    c.semesters.forEach((s, n) => { s.gpa = val(`[data-s="${n}"]`); });
    ui.editCol = false; commit(); toast('Saved.');
  },
  'col-del': () => { if(!confirm('Delete this education entry?')) return; S.colleges.splice(ui.col || 0, 1); ui.col = 0; ui.editCol = false; commit(); },
  'sem-add': () => { const c = S.colleges[ui.col || 0]; c.semesters.forEach((s, n) => { s.gpa = val(`[data-s="${n}"]`); }); c.semesters.push({ label: 'SEM ' + (c.semesters.length + 1), gpa: '' }); renderPanel(); },

  'sk-add': () => {
    const name = val('#skName'); if(!name) return toast('Type a skill name first.');
    if(S.skills.some(s => s.name.toLowerCase() === name.toLowerCase())) return toast('You already added that skill.');
    S.skills.push({ name, level: val('#skLevel') }); commit();
  },
  'sk-del': d => { S.skills.splice(+d.i, 1); commit(); },
  view: d => { S.view = d.v; commit(); },

  'more-open': d => { ui.add = ui.add === d.id ? null : d.id; ui.pending = null; ui.draft = null; renderPanel(); },
  'more-save': d => {
    const [a, b, c] = [0, 1, 2].map(n => val(`[data-m="${n}"]`));
    if(!a) return toast('Please fill in the first box.');
    S.more[d.id].push({ a, b, c, proof: ui.pending || '' }); ui.add = null; ui.pending = null; ui.draft = null; commit();
  },
  'more-del': d => { S.more[d.id].splice(+d.i, 1); commit(); },
  'soc-open': d => { ui.soc = ui.soc === d.p ? null : d.p; renderPanel(); $('#socIn')?.focus(); },
  'soc-save': () => { const u = val('#socIn'); if(!u) return; S.socials[ui.soc] = fixUrl(u); ui.soc = null; commit(); },
  'soc-del': () => { delete S.socials[ui.soc]; ui.soc = null; commit(); },
  lang: d => { const i = S.languages.indexOf(d.l); i < 0 ? S.languages.push(d.l) : S.languages.splice(i, 1); commit(); },

  'proof-pick': d => { ui.proofTo = { id: d.id, i: d.i }; if(d.i === 'new') keepDraft(); $('#pfProofIn').click(); },
  'proof-new-clear': () => { keepDraft(); ui.pending = null; renderPanel(); },
  'proof-view': d => showProof(d.id, +d.i),
  'proof-del': () => { const { id, i } = ui.lb; delete S.more[id][i].proof; closeProof(); commit(); },
  'lb-close': () => closeProof(),

  'res-up': () => $('#pfResumeIn').click(),
  'res-dl': async () => {
    try{ const b = await idbGet('resume'); if(!b) return toast('The file is not on this device any more. Please upload it again.'); download(S.resumeFile.name, b); }
    catch{ toast('Could not read the saved file.'); }
  },
  'res-del': async () => { if(!confirm('Remove the uploaded resume file?')) return; try{ await idbDel('resume'); }catch{} S.resumeFile = null; commit(); },
  'res-edit': () => { ui.editResume = !ui.editResume; renderPanel(); },
  'res-doc': () => download(fileBase() + '_Resume.doc', new Blob(['\ufeff' + resumeDoc()], { type: 'application/msword' })),
  'res-pdf': () => {
    const fr = Object.assign(document.createElement('iframe'), { className: 'pf-print' });
    document.body.appendChild(fr); const d = fr.contentDocument; d.open(); d.write(resumeDoc()); d.close();
    setTimeout(() => { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 2000); }, 250);
  },

  'doc-up': d => { ui.upDoc = +d.i; $('#pfDocIn').click(); },
  'doc-del': d => { const doc = S.documents[+d.i]; if(!confirm(`Remove "${doc.name}"?`)) return; S.documents.splice(+d.i, 1); commit(); },
  'doc-new': () => { ui.newDoc = !ui.newDoc; renderPanel(); $('#docName')?.focus(); },
  'doc-create': () => { const n = val('#docName'); if(!n) return; S.documents.push({ name: n, meta: 'Not uploaded yet', status: 'missing' }); ui.newDoc = false; commit(); },
};

export function mount(){
  S = load(); tab = 'details'; ui = {};
  root = $('#view-profile');
  render();

  root.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if(el) A[el.dataset.act]?.(el.dataset);
  });
  const refreshPaper = () => { const p = $('#resPaper'); if(p) p.innerHTML = resumeBody(); };
  root.addEventListener('input', e => {
    if(e.target.id === 'pfSearch'){ ui.q = e.target.value; applySearch(); }
    if(e.target.id === 'resObj'){ S.resume.objective = e.target.value; save(); refreshPaper(); }
  });
  root.addEventListener('change', e => {
    if(e.target.dataset.inc){ S.resume.include[e.target.dataset.inc] = e.target.checked; save(); refreshPaper(); }
  });
  root.addEventListener('click', e => { if(e.target.id === 'pfLb') closeProof(); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && ui.lb) closeProof(); });
  $('#pfProofIn').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if(!f) return;
    if(!f.type.startsWith('image/')) return toast('Please choose an image file.');
    let url; try{ url = await shrink(f, 900, 0.72); }catch{ return toast('Could not read that image.'); }
    const t = ui.proofTo; if(!t) return;
    if(t.i === 'new'){ ui.pending = url; renderPanel(); return; }
    closeProof(); S.more[t.id][+t.i].proof = url; commit(); toast('Photo proof saved.');
  });
  $('#pfResumeIn').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if(!f) return;
    if(f.size > 5 * 1024 * 1024) return toast('Please choose a file under 5 MB.');
    try{ await idbPut('resume', f); }catch{ return toast('Could not store the file in this browser.'); }
    S.resumeFile = { name: f.name, size: f.size, date: today() }; commit(); toast('Resume uploaded.');
  });
  root.addEventListener('keydown', e => {
    if(e.key !== 'Enter') return;
    const map = { skName: 'sk-add', socIn: 'soc-save', docName: 'doc-create', pfLinkIn: 'link-save' };
    const act = map[e.target.id]; if(act) A[act]();
  });
  $('#pfPhotoIn').addEventListener('change', e => { photo(e.target.files[0]); e.target.value = ''; });
  $('#pfDocIn').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = ''; if(!f) return;
    if(f.size > 5 * 1024 * 1024) return toast('Please choose a file under 5 MB.');
    const d = S.documents[ui.upDoc]; if(!d) return;
    d.meta = `${f.name} · ${Math.max(1, Math.round(f.size / 1024))} KB · ${today()}`; d.status = 'uploaded'; commit();
  });
}
