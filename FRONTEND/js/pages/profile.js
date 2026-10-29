/* profile.js — student profile: Details, Academics, Skills, More */
import { $, $$, esc } from '../core/dom.js';
import { api, getToken } from '../core/api.js';
import { compressImageFile, prepareUploadFile } from '../core/upload-limits.js';
import { profileMeta } from '../data/profile.data.js';
import { navigate } from '../core/router.js';
import { announceUser } from '../core/user.js';

const TABS = ['Details','Academics','Skills','More'];
const PROF = ['Beginner','Intermediate','Advance','Professional'];
const SOCIAL = ['GitHub','LeetCode','CodeChef','HackerRank','Codeforces','HackerEarth','CodePen','Stack Overflow','Codecademy','Codewars','Exercism','SPOJ','Topcoder','GitLab','Bitbucket','Dev.to','SourceForge','Slashdot','Hacker News','Designer News','Dribbble','Behance','Portfolio Website','YouTube','Reddit','Twitter','Facebook','Instagram','Snapchat','TikTok','Pinterest','Product Hunt','Indie Hackers','AngelList','LinkedIn','Other'];
const LANGS = ['Telugu','Hindi','English','Tamil','Kannada','Malayalam','Marathi','Bengali','Gujarati','Punjabi','Urdu','Odia','Sanskrit','Other'];
const adr = p => [['City',p+'City'],['District',p+'Dist'],['State',p+'State'],['Country',p+'Country'],['Pin Code',p+'Pin'],['Address',p+'Addr']];
const par = (w,p) => [[w+"'s Name",p+'Name'],[w+"'s Email",p+'Email'],[w+"'s Contact",p+'Phone'],[w+"'s Occupation",p+'Job'],[w+"'s Company",p+'Co'],[w+"'s Office Address",p+'Off']];
/* [title, editable, fields]; a field ['#','Heading'] is a sub-heading */
const DET = [
  ['Student Overview',1,[['Full Name','name'],['First Name','first'],['Last Name','last'],['Roll Number','regNo'],['Branch','branch'],['Course','course'],['College','college'],['Passed Out Year','passOut'],['Placement Cycle','cycle'],['Student Status','status'],['Career Path','career'],['Gender','gender'],['Birthday','dob'],['Person With Disability','pwd'],['Differently Abled Person','da'],['Academics Attendance','acAtt'],['T&P Attendance','tpAtt'],['RFID','rfid']]],
  ['Point of Contact',0,[['Mentor','mentor'],['Advisor','advisor'],['Coordinator','coord']]],
  ['TAGS'],
  ['Student Details',1,[['Admission Through','admit'],['Rank','rank'],['Religion','religion'],['Category','category'],['Registered On','regOn'],['Verified On','verOn'],['Registered','registered'],['Verified By','verBy']]],
  ['Student Identity',1,[['Day Scholar','dayScholar'],['Nationality','nation'],['Aadhaar Number','aadhaar'],['Driving Licence','dl'],['Passport Number','passNo'],['Passport Issue Date','passIssue'],['Passport Expiry','passExp']]],
  ['Contact Details',1,[['Communication Email','email'],['Phone Number','phone'],['Personal Email','pemail'],['Alt. Phone Number','phone2'],['WhatsApp Number','wa'],['Alternative Email','email2'],['Parent / Guardian WhatsApp','pwa'],['Institute Email','iemail'],['LinkedIn Profile','linkedin']]],
  ['Address Details',1,[['#','Current Address'],...adr('c'),['#','Permanent Address'],...adr('p')]],
  ['Parent Information',1,[['#','Father'],...par('Father','f'),['#','Mother'],...par('Mother','m')]],
];
/* read-only: identity set by the placement cell (name, first & last name are now editable) */
const RO = new Set(['regNo','email','regOn','verOn','registered','verBy']);
/* nicer inputs for a few fields; everything else is a plain text box */
const YN = ['Yes','No'];
const FT = { gender:['select',['Male','Female','Other','Prefer not to say']], dob:['date'], pwd:['select',YN], da:['select',YN], passOut:['number'], acAtt:['text'], tpAtt:['text'] };
function fieldInput(k){
  const v = P.d[k] || '', dis = RO.has(k) ? 'disabled' : '', t = FT[k];
  if(t && t[0] === 'select'){
    const opts = t[1].includes(v) || !v ? t[1] : [v, ...t[1]];
    return `<select data-k="${k}" ${dis}><option value="">Select</option>${opts.map(o => `<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  }
  if(t && t[0] === 'date') return `<input type="date" data-k="${k}" value="${esc(String(v).slice(0,10))}" max="${new Date().toISOString().slice(0,10)}" ${dis}>`;
  if(t && t[0] === 'number') return `<input type="number" data-k="${k}" value="${esc(v)}" min="2000" max="2100" ${dis}>`;
  return `<input data-k="${k}" value="${esc(v)}" ${dis}>`;
}
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
const ACAD = [['level','Level (Current / 12th / 10th / Diploma)'],['inst','Institution / School'],['course','Course'],['branch','Branch / Stream'],['cgpa','CGPA or %'],['year','Year'],['status','Status (e.g. Out Going)'],['arrears','Current arrears'],['arrHist','Arrears history'],['sems','Semester scores (comma separated, e.g. 8.18, 7.91, 8.61)']];

