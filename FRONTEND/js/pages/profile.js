/* profile.js — student profile (Details, Academics, Freeze, Skills, More, Evidence, Documents, Settings) */
import { $, $$, esc } from '../core/dom.js';
import { api, getToken } from '../core/api.js';
import { profileMeta } from '../data/profile.data.js';
import { navigate } from '../core/router.js';

const TABS = ['Details','Academics','Freeze','Skills','More','Evidence','Documents','Settings'];
const PROF = ['Beginner','Intermediate','Advance','Professional'];
const SOCIAL = ['GitHub','LeetCode','CodeChef','HackerRank','Codeforces','HackerEarth','CodePen','Stack Overflow','Codecademy','Codewars','Exercism','SPOJ','Topcoder','GitLab','Bitbucket','Dev.to','SourceForge','Hacker News','Dribbble','Behance','Portfolio Website','YouTube','Reddit','Twitter','Facebook','Instagram','Snapchat','TikTok','Pinterest','Product Hunt','Indie Hackers','AngelList','LinkedIn','Other'];
const LANGS = ['Telugu','Hindi','English','Tamil','Kannada','Malayalam','Marathi','Bengali','Gujarati','Punjabi','Urdu','Odia','Sanskrit','Other'];
const adr = p => [['City',p+'City'],['District',p+'Dist'],['State',p+'State'],['Country',p+'Country'],['Pin Code',p+'Pin'],['Address',p+'Addr']];
const par = (w,p) => [[w+'\'s Name',p+'Name'],[w+'\'s Email',p+'Email'],[w+'\'s Contact',p+'Phone'],[w+'\'s Occupation',p+'Job'],[w+'\'s Company',p+'Co'],[w+'\'s Office Address',p+'Off']];
const DET = [
  ['Student Overview',0,[['Full Name','name'],['First Name','first'],['Last Name','last'],['Roll Number','regNo'],['Career Path','career'],['Gender','gender'],['Birthday','dob'],['Person With Disability','pwd'],['Differently Abled Person','da'],['T&P Attendance','tpAtt'],['Academics Attendance','acAtt'],['RFID','rfid']]],
  ['Point of Contact',0,[['Mentor','mentor'],['Advisor','advisor'],['Coordinator','coord']]],
  ['Student Identity',0,[['Day Scholar','dayScholar'],['Nationality','nation'],['Aadhaar Number','aadhaar'],['Driving Licence','dl'],['Passport Number','passNo'],['Passport Issue Date','passIssue'],['Passport Expiry','passExp']]],
  ['Contact Details',1,[['Communication Email','email'],['Phone Number','phone'],['Personal Email','pemail'],['Alt. Phone Number','phone2'],['WhatsApp Number','wa'],['Alternative Email','email2']]],
  ['Current Address',1,adr('c')], ['Permanent Address',1,adr('p')],
  ['Father',1,par('Father','f')], ['Mother',1,par('Mother','m')],
];
const MORE = [
  ['work','Work Experience','Add Experience',[['title','Role'],['org','Company'],['period','Duration'],['desc','Description','area']]],
  ['projects','Projects','Add Project',[['title','Project name'],['org','Technologies'],['link','Link'],['desc','Description','area']]],
  ['certs','Certifications','Add Certification',[['title','Certification'],['org','Issuer'],['period','Year'],['link','Credential link']]],
  ['pubs','Publications','Add Publication',[['title','Title'],['org','Publisher'],['period','Year'],['link','Link']]],
  ['confs','Conferences & Workshops','Add Conference',[['title','Name'],['org','Organiser'],['period','Date'],['desc','Description','area']]],
  ['awards','Awards','Add Award',[['title','Award'],['org','Awarded by'],['period','Year'],['desc','Description','area']]],
  ['comps','Competitions','Add Competition',[['title','Competition'],['org','Organiser'],['period','Year'],['desc','Result / role']]],
  ['tests','Test Scores','Add Test Score',[['title','Test'],['org','Score'],['period','Year']]],
  ['patents','Patents','Add Patent',[['title','Title'],['org','Patent number'],['period','Year'],['link','Link']]],
  ['vol','Volunteering','Add Volunteering',[['title','Role'],['org','Organisation'],['period','Duration'],['desc','Description','area']]],
  ['eca','Extra Curricular Activities','Add Activity',[['title','Activity'],['org','Club / Body'],['period','Year'],['desc','Description','area']]],
  ['writes','Write Ups','Add Write Up',[['title','Title'],['org','Platform'],['link','Link'],['desc','Summary','area']]],
  ['breaks','Career Breaks','Add Career Break',[['title','Reason'],['period','Duration'],['desc','Details','area']]],
];
const ACAD = [['level','Level (Current / 12th / 10th)'],['inst','Institution'],['course','Course'],['branch','Branch'],['cgpa','CGPA / %'],['year','Year'],['arrears','Current arrears']];

