const API_BASE = (window.STEPUP_API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const tokenKey='stepupAdminToken', adminKey='stepupAdmin';
const token=sessionStorage.getItem(tokenKey); if(!token){location.href='admin-login.html';}
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let navigationController=null,navigationPending=false,navigationSequence=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const admin=JSON.parse(sessionStorage.getItem(adminKey)||'{}'); $('#adminName').textContent=admin.name||admin.id||'Administrator'; $('#adminRole').textContent=admin.role||'Super Admin';
function initials(name){return String(name||'SA').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'SA'}
document.documentElement.dataset.theme='light'; try{localStorage.removeItem('stepupAdminTheme')}catch{} $('#adminAvatar').textContent=initials(admin.name||admin.id);
const titles={overview:['Overview','StepUp placement platform control center'],students:['Students','Manage student accounts, profiles, documents and approvals'],jobs:['Jobs','Monitor vacancies and recruitment activity'],applications:['Applications','Track applications and pipeline status'],competitions:['Competitions','Publish competitions and manage student registrations'],announcements:['Announcements','Publish updates to students and recruiters'],analytics:['Analytics','Placement and recruitment intelligence'],reports:['Reports','Export operational data for Excel and reporting'],analyticsreports:['Analytics & Reports','Placement insights and exportable platform data'],activity:['Activity Log','Audit administrator actions'],admins:['Admin Roles','Manage administrator accounts and permissions']};
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800)}
async function api(path,opt={}){const r=await fetch(API_BASE+path,{...opt,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...(opt.headers||{})}});let j={};try{j=await r.json()}catch{}if(r.status===401){sessionStorage.clear();location.href='admin-login.html';throw Error('Session expired.')}if(!r.ok)throw Error(j.error||'Request failed');return j.data}
// Cancel page reads when navigation changes so late responses cannot render stale sections.
const sendAdminRequest=api;
api=async function(path,opt={}){
  const isRead=(opt.method||'GET').toUpperCase()==='GET';
  const signal=isRead&&navigationPending?navigationController?.signal:undefined;
  return sendAdminRequest(path,{...opt,...(signal&&!opt.signal?{signal}:{})});
};
function sectionHead(name){const [t,s]=titles[name]||[name,''];$('#sectionTitle').textContent=t;$('#sectionSub').textContent=s}
function table(headers,rows){return `<div class="table-wrap"><table class="table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||''}</tbody></table></div>`}
function empty(msg='No records found'){return `<div class="empty">${msg}</div>`}
function getVerificationState(student){
  const details = student && student.profile_details && typeof student.profile_details === 'object' ? student.profile_details : {};
  const status = String(details.verificationStatus || '').trim().toLowerCase();
  if (status === 'approved' || status === 'verified' || details.verified) return 'approved';
  if (status === 'rejected' || status === 'declined') return 'rejected';
  if (details.requested) return 'pending';
  return 'pending';
}
function setContent(html){$('#content').innerHTML=html}
function confirmDelete(label,fn){if(confirm(`Remove ${label}? This action cannot be undone.`))fn()}
async function loadOverview(){
const d=await api('/admin/dashboard');$('#stats').innerHTML=[['Students',d.students],['Jobs',d.jobs],['Applications',d.applications],['Completed Profiles',d.completed_profiles],['Active Jobs',d.active_jobs],['Selected',d.selected_applications]].map((x,i)=>`<div class="stat"><span class="stat-icon">${['S','C','J','A','✓','C','J','★'][i]||'•'}</span><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join('');$('#overviewText').innerHTML=`<div class="metric">${d.students?Math.round(d.completed_profiles/d.students*100):0}%</div><p class="muted">${d.completed_profiles} of ${d.students} student profiles are completed.</p>`}function studentForm(s={}){return `<div class="form-grid">
<div class="field"><label>Name</label><input name="name" value="${esc(s.name)}" required></div>
<div class="field"><label>Registration Number</label><input name="regNo" value="${esc(s.reg_no)}" required></div>
<div class="field"><label>Email</label><input type="email" name="email" value="${esc(s.email)}" required></div>
<div class="field"><label>Phone</label><input name="phone" value="${esc(s.phone)}"></div>
<div class="field"><label>College</label><input name="college" value="${esc(s.college)}"></div>
<div class="field"><label>Degree</label><input name="degree" value="${esc(s.degree)}"></div>
<div class="field"><label>Department</label><select name="department" required><option value="">Select Department</option><option value="CSE" ${s.department==='CSE'?'selected':''}>CSE</option><option value="IT" ${s.department==='IT'?'selected':''}>IT</option><option value="EEE" ${s.department==='EEE'?'selected':''}>EEE</option><option value="ECE" ${s.department==='ECE'?'selected':''}>ECE</option><option value="Mechanical" ${s.department==='Mechanical'?'selected':''}>Mechanical</option><option value="Civil" ${s.department==='Civil'?'selected':''}>Civil</option><option value="Arts" ${s.department==='Arts'?'selected':''}>Arts</option></select></div><div class="field"><label>Current Year</label><select name="studyYear" required><option value="">Select Current Year</option><option value="1" ${Number(s.study_year)===1?'selected':''}>I Year</option><option value="2" ${Number(s.study_year)===2?'selected':''}>II Year</option><option value="3" ${Number(s.study_year)===3?'selected':''}>III Year</option><option value="4" ${Number(s.study_year)===4?'selected':''}>IV Year</option></select></div>
<div class="field"><label>Graduation Year</label><input type="number" name="graduationYear" min="2020" max="2100" value="${esc(s.graduation_year)}" placeholder="2028"></div>
<div class="field"><label>CGPA</label><input type="number" name="cgpa" min="0" max="10" step="0.01" value="${esc(s.cgpa)}"></div>
<div class="field"><label>Date of Birth</label><input type="date" name="dob" value="${esc(s.dob)}"></div>
<div class="field"><label>Gender</label><select name="gender"><option value="">Select Gender</option><option value="Male" ${s.gender==='Male'?'selected':''}>Male</option><option value="Female" ${s.gender==='Female'?'selected':''}>Female</option><option value="Other" ${s.gender==='Other'?'selected':''}>Other</option></select></div>
<div class="field full"><label>Address</label><textarea name="address">${esc(s.address)}</textarea></div>
<div class="field full"><label>Skills (comma separated)</label><input name="skills" value="${esc((s.skills||[]).join(', '))}"></div>
<div class="field full"><label>Languages (comma separated)</label><input name="languages" value="${esc((s.languages||[]).join(', '))}"></div>
<div class="field full"><label>Summary</label><textarea name="summary">${esc(s.summary)}</textarea></div>
<div class="field full"><label>Achievements</label><textarea name="achievements">${esc(s.achievements)}</textarea></div>
<div class="field"><label>LinkedIn</label><input name="linkedin" value="${esc(s.linkedin)}"></div>
<div class="field"><label>GitHub</label><input name="github" value="${esc(s.github)}"></div>
<div class="field"><label>Portfolio</label><input name="portfolio" value="${esc(s.portfolio)}"></div>
${!s.id?'<div class="field full"><label>Temporary Password</label><input name="password" type="password" placeholder="Leave blank to generate automatically"></div>':''}
</div><div class="form-actions"><button type="button" class="btn" id="cancelModal">Cancel</button><button class="primary">Save Student</button></div>`}

async function students(){sectionHead('students');const data=await api('/admin/students');setContent(`<div class="panel"><div class="toolbar"><div class="filters"><input class="search" id="studentSearch" placeholder="Search name, reg no, email..."></div><button class="primary" id="addStudent">+ Add Student</button></div><div id="studentTable"></div></div>`);function draw(){const q=($('#studentSearch').value||'').toLowerCase();const rows=data.filter(s=>[s.name,s.reg_no,s.email,s.department].join(' ').toLowerCase().includes(q)).map(s=>`<tr><td>${esc(s.reg_no)}</td><td><b>${esc(s.name)}</b><br><small>${esc(s.email)}</small></td><td>${esc(s.department||'—')}</td><td>${s.profile_completed?'<span class="pill">Complete</span>':'<span class="pill">Pending</span>'}</td><td><button class="btn" data-view="${s.id}">View</button><button class="btn" data-edit="${s.id}">Edit</button>${s.id?`<button class="btn danger" data-del="${s.id}">Remove</button>`:''}</td></tr>`).join('');$('#studentTable').innerHTML=data.length?table(['Reg No','Student','Department','Profile','Actions'],rows):empty()};draw();$('#studentSearch').oninput=draw;$('#addStudent').onclick=()=>openModal('Add Student',studentForm(),async form=>{const body=formToObj(form);body.skills=body.skills.split(',').map(x=>x.trim()).filter(Boolean);body.languages=body.languages.split(',').map(x=>x.trim()).filter(Boolean);const d=await api('/admin/students',{method:'POST',body:JSON.stringify(body)});toast(`Student created. Temporary password: ${d.temporaryPassword}`);closeModal();students()});$('#studentTable').onclick=async e=>{const v=e.target.closest('[data-view]');const ed=e.target.closest('[data-edit]');const de=e.target.closest('[data-del]');if(v){const s=await api('/admin/students/'+v.dataset.view);const profile=(s.profile_details||{});const renderDocCard=(label, docValue, signatureValue)=>{if(!docValue && !signatureValue) return '';const isImage = typeof docValue === 'string' && docValue.toLowerCase().startsWith('data:image/');const isPdf = typeof docValue === 'string' && docValue.toLowerCase().startsWith('data:application/pdf');return `<div class="field full"><label>${label}</label>${docValue?isImage?`<img src="${esc(docValue)}" alt="${esc(label)}" style="max-width:100%;max-height:220px;border-radius:12px;border:1px solid rgba(98,109,128,0.2);background:#fff;object-fit:contain;" onerror="this.style.display='none'" />`:isPdf?`<a href="${esc(docValue)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;color:#5b46d6;font-weight:700;">Open PDF</a>`:`<div style="margin-top:8px; color:#4a5062;">Uploaded document</div>`:'<div style="color:#4a5062;">—</div>'}${signatureValue?`<div style="margin-top:12px;"><div style="font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#5d6477; margin-bottom:6px;">Signature</div><img src="${esc(signatureValue)}" alt="${esc(label)} signature" style="max-width:220px;max-height:90px;border-radius:10px;border:1px solid rgba(98,109,128,0.2);background:#fff;object-fit:contain;" /></div>`:''}</div>`;};const verificationCards=[['10th marks', profile.tenthScore || profile.schoolMarks || s.tenthScore || '—', profile.tenthProof || '', profile.tenthSignature || profile.signature || ''],['12th marks', profile.twelfthScore || s.twelfthScore || '—', profile.twelfthProof || '', profile.twelfthSignature || ''],['CGPA', s.cgpa || profile.cgpa || '—', profile.cgpaProof || '', profile.cgpaSignature || ''],['Aadhaar', profile.aadhaarNumber || s.aadhaarNumber || '—', profile.aadhaarProof || '', profile.aadhaarSignature || '']];const proofMarkup=verificationCards.map(([label, score, proofValue, sigValue])=>renderDocCard(label, proofValue, sigValue)).filter(Boolean).join('');openModal('Student Profile',`<div class="form-grid">${[['Name',s.name],['Reg No',s.reg_no],['Email',s.email],['Phone',s.phone],['College',s.college],['Degree',s.degree],['Department',s.department],['Current Year',s.study_year ? ['I Year','II Year','III Year','IV Year'][Number(s.study_year)-1] : '—'],['Graduation Year',s.graduation_year],['10th school',profile.tenthSchoolName || s.tenthSchoolName || '—'],['10th completion year',profile.tenthCompletionYear || s.tenthCompletionYear || '—'],['12th school',profile.twelfthSchoolName || s.twelfthSchoolName || '—'],['12th completion year',profile.twelfthCompletionYear || s.twelfthCompletionYear || '—'],['CGPA',s.cgpa || '—'],['School marks',profile.schoolMarks || [profile.tenthScore, profile.twelfthScore].filter(Boolean).join(' / ') || '—'],['Aadhaar number',profile.aadhaarNumber||'—'],['Skills',(s.skills||[]).join(', ')],['Languages',(s.languages||[]).join(', ')],['Summary',s.summary]].map(x=>`<div class="field"><label>${x[0]}</label><div>${esc(x[1]||'—')}</div></div>`).join('')}${verificationCards.map(([label, score, proofValue, sigValue])=>`<div class="field"><label>${label}</label><div>${esc(score || '—')}</div></div>`).join('')}${proofMarkup}</div><div class="form-actions"><button class="btn" id="resumeBtn">View Resume</button><button class="primary" id="cancelModal">Close</button></div>`);$('#resumeBtn').onclick=async()=>{try{const r=await fetch(`${API_BASE}/admin/student-resume/${s.id}`,{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Resume not found');const blob=await r.blob();window.open(URL.createObjectURL(blob),'_blank')}catch(err){toast(err.message)}}}if(ed){const s=await api('/admin/students/'+ed.dataset.edit);openModal('Edit Student',studentForm(s),async form=>{const b=formToObj(form);b.skills=b.skills.split(',').map(x=>x.trim()).filter(Boolean);b.languages=b.languages.split(',').map(x=>x.trim()).filter(Boolean);await api('/admin/students/'+s.id,{method:'PATCH',body:JSON.stringify(b)});toast('Student updated');closeModal();students()})}if(de)confirmDelete('this student',async()=>{await api('/admin/students/'+de.dataset.del,{method:'DELETE'});toast('Student removed');students()})}}

function reviewText(value){
  if(value===null||value===undefined||value==='')return '—';
  if(typeof value==='string'&&/^data:(image\/|application\/pdf)/i.test(value))return '[Uploaded image or PDF]';
  return typeof value==='object'?JSON.stringify(value):String(value);
}
function flattenReviewMap(value,prefix='',entries=new Map()){
  if(value&&typeof value==='object'&&!Array.isArray(value)){
    Object.entries(value).forEach(([key,item])=>flattenReviewMap(item,prefix?`${prefix} · ${key}`:key,entries));
  }else if(Array.isArray(value)){
    value.forEach((item,index)=>flattenReviewMap(item,`${prefix} · ${index+1}`,entries));
  }else if(prefix)entries.set(prefix,value);
  return entries;
}
function profileReviewChanges(student,pending){
  const omit=['pendingChanges','verificationStatus','verified','requested','requestedAt','reviewedAt','reviewedBy','approvedAt','rejectedAt'];
  const cleanDetails=value=>Object.fromEntries(Object.entries(value||{}).filter(([key])=>!omit.includes(key)));
  const current={
    name:student.name,regNo:student.reg_no,email:student.email,phone:student.phone,dob:student.dob,
    gender:student.gender,address:student.address,college:student.college,degree:student.degree,
    department:student.department,graduationYear:student.graduation_year,cgpa:student.cgpa,
    education:student.education,skills:student.skills,languages:student.languages,
    experience:student.experience,achievements:student.achievements,certifications:student.certifications,
    projects:student.projects,summary:student.summary,linkedin:student.linkedin,github:student.github,
    portfolio:student.portfolio,profileDetails:cleanDetails(student.profile_details)
  };
  const proposed={...pending,profileDetails:cleanDetails(pending.profileDetails)};
  const before=flattenReviewMap(current),after=flattenReviewMap(proposed);
  return [...new Set([...before.keys(),...after.keys()])]
    .filter(key=>JSON.stringify(before.get(key))!==JSON.stringify(after.get(key)))
    .map(key=>[key,`${reviewText(before.get(key))} → ${reviewText(after.get(key))}`]);
}
function reviewRows(entries){
  return `<div class="review-diff">${entries.map(([key,value])=>`<div><span>${esc(key)}</span><b>${esc(value)}</b></div>`).join('')}</div>`;
}
function formatAdminDate(value){if(!value)return '—';const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString()}
function applicationRounds(raw){if(Array.isArray(raw))return raw.map((round,index)=>typeof round==='string'?{name:round}:({...round,name:round.name||round.title||round.roundName||`Round ${index+1}`}));const value=String(raw||'').trim();if(!value||value==='Not specified')return [];try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return applicationRounds(parsed);if(Array.isArray(parsed.rounds))return applicationRounds(parsed.rounds)}catch{}return value.split(/\r?\n/).map(line=>line.replace(/^\s*\d+[.)]\s*/,'').trim()).filter(Boolean).map(name=>({name}))}
function jobRoundFlow(raw){
  const rounds=applicationRounds(raw);
  if(!rounds.length)return '<p class="muted">No interview rounds specified.</p>';
  const field=(round,keys)=>{for(const key of keys){const value=round[key];if(value!==undefined&&value!==null&&String(value).trim())return String(value).trim()}return ''};
  const configured=rounds.map((round,index)=>{
    const type=field(round,['type','assessmentType','assessment_type']);
    const mode=field(round,['mode']);
    const duration=field(round,['durationMinutes','duration_minutes','duration']);
    const questionCount=field(round,['questionCount','question_count']);
    const passingScore=field(round,['cutoff','passingScore','passing_score']);
    const isTest=/aptitude|coding|programming|assessment|online test|written test|quiz|technical test|mcq/i.test(`${round.name||''} ${type}`);
    const complete=round.active===true&&Boolean(type&&mode&&Number(duration)>=5&&Number(duration)<=240&&(!isTest||(Number(questionCount)>0&&passingScore!=='')));
    const details=[
      ['Round type',type],
      ['Mode',mode],
      ['Duration',duration?`${duration} minutes`:'' ],
      ...(isTest?[['Questions',questionCount],['Passing score',passingScore!==''?String(passingScore).includes('%')?passingScore:`${passingScore}%`:'']]:[]),
      ['Scheduled',field(round,['scheduledAt','scheduled_at'])?formatAdminDate(field(round,['scheduledAt','scheduled_at'])):''],
      ['Topics / skills',field(round,['topics','skills'])],
      ['Instructions',field(round,['instructions'])],
      ['Meeting link',field(round,['meetingUrl','meeting_url'])]
    ].filter(([,value])=>value);
    return {round,index,complete,details};
  });
  return `<div class="job-round-chart"><div class="job-round-flow" aria-label="Interview rounds">${configured.map(({round,index,complete})=>`<div class="job-round-node-wrap"><button type="button" class="job-round-step" data-job-round="${index}" ${complete?`aria-expanded="false" aria-controls="admin-job-round-details-${index}"`:'disabled'}><span class="job-round-number">${index+1}</span><span class="job-round-name">${esc(round.name||`Round ${index+1}`)}</span></button></div>`).join('')}</div><div class="job-round-detail-panels">${configured.filter(round=>round.complete).map(({index,round,details})=>`<section class="job-round-detail-panel" id="admin-job-round-details-${index}" data-job-round-details="${index}" hidden><h4>${esc(round.name||`Round ${index+1}`)} details</h4><dl>${details.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></section>`).join('')}</div></div>`;
}
function flowStep(label,status,detail='',tone='neutral'){return `<div class="student-flow-step ${tone}"><span class="student-flow-dot"></span><div><b>${esc(label)}</b><span class="student-flow-status">${esc(status)}</span>${detail?`<small>${esc(detail)}</small>`:''}</div></div>`}
function applicationFlow(application){
  const history=Array.isArray(application.status_history)?application.status_history:[];
  const attempts=Array.isArray(application.assessment_attempts)?application.assessment_attempts:[];
  const reviews=Array.isArray(application.round_reviews)?application.round_reviews:[];
  const interviews=Array.isArray(application.hr_interviews)?application.hr_interviews:[];
  const configuredRounds=applicationRounds(application.interview_rounds);
  const steps=[flowStep('Application received','Applied',formatAdminDate(application.applied_at),'done')];
  for(const event of history.filter(item=>String(item.status).toLowerCase()!=='applied')){steps.push(flowStep('Application status',event.status,`${event.changed_by_role||'Admin'} · ${formatAdminDate(event.created_at)}`,/reject/i.test(event.status)?'failed':/select|offer/i.test(event.status)?'done':'neutral'))}
  configuredRounds.forEach((round,index)=>{
    const attempt=attempts.find(item=>Number(item.round_index)===index);
    const review=reviews.find(item=>Number(item.round_index)===index);
    const interview=interviews.find(item=>Number(item.round_index)===index);
    const results=[];
    const details=[];
    let tone='neutral';
    if(review){results.push(`Review: ${review.decision}`);if(review.decision==='Fail')tone='failed';else if(review.decision==='Pass'&&tone!=='failed')tone='done';details.push(review.feedback||`Reviewed ${formatAdminDate(review.reviewed_at||review.updated_at)}`)}
    if(attempt){
      results.push(`Assessment: ${attempt.company_verified?(attempt.company_decision||'Verified'):attempt.status==='submitted'?'Awaiting approval':'In progress'}`);
      if(attempt.company_verified){if(attempt.company_decision==='Fail')tone='failed';else if(tone!=='failed')tone='done';details.push(`Verified score: ${attempt.score??'—'}${attempt.total_questions?` / ${attempt.total_questions}`:''}${attempt.company_feedback?` · ${attempt.company_feedback}`:''}`)}
      else if(attempt.status==='submitted'){if(tone==='neutral')tone='pending';details.push(`Submitted ${formatAdminDate(attempt.submitted_at)} · score hidden until company approval`)}
      else details.push('Assessment started');
    }
    if(interview){results.push(`Interview: ${interview.status}`);if(interview.status==='cancelled')tone='failed';else if(interview.status==='ended'&&tone!=='failed')tone='done';else if(tone==='neutral')tone='pending';details.push(`Scheduled ${formatAdminDate(interview.scheduled_at)}`)}
    steps.push(flowStep(round.name||`Round ${index+1}`,results.join(' · ')||'Upcoming',details.join(' · ')||'No activity recorded yet',tone));
  });
  if(!configuredRounds.length)steps.push(flowStep('Recruitment rounds','Not configured','This job has no configured rounds.'));
  return `<div class="student-flow">${steps.join('')}</div>`;
}
function studentMoreSection(profile){
  const more=profile?.more&&typeof profile.more==='object'?profile.more:{};
  const humanize=value=>String(value).replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/\b\w/g,char=>char.toUpperCase());
  const renderValue=(label,value)=>{
    if(value===null||value===undefined||value==='')return '';
    if(Array.isArray(value)){
      return value.length?`<div class="student-more-list">${value.map((item,index)=>`<article class="student-more-item">${renderValue(`Entry ${index+1}`,item)}</article>`).join('')}</div>`:'';
    }
    if(typeof value==='object'){
      const entries=Object.entries(value).filter(([,item])=>item!==null&&item!==undefined&&item!=='');
      return entries.length?`<div class="student-more-fields">${entries.map(([key,item])=>renderValue(humanize(key),item)).join('')}</div>`:'';
    }
    return `<div class="student-more-field"><small>${esc(humanize(label))}</small><span>${esc(reviewText(value))}</span></div>`;
  };
  const sections=Object.entries({
    ...more,
    social:profile?.social||{},
    languages:profile?.languages||{},
    links:profile?.links||[],
    tags:profile?.tags||[]
  })
    .map(([key,value])=>[key,renderValue(key,value)])
    .filter(([,content])=>content)
    .map(([key,content])=>`<section class="student-more-section"><h4>${esc(humanize(key))}</h4>${content}</section>`);
  if(profile?.achievements)sections.push(`<section class="student-more-section"><h4>Achievements</h4>${renderValue('Achievements',profile.achievements)}</section>`);
  return `<section class="student-profile-summary student-more-summary"><div class="student-section-heading"><div><h3>More profile details</h3><p>Projects, achievements, awards, test scores, and other submitted items.</p></div>${profile?.verificationStatus==='pending'?'<span class="review-status pending">Pending review</span>':''}</div>${sections.length?sections.join(''):empty('No additional profile details have been submitted.')}</section>`;
}
async function viewStudentPerformance(studentId){
  try{
    const {student,applications}=await api(`/admin/students/${encodeURIComponent(studentId)}/performance`);
    const certificates=await api(`/admin/students/${encodeURIComponent(studentId)}/skill-certificates`);
    const attempts=applications.flatMap(application=>Array.isArray(application.assessment_attempts)?application.assessment_attempts:[]);
    const verified=attempts.filter(attempt=>attempt.company_verified);
    const passedRoundKeys=new Set([
      ...applications.flatMap(application=>(application.assessment_attempts||[]).filter(attempt=>attempt.company_verified&&attempt.company_decision==='Pass').map(attempt=>`${application.id}:${attempt.round_index}`)),
      ...applications.flatMap(application=>(application.round_reviews||[]).filter(review=>review.decision==='Pass').map(review=>`${application.id}:${review.round_index}`))
    ]);
    const passedRounds=passedRoundKeys.size;
    const selected=applications.filter(application=>/select|offer/i.test(application.status||'')).length;
    const verificationState=getVerificationState(student);
    const verificationLabel = verificationState === 'approved' ? 'Verified' : verificationState === 'rejected' ? 'Rejected' : 'Pending review';
    const verificationStyle = verificationState === 'approved'
      ? 'background:#e8fff1;color:#157347;border:1px solid rgba(21,115,71,0.18);'
      : verificationState === 'rejected'
        ? 'background:#fff1f1;color:#b42318;border:1px solid rgba(180,35,24,0.18);'
        : 'background:#fff8e6;color:#a16207;border:1px solid rgba(161,98,7,0.18);';
    const currentProfile=student.profile_details||{};
    const pendingProfile=student.pending_profile?.profileDetails||{};
    const profile={
      ...currentProfile,
      ...pendingProfile,
      verificationStatus:student.pending_profile?'pending':currentProfile.verificationStatus,
      achievements:student.pending_profile?.achievements??student.achievements
    };
    const profileReviewStatus=currentProfile.verificationStatus||(student.pending_profile?'pending':'uploaded');
    const documents=[];
    const addProfileDocument=(label,data,status)=>{
      if(typeof data==='string'&&/^data:(image\/|application\/pdf)/i.test(data)){
        documents.push({label,data,status});
      }
    };
    [
      ['10th marksheet',profile.tenthProof||profile.schoolMarksProof],
      ['12th marksheet',profile.twelfthProof],
      ['CGPA marksheet',profile.cgpaProof],
      ['Aadhaar card',profile.aadhaarProof],
      ['10th signature',profile.tenthSignature||profile.signature],
      ['12th signature',profile.twelfthSignature],
      ['CGPA signature',profile.cgpaSignature],
      ['Aadhaar signature',profile.aadhaarSignature]
    ].forEach(([label,data])=>addProfileDocument(
      label,
      data,
      profileReviewStatus
    ));
    Object.entries(profile).forEach(([key,data])=>{
      if(/proof|signature/i.test(key)&&!['tenthProof','schoolMarksProof','twelfthProof','cgpaProof','aadhaarProof','tenthSignature','signature','twelfthSignature','cgpaSignature','aadhaarSignature'].includes(key)){
        addProfileDocument(key.replace(/([A-Z])/g,' $1'),data,'Profile document');
      }
    });
    (Array.isArray(profile.skills)?profile.skills:[]).forEach(skill=>{
      (Array.isArray(skill?.proof)?skill.proof:[]).forEach((data,index)=>{
        addProfileDocument(`${skill.name||'Skill'} proof ${index+1}`,data,'Profile document');
      });
    });
    (Array.isArray(certificates)?certificates:[]).forEach(certificate=>documents.push({
      label:`${certificate.course_title} · ${certificate.provider}`,
      data:certificate.file_data,
      status:certificate.status,
      certificateId:certificate.id
    }));
    const pendingChanges=student.pending_profile?profileReviewChanges(student,student.pending_profile):[];
    const profileReviewSection=student.pending_profile
      ?`<section class="student-applications student-profile-review"><div class="student-section-heading"><div><h3>Profile changes</h3><p>Review all submitted Details and More changes before approving or rejecting the profile below.</p></div><span class="review-status ${verificationState}">${verificationState==='rejected'?'Rejected':verificationState==='approved'?'Approved':'Pending review'}</span></div>${reviewRows(pendingChanges.length?pendingChanges:[['Profile','No differences found.']])}</section>`
      :'';
    const appCards=applications.map(application=>`<article class="student-application"><div class="student-application-head"><div><span class="eyebrow">${esc(application.company_name||'Company')}</span><h3>${esc(application.title||'Job')}</h3><p>${esc([application.job_type,application.location,application.work_mode].filter(Boolean).join(' · ')||'')}</p></div><span class="pill">${esc(application.status)}</span></div><div class="student-flow-heading">Recruitment progress</div>${applicationFlow(application)}</article>`).join('');
    const fields=[['Registration number',student.reg_no],['Email',student.email],['Phone',student.phone],['College',student.college],['Degree',student.degree],['Department',student.department],['Current year',student.study_year?['I Year','II Year','III Year','IV Year'][Number(student.study_year)-1]:'—'],['Graduation year',student.graduation_year],['CGPA',student.cgpa],['Skills',(student.skills||[]).join(', ')]];
    openModal(`${student.name} · Student performance`,`<div class="student-performance"><div class="student-performance-overview"><div class="student-performance-identity"><div class="avatar">${esc(initials(student.name))}</div><div><h3>${esc(student.name)}</h3><span>${esc(student.email)}</span></div></div><div class="student-performance-stats"><div><small>Applications</small><strong>${applications.length}</strong></div><div><small>Rounds passed</small><strong>${passedRounds}</strong></div><div><small>Verified assessments</small><strong>${verified.length}</strong></div><div><small>Selected / offers</small><strong>${selected}</strong></div></div></div><section class="student-profile-summary"><h3>Student profile</h3><div id="studentVerificationState" style="margin-bottom:12px"><span class="pill" style="${verificationStyle}">${verificationLabel}</span></div><div class="student-profile-grid">${fields.map(([label,value])=>`<div><small>${esc(label)}</small><span>${esc(value||'—')}</span></div>`).join('')}${student.summary?`<div class="student-profile-wide"><small>Summary</small><span>${esc(student.summary)}</span></div>`:''}</div></section>${profileReviewSection}${studentMoreSection(profile)}<section class="student-applications"><div class="student-section-heading"><div><h3>Applications and recruitment flow</h3><p>Round results and assessment scores appear here only after company verification.</p></div><span class="pill">${applications.length} total</span></div>${appCards||empty('This student has not applied to any jobs yet.')}</section><div class="form-actions"><button type="button" class="btn" id="studentResumeBtn">View Resume</button>${verificationState === 'approved' ? '' : `<button type="button" class="primary" data-verification-action="approve" data-student-id="${student.id}">Approve profile</button><button type="button" class="btn danger" data-verification-action="reject" data-student-id="${student.id}">Reject</button>`}<button type="button" class="btn" id="cancelModal">Close</button></div></div>`);
    const documentSection=document.createElement('section');
    documentSection.className='student-applications student-documents';
    const drawDocuments=()=>{
      documentSection.innerHTML=`<div class="student-section-heading"><div><h3>Uploaded documents</h3><p>Marksheets, Aadhaar proof, signatures, skill proofs, and course certificates.</p></div><span class="pill">${documents.length} files</span></div>${documents.length?`<div class="student-document-grid">${documents.map((doc,index)=>{const status=String(doc.status).toLowerCase();const statusClass=['approved','rejected','pending'].includes(status)?status:'uploaded';return `<article class="student-document"><div><b>${esc(doc.label)}</b><span class="review-status ${statusClass}">${esc(doc.status)}</span></div><div class="student-document-actions"><button type="button" class="btn" data-document-view="${index}">View</button>${doc.certificateId&&doc.status==='pending'?`<button type="button" class="btn success" data-document-approve="${index}">Approve</button><button type="button" class="btn danger" data-document-reject="${index}">Reject</button>`:''}</div></article>`}).join('')}</div>`:empty('No uploaded documents found for this student.')}`;
    };
    drawDocuments();
    document.querySelector('.student-applications')?.before(documentSection);
    documentSection.onclick=async event=>{
      const view=event.target.closest('[data-document-view]');
      const approve=event.target.closest('[data-document-approve]');
      const reject=event.target.closest('[data-document-reject]');
      if(view){
        const doc=documents[Number(view.dataset.documentView)];
        if(!doc)return;
        const preview=doc.data.startsWith('data:application/pdf')
          ?`<iframe class="review-document" src="${esc(doc.data)}" title="${esc(doc.label)}"></iframe>`
          :`<img class="review-document-image" src="${esc(doc.data)}" alt="${esc(doc.label)}">`;
        const previewModal=document.createElement('div');
        previewModal.className='modal document-preview-modal';
        previewModal.innerHTML=`<div class="modal-card"><button type="button" class="close" data-close-document-preview aria-label="Close document preview">×</button><h2>${esc(doc.label)}</h2>${preview}<div class="form-actions"><button type="button" class="btn" data-close-document-preview>Close</button></div></div>`;
        previewModal.addEventListener('click',event=>{
          if(event.target===previewModal||event.target.closest('[data-close-document-preview]'))previewModal.remove();
        });
        document.body.append(previewModal);
        return;
      }
      const decision=approve||reject;
      if(!decision)return;
      const doc=documents[Number(decision.dataset.documentApprove||decision.dataset.documentReject)];
      if(!doc?.certificateId)return;
      const status=approve?'approved':'rejected';
      decision.disabled=true;
      try{
        const result=await api(`/admin/skill-certificates/${doc.certificateId}`,{
          method:'PATCH',
          body:JSON.stringify({status})
        });
        doc.status=result.status;
        toast(`Certificate ${status}`);
        drawDocuments();
      }catch(error){decision.disabled=false;toast(error.message)}
    };
    $('#studentResumeBtn').onclick=async()=>{try{const response=await fetch(`${API_BASE}/admin/student-resume/${student.id}`,{headers:{Authorization:'Bearer '+token}});if(!response.ok)throw Error('Resume not found');const blob=await response.blob();window.open(URL.createObjectURL(blob),'_blank')}catch(error){toast(error.message)}};
    document.querySelectorAll('[data-verification-action]').forEach(button=>{
      button.onclick=async()=>{
        const action = button.dataset.verificationAction;
        const nextStatus = action === 'approve' ? 'approved' : 'rejected';
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = action === 'approve' ? 'Approving...' : 'Rejecting...';

        try {
          await api(`/admin/students/${encodeURIComponent(student.id)}/verification`, {
            method: 'PATCH',
            body: JSON.stringify({ status: nextStatus })
          });
          toast(`Verification ${nextStatus === 'approved' ? 'approved' : 'rejected'} for ${student.name}.`);
          await viewStudentPerformance(student.id);
        } catch (error) {
          toast(error.message || 'Could not update verification.');
          button.disabled = false;
          button.textContent = originalText;
        }
      };
    });
  }catch(error){toast(error.message)}
}
document.addEventListener('click',event=>{const button=event.target.closest('#studentTable [data-view]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();viewStudentPerformance(button.dataset.view)},true);

async function companies(){
  sectionHead('companies');
  const data=await api('/admin/companies');
  setContent(`<div class="panel"><div class="toolbar"><input class="search" id="companySearch" placeholder="Search companies..."></div><div id="companyTable"></div></div>`);
  function draw(){
    const q=($('#companySearch').value||'').toLowerCase();
    $('#companyTable').innerHTML=table(['Company','Industry','Location','Jobs','Applications','Status','Actions'],data.filter(c=>[c.name,c.industry,c.location].join(' ').toLowerCase().includes(q)).map(c=>{
      const status=c.admin_status||'Pending';
      const nextStatus=status==='Active'?'Suspended':'Active';
      const actionLabel=status==='Active'?'Suspend':status==='Pending'?'Approve':'Activate';
      const displayedStatus=status==='Pending'?'Pending approval':status==='Active'?'Approved':'Suspended';
      return `<tr><td><b>${esc(c.name)}</b><br><small>${esc(c.email)}</small></td><td>${esc(c.industry)}</td><td>${esc(c.location||'—')}</td><td>${c.job_count}</td><td>${c.application_count}</td><td><span class="pill">${esc(displayedStatus)}</span></td><td><button class="btn" data-company="${c.id}" data-status="${nextStatus}">${actionLabel}</button><button class="btn danger" data-del="${c.id}">Remove</button></td></tr>`;
    }).join('')||empty());
  }
  draw();
  $('#companySearch').oninput=draw;
  $('#companyTable').onclick=async e=>{
    const button=e.target.closest('[data-company]');
    const remove=e.target.closest('[data-del]');
    if(button){
      try{
        await api('/admin/companies/'+button.dataset.company,{method:'PATCH',body:JSON.stringify({status:button.dataset.status})});
        const company=data.find(c=>String(c.id)===button.dataset.company);
        if(company)company.admin_status=button.dataset.status;
        draw();
        toast(button.dataset.status==='Active'?'Company approved':'Company status updated');
      }catch(error){toast(error.message)}
    }
    if(remove)confirmDelete('this company',async()=>{
      try{
        await api('/admin/companies/'+remove.dataset.del,{method:'DELETE'});
        const index=data.findIndex(c=>String(c.id)===remove.dataset.del);
        if(index!==-1)data.splice(index,1);
        draw();
        toast('Company removed');
      }catch(error){toast(error.message)}
    });
  };
}
async function jobs(){
  sectionHead('jobs');
  let data=await api('/admin/jobs');
  let activeFilter='Pending';
  setContent(`<section class="approval-hero"><div><div class="approval-eyebrow">RECRUITMENT CONTROL CENTER</div><h2>Job approvals</h2><p>Review every role submitted by a company. Each job is reviewed independently, even when a company already has approved listings.</p></div><div class="approval-hero-icon">✓</div></section>
    <div class="approval-stats" id="approvalStats"></div>
    <div class="panel approval-workspace"><div class="approval-toolbar"><div class="approval-tabs" id="approvalTabs"><button class="approval-tab active" data-filter="Pending">Pending review <span id="pendingTabCount">0</span></button><button class="approval-tab" data-filter="Approved">Approved</button><button class="approval-tab" data-filter="Rejected">Rejected</button><button class="approval-tab" data-filter="All">All jobs</button></div><input class="search" id="jobSearch" placeholder="Search job title or company…" aria-label="Search jobs"></div><div class="approval-results-head"><span id="approvalResultLabel">Pending jobs</span><button class="btn" id="refreshApprovals">↻ Refresh</button></div><div id="approvalList" class="approval-list"></div></div>`);
  const date=v=>v?new Date(v).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'Not specified';
  const statusClass=v=>v==='Approved'?'approved':v==='Rejected'?'rejected':'pending';
  function draw(){
    const q=($('#jobSearch').value||'').trim().toLowerCase();
    const counts={Pending:data.filter(j=>(j.approval_status||'Approved')==='Pending').length,Approved:data.filter(j=>(j.approval_status||'Approved')==='Approved').length,Rejected:data.filter(j=>j.approval_status==='Rejected').length};
    $('#approvalStats').innerHTML=[['Pending review',counts.Pending,'Needs your attention','◷','pending'],['Approved roles',counts.Approved,'Visible to eligible students','✓','approved'],['Rejected roles',counts.Rejected,'Returned to companies','↗','rejected'],['Total submissions',data.length,'Across all companies','▤','total']].map(x=>`<article class="approval-stat ${x[4]}"><div class="approval-stat-top"><span>${x[0]}</span><i>${x[3]}</i></div><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join('');
    $('#pendingTabCount').textContent=counts.Pending;
    const rows=data.filter(j=>(activeFilter==='All'||(j.approval_status||'Approved')===activeFilter)&&[j.title,j.company_name,j.job_type,j.location].join(' ').toLowerCase().includes(q)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    $('#approvalResultLabel').textContent=`${rows.length} ${activeFilter==='All'?'job':activeFilter.toLowerCase()+' job'}${rows.length===1?'':'s'}`;
    $('#approvalList').innerHTML=rows.length?rows.map(j=>{const st=j.approval_status||'Approved';return `<article class="approval-card"><div class="approval-card-main"><div class="approval-company-mark">${esc(initials(j.company_name||'CO'))}</div><div class="approval-job-copy"><div class="approval-job-heading"><h3>${esc(j.title)}</h3><span class="approval-badge ${statusClass(st)}"><i></i>${esc(st)}</span></div><p class="approval-company">${esc(j.company_name||'Company')} <span>•</span> ${esc(j.job_type||'Role not specified')}</p><div class="approval-meta"><span>⌖ ${esc(j.location||'Location not specified')}</span><span>◷ Apply by ${date(j.apply_before)}</span><span>♙ ${Number(j.applicant_count||0)} applicants</span></div><div class="approval-tags">${(j.eligible_departments||[]).map(d=>`<span>${esc(d)}</span>`).join('')||'<span>Departments not specified</span>'}<span>${esc(j.work_mode||'Work mode not specified')}</span></div>${st==='Rejected'&&j.approval_note?`<div class="approval-note"><b>Rejection reason:</b> ${esc(j.approval_note)}</div>`:''}</div></div><div class="approval-card-actions"><button class="btn" data-view="${j.id}">Review details</button><button class="btn" data-applicants="${j.id}">Applicants (${Number(j.applicant_count||0)})</button>${st!=='Approved'?`<button class="approval-btn approve" data-approve="${j.id}">✓ Approve</button>`:''}${st!=='Rejected'?`<button class="approval-btn reject" data-reject="${j.id}">✕ Reject</button>`:''}<button class="approval-btn remove" data-remove-job="${j.id}">Remove job</button></div><div class="approval-card-foot"><span>Submitted ${date(j.created_at)}</span><span>Job ID #${esc(j.id)}</span></div></article>`}).join(''):`<div class="approval-empty"><div>✓</div><h3>${q?'No matching jobs':activeFilter==='Pending'?'You’re all caught up':'No jobs in this view yet'}</h3><p>${q?'Try another search term.':activeFilter==='Pending'?'New company submissions will appear here for review.':'Choose another status tab to view job submissions.'}</p></div>`;
  }
  async function reload(){data=await api('/admin/jobs');draw();}
  draw();
  $('#jobSearch').oninput=draw;
  $('#approvalTabs').onclick=e=>{const b=e.target.closest('[data-filter]');if(!b)return;activeFilter=b.dataset.filter;$$('#approvalTabs .approval-tab').forEach(x=>x.classList.toggle('active',x===b));draw()};
  $('#refreshApprovals').onclick=async()=>{try{await reload();toast('Job approvals refreshed')}catch(e){toast(e.message)}};
  $('#approvalList').onclick=async e=>{
    const remove=e.target.closest('[data-remove-job]');
    if(remove){
      const job=data.find(item=>String(item.id)===remove.dataset.removeJob);
      if(!job)return;
      const applicants=Number(job.applicant_count||0);
      const applicantLabel=`${applicants} application${applicants===1?'':'s'}`;
      if(!confirm(`Remove "${job.title}"? This permanently deletes the job, its ${applicantLabel}, and related recruitment records. This action cannot be undone.`))return;
      remove.disabled=true;
      remove.textContent='Removing…';
      try{
        await api(`/admin/jobs/${encodeURIComponent(job.id)}`,{method:'DELETE'});
      }catch(error){
        toast(error.message||'Could not remove the job.');
        remove.disabled=false;
        remove.textContent='Remove job';
        return;
      }
      toast(`Job "${job.title}" and related records removed`);
      data=data.filter(item=>String(item.id)!==String(job.id));
      draw();
      return;
    }
    const approve=e.target.closest('[data-approve]'),reject=e.target.closest('[data-reject]'),view=e.target.closest('[data-view]'),applicantButton=e.target.closest('[data-applicants]');
    if(applicantButton){
      const job=data.find(x=>String(x.id)===applicantButton.dataset.applicants);if(!job)return;
      let jobApps=[];try{jobApps=(await api('/admin/applications')).filter(a=>String(a.job_id)===String(job.id));}catch(err){toast(err.message);return;}
      const statusOptions=['Applied','Shortlisted','Interview','Selected','Waitlisted','Rejected'];
      $('#modalTitle').textContent=`Applicants · ${job.title}`;
      const renderApplicants=items=>items.length?table(['Student','Registration No.','Applied','Status'],items.map(a=>`<tr><td><b>${esc(a.student_name)}</b><br><small>${esc(a.email||'')}</small></td><td>${esc(a.reg_no)}</td><td>${a.applied_at?new Date(a.applied_at).toLocaleDateString():'—'}</td><td><select class="app-status" data-id="${a.id}">${statusOptions.map(x=>`<option ${x===a.status?'selected':''}>${x}</option>`).join('')}</select></td></tr>`).join('')):empty('No applications have been submitted for this job yet.');
      $('#modalForm').innerHTML=`<div class="applicant-modal-intro"><p class="muted">${esc(job.company_name||'Company')} · ${jobApps.length} applicant${jobApps.length===1?'':'s'}</p><input class="search" id="jobApplicantSearch" placeholder="Search student name or registration number…"></div><div id="jobApplicantTable">${renderApplicants(jobApps)}</div><div class="form-actions"><button type="button" class="btn" id="cancelModal">Close</button></div>`;
      $('#modal').classList.remove('hidden');$('#cancelModal')?.addEventListener('click',closeModal);
      $('#jobApplicantSearch').oninput=()=>{const q=($('#jobApplicantSearch').value||'').toLowerCase();$('#jobApplicantTable').innerHTML=renderApplicants(jobApps.filter(a=>[a.student_name,a.reg_no,a.email].join(' ').toLowerCase().includes(q)));};
      $('#jobApplicantTable').onchange=async ev=>{if(!ev.target.matches('.app-status'))return;try{await api('/admin/applications/'+ev.target.dataset.id,{method:'PATCH',body:JSON.stringify({status:ev.target.value})});const item=jobApps.find(a=>String(a.id)===ev.target.dataset.id);if(item)item.status=ev.target.value;toast('Applicant status updated');}catch(err){toast(err.message)}};
      return;
    }
    if(approve){const j=data.find(x=>String(x.id)===approve.dataset.approve);if(!j)return;try{await api('/admin/jobs/'+j.id,{method:'PATCH',body:JSON.stringify({approvalStatus:'Approved'})});j.approval_status='Approved';j.approval_note=null;draw();toast(`${j.title} approved and published to eligible students`)}catch(err){toast(err.message)}}
    if(reject){const j=data.find(x=>String(x.id)===reject.dataset.reject);if(!j)return;openModal('Reject job submission',`<p class="muted">You are rejecting <b>${esc(j.title)}</b> from ${esc(j.company_name)}. The company will need to review the reason before resubmitting.</p><div class="field full"><label>Reason for rejection *</label><textarea name="approvalNote" required minlength="5" placeholder="Explain what needs to be corrected (e.g. missing salary details, unclear eligibility)…"></textarea></div><div class="form-actions"><button type="button" class="btn" id="cancelModal">Cancel</button><button class="approval-btn reject">Confirm rejection</button></div>`,async f=>{const approvalNote=new FormData(f).get('approvalNote')?.toString().trim();if(!approvalNote||approvalNote.length<5)throw Error('Please provide a clear rejection reason (at least 5 characters).');await api('/admin/jobs/'+j.id,{method:'PATCH',body:JSON.stringify({approvalStatus:'Rejected',approvalNote})});j.approval_status='Rejected';j.approval_note=approvalNote;draw();toast('Job rejected and feedback saved');closeModal()})}
    if(view){
      const j=data.find(x=>String(x.id)===view.dataset.view);
      if(!j)return;
      openModal('Job submission details',`<div class="approval-detail-grid"><div><small>Company</small><b>${esc(j.company_name)}</b></div><div><small>Approval status</small><b>${esc(j.approval_status||'Approved')}</b></div><div><small>Job title</small><b>${esc(j.title)}</b></div><div><small>Job type / mode</small><b>${esc(j.job_type||'—')} / ${esc(j.work_mode||'—')}</b></div><div><small>Salary</small><b>${esc(j.salary||'Not provided')}</b></div><div><small>Stipend</small><b>${esc(j.stipend||'Not provided')}</b></div><div><small>Location</small><b>${esc(j.location||'Not provided')}</b></div><div><small>Application deadline</small><b>${date(j.apply_before)}</b></div><div><small>Eligible departments</small><b>${esc((j.eligible_departments||[]).join(', ')||'Not specified')}</b></div><div><small>Batch</small><b>${esc(j.batch||'Not specified')}</b></div><div class="full"><small>Description</small><p>${esc(j.description||'No description provided')}</p></div><div class="full"><small>Interview rounds</small>${jobRoundFlow(j.interview_rounds)}</div>${j.approval_note?`<div class="full"><small>Previous review note</small><p>${esc(j.approval_note)}</p></div>`:''}</div><div class="form-actions"><button type="button" class="btn" id="cancelModal">Close</button>${(j.approval_status||'Approved')!=='Approved'?`<button type="button" class="approval-btn approve" id="detailApprove">✓ Approve job</button>`:''}</div>`,async()=>{});
      $('#modalForm').onclick=event=>{
        const toggle=event.target.closest('[data-job-round]');
        if(!toggle)return;
        const panel=$(`#admin-job-round-details-${toggle.dataset.jobRound}`);
        if(!panel)return;
        const expanded=panel.hidden;
        $('#modalForm').querySelectorAll('[data-job-round-details]').forEach(item=>{item.hidden=true});
        $('#modalForm').querySelectorAll('[data-job-round]').forEach(item=>{item.setAttribute('aria-expanded','false');item.classList.remove('is-expanded')});
        panel.hidden=!expanded;
        toggle.setAttribute('aria-expanded',String(expanded));
        toggle.classList.toggle('is-expanded',expanded);
      };
      $('#detailApprove')?.addEventListener('click',async()=>{try{await api('/admin/jobs/'+j.id,{method:'PATCH',body:JSON.stringify({approvalStatus:'Approved'})});j.approval_status='Approved';j.approval_note=null;closeModal();draw();toast('Job approved and published')}catch(err){toast(err.message)}});
    }
  };
}
async function applications(){
  sectionHead('applications');
  const data=await api('/admin/applications');
  setContent(`<div class="panel"><div class="toolbar"><div class="filters"><input class="search" id="appSearch" placeholder="Search student, company or job..."><span class="pill">${data.length} applications</span></div><button class="btn danger" id="clearApplications" ${data.length?'':'disabled'}>Clear all applications</button></div><div id="appTable"></div></div>`);
  function draw(){
    const q=($('#appSearch').value||'').toLowerCase();
    const filtered=data.filter(a=>[a.student_name,a.reg_no,a.job_title,a.company_name].join(' ').toLowerCase().includes(q));
    $('#appTable').innerHTML=table(['Student','Job','Company','Applied','Status','Actions'],filtered.map(a=>`<tr><td>${esc(a.student_name)}<br><small>${esc(a.reg_no)}</small></td><td>${esc(a.job_title)}</td><td>${esc(a.company_name)}</td><td>${a.applied_at?new Date(a.applied_at).toLocaleDateString():'—'}</td><td><select class="app-status" data-id="${a.id}">${['Applied','Shortlisted','Interview','Selected','Waitlisted','Rejected'].map(x=>`<option ${x===a.status?'selected':''}>${x}</option>`).join('')}</select></td><td><button class="btn danger" data-delete-application="${a.id}">Delete</button></td></tr>`).join('')||empty('No applications match this search.'));
  }
  draw();
  $('#appSearch').oninput=draw;
  $('#appTable').onchange=async e=>{
    if(!e.target.matches('.app-status'))return;
    try{await api('/admin/applications/'+e.target.dataset.id,{method:'PATCH',body:JSON.stringify({status:e.target.value})});toast('Application updated')}
    catch(error){toast(error.message);await applications()}
  };
  $('#appTable').onclick=async e=>{
    const button=e.target.closest('[data-delete-application]');
    if(!button)return;
    const row=data.find(item=>String(item.id)===button.dataset.deleteApplication);
    if(!row||!confirm(`Delete the application for ${row.student_name} to ${row.job_title}? Application-specific HR interviews, assessments, round reviews, and status history will also be deleted.`))return;
    try{await api('/admin/applications/'+button.dataset.deleteApplication,{method:'DELETE'});toast('Application deleted');await applications()}
    catch(error){toast(error.message)}
  };
  $('#clearApplications').onclick=async()=>{
    if(!data.length||!confirm(`Delete all ${data.length} applications? Application-specific HR interviews, assessments, round reviews, and status history will also be deleted. Students, companies, jobs, and separately scheduled interviews will remain.`))return;
    try{const result=await api('/admin/applications',{method:'DELETE'});toast(`${result.deleted} application(s) deleted`);await applications()}
    catch(error){toast(error.message)}
  };
}
async function competitions(){
  sectionHead('competitions');
  const data=await api('/admin/competitions');
  setContent(`<div class="panel"><div class="toolbar"><input class="search" id="competitionSearch" placeholder="Search competitions..."><button class="primary" id="newCompetition">+ Add Competition</button></div><div id="competitionTable"></div></div>`);
  const formatDeadline=value=>value?new Date(`${String(value).slice(0,10)}T00:00:00`).toLocaleDateString():'—';
  function draw(){
    const query=($('#competitionSearch').value||'').trim().toLowerCase();
    const rows=data.filter(item=>[item.title,item.description].join(' ').toLowerCase().includes(query));
    $('#competitionTable').innerHTML=table(['Competition','Deadline','Status','Created','Actions'],rows.map(item=>`<tr><td><b>${esc(item.title)}</b><br><small>${esc(item.description).slice(0,90)}</small></td><td>${esc(formatDeadline(item.deadline))}</td><td><span class="pill">${item.published?'Published':'Unpublished'}</span></td><td>${item.created_at?new Date(item.created_at).toLocaleDateString():'—'}</td><td><button class="btn" data-toggle-competition="${item.id}" data-published="${!item.published}">${item.published?'Unpublish':'Publish'}</button><button class="btn danger" data-delete-competition="${item.id}">Remove</button></td></tr>`).join('')||empty('No competitions match this search.'));
  }
  draw();
  $('#competitionSearch').oninput=draw;
  $('#newCompetition').onclick=()=>openModal('Publish Competition',`<div class="form-grid">
    <div class="field full"><label>Competition Name</label><input name="title" maxlength="160" required></div>
    <div class="field full"><label>Description</label><textarea name="description" maxlength="10000" required></textarea></div>
    <div class="field full"><label>Competition Image</label><input id="competitionImage" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required><small>PNG, JPG, WebP or GIF; maximum 1 MB.</small><img id="competitionImagePreview" class="competition-image-preview hidden" alt="Competition image preview"></div>
    <div class="field full"><label>Registration Link</label><input name="registrationUrl" type="url" placeholder="https://example.com/register" required></div>
    <div class="field"><label>Deadline</label><input name="deadline" type="date" required></div>
  </div><div class="form-actions"><button type="button" class="btn" id="cancelModal">Cancel</button><button class="primary">Publish Competition</button></div>`,async form=>{
    const file=form.elements.image.files[0];
    if(!file)throw Error('Choose a competition image.');
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw Error('Use a PNG, JPG, WebP or GIF image.');
    if(file.size>1024*1024)throw Error('The competition image must be 1 MB or smaller.');
    const imageData=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('Could not read the competition image.'));
      reader.onload=()=>resolve(reader.result);
      reader.readAsDataURL(file);
    });
    const body=formToObj(form);
    delete body.image;
    body.imageData=imageData;
    await api('/admin/competitions',{method:'POST',body:JSON.stringify(body)});
    toast('Competition published to the student portal');
    closeModal();
    await competitions();
  });
  $('#modalForm').onchange=event=>{
    if(!event.target.matches('#competitionImage'))return;
    const file=event.target.files[0],preview=$('#competitionImagePreview');
    if(preview.src.startsWith('blob:'))URL.revokeObjectURL(preview.src);
    if(!file){preview.removeAttribute('src');preview.classList.add('hidden');return}
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>1024*1024){
      event.target.value='';
      preview.removeAttribute('src');
      preview.classList.add('hidden');
      toast('Choose a PNG, JPG, WebP or GIF image up to 1 MB.');
      return;
    }
    preview.src=URL.createObjectURL(file);
    preview.classList.remove('hidden');
  };
  $('#competitionTable').onclick=async event=>{
    const toggle=event.target.closest('[data-toggle-competition]');
    const remove=event.target.closest('[data-delete-competition]');
    if(toggle){
      try{
        await api(`/admin/competitions/${toggle.dataset.toggleCompetition}`,{method:'PATCH',body:JSON.stringify({published:toggle.dataset.published==='true'})});
        toast(toggle.dataset.published==='true'?'Competition published':'Competition unpublished');
        await competitions();
      }catch(error){toast(error.message)}
    }
    if(remove){
      const item=data.find(row=>String(row.id)===remove.dataset.deleteCompetition);
      if(!item||!confirm(`Remove "${item.title}"? This action cannot be undone.`))return;
      try{
        await api(`/admin/competitions/${remove.dataset.deleteCompetition}`,{method:'DELETE'});
        toast('Competition removed');
        await competitions();
      }catch(error){toast(error.message)}
    }
  };
}
async function drives(){sectionHead('drives');const [data,companiesData,jobsData]=await Promise.all([api('/admin/drives'),api('/admin/companies'),api('/admin/jobs')]);setContent(`<div class="panel"><div class="toolbar"><input class="search" id="driveSearch" placeholder="Search drives..."><button class="primary" id="newDrive">+ Create Drive</button></div><div id="driveTable"></div></div>`);function draw(){const q=($('#driveSearch').value||'').toLowerCase();$('#driveTable').innerHTML=table(['Drive','Company','Job','Date','Eligibility','Status','Actions'],data.filter(d=>[d.title,d.company_name,d.job_title].join(' ').toLowerCase().includes(q)).map(d=>`<tr><td>${esc(d.title)}</td><td>${esc(d.company_name||'—')}</td><td>${esc(d.job_title||'—')}</td><td>${esc(d.drive_date||'—')}</td><td>${esc(d.eligible_batch||'—')}</td><td><span class="pill">${esc(d.status)}</span></td><td><button class="btn" data-close="${d.id}">Close</button><button class="btn danger" data-del="${d.id}">Remove</button></td></tr>`).join('')||empty())}draw();$('#driveSearch').oninput=draw;$('#newDrive').onclick=()=>openModal('Create Placement Drive',`<div class="form-grid"><div class="field full"><label>Title</label><input name="title" required></div><div class="field"><label>Company</label><select name="companyId"><option value="">Select</option>${companiesData.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Job</label><select name="jobId"><option value="">Select</option>${jobsData.map(j=>`<option value="${j.id}">${esc(j.title)} — ${esc(j.company_name)}</option>`).join('')}</select></div><div class="field"><label>Drive Date</label><input name="driveDate" type="date"></div><div class="field"><label>Eligible Batch</label><input name="eligibleBatch" placeholder="2027"></div><div class="field"><label>Minimum CGPA</label><input name="minCgpa" type="number" step="0.01"></div><div class="field"><label>Departments</label><input name="departments" placeholder="CSE, IT, ECE"></div><div class="field"><label>Location</label><input name="location"></div><div class="field full"><label>Description</label><textarea name="description"></textarea></div><div class="field"><label>Backlogs Allowed</label><select name="backlogsAllowed"><option value="false">No</option><option value="true">Yes</option></select></div></div><div class="form-actions"><button type="button" class="btn" id="cancelModal">Cancel</button><button class="primary">Create Drive</button></div>`,async f=>{const b=formToObj(f);b.departments=b.departments.split(',').map(x=>x.trim()).filter(Boolean);b.backlogsAllowed=b.backlogsAllowed==='true';await api('/admin/drives',{method:'POST',body:JSON.stringify(b)});toast('Placement drive created');closeModal();drives()});$('#driveTable').onclick=async e=>{const c=e.target.closest('[data-close]');const d=e.target.closest('[data-del]');if(c){await api('/admin/drives/'+c.dataset.close,{method:'PATCH',body:JSON.stringify({status:'Closed'})});toast('Drive closed');drives()}if(d)confirmDelete('this drive',async()=>{await api('/admin/drives/'+d.dataset.del,{method:'DELETE'});toast('Drive removed');drives()})}}
async function announcements(){sectionHead('announcements');const data=await api('/admin/announcements');setContent(`<div class="panel"><div class="toolbar"><span class="muted">Keep students informed about placement activity.</span><button class="primary" id="newAnn">+ Publish Announcement</button></div>${table(['Title','Audience','Published','Created','Actions'],data.map(a=>`<tr><td><b>${esc(a.title)}</b><br><small>${esc(a.message).slice(0,90)}</small></td><td>${esc(a.audience)}</td><td>${a.published?'Yes':'No'}</td><td>${new Date(a.created_at).toLocaleDateString()}</td><td><button class="btn" data-toggle="${a.id}" data-pub="${!a.published}">${a.published?'Unpublish':'Publish'}</button><button class="btn danger" data-del="${a.id}">Remove</button></td></tr>`).join('')||empty())}</div>`);$('#newAnn').onclick=()=>openModal('Publish Announcement',`<div class="form-grid"><div class="field full"><label>Title</label><input name="title" required></div><div class="field"><label>Audience</label><select name="audience"><option>All</option><option>Students</option><option>Companies</option></select></div><div class="field full"><label>Message</label><textarea name="message" required></textarea></div></div><div class="form-actions"><button type="button" class="btn" id="cancelModal">Cancel</button><button class="primary">Publish</button></div>`,async f=>{await api('/admin/announcements',{method:'POST',body:JSON.stringify(formToObj(f))});toast('Announcement published');closeModal();announcements()});$('.panel').onclick=async e=>{const t=e.target.closest('[data-toggle]'),d=e.target.closest('[data-del]');if(t){await api('/admin/announcements/'+t.dataset.toggle,{method:'PATCH',body:JSON.stringify({published:t.dataset.pub==='true'})});announcements()}if(d)confirmDelete('this announcement',async()=>{await api('/admin/announcements/'+d.dataset.del,{method:'DELETE'});announcements()})}}
async function interviews(){sectionHead('interviews');const [data,studentsData,companiesData,jobsData]=await Promise.all([api('/admin/interviews'),api('/admin/students'),api('/admin/companies'),api('/admin/jobs')]);setContent(`<div class="panel"><div class="toolbar"><span class="muted">Schedule online or campus interviews.</span><button class="primary" id="newInterview">+ Schedule Interview</button></div>${table(['Student','Company','Job','Date','Mode','Status','Actions'],data.map(i=>`<tr><td>${esc(i.student_name)}<br><small>${esc(i.reg_no)}</small></td><td>${esc(i.company_name||'—')}</td><td>${esc(i.job_title||'—')}</td><td>${i.interview_date?new Date(i.interview_date).toLocaleString():'—'}</td><td>${esc(i.mode)}</td><td>${esc(i.status)}</td><td><select class="int-status" data-id="${i.id}">${['Scheduled','Completed','Cancelled','No Show'].map(x=>`<option ${x===i.status?'selected':''}>${x}</option>`).join('')}</select></td></tr>`).join('')||empty())}</div>`);$('#newInterview').onclick=()=>openModal('Schedule Interview',`<div class="form-grid"><div class="field"><label>Student</label><select name="studentId">${studentsData.map(s=>`<option value="${s.id}">${esc(s.name)} (${esc(s.reg_no)})</option>`).join('')}</select></div><div class="field"><label>Company</label><select name="companyId"><option value="">Select</option>${companiesData.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Job</label><select name="jobId"><option value="">Select</option>${jobsData.map(j=>`<option value="${j.id}">${esc(j.title)}</option>`).join('')}</select></div><div class="field"><label>Date & Time</label><input name="interviewDate" type="datetime-local" required></div><div class="field"><label>Mode</label><select name="mode"><option>Online</option><option>Campus</option><option>Phone</option></select></div><div class="field"><label>Meeting Link</label><input name="meetingLink"></div><div class="field"><label>Interviewer</label><input name="interviewer"></div><div class="field full"><label>Notes</label><textarea name="notes"></textarea></div></div><div class="form-actions"><button class="primary">Schedule</button></div>`,async f=>{await api('/admin/interviews',{method:'POST',body:JSON.stringify(formToObj(f))});toast('Interview scheduled');closeModal();interviews()});$('.panel').onchange=async e=>{if(e.target.matches('.int-status')){await api('/admin/interviews/'+e.target.dataset.id,{method:'PATCH',body:JSON.stringify({status:e.target.value})});toast('Interview updated')}}}
async function analytics(){sectionHead('analytics');const d=await api('/admin/analytics');const max=a=>Math.max(1,...a.map(x=>Number(x.value)));const bars=(title,a)=>`<div class="panel"><h3>${title}</h3>${a.length?a.map(x=>`<div class="bar-row"><span>${esc(x.label)}</span><div class="bar"><i style="width:${Number(x.value)/max(a)*100}%"></i></div><b>${x.value}</b></div>`).join(''):empty()}</div>`;setContent(`<div class="chart-grid">${bars('Students by Department',d.departments)}${bars('Applications by Status',d.applications)}${bars('Applications by Company',d.companies)}${bars('Jobs by Month',d.jobsByMonth)}</div>`)}
async function reports(){sectionHead('reports');setContent(`<div class="panel"><h3>Export Reports</h3><p class="muted">CSV files open directly in Excel and preserve the current StepUp data.</p><div class="quick"><button class="primary" data-export="students">Students CSV</button><button class="primary" data-export="companies">Companies CSV</button><button class="primary" data-export="jobs">Jobs CSV</button><button class="primary" data-export="applications">Applications CSV</button><button class="primary" data-export="activity">Activity CSV</button></div></div>`);$('.panel').onclick=async e=>{const b=e.target.closest('[data-export]');if(!b)return;const d=await api('/admin/'+b.dataset.export);const arr=d.data||d;const rows=Array.isArray(arr)?arr:[];downloadCSV(b.dataset.export+'.csv',rows);toast('Report exported')};}
async function analyticsreports(){
  sectionHead('analyticsreports');
  const [d,catalog] = await Promise.all([
    api('/admin/analytics'),
    import('../js/data/skills.data.js?v=20261029a')
  ]);
  const courseMap = new Map();
  const addCourse = (course,category) => {
    const id = `${course.company}|${course.title}`.toLowerCase();
    const existing = courseMap.get(id) || {
      id,
      title: course.title,
      provider: course.company,
      categories: new Set(),
      students: 0,
      submissions: 0,
      approved: 0,
      pending: 0,
      rejected: 0
    };
    if(category) existing.categories.add(category);
    courseMap.set(id,existing);
  };
  catalog.PROG_COURSES.forEach(course=>addCourse(course,`Programming · ${course.lang}`));
  const groupLabels = new Map(catalog.GENERAL_GROUPS.map(group=>[group.key,group.label]));
  catalog.COURSES.forEach(course=>{
    if(course.general) addCourse(course,`General · ${groupLabels.get(course.group)||'Other'}`);
    if(course.depts==='ALL') addCourse(course,'Department · All departments');
    else (Array.isArray(course.depts)?course.depts:[]).forEach(dept=>addCourse(course,`Department · ${dept}`));
  });
  (d.courseCertificates||[]).forEach(row=>{
    const id=String(row.course_id).toLowerCase();
    const existing=courseMap.get(id)||{
      id,
      title:row.course_title,
      provider:row.provider,
      categories:new Set(['Other · Previously listed']),
      students:0,
      submissions:0,
      approved:0,
      pending:0,
      rejected:0
    };
    existing.students=Number(row.students)||0;
    existing.submissions=Number(row.submissions)||0;
    existing.approved=Number(row.approved)||0;
    existing.pending=Number(row.pending)||0;
    existing.rejected=Number(row.rejected)||0;
    courseMap.set(id,existing);
  });
  const courses=[...courseMap.values()].map(course=>({
    ...course,
    categories:[...course.categories].sort().join(', ')||'Department courses'
  })).sort((a,b)=>a.title.localeCompare(b.title)||a.provider.localeCompare(b.provider));
  const categories=[...new Set(courses.flatMap(course=>course.categories.split(', ')))].sort();
  const summary=d.certificateSummary||{};
  const stats=[
    ['Total students',Number(d.totalStudents)||0,'All student accounts'],
    ['Course catalog',courses.length,'Available courses'],
    ['Students with certificates',Number(summary.students)||0,'Unique students'],
    ['Pending reviews',Number(summary.pending)||0,'Awaiting admin approval']
  ];
  const max=rows=>Math.max(1,...rows.map(row=>Number(row.value)||0));
  const bars=(title,rows)=>`<div class="panel"><div class="analytics-panel-heading"><h3>${esc(title)}</h3><span>${rows.reduce((sum,row)=>sum+(Number(row.value)||0),0).toLocaleString()} total</span></div>${rows.length?rows.map(row=>`<div class="bar-row"><span title="${esc(row.label)}">${esc(row.label)}</span><div class="bar"><i style="width:${Math.max(0,Number(row.value)||0)/max(rows)*100}%"></i></div><b>${Number(row.value)||0}</b></div>`).join(''):empty('No data available yet.')}</div>`;
  const categoryCards=categories.map(category=>{
    const matching=courses.filter(course=>course.categories.split(', ').includes(category));
    const completions=matching.reduce((sum,course)=>sum+course.students,0);
    return `<article class="analytics-category-card"><span>${esc(category)}</span><strong>${matching.length}</strong><small>courses · ${completions.toLocaleString()} student-course certificates</small></article>`;
  }).join('');
  const courseRows=courses.map(course=>({
    category:course.categories,
    course:course.title,
    provider:course.provider,
    students_with_certificates:course.students,
    submissions:course.submissions,
    approved:course.approved,
    pending:course.pending,
    rejected:course.rejected
  }));
  setContent(`<div class="analytics-report-toolbar"><div><h2>Placement intelligence</h2><p class="muted">Student, course-certificate, application, and recruitment activity.</p></div><div class="quick analytics-export-actions"><button class="primary" data-export="students">Students CSV</button><button class="primary" data-export="companies">Companies CSV</button><button class="primary" data-export="jobs">Jobs CSV</button><button class="primary" data-export="applications">Applications CSV</button><button class="primary" data-export="activity">Activity CSV</button><button class="btn" id="courseReportExport">Course report CSV</button></div></div>
    <div class="analytics-stats">${stats.map((stat,index)=>`<article class="analytics-stat"><small>${esc(stat[0])}</small><strong>${Number(stat[1]).toLocaleString()}</strong><span>${esc(stat[2])}</span><i>${['S','C','✓','!'][index]}</i></article>`).join('')}</div>
    <div class="analytics-course-summary"><div class="analytics-section-heading"><div><h2>Course categories</h2><p>Counts include students who submitted a course certificate, not course enrollments.</p></div><span class="pill">${categories.length} categories</span></div><div class="analytics-category-grid">${categoryCards||empty('No course categories are configured.')}</div></div>
    <div class="panel analytics-course-panel"><div class="analytics-section-heading"><div><h2>Course-by-course report</h2><p>Each student is counted once per course. Pending, approved, and rejected certificate reviews are shown separately.</p></div></div><div class="analytics-course-filters"><input class="search" id="courseReportSearch" placeholder="Search course or provider"><select id="courseCategoryFilter"><option value="">All categories</option>${categories.map(category=>`<option value="${esc(category)}">${esc(category)}</option>`).join('')}</select></div><div id="courseReportTable"></div></div>
    <div class="analytics-secondary-heading"><h2>Placement and recruitment</h2><p>Current platform activity grouped by department, status, company, and month.</p></div>
    <div class="chart-grid">${bars('Students by Department',d.departments||[])}${bars('Applications by Status',d.applications||[])}${bars('Applications by Company',d.companies||[])}${bars('Jobs by Month',d.jobsByMonth||[])}</div>`);
  const renderCourses=()=>{
    const query=($('#courseReportSearch').value||'').trim().toLowerCase();
    const category=$('#courseCategoryFilter').value;
    const filtered=courses.filter(course=>(!category||course.categories.split(', ').includes(category))&&`${course.title} ${course.provider} ${course.categories}`.toLowerCase().includes(query));
    $('#courseReportTable').innerHTML=table(
      ['Category','Course','Provider','Students with certificates','Approved','Pending','Rejected'],
      filtered.map(course=>`<tr><td><span class="analytics-course-category">${esc(course.categories)}</span></td><td><b>${esc(course.title)}</b></td><td>${esc(course.provider)}</td><td><strong>${course.students.toLocaleString()}</strong></td><td>${course.approved.toLocaleString()}</td><td>${course.pending.toLocaleString()}</td><td>${course.rejected.toLocaleString()}</td></tr>`).join('')||`<tr><td colspan="7">${empty('No courses match your filters.')}</td></tr>`
    );
  };
  renderCourses();
  $('#courseReportSearch').oninput=renderCourses;
  $('#courseCategoryFilter').onchange=renderCourses;
  $('#courseReportExport').onclick=()=>downloadCSV('course-student-report.csv',courseRows);
}
async function activity(){
  sectionHead('activity');
  const d=await api('/admin/activity');
  const canManage=admin.role==='Super Admin';
  setContent(`<div class="panel"><div class="toolbar"><div><h3>Activity history</h3><span class="pill">${d.length} recent entries shown (up to 50)</span></div>${canManage?`<button class="btn danger" id="clearActivity" ${d.length?'':'disabled'}>Clear entire activity log</button>`:''}</div><div id="activityTable"></div></div>`);
  const draw=()=>$('#activityTable').innerHTML=table(['Time','Admin','Action','Entity','Details',...(canManage?['Actions']:[])],d.map(x=>`<tr><td>${x.created_at?new Date(x.created_at).toLocaleString():'—'}</td><td>${esc(x.admin_id)}</td><td>${esc(x.action)}</td><td>${esc(x.entity_type||'')}</td><td>${esc(x.details||'')}</td>${canManage?`<td><button class="btn danger" data-delete-activity="${x.id}">Delete</button></td>`:''}</tr>`).join('')||empty('No activity entries found.'));
  draw();
  if(!canManage)return;
  $('#activityTable').onclick=async e=>{
    const button=e.target.closest('[data-delete-activity]');
    if(!button)return;
    if(!confirm('Delete this activity log entry? This cannot be undone.'))return;
    try{await api('/admin/activity/'+button.dataset.deleteActivity,{method:'DELETE'});toast('Activity entry deleted');await activity()}
    catch(error){toast(error.message)}
  };
  $('#clearActivity').onclick=async()=>{
    if(!d.length||!confirm(`Permanently clear the entire activity log? This removes all entries, including entries not currently shown.`))return;
    try{const result=await api('/admin/activity',{method:'DELETE'});toast(`${result.deleted} activity entr${result.deleted===1?'y':'ies'} deleted`);await activity()}
    catch(error){toast(error.message)}
  };
}
async function admins(){
  sectionHead('admins');
  const d=await api('/admin/admin-users');
  const canManage=admin.role==='Super Admin';
  const currentId=String(admin.id||'');
  setContent(`<div class="panel"><div class="toolbar admin-role-toolbar"><div class="admin-role-summary"><span class="muted">Super Admin is controlled by ADMIN_KEY. Removing other accounts does not change it.</span><span class="pill">${d.length} admin accounts</span></div><div class="admin-role-toolbar-actions">${canManage?`<button class="btn danger" id="clearAdmins" ${d.some(a=>String(a.admin_id)!==currentId)?'':'disabled'} ${d.some(a=>String(a.admin_id)!==currentId)?'':'title="There are no other admin accounts to remove"'}>Remove other admins</button>`:''}<button class="primary" id="newAdmin">+ Add Admin</button></div></div><div id="adminTable"></div></div>`);
  const draw=()=>$('#adminTable').innerHTML=table(['Admin ID','Name','Email','Role','Active','Actions'],d.map(a=>`<tr><td>${esc(a.admin_id)}</td><td>${esc(a.name)}</td><td>${esc(a.email||'—')}</td><td>${esc(a.role)}</td><td>${a.active?'Yes':'No'}</td><td><button class="btn" data-toggle="${a.id}" data-active="${!a.active}">${a.active?'Disable':'Enable'}</button>${canManage?`<button class="btn danger" data-delete-admin="${a.id}" ${String(a.admin_id)===currentId?'disabled':''}>Delete</button>`:''}</td></tr>`).join('')||empty('No additional admin accounts found.'));
  draw();
  $('#newAdmin').onclick=()=>openModal('Add Admin',`<div class="form-grid"><div class="field"><label>Admin ID</label><input name="adminId" required></div><div class="field"><label>Name</label><input name="name" required></div><div class="field"><label>Email</label><input name="email"></div><div class="field"><label>Role</label><select name="role"><option>Placement Officer</option><option>Recruiter Manager</option><option>Viewer</option></select></div><div class="field full"><label>Password</label><input name="password" type="password" required></div></div><div class="form-actions"><button class="primary">Create Admin</button></div>`,async f=>{try{await api('/admin/admin-users',{method:'POST',body:JSON.stringify(formToObj(f))});toast('Admin created');closeModal();admins()}catch(error){toast(error.message)}});
  $('#adminTable').onclick=async e=>{
    const toggle=e.target.closest('[data-toggle]');
    const remove=e.target.closest('[data-delete-admin]');
    if(toggle){try{await api('/admin/admin-users/'+toggle.dataset.toggle,{method:'PATCH',body:JSON.stringify({active:toggle.dataset.active==='true'})});await admins()}catch(error){toast(error.message)}return}
    if(!remove)return;
    const target=d.find(a=>String(a.id)===remove.dataset.deleteAdmin);
    if(!target||!confirm(`Delete admin account "${target.admin_id}"? This removes the account and cannot be undone.`))return;
    try{await api('/admin/admin-users/'+remove.dataset.deleteAdmin,{method:'DELETE'});toast('Admin account deleted');await admins()}
    catch(error){toast(error.message)}
  };
  if(canManage)$('#clearAdmins').onclick=async()=>{
    const otherCount=d.filter(a=>String(a.admin_id)!==currentId).length;
    if(!otherCount||!confirm(`Delete all ${otherCount} other admin account(s)? Your current admin account and password will remain unchanged.`))return;
    try{const result=await api('/admin/admin-users',{method:'DELETE'});toast(`${result.deleted} admin account(s) deleted`);await admins()}
    catch(error){toast(error.message)}
  };
}
function formToObj(f){const o={};new FormData(f).forEach((v,k)=>o[k]=v);return o}
function openModal(title,html,onSubmit){$('#modalTitle').textContent=title;$('#modalForm').innerHTML=html;$('#modal').classList.remove('hidden');$('#cancelModal')?.addEventListener('click',closeModal);$('#modalForm').onsubmit=async e=>{e.preventDefault();try{await onSubmit(e.target)}catch(err){toast(err.message)}}}
function closeModal(){const preview=$('#competitionImagePreview');if(preview?.src.startsWith('blob:'))URL.revokeObjectURL(preview.src);$('#modal').classList.add('hidden');$('#modalForm').innerHTML=''}$('#closeModal').onclick=closeModal;
function downloadCSV(name,rows){if(!rows.length)return toast('No data to export');const keys=[...new Set(rows.flatMap(x=>Object.keys(x)))];const csv=[keys.join(','),...rows.map(r=>keys.map(k=>`"${String(r[k]??'').replace(/"/g,'""').replace(/\n/g,' ')}"`).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
const loaders={overview:async()=>{sectionHead('overview');setContent(`<div class="stats" id="stats"></div><div class="panel overview-grid"><div><h3>Platform Overview</h3><div id="overviewText">Loading...</div></div><div><h3>Quick Actions</h3><div class="quick"><button data-go="students">Add Student</button><button data-go="announcements">Publish Announcement</button></div></div></div>`);await loadOverview()},students,jobs,applications,competitions,announcements,analyticsreports,activity,admins};
async function navigate(name){
  const sequence=++navigationSequence;
  navigationController?.abort();
  navigationController=new AbortController();
  navigationPending=true;
  $$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.section===name));
  sectionHead(name);
  setContent(`<div class="panel admin-loading" role="status" aria-live="polite"><span class="admin-loading-spinner" aria-hidden="true"></span><span>Loading ${esc((titles[name]||[name])[0])}…</span></div>`);
  try{
    await loaders[name]();
  }catch(e){
    if(sequence!==navigationSequence||e.name==='AbortError')return;
    setContent(`<div class="panel"><div class="danger-text">${esc(e.message)}</div></div>`);
    toast(e.message);
  }finally{
    if(sequence===navigationSequence)navigationPending=false;
  }
}
$('#nav').onclick=e=>{const b=e.target.closest('.nav');if(b)navigate(b.dataset.section)};$('#content').onclick=async e=>{const go=e.target.closest('[data-go]');if(go){navigate(go.dataset.go);return;}const b=e.target.closest('[data-export]');if(!b)return;try{const d=await api('/admin/'+b.dataset.export);const arr=d.data||d;downloadCSV(b.dataset.export+'.csv',Array.isArray(arr)?arr:[]);toast('Report exported')}catch(err){toast(err.message)}};$('#logout').onclick=()=>{sessionStorage.clear();location.href='admin-login.html'};navigate('overview');