let P, S, tab = 'Details', editing = null, view = 'grid', q = '', profileSyncTimer;
let profileSyncQueue = Promise.resolve();
const key = () => 'stepupProfile:' + (P.d.regNo || 'guest');
const save = () => {
  if(P?.logged){
    S.verified = false;
    S.requested = true;
    S.verificationStatus = 'pending';
  }
  try{ localStorage.setItem(key(), JSON.stringify(S)); }
  catch{ toast('Could not save your profile in this browser.'); }
  announceUser();
  if(P?.logged){
    clearTimeout(profileSyncTimer);
    profileSyncTimer = setTimeout(() => {
      profileSyncQueue = profileSyncQueue.then(() => syncCore()).then(
        () => toast('Changes submitted for admin approval'),
        error => toast('Could not submit changes for approval: ' + error.message)
      );
    }, 300);
  }
};
const val = k => (P.d[k] ?? '') === '' ? '-' : P.d[k];

/* Applications come from /student/applications. Status 'Selected' = an offer.
   The last good numbers are remembered so the header is not wrong if the server is down. */
function countApps(rows){
  const k = 'stepup-apps-' + (getToken() ? 'in' : 'out');
  if(rows){
    const out = { applied: rows.length, offers: rows.filter(r => r.status === 'Selected').map(r => ({ company: r.company_name, title: r.title })),
      list: rows.map(r => ({ company: r.company_name, title: r.title, status: r.status })) };
    try{ localStorage.setItem(k, JSON.stringify(out)); }catch{}
    return out;
  }
  try{ const old = JSON.parse(localStorage.getItem(k) || 'null'); if(old) return old; }catch{}
  return { applied: 0, offers: [], list: [] };
}

async function load(){
  let me = null, st = null;
  try{ st = JSON.parse(localStorage.getItem('stepupStudent') || 'null'); }catch{}
  let apps = null;
  if(getToken()){
    const [m, a] = await Promise.allSettled([api('/student/me'), api('/student/applications')]);
    if(m.status === 'fulfilled') me = m.value.data;
    if(a.status === 'fulfilled' && Array.isArray(a.value.data)) apps = a.value.data;
  }
  const pending = me?.pending_profile;
  const b = pending ? {
    ...me,
    name:pending.name,
    reg_no:pending.regNo,
    email:pending.email,
    phone:pending.phone,
    dob:pending.dob,
    gender:pending.gender,
    address:pending.address,
    college:pending.college,
    degree:pending.degree,
    department:pending.department,
    graduation_year:pending.graduationYear,
    cgpa:pending.cgpa,
    education:pending.education,
    skills:pending.skills,
    languages:pending.languages,
    experience:pending.experience,
    achievements:pending.achievements,
    certifications:pending.certifications,
    projects:pending.projects,
    summary:pending.summary,
    linkedin:pending.linkedin,
    github:pending.github,
    portfolio:pending.portfolio,
    profile_details:pending.profileDetails || me.profile_details
  } : me || st || {};
  const d = { name:b.name || profileMeta.name, regNo:b.reg_no || profileMeta.regNo, email:b.email || '', phone:b.phone || '',
    dob:(b.dob || '').slice(0,10), gender:b.gender || '', nation:'Indian', cCountry:'India', pCountry:'India', cAddr:b.address || '',
    registered:me ? 'True' : '', regOn:me && b.created_at ? new Date(b.created_at).toLocaleDateString() : '' };
  d.first = d.name.split(' ')[0]; d.last = d.name.split(' ').slice(1).join(' ');
  P = { d, base:b, logged:!!me, apps:countApps(apps) };
  let ext = {};
  try{ ext = JSON.parse(localStorage.getItem(key()) || '{}'); }catch{}
  const statusProfile = me && me.profile_details && typeof me.profile_details === 'object' ? me.profile_details : {};
  const remoteProfile = pending?.profileDetails && typeof pending.profileDetails === 'object'
    ? pending.profileDetails
    : statusProfile;
  const remoteState = {
    d: remoteProfile.details || {},
    acad: Array.isArray(remoteProfile.academics) ? remoteProfile.academics : [],
    skills: Array.isArray(remoteProfile.skills) ? remoteProfile.skills : null,
    more: remoteProfile.more && typeof remoteProfile.more === 'object' ? remoteProfile.more : {},
    social: remoteProfile.social && typeof remoteProfile.social === 'object' ? remoteProfile.social : {},
    langs: remoteProfile.languages && typeof remoteProfile.languages === 'object' ? remoteProfile.languages : {},
    links: Array.isArray(remoteProfile.links) ? remoteProfile.links : [],
    tags: Array.isArray(remoteProfile.tags) ? remoteProfile.tags : [],
    photo: remoteProfile.photo || '',
    verified: !!statusProfile.verified,
    requested: !!statusProfile.requested,
    verificationStatus: statusProfile.verificationStatus || 'pending'
  };
  S = Object.assign(
    { d:{}, acad:[], skills:null, more:{}, social:{}, langs:{}, links:[], tags:[], photo:'', verified:false, requested:false, verificationStatus:'pending' },
    remoteState,
    ext
  );
  S.verified = !!statusProfile.verified;
  S.requested = !!statusProfile.requested;
  S.verificationStatus = statusProfile.verificationStatus || (S.verified ? 'approved' : S.requested ? 'pending' : 'pending');
  if(pending || statusProfile.verified || statusProfile.reviewedAt) S = Object.assign(S, remoteState);
  if(!S.acad.length && (b.college || b.department)) S.acad = [{ level:'Current', inst:b.college || '', course:b.degree || '', branch:b.department || '', cgpa:b.cgpa || '', year:b.graduation_year || '', status:'', arrears:'0', arrHist:'0', sems:'' }];
  if(!S.skills) S.skills = (b.skills || []).map(n => ({ name:n, prof:'Intermediate' }));
  [['linkedin','LinkedIn'],['github','GitHub'],['portfolio','Portfolio Website']].forEach(([k,n]) => { if(b[k] && !S.social[n]) S.social[n] = b[k]; });
  (b.languages || []).forEach(l => { if(!S.langs[l]) S.langs[l] = 'Intermediate'; });
  Object.assign(P.d, S.d);
  const c = S.acad[0];
  if(c){ [['branch','branch'],['course','course'],['college','inst'],['passOut','year']].forEach(([k,f]) => { if(!P.d[k]) P.d[k] = c[f] || ''; }); }
}