let P, S, tab = 'Details', editing = null, view = 'grid', evMode = 'Skills', evFilter = 'All', q = '';
const key = () => 'stepupProfile:' + (P.d.regNo || 'guest');
const save = () => { try{ localStorage.setItem(key(), JSON.stringify(S)); }catch{} };
const val = k => (P.d[k] ?? '') === '' ? '-' : P.d[k];

async function load(){
  let me = null, st = null;
  try{ st = JSON.parse(localStorage.getItem('stepupStudent') || 'null'); }catch{}
  if(getToken()){ try{ me = (await api('/student/me')).data; }catch{} }
  const b = me || st || {};
  const d = { name:b.name || profileMeta.name, regNo:b.reg_no || profileMeta.regNo, email:b.email || '', phone:b.phone || '',
    dob:(b.dob || '').slice(0,10), gender:b.gender || '', cCountry:'India', nation:'Indian' };
  d.first = d.name.split(' ')[0]; d.last = d.name.split(' ').slice(1).join(' ');
  P = { d, base:b, logged:!!me };
  let ext = {};
  try{ ext = JSON.parse(localStorage.getItem(key()) || '{}'); }catch{}
  S = Object.assign({ d:{}, acad:[], skills:null, more:{}, social:{}, langs:{}, docs:[], links:[], over:{}, notif:{all:true}, photo:'', verified:false, requested:false }, ext);
  if(!S.acad.length && (b.college || b.department)) S.acad = [{ level:'Current', inst:b.college || '', course:b.degree || '', branch:b.department || '', cgpa:b.cgpa || '', year:b.graduation_year || '', arrears:'0' }];
  if(!S.skills) S.skills = (b.skills || []).map(n => ({ name:n, prof:'Intermediate' }));
  ['linkedin','github','portfolio'].forEach(k => { const n = {linkedin:'LinkedIn',github:'GitHub',portfolio:'Portfolio Website'}[k]; if(b[k] && !S.social[n]) S.social[n] = b[k]; });
  (b.languages || []).forEach(l => { if(!S.langs[l]) S.langs[l] = 'Intermediate'; });
  Object.assign(P.d, S.d);
}

export async function mount(){
  await load();
  const want = sessionStorage.getItem('pfTab'); sessionStorage.removeItem('pfTab');
  tab = TABS.includes(want) ? want : 'Details'; editing = null; q = '';
  render();
}
window.addEventListener('pf-tab', e => { if($('#pfBody') && TABS.includes(e.detail)){ tab = e.detail; editing = null; render(); } });