export async function mount(){ await load(); tab = 'Details'; editing = null; q = ''; render(); }

function render(){
  head();
  $('#pfTabs').innerHTML = TABS.map(t => `<button class="${t===tab?'on':''}" data-t="${t}">${t}</button>`).join('');
  $$('#pfTabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; editing = null; q = ''; render(); });
  $('#pfBody').innerHTML = ({Details:details,Academics:academics,Skills:skills,More:more})[tab]();
  bind();
}

function head(){
  const a = S.acad[0] || {}, d = P.d;
  const verificationLabel = S.verified ? 'Verified' : S.verificationStatus === 'rejected' ? 'Changes rejected' : S.requested ? 'Pending approval' : 'Unverified';
  $('#pfHead').innerHTML = `<div class="pf-top">
    <label class="pf-photo" title="Change photo">${S.photo ? `<img src="${S.photo}" alt="">` : `<span>${esc(d.name[0] || 'S')}</span>`}<i>&#128247;</i><input type="file" id="pfPhoto" accept="image/*" hidden></label>
    <div class="pf-id"><h1>${esc(d.name)}</h1>
      <div class="pf-reg">${esc(d.regNo)} <span class="pf-badge ${S.verified?'ok':'warn'}">${verificationLabel}</span></div>
      ${S.verified ? '' : `<p class="pf-note">${S.verificationStatus === 'rejected' ? 'Your profile changes were rejected. Edit the profile and save again to resubmit.' : S.requested ? 'Your profile changes are awaiting admin approval. Your approved profile remains active until review.' : 'Your profile is not verified yet. <a href="#" id="pfReq">Request profile verification</a>.'}</p>`}
      <p class="pf-sub">${esc([a.branch, a.course, a.year].filter(Boolean).join(' · ') || 'Add your academics')}</p>
      <p class="pf-contact"><b>${P.apps.applied}</b> applied ${d.email ? ` &nbsp;&#9993; <b>${esc(d.email)}</b>` : ''} ${d.phone ? ` &nbsp;&#9742; <b>${esc(d.phone)}</b>` : ''}</p></div></div>
    <div class="pf-actions"><div class="pf-links">${S.links.map((l,i) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a><button data-rl="${i}" title="Remove">&times;</button>`).join('')}<button class="pf-ghost" id="pfLink">+ Add Link</button></div>
    <div class="pf-btns"><button class="pf-pill" id="bOffers">${P.apps.offers.length} Offer${P.apps.offers.length === 1 ? '' : 's'}</button><button class="pf-pill pri" id="pfTrack">Job Tracker</button><button class="pf-pill" id="bResume">Resumes</button><button class="pf-pill" id="bReport">Reports</button></div></div>`;
}

const row = (l,v) => `<div class="pf-row"><span>${esc(l)}</span><b>${esc(v)}</b></div>`;
function details(){
  const ql = q.toLowerCase();
  return `<div class="pf-search"><input id="pfQ" placeholder="Search any field or value..." value="${esc(q)}"></div>` + DET.map(([t,ed,f]) => {
    if(t === 'TAGS') return (ql && !S.tags.join(' ').toLowerCase().includes(ql)) ? '' : `<section class="pf-sec"><div class="pf-sh"><h2>Student Tags</h2><button class="pf-edit" id="tagAdd">+ Add tag</button></div>${S.tags.length ? `<div class="pf-chips">${S.tags.map((x,i) => `<button class="on" data-rt="${i}" title="Remove">${esc(x)} &times;</button>`).join('')}</div>` : '<p class="pf-hint">-</p>'}</section>`;
    if(editing === t) return `<section class="pf-sec"><div class="pf-sh"><h2>${t}</h2></div><div class="pf-form">${f.map(([l,k]) => l==='#' ? `<h3 class="pf-subh">${esc(k)}</h3>` : `<label>${esc(l)}${RO.has(k) ? '<em class="pf-lock">locked</em>' : ''}${fieldInput(k)}</label>`).join('')}</div><div class="pf-fa"><button class="pf-pill" id="dCancel">Cancel</button><button class="pf-pill pri" id="dSave">Save</button></div></section>`;
    const rows = f.filter(([l,k]) => l==='#' || !ql || (l + ' ' + val(k)).toLowerCase().includes(ql));
    if(!rows.some(r => r[0] !== '#')) return '';
    return `<section class="pf-sec"><div class="pf-sh"><h2>${t}</h2>${ed ? `<button class="pf-edit" data-ed="${t}">&#9998; Edit</button>` : ''}</div><div class="pf-grid">${rows.map(([l,k]) => l==='#' ? `<h3 class="pf-subh">${esc(k)}</h3>` : row(l, k==='aadhaar' && P.d[k] ? 'XXXX XXXX ' + String(P.d[k]).slice(-4) : val(k))).join('')}</div></section>`;
  }).join('');
}

function academics(){
  const i = Math.min(S.acadSel || 0, S.acad.length - 1), a = S.acad[i];
  const sems = a ? String(a.sems || '').split(',').map(x => x.trim()).filter(Boolean) : [];
  return `<section class="pf-card"><div class="pf-sh"><h2>Academics</h2><button class="pf-pill pri" id="acAdd">+ Add</button></div>` + (!a ? '<p class="pf-empty">No academic records yet. Add your college, 12th and 10th details.</p>' :
    `<div class="pf-ac"><div class="pf-aside">${S.acad.map((x,n) => `<button class="${n===i?'on':''}" data-a="${n}"><em class="${/current/i.test(x.level)?'cur':''}">${esc(x.level)}</em>${esc(x.inst)}<small>${esc(x.cgpa || '-')} CGPA</small></button>`).join('')}</div>
    <div class="pf-adet"><h3>${esc(a.branch || a.course || a.inst)}</h3><p class="pf-sub">${esc([a.year, a.status].filter(Boolean).join(' · '))}</p><div class="pf-big">${esc(a.cgpa || '-')}<small> CGPA</small></div>
    <div class="pf-grid">${row('College',a.inst||'-')}${row('Course',a.course||'-')}${row('Branch',a.branch||'-')}${row('Current Arrears',a.arrears||'0')}${row('Arrears History',a.arrHist||'0')}</div>
    ${sems.length ? `<h4 class="pf-semh">Semester scores</h4><div class="pf-scroll"><table class="pf-mx"><tr>${sems.map((_,n) => `<th>SEM ${n+1}</th>`).join('')}</tr><tr>${sems.map(s => `<td>${esc(s)}</td>`).join('')}</tr></table></div>` : ''}
    <div class="pf-fa"><button class="pf-pill" id="acEdit">Edit</button><button class="pf-pill" id="acDel">Remove</button></div></div></div>`) + '</section>';
}

function skills(){
  return `<section class="pf-card"><div class="pf-sh"><h2>Skills (${S.skills.length})</h2><div><button class="pf-pill ${view==='grid'?'on':''}" data-v="grid">Grid</button><button class="pf-pill ${view==='list'?'on':''}" data-v="list">List</button><button class="pf-pill pri" id="skAdd">+ Add Skill</button></div></div>` +
    (S.skills.length ? `<div class="pf-skills ${view}">${S.skills.map((s,i) => `<div class="pf-skill" data-es="${i}" title="Click to edit"><div class="pf-skname"><b>${esc(s.name)}</b>${(s.proof || []).length ? `<span class="pf-prooftag">&#128247; ${s.proof.length} proof${s.proof.length>1?'s':''}</span>` : `<span class="pf-prooftag none">No proof yet</span>`}</div>${(s.proof || []).length ? `<div class="pf-thumbs">${s.proof.map((src,n) => `<img src="${src}" alt="Proof" data-pv="${i}|${n}">`).join('')}</div>` : ''}<span>${esc(s.prof)}</span><button data-rs="${i}" title="Remove">&times;</button></div>`).join('')}</div>` : '<p class="pf-empty">No skills added yet.</p>') + '</section>';
}

function more(){
  const chips = (title, list, store, hint) => `<section class="pf-card"><div class="pf-sh"><h2>${title} (${Object.keys(S[store]).length})</h2></div><p class="pf-hint">${hint}</p><div class="pf-chips">${list.map(n => `<button class="${S[store][n]?'on':''}" data-c="${store}|${esc(n)}">${esc(n)}</button>`).join('')}</div></section>`;
  return MORE.map(([k,t,add]) => { const it = S.more[k] || [];
    return `<section class="pf-card"><div class="pf-sh"><h2>${t} (${it.length})</h2><button class="pf-pill pri" data-m="${k}">+ ${add}</button></div>` +
      (it.length ? it.map((x,i) => `<div class="pf-item"><div><b>${esc(x.title || '')}</b> <small>${esc([x.org, x.period].filter(Boolean).join(' · '))}</small><p>${esc(x.desc || '')}</p>${x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.link)}</a>` : ''}</div><span class="pf-ia"><button data-me="${k}|${i}" title="Edit">Edit</button><button data-mr="${k}|${i}" title="Remove">&times;</button></span></div>`).join('') : `<p class="pf-empty">No ${t.toLowerCase()} added yet.</p>`) + '</section>'; }).join('') +
    chips('Social Media', SOCIAL, 'social', 'Click a platform to add or edit your link.') + chips('Languages', LANGS, 'langs', 'Click a language to add or edit proficiency.');
}

/* ---------- helpers ---------- */
function toast(m){ const t = document.createElement('div'); t.className = 'pf-toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }
function overlay(html){ const o = document.createElement('div'); o.className = 'pf-modal'; o.innerHTML = html; document.body.appendChild(o);
  o.addEventListener('click', e => { if(e.target === o || e.target.hasAttribute('data-x')) o.remove(); }); return o; }
function modal(title, fields, v, onSave){
  const o = overlay(`<form><h3>${esc(title)}</h3>${fields.map(([k,l,t]) => `<label>${esc(l)}${t==='area' ? `<textarea name="${k}">${esc(v[k] || '')}</textarea>` : `<input name="${k}" value="${esc(v[k] || '')}">`}</label>`).join('')}<div class="pf-fa"><button type="button" class="pf-pill" data-x>Cancel</button><button class="pf-pill pri">Save</button></div></form>`);
  o.querySelector('form').onsubmit = e => { e.preventDefault(); const r = Object.fromEntries(new FormData(e.target)); if(!String(r[fields[0][0]]).trim()) return; onSave(r); o.remove(); save(); render(); };
  o.querySelector('input,textarea').focus();
}
/* ---------- photo proof for skills ---------- */
const MAX_PROOF = 3;
const shrink = file => compressImageFile(file);
function lightbox(src){ overlay(`<div class="pf-lb"><img src="${src}" alt="Skill proof"><button type="button" class="pf-pill pri" data-x>Close</button></div>`); }
function skillModal(i){
  const cur = i == null ? { name:'', prof:'', proof:[] } : S.skills[i]; let prof = cur.prof; const proof = [...(cur.proof || [])];
  const o = overlay(`<form><h3>${i == null ? 'Add skill' : 'Edit skill'}</h3><label>Skill name<input name="name" placeholder="e.g. Python, React, Communication" value="${esc(cur.name)}"></label><label>Proficiency</label><div class="pf-chips">${PROF.map(p => `<button type="button" class="${p===prof?'on':''}" data-p="${p}">${p}</button>`).join('')}</div>
    <label>Photo proof <small class="pf-hint">Certificate, badge or screenshot. Up to ${MAX_PROOF} photos, compressed below 10 KB each.</small></label><div class="pf-proofs" id="pfProofs"></div>
    <input type="file" id="pfProofFile" accept="image/*" multiple hidden>
    <div class="pf-fa"><button type="button" class="pf-pill" data-x>Cancel</button><button class="pf-pill pri">Save</button></div></form>`);
  const box = o.querySelector('#pfProofs'), file = o.querySelector('#pfProofFile');
  const paint = () => {
    box.innerHTML = proof.map((src,n) => `<div class="pf-proof"><img src="${src}" alt="Proof ${n+1}" data-view="${n}"><button type="button" data-del="${n}" title="Remove photo">&times;</button></div>`).join('') +
      (proof.length < MAX_PROOF ? `<button type="button" class="pf-addproof" id="pfAddProof">&#128247;<span>Add photo</span></button>` : '');
    box.querySelector('#pfAddProof')?.addEventListener('click', () => file.click());
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { proof.splice(+b.dataset.del, 1); paint(); });
    box.querySelectorAll('[data-view]').forEach(im => im.onclick = () => lightbox(proof[+im.dataset.view]));
  };
  file.onchange = async () => {
    const files = [...file.files].filter(f => /^image\//.test(f.type)); file.value = '';
    if(!files.length){ toast('Choose an image file'); return; }
    const room = MAX_PROOF - proof.length;
    if(files.length > room) toast('Maximum ' + MAX_PROOF + ' photos per skill');
    for(const f of files.slice(0, room)){
      if(f.size > 15 * 1024 * 1024){ toast('Each source photo must be under 15 MB before compression.'); continue; }
      try{ proof.push(await shrink(f)); }catch(error){ toast(error.message); }
    }
    paint();
  };
  paint();
  o.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { prof = b.dataset.p; o.querySelectorAll('[data-p]').forEach(x => x.classList.toggle('on', x === b)); });
  o.querySelector('form').onsubmit = e => { e.preventDefault(); const name = o.querySelector('[name=name]').value.trim(); if(!name){ toast('Enter a skill name'); return; } if(!prof){ toast('Pick a proficiency'); return; }
    const item = { name, prof, proof };
    if(i == null) S.skills.push(item); else S.skills[i] = item; o.remove(); save(); render(); };
  o.querySelector('input').focus();
}
function pick(title, opts, onPick){
  const o = overlay(`<form><h3>${esc(title)}</h3><div class="pf-chips">${opts.map(x => `<button type="button" data-p="${esc(x)}">${esc(x)}</button>`).join('')}</div><div class="pf-fa"><button type="button" class="pf-pill" data-x>Cancel</button></div></form>`);
  o.addEventListener('click', e => { const p = e.target.dataset.p; if(p){ o.remove(); onPick(p); } });
}
function info(title, msg){ const o = overlay(`<form><h3>${esc(title)}</h3><p class="pf-empty">${esc(msg)}</p><div class="pf-fa"><button type="button" class="pf-pill pri" data-x>Close</button></div></form>`); return o; }
const dl = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type:'text/csv'})); a.download = name; a.click(); };
const csv = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';

function report(){
  const rows = [['Section','Field','Value']];
  DET.forEach(([t,,f]) => { if(!f) return; f.forEach(([l,k]) => { if(l !== '#') rows.push([t, l, P.d[k] || '']); }); });
  S.acad.forEach(a => rows.push(['Academics', a.level + ' - ' + a.inst, a.cgpa]));
  S.skills.forEach(s => rows.push(['Skills', s.name, s.prof + ((s.proof || []).length ? ' (' + s.proof.length + ' proof photo' + (s.proof.length > 1 ? 's' : '') + ')' : '')]));
  dl('profile-report.csv', rows.map(r => r.map(csv).join(',')).join('\n'));
}
async function resume(){
  const current = await api('/student/resume').catch(() => null);
  const existing = current?.data || null;
  const previous = await api('/student/resume/analysis').catch(() => null);
  const analysis = previous?.data?.analysis || null;
  const score = n => Number.isFinite(Number(n)) ? Math.max(0, Math.min(100, Math.round(Number(n)))) : 0;
  const scoreCard = (label, value) => `<div class="rai-score"><span>${esc(label)}</span><b>${score(value)}%</b></div>`;
  const renderAnalysis = a => {
    if(!a) return '<p class="pf-empty">Upload your resume, then choose <b>Analyze with AI</b> to get a real analysis of the uploaded PDF.</p>';
    const mistakes = Array.isArray(a.mistakes) ? a.mistakes : [];
    const projects = Array.isArray(a.projects) ? a.projects : [];
    const sections = Array.isArray(a.sectionFeedback) ? a.sectionFeedback : [];
    return `<div class="rai-analysis">
      <div class="rai-summary"><div><small>Overall Resume Score</small><strong>${score(a.overallScore)}%</strong></div><p>${esc(a.summary || '')}</p></div>
      <div class="rai-scores">${scoreCard('ATS',a.atsScore)}${scoreCard('Content',a.contentScore)}${scoreCard('Skills',a.skillsScore)}${scoreCard('Projects',a.projectsScore)}${scoreCard('Vocabulary',a.vocabularyScore)}</div>
      ${Array.isArray(a.strengths)&&a.strengths.length?`<section class="rai-section"><h4>✓ Strengths</h4><ul>${a.strengths.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`:''}
      ${mistakes.length?`<section class="rai-section"><h4>⚠ Mistakes & corrections</h4>${mistakes.map(x=>`<div class="rai-item"><b>${esc(x.type)}</b><div class="rai-original">${esc(x.original)}</div><div class="rai-suggestion">${esc(x.suggestion)}</div><small>${esc(x.explanation)}</small></div>`).join('')}</section>`:''}
      ${a.vocabulary?.weakWords?.length||a.vocabulary?.notes?.length?`<section class="rai-section"><h4>✦ Vocabulary</h4><p><b>Weak / repeated words:</b> ${esc((a.vocabulary?.weakWords||[]).join(', ')||'None identified')}</p><p><b>Better alternatives:</b> ${esc((a.vocabulary?.betterAlternatives||[]).join(', ')||'None')}</p>${(a.vocabulary?.notes||[]).map(x=>`<p>${esc(x)}</p>`).join('')}</section>`:''}
      ${a.detectedSkills?.length?`<section class="rai-section"><h4>🧠 Detected skills</h4><div class="rai-chips">${a.detectedSkills.map(x=>`<span>${esc(x)}</span>`).join('')}</div></section>`:''}
      ${a.skillSuggestions?.length?`<section class="rai-section"><h4>💡 Skill suggestions</h4><ul>${a.skillSuggestions.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`:''}
      ${projects.length?`<section class="rai-section"><h4>🚀 Project analysis</h4>${projects.map(x=>`<div class="rai-item"><b>${esc(x.name)}</b><span class="rai-project-score">${score(x.score)}%</span><p>${esc(x.suggestion)}</p>${x.domains?.length?`<small>${esc(x.domains.join(' • '))}</small>`:''}</div>`).join('')}</section>`:''}
      ${a.domainSuggestions?.length?`<section class="rai-section"><h4>🎯 Domain-based suggestions</h4><ul>${a.domainSuggestions.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`:''}
      ${sections.length?`<section class="rai-section"><h4>📌 Section feedback</h4>${sections.map(x=>`<div class="rai-section-row"><b>${esc(x.section)}</b><span>${esc(x.status)}</span><p>${esc(x.feedback)}</p></div>`).join('')}</section>`:''}
    </div>`;
  };
  const o = overlay(`<form id="resumeForm" class="rai-modal-form">
    <h3>AI Resume Analyzer</h3>
    <p class="pf-empty">Upload the actual PDF you want StepUp AI to review. No dummy resume data is used.</p>
    <label class="pf-file-label">PDF resume
      <input id="resumeFile" type="file" accept="application/pdf,.pdf">
    </label>
    <p class="pf-hint">PDF only • Must be smaller than 10 KB. The uploaded PDF remains the exact resume companies receive.</p>
    <div class="pf-fa">
      <button type="button" class="pf-pill" data-x>Close</button>
      ${existing ? '<button type="button" class="pf-pill" id="resumeDownload">Download Current</button>' : ''}
      <button type="submit" class="pf-pill pri" id="resumeUpload">${existing ? 'Replace & Analyze' : 'Upload & Analyze'}</button>
    </div>
    <div id="resumeMsg" class="pf-hint"></div>
    <div id="resumeAnalysis">${renderAnalysis(analysis)}</div>
  </form>`);
  const form=o.querySelector('#resumeForm'), msgEl=o.querySelector('#resumeMsg'), analysisEl=o.querySelector('#resumeAnalysis');
  const setMsg=(m,ok=false)=>{msgEl.textContent=m;msgEl.style.color=ok?'var(--green)':'var(--rose)';};
  o.querySelector('#resumeDownload')?.addEventListener('click',async()=>{
    try{
      const base=window.STEPUP_API_BASE_URL||'http://localhost:3000/api';
      const r=await fetch(base+'/student/resume/download',{headers:{Authorization:'Bearer '+getToken()}});
      if(!r.ok) throw Error('Could not download the resume.');
      const blob=await r.blob(), url=URL.createObjectURL(blob), a=document.createElement('a');
      a.href=url; a.download=existing.file_name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500);
    }catch(e){setMsg(e.message);}
  });
  async function analyze(){
    const button=o.querySelector('#resumeUpload'); button.disabled=true; setMsg('AI is reading your actual resume…',true);
    try{
      const result=await api('/student/resume/analyze',{method:'POST',body:JSON.stringify({})});
      analysisEl.innerHTML=renderAnalysis(result?.data?.analysis);
      setMsg('Resume analyzed successfully.',true);
    }catch(err){setMsg(err.message);}
    finally{button.disabled=false;}
  }
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const file=o.querySelector('#resumeFile').files[0];
    if(!file){
      if(existing){ await analyze(); } else setMsg('Choose a PDF resume first.');
      return;
    }
    if(file.type!=='application/pdf' && !/\.pdf$/i.test(file.name)){setMsg('Only PDF resumes are allowed.');return;}
    let data;
    try{data=await prepareUploadFile(file);}
    catch(error){setMsg(error.message);return;}
    const button=o.querySelector('#resumeUpload'); button.disabled=true; setMsg('Uploading your PDF…',true);
    try{
      await api('/student/resume',{method:'POST',body:JSON.stringify({fileName:file.name,mimeType:'application/pdf',data})});
      await analyze();
    }catch(err){button.disabled=false;setMsg(err.message);}
  });
}