function render(){ head(); $('#pfTabs').innerHTML = TABS.map(t => `<button class="${t===tab?'on':''}" data-t="${t}">${t}</button>`).join('');
  $$('#pfTabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; editing = null; q = ''; render(); });
  $('#pfBody').innerHTML = ({Details:details,Academics:academics,Freeze:freeze,Skills:skills,More:more,Evidence:evidence,Documents:documents,Settings:settings})[tab]();
  bind(); }

function head(){
  const a = S.acad[0] || {}, d = P.d;
  $('#pfHead').innerHTML = `<div class="pf-top">
    <label class="pf-photo" title="Change photo">${S.photo ? `<img src="${S.photo}" alt="">` : `<span>${esc(d.name[0] || 'S')}</span>`}<i>&#128247;</i><input type="file" id="pfPhoto" accept="image/*" hidden></label>
    <div class="pf-id"><h1>${esc(d.name)}</h1>
      <div class="pf-reg">${esc(d.regNo)} <span class="pf-badge ${S.verified?'ok':'warn'}">${S.verified?'Verified':'Unverified'}</span></div>
      ${S.verified ? '' : `<p class="pf-note">${S.requested ? 'Verification requested. Your placement team will review your profile.' : 'Your profile is not verified yet. <a href="#" id="pfReq">Request profile verification</a>.'}</p>`}
      <p class="pf-sub">${esc([a.branch, a.course, a.year].filter(Boolean).join(' · ') || 'Add your academics')}</p>
      <p class="pf-contact"><b>0</b> applied ${d.email ? ` &nbsp;&#9993; <b>${esc(d.email)}</b>` : ''} ${d.phone ? ` &nbsp;&#9742; <b>${esc(d.phone)}</b>` : ''}</p></div></div>
    <div class="pf-actions"><div class="pf-links">${S.links.map((l,i) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a><button data-rl="${i}" title="Remove">&times;</button>`).join('')}<button class="pf-ghost" id="pfLink">+ Add Link</button></div>
    <div class="pf-btns"><button class="pf-pill" data-soon="Offers">0 Offers</button><button class="pf-pill pri" id="pfTrack">Job Tracker</button><button class="pf-pill" data-soon="Surveys">Surveys</button><button class="pf-pill" data-soon="Resumes">Resumes</button><button class="pf-pill" data-soon="Reports">Reports</button></div></div>`;
}

const row = (l,v) => `<div class="pf-row"><span>${esc(l)}</span><b>${esc(v)}</b></div>`;
function details(){
  const ql = q.toLowerCase();
  return `<div class="pf-search"><input id="pfQ" placeholder="Search any field or value..." value="${esc(q)}"></div>` + DET.map(([t,ed,f]) => {
    if(editing === t) return `<section class="pf-sec"><div class="pf-sh"><h2>${t}</h2></div><div class="pf-form">${f.map(([l,k]) => `<label>${esc(l)}<input data-k="${k}" value="${esc(P.d[k] || '')}"></label>`).join('')}</div><div class="pf-fa"><button class="pf-pill" id="dCancel">Cancel</button><button class="pf-pill pri" id="dSave">Save</button></div></section>`;
    const rows = f.filter(([l,k]) => !ql || (l + ' ' + val(k)).toLowerCase().includes(ql));
    if(!rows.length) return '';
    return `<section class="pf-sec"><div class="pf-sh"><h2>${t}</h2>${ed ? `<button class="pf-edit" data-ed="${t}">Edit</button>` : ''}</div><div class="pf-grid">${rows.map(([l,k]) => row(l, k==='aadhaar' && P.d[k] ? 'XXXX XXXX ' + String(P.d[k]).slice(-4) : val(k))).join('')}</div></section>`;
  }).join('');
}

function academics(){
  const i = Math.min(S.acadSel || 0, S.acad.length - 1), a = S.acad[i];
  return `<section class="pf-card"><div class="pf-sh"><h2>Academics</h2><button class="pf-pill pri" id="acAdd">+ Add</button></div>` + (!a ? '<p class="pf-empty">No academic records yet.</p>' :
    `<div class="pf-ac"><div class="pf-aside">${S.acad.map((x,n) => `<button class="${n===i?'on':''}" data-a="${n}"><em>${esc(x.level)}</em>${esc(x.inst)}<small>${esc(x.cgpa)} CGPA</small></button>`).join('')}</div>
    <div class="pf-adet"><h3>${esc(a.branch || a.course)}</h3><p class="pf-sub">${esc(a.year)}</p><div class="pf-big">${esc(a.cgpa || '-')}<small> CGPA</small></div>
    <div class="pf-grid">${row('College',a.inst||'-')}${row('Course',a.course||'-')}${row('Branch',a.branch||'-')}${row('Current Arrears',a.arrears||'0')}</div>
    <div class="pf-fa"><button class="pf-pill" id="acEdit">Edit</button><button class="pf-pill" id="acDel">Remove</button></div></div></div>`) + '</section>';
}

function freeze(){ return `<section class="pf-card"><div class="pf-sh"><h2>Freeze</h2><button class="pf-pill" id="frDl">Download History</button></div></section><section class="pf-card"><div class="pf-sh"><h2>Freeze History</h2></div><p class="pf-empty">No freeze history found.</p></section>`; }

function skills(){
  return `<section class="pf-card"><div class="pf-sh"><h2>Skills (${S.skills.length})</h2><div><button class="pf-pill ${view==='grid'?'on':''}" data-v="grid">Grid</button><button class="pf-pill ${view==='list'?'on':''}" data-v="list">List</button><button class="pf-pill pri" id="skAdd">+ Add Skill</button></div></div>` +
    (S.skills.length ? `<div class="pf-skills ${view}">${S.skills.map((s,i) => `<div class="pf-skill"><b>${esc(s.name)}</b><span>${esc(s.prof)}</span><button data-rs="${i}" title="Remove">&times;</button></div>`).join('')}</div>` : '<p class="pf-empty">No skills added yet.</p>') + '</section>';
}

function more(){
  const chips = (title, list, store, hint) => `<section class="pf-card"><div class="pf-sh"><h2>${title} (${Object.keys(S[store]).length})</h2></div><p class="pf-hint">${hint}</p><div class="pf-chips">${list.map(n => `<button class="${S[store][n]?'on':''}" data-c="${store}|${esc(n)}">${esc(n)}</button>`).join('')}</div></section>`;
  return MORE.map(([k,t,add]) => { const it = S.more[k] || [];
    return `<section class="pf-card"><div class="pf-sh"><h2>${t} (${it.length})</h2><button class="pf-pill pri" data-m="${k}">+ ${add}</button></div>` +
      (it.length ? it.map((x,i) => `<div class="pf-item"><div><b>${esc(x.title || '')}</b> <small>${esc([x.org, x.period].filter(Boolean).join(' · '))}</small><p>${esc(x.desc || '')}</p>${x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.link)}</a>` : ''}</div><button data-mr="${k}|${i}" title="Remove">&times;</button></div>`).join('') : `<p class="pf-empty">No ${t.toLowerCase()} added yet.</p>`) + '</section>'; }).join('') +
    chips('Social Media', SOCIAL, 'social', 'Click a platform to add or edit your link.') + chips('Languages', LANGS, 'langs', 'Click a language to add or edit proficiency.');
}

const mentions = s => MORE.filter(([k]) => (S.more[k] || []).some(x => JSON.stringify(x).toLowerCase().includes(s.name.toLowerCase()))).map(m => m[0]);
const score = s => S.over[s.name] ?? Math.min(10, (PROF.indexOf(s.prof) + 1) * 2 + mentions(s).length);
function evidence(){
  const rows = S.skills.filter(s => (!q || s.name.toLowerCase().includes(q.toLowerCase())) && (evFilter==='All' || (evFilter==='Verified') === (mentions(s).length > 0)));
  let body = '';
  if(!S.skills.length) body = '<p class="pf-empty">No skill evidence yet. Link skills to projects or other items in the <b>More</b> tab.</p>';
  else if(evMode === 'Skills') body = rows.map(s => `<div class="pf-item"><div><b>${esc(s.name)}</b> <small>${mentions(s).length ? 'Verified' : 'Unverified'} · ${esc(s.prof)}</small></div><span class="pf-score">${score(s)}/10</span></div>`).join('') || '<p class="pf-empty">No matching skills.</p>';
  else if(evMode === 'Sections') body = MORE.map(([k,t]) => row(t, (S.more[k] || []).length + ' items')).join('');
  else if(evMode === 'Matrix') body = `<div class="pf-scroll"><table class="pf-mx"><tr><th>Skill</th>${MORE.map(m => `<th>${m[1]}</th>`).join('')}</tr>${S.skills.map(s => `<tr><td>${esc(s.name)}</td>${MORE.map(m => `<td>${mentions(s).includes(m[0]) ? '&#10003;' : ''}</td>`).join('')}</tr>`).join('')}</table></div>`;
  else body = `<p class="pf-hint">Set a final score for a skill. Overrides replace the computed score until removed.</p><div class="pf-fa l"><select id="ovS">${S.skills.map(s => `<option>${esc(s.name)}</option>`).join('') || '<option>No skills on file yet</option>'}</select><input id="ovV" type="number" min="0" max="10" value="7"><button class="pf-pill pri" id="ovAdd">Apply</button></div>` + Object.entries(S.over).map(([n,v]) => `<div class="pf-item"><div><b>${esc(n)}</b> <small>Override: ${v}/10</small></div><button data-ro="${esc(n)}">&times;</button></div>`).join('');
  return `<section class="pf-card"><div class="pf-sh"><h2>Skill evidence</h2><button class="pf-pill" id="evDl">Download</button></div><p class="pf-hint">Proof of ability from portfolio work. Scores blend your self-rating with the items linked to each skill.</p>
    <div class="pf-sh"><input id="pfQ" class="pf-in" placeholder="Search skill..." value="${esc(q)}"><div>${['Skills','Sections','Matrix','Overrides'].map(m => `<button class="pf-pill ${m===evMode?'on':''}" data-em="${m}">${m}</button>`).join('')}</div></div>
    ${evMode==='Skills' ? `<div class="pf-fa l">${['All','Verified','Unverified'].map(f => `<button class="pf-pill ${f===evFilter?'on':''}" data-ef="${f}">${f}</button>`).join('')}</div>` : ''}${body}</section>`;
}

function documents(){ return `<section class="pf-card"><div class="pf-sh"><h2>Documents</h2><label class="pf-pill pri">+ Add New<input type="file" id="docAdd" hidden></label></div>` +
  (S.docs.length ? S.docs.map((x,i) => `<div class="pf-item"><div><b>${esc(x.name)}</b> <small>${esc(x.size)} · added ${esc(x.date)}</small></div><button data-rd="${i}" title="Remove">&times;</button></div>`).join('') : '<p class="pf-empty">No documents to show.</p>') + '<p class="pf-hint">Only file names are stored for now; the files stay on your device.</p></section>'; }

function settings(){
  const tg = (id, on, l) => `<label class="pf-tg"><input type="checkbox" data-n="${id}" ${on?'checked':''}> ${l}</label>`;
  return `<section class="pf-card"><div class="pf-sh"><h2>Reset Password</h2></div><div class="pf-row"><span>Student username</span><b>${esc(P.d.regNo)}</b></div><div class="pf-fa l"><a class="pf-pill pri" href="student-change-password.html">Change password</a></div></section>
  <section class="pf-card"><div class="pf-sh"><h2>Email verification</h2></div><div class="pf-row"><span>Email</span><b>${esc(P.d.email || '-')} <span class="pf-badge ${S.verified?'ok':'warn'}">${S.verified?'Verified':'Unverified'}</span></b></div></section>
  <section class="pf-card"><div class="pf-sh"><h2>Email notifications</h2></div><p class="pf-hint">Choose which emails you receive.</p>${tg('all', S.notif.all, 'All notifications')}${['Jobs','Notices','Rounds','Surveys'].map(n => tg(n, S.notif.all && S.notif[n] !== false, n)).join('')}</section>
  <section class="pf-card"><div class="pf-sh"><h2>College Payments</h2></div><p class="pf-empty">No payments due.</p></section>`;
}

/* ---------- helpers ---------- */
function toast(m){ const t = document.createElement('div'); t.className = 'pf-toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }
function modal(title, fields, v, onSave){
  const o = document.createElement('div'); o.className = 'pf-modal';
  o.innerHTML = `<form><h3>${esc(title)}</h3>${fields.map(([k,l,t]) => `<label>${esc(l)}${t==='area' ? `<textarea name="${k}">${esc(v[k] || '')}</textarea>` : `<input name="${k}" value="${esc(v[k] || '')}">`}</label>`).join('')}<div class="pf-fa"><button type="button" class="pf-pill" data-x>Cancel</button><button class="pf-pill pri">Save</button></div></form>`;
  document.body.appendChild(o);
  o.onclick = e => { if(e.target === o || e.target.hasAttribute('data-x')) o.remove(); };
  o.querySelector('form').onsubmit = e => { e.preventDefault(); const r = Object.fromEntries(new FormData(e.target)); if(!String(r[fields[0][0]]).trim()) return; onSave(r); o.remove(); save(); render(); };
  o.querySelector('input,textarea').focus();
}
function pick(title, opts, onPick){
  const o = document.createElement('div'); o.className = 'pf-modal';
  o.innerHTML = `<form><h3>${esc(title)}</h3><div class="pf-chips">${opts.map(x => `<button type="button" data-p="${esc(x)}">${esc(x)}</button>`).join('')}</div><div class="pf-fa"><button type="button" class="pf-pill" data-x>Cancel</button></div></form>`;
  document.body.appendChild(o);
  o.onclick = e => { if(e.target === o || e.target.hasAttribute('data-x')) o.remove(); const p = e.target.dataset.p; if(p){ o.remove(); onPick(p); } };
}
const dl = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type:'text/csv'})); a.download = name; a.click(); };
function syncCore(){
  if(!P.logged) return;
  const b = P.base, d = P.d;
  api('/student/profile', { method:'PUT', body:JSON.stringify({ name:d.name, regNo:d.regNo, email:d.email, phone:d.phone, dob:d.dob, gender:d.gender, address:d.cAddr || b.address, college:b.college, degree:b.degree || 'B.Tech', department:b.department || 'N/A', graduationYear:b.graduation_year, cgpa:b.cgpa, education:b.education, skills:S.skills.map(s => s.name), languages:Object.keys(S.langs), experience:b.experience, achievements:b.achievements, certifications:b.certifications, projects:b.projects, summary:b.summary, linkedin:S.social.LinkedIn, github:S.social.GitHub, portfolio:S.social['Portfolio Website'] }) }).catch(() => {});
}

function bind(){
  const on = (sel, fn) => $$(sel).forEach(el => el.addEventListener('click', e => fn(el, e)));
  $('#pfPhoto')?.addEventListener('change', e => { const f = e.target.files[0]; if(!f) return; const im = new Image(); im.onload = () => { const c = document.createElement('canvas'), r = 240 / Math.max(im.width, im.height, 240); c.width = im.width * r; c.height = im.height * r; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); S.photo = c.toDataURL('image/jpeg', .8); save(); render(); }; im.src = URL.createObjectURL(f); });
  $('#pfReq')?.addEventListener('click', e => { e.preventDefault(); S.requested = true; save(); render(); });
  $('#pfLink')?.addEventListener('click', () => modal('Add link', [['name','Label'],['url','URL']], {}, r => S.links.push(r)));
  on('[data-rl]', b => { S.links.splice(+b.dataset.rl, 1); save(); render(); });
  $('#pfTrack')?.addEventListener('click', () => navigate('progress'));
  on('[data-soon]', b => toast(b.dataset.soon + ' is coming soon.'));
  const qi = $('#pfQ'); if(qi) qi.oninput = () => { q = qi.value; const p = qi.selectionStart; render(); const n = $('#pfQ'); n.focus(); n.setSelectionRange(p, p); };
  on('[data-ed]', b => { editing = b.dataset.ed; render(); });
  $('#dCancel')?.addEventListener('click', () => { editing = null; render(); });
  $('#dSave')?.addEventListener('click', () => { $$('.pf-form [data-k]').forEach(i => P.d[i.dataset.k] = i.value.trim()); DET.flatMap(s => s[2]).forEach(([,k]) => { if(P.d[k] !== undefined) S.d[k] = P.d[k]; }); editing = null; save(); syncCore(); render(); toast('Saved'); });
  on('[data-a]', b => { S.acadSel = +b.dataset.a; render(); });
  $('#acAdd')?.addEventListener('click', () => modal('Add academic record', ACAD, {}, r => S.acad.push(r)));
  $('#acEdit')?.addEventListener('click', () => { const i = S.acadSel || 0; modal('Edit academic record', ACAD, S.acad[i], r => S.acad[i] = r); });
  $('#acDel')?.addEventListener('click', () => { S.acad.splice(S.acadSel || 0, 1); S.acadSel = 0; save(); render(); });
  $('#frDl')?.addEventListener('click', () => dl('freeze-history.csv', 'Date,Action,Status\n'));
  on('[data-v]', b => { view = b.dataset.v; render(); });
  $('#skAdd')?.addEventListener('click', () => modal('Add skill', [['name','Skill name']], {}, r => pick('Proficiency', PROF, p => { S.skills.push({ name:r.name.trim(), prof:p }); save(); syncCore(); render(); })));
  on('[data-rs]', b => { S.skills.splice(+b.dataset.rs, 1); save(); syncCore(); render(); });
  on('[data-m]', b => { const m = MORE.find(x => x[0] === b.dataset.m); modal(m[2], m[3], {}, r => (S.more[m[0]] = S.more[m[0]] || []).push(r)); });
  on('[data-mr]', b => { const [k,i] = b.dataset.mr.split('|'); S.more[k].splice(+i, 1); save(); render(); });
  on('[data-c]', b => { const [st,n] = b.dataset.c.split('|');
    if(st === 'social') modal(n + ' link', [['u','Profile URL']], { u:S.social[n] || '' }, r => { S.social[n] = r.u.trim(); syncCore(); });
    else pick(n + ' proficiency', ['Beginner','Intermediate','Fluent','Native'].concat(S.langs[n] ? ['Remove'] : []), p => { p === 'Remove' ? delete S.langs[n] : S.langs[n] = p; save(); syncCore(); render(); }); });
  on('[data-em]', b => { evMode = b.dataset.em; render(); });
  on('[data-ef]', b => { evFilter = b.dataset.ef; render(); });
  $('#evDl')?.addEventListener('click', () => dl('skill-evidence.csv', 'Skill,Proficiency,Linked sections,Score\n' + S.skills.map(s => [s.name, s.prof, mentions(s).length, score(s)].join(',')).join('\n')));
  $('#ovAdd')?.addEventListener('click', () => { const n = $('#ovS').value; if(!S.skills.some(s => s.name === n)) return; S.over[n] = Math.max(0, Math.min(10, +$('#ovV').value || 0)); save(); render(); });
  on('[data-ro]', b => { delete S.over[b.dataset.ro]; save(); render(); });
  $('#docAdd')?.addEventListener('change', e => { const f = e.target.files[0]; if(!f) return; S.docs.push({ name:f.name, size:Math.ceil(f.size / 1024) + ' KB', date:new Date().toLocaleDateString() }); save(); render(); });
  on('[data-rd]', b => { S.docs.splice(+b.dataset.rd, 1); save(); render(); });
  $$('[data-n]').forEach(i => i.onchange = () => { S.notif[i.dataset.n] = i.checked; save(); render(); });
}