function syncCore(){
  if(!P.logged) return;
  const b = P.base, d = P.d;
  const profileDetails = {
    details: { ...d },
    academics: Array.isArray(S.acad) ? S.acad : [],
    skills: Array.isArray(S.skills) ? S.skills : [],
    more: S.more || {},
    social: S.social || {},
    languages: S.langs || {},
    links: Array.isArray(S.links) ? S.links : [],
    tags: Array.isArray(S.tags) ? S.tags : [],
    photo: S.photo || '',
    verified: !!S.verified,
    requested: !!S.requested,
    verificationStatus: S.verificationStatus || 'pending'
  };
  return api('/student/profile', {
    method:'PUT',
    body:JSON.stringify({
      name:d.name,
      regNo:d.regNo,
      email:d.email,
      phone:d.phone,
      dob:d.dob,
      gender:d.gender,
      address:d.cAddr || b.address,
      college:d.college || b.college,
      degree:d.course || b.degree || 'B.Tech',
      department:d.branch || b.department || 'N/A',
      graduationYear:d.passOut || b.graduation_year,
      cgpa:d.cgpa || b.cgpa,
      education:Array.isArray(S.acad) ? S.acad : b.education || [],
      skills:Array.isArray(S.skills) ? S.skills.map(s => typeof s === 'string' ? s : s.name).filter(Boolean) : [],
      languages:Object.keys(S.langs || {}),
      experience:S.more?.work || b.experience || [],
      achievements:b.achievements,
      certifications:S.more?.certs || b.certifications || [],
      projects:S.more?.projects || b.projects || [],
      summary:b.summary,
      linkedin:S.social?.LinkedIn,
      github:S.social?.GitHub,
      portfolio:S.social?.['Portfolio Website'],
      profileDetails
    })
  });
}


function bind(){
  const on = (sel, fn) => $$(sel).forEach(el => el.addEventListener('click', e => fn(el, e)));
  $('#pfPhoto')?.addEventListener('change', async e => { const f = e.target.files[0]; if(!f) return; try{ S.photo = await compressImageFile(f); save(); render(); }catch(error){ toast(error.message); } });
  $('#pfReq')?.addEventListener('click', e => { e.preventDefault(); S.requested = true; save(); render(); });
  $('#pfLink')?.addEventListener('click', () => modal('Add link', [['name','Label'],['url','URL']], {}, r => S.links.push(r)));
  on('[data-rl]', b => { S.links.splice(+b.dataset.rl, 1); save(); render(); });
  $('#pfTrack')?.addEventListener('click', () => navigate('progress'));
  $('#bOffers')?.addEventListener('click', () => info("Student's Offers",
    P.apps.offers.length ? P.apps.offers.map(o => `${o.company} - ${o.title}`).join(', ') : 'No offers found.'));
  $('#bResume')?.addEventListener('click', resume);
  $('#bReport')?.addEventListener('click', report);
  const qi = $('#pfQ'); if(qi) qi.oninput = () => { q = qi.value; const p = qi.selectionStart; render(); const n = $('#pfQ'); n.focus(); n.setSelectionRange(p, p); };
  on('[data-ed]', b => { editing = b.dataset.ed; render(); });
  $('#dCancel')?.addEventListener('click', () => { editing = null; render(); });
  $('#dSave')?.addEventListener('click', () => {
    const f = $$('.pf-form [data-k]:not(:disabled)'), got = {};
    f.forEach(i => { got[i.dataset.k] = i.value.trim(); });
    if('name' in got){
      if(!got.name){ toast('Full name cannot be empty'); return; }
      const nameMoved = got.name !== (P.d.name || ''), partsMoved = got.first !== (P.d.first || '') || got.last !== (P.d.last || '');
      if(nameMoved && !partsMoved){ got.first = got.name.split(/\s+/)[0]; got.last = got.name.split(/\s+/).slice(1).join(' '); }
      else if(partsMoved && !nameMoved){ got.name = [got.first, got.last].filter(Boolean).join(' ') || got.name; }
    }
    Object.entries(got).forEach(([k,v]) => { P.d[k] = v; S.d[k] = v; });
    editing = null; save(); render(); toast('Saving changes for admin review…');
  });
  $('#tagAdd')?.addEventListener('click', () => modal('Add tag', [['t','Tag']], {}, r => S.tags.push(r.t.trim())));
  on('[data-rt]', b => { S.tags.splice(+b.dataset.rt, 1); save(); render(); });
  on('[data-a]', b => { S.acadSel = +b.dataset.a; render(); });
  $('#acAdd')?.addEventListener('click', () => modal('Add academic record', ACAD, {}, r => { S.acad.push(r); S.acadSel = S.acad.length - 1; }));
  $('#acEdit')?.addEventListener('click', () => { const i = S.acadSel || 0; modal('Edit academic record', ACAD, S.acad[i], r => S.acad[i] = r); });
  $('#acDel')?.addEventListener('click', () => { S.acad.splice(S.acadSel || 0, 1); S.acadSel = 0; save(); render(); });
  on('[data-v]', b => { view = b.dataset.v; render(); });
  $('#skAdd')?.addEventListener('click', () => skillModal());
  on('[data-pv]', (im, e) => { e.stopPropagation(); const [a,b] = im.dataset.pv.split('|'); lightbox(S.skills[+a].proof[+b]); });
  on('[data-es]', (el, e) => { if(e.target.closest('[data-rs]') || e.target.closest('[data-pv]')) return; skillModal(+el.dataset.es); });
  on('[data-rs]', (b, e) => { e.stopPropagation(); S.skills.splice(+b.dataset.rs, 1); save(); render(); });
  on('[data-m]', b => { const m = MORE.find(x => x[0] === b.dataset.m); modal(m[2], m[3], {}, r => (S.more[m[0]] = S.more[m[0]] || []).push(r)); });
  on('[data-me]', b => { const [k,i] = b.dataset.me.split('|'), m = MORE.find(x => x[0] === k); modal('Edit', m[3], S.more[k][+i], r => S.more[k][+i] = r); });
  on('[data-mr]', b => { const [k,i] = b.dataset.mr.split('|'); S.more[k].splice(+i, 1); save(); render(); });
  on('[data-c]', b => { const [st,n] = b.dataset.c.split('|');
    if(st === 'social') modal(n + ' link', [['u','Profile URL']], { u:S.social[n] || '' }, r => { S.social[n] = r.u.trim(); if(!S.social[n]) delete S.social[n]; });
    else pick(n + ' proficiency', ['Beginner','Intermediate','Fluent','Native'].concat(S.langs[n] ? ['Remove'] : []), p => { p === 'Remove' ? delete S.langs[n] : S.langs[n] = p; save(); render(); }); });
}
