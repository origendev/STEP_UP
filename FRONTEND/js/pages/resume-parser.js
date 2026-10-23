import { api } from '../core/api.js';

const esc = (v) => String(v ?? '').replace(/[&<>\'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const list = (v) => Array.isArray(v) ? v : [];
const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
const scoreFields = [
  {key:'atsScore', label:'ATS Fit', short:'ATS'},
  {key:'contentScore', label:'Content Quality', short:'Content'},
  {key:'skillsScore', label:'Technical Skills', short:'Skills'},
  {key:'projectsScore', label:'Project Depth', short:'Projects'},
  {key:'vocabularyScore', label:'Vocabulary', short:'Vocabulary'}
];

function scoreMini(label, value, accent='violet') {
  const n = clamp(value);
  return `<div class="rp-mini-score ${accent}"><span>${esc(label)}</span><strong>${n}%</strong><div class="rp-mini-track"><i style="width:${n}%"></i></div></div>`;
}

function radarSvg(scores) {
  const cx=150, cy=128, radius=83, count=scores.length;
  const point=(i,r)=>({x:cx+Math.sin((Math.PI*2*i/count))*r,y:cy-Math.cos((Math.PI*2*i/count))*r});
  const polygon=(r)=>scores.map((_,i)=>{const p=point(i,r);return `${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join(' ');
  const valuePolygon=scores.map((s,i)=>{const p=point(i,radius*clamp(s.value)/100);return `${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join(' ');
  const labels=scores.map((s,i)=>{const p=point(i,radius+25);let anchor='middle';if(p.x<cx-18)anchor='end';if(p.x>cx+18)anchor='start';const y=p.y+(p.y<cy-70?-2:p.y>cy+70?10:4);return `<text x="${p.x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" class="rp-radar-label">${esc(s.short)}</text><text x="${p.x.toFixed(1)}" y="${(y+14).toFixed(1)}" text-anchor="${anchor}" class="rp-radar-value">${clamp(s.value)}%</text>`}).join('');
  const axes=scores.map((_,i)=>{const p=point(i,radius);return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" class="rp-radar-axis"/>`}).join('');
  const dots=scores.map((s,i)=>{const p=point(i,radius*clamp(s.value)/100);return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.2" class="rp-radar-dot"/>`}).join('');
  return `<svg class="rp-radar-svg" viewBox="0 0 300 270" role="img" aria-label="Radar chart of resume scores"><defs><linearGradient id="rpRadarFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7c4dff" stop-opacity=".38"/><stop offset="100%" stop-color="#df55c7" stop-opacity=".16"/></linearGradient></defs>${[1,.75,.5,.25].map(k=>`<polygon points="${polygon(radius*k)}" class="rp-radar-grid"/>`).join('')}${axes}<polygon points="${valuePolygon}" class="rp-radar-data" fill="url(#rpRadarFill)"/>${dots}${labels}</svg>`;
}

function groupSkills(skills) {
  const groups = [
    {name:'Programming', icon:'</>', cls:'code', test:/python|java|javascript|typescript|c\+\+|\bc\b|react|node|flask|html|css|dart|flutter/i},
    {name:'AI / ML', icon:'✦', cls:'ai', test:/machine learning|deep learning|pytorch|tensorflow|artificial intelligence|nlp|computer vision|opencv|llm|data science/i},
    {name:'Embedded Systems', icon:'⌘', cls:'embedded', test:/arduino|iot|embedded|raspberry|microcontroller|robotics|sensor|wokwi/i},
    {name:'Data Tools', icon:'▤', cls:'data', test:/powerbi|power bi|excel|sql|postgres|mysql|pandas|numpy|tableau|database/i}
  ];
  const used=new Set();
  const cards=groups.map(g=>{const matches=skills.filter(s=>g.test.test(s));matches.forEach(s=>used.add(s));return {...g,items:matches}}).filter(g=>g.items.length);
  const other=skills.filter(s=>!used.has(s)); if(other.length)cards.push({name:'Other Skills',icon:'✧',cls:'other',items:other});
  if(!cards.length)return '<div class="rp-empty-state">No skills were detected in this analysis.</div>';
  return cards.map(g=>`<div class="rp-skill-group"><div class="rp-skill-icon ${g.cls}">${g.icon}</div><div class="rp-skill-group-content"><h4>${esc(g.name)}</h4><div class="rp-chips">${g.items.map(s=>`<span>${esc(s)}</span>`).join('')}</div></div></div>`).join('');
}

function detailAccordion(title, icon, content, open=false) {
  return `<details class="rp-detail-accordion" ${open?'open':''}><summary><span class="rp-detail-icon">${icon}</span><span>${esc(title)}</span><span class="rp-detail-chevron">⌄</span></summary><div class="rp-detail-body">${content}</div></details>`;
}

function render(a, fileName) {
  const results=document.getElementById('rp-results'); results.hidden=false;
  document.getElementById('rp-analyzed-file').textContent=fileName?`Analyzed · ${fileName}`:'';
  const overall=clamp(a.overallScore);
  document.getElementById('rp-overall-score').textContent=`${overall}%`;
  document.getElementById('rp-score-orb').style.setProperty('--rp-score-angle',`${overall*3.6}deg`);
  const verdict=overall>=85?'Your resume is presenting a strong, focused profile.':overall>=70?'Your resume has a solid foundation. A few targeted improvements can make it even stronger.':'Your resume has opportunities to become clearer, stronger, and more targeted.';
  document.getElementById('rp-score-verdict').textContent=verdict;
  document.getElementById('rp-score-label').textContent=overall>=85?'Strong foundation':overall>=70?'Room to level up':'Improvement opportunity';
  const scores=scoreFields.map(s=>({...s,value:clamp(a[s.key])}));
  document.getElementById('rp-score-grid').innerHTML=scores.map((s,i)=>scoreMini(s.short,s.value,['mint','blue','violet','pink','gold'][i])).join('');
  const weakest=[...scores].sort((x,y)=>x.value-y.value)[0];
  const strengths=list(a.strengths);
  document.getElementById('rp-coach-copy').textContent=weakest?`Your lowest current category is ${weakest.label} (${weakest.value}%). ${list(a.mistakes).length?'Review the suggested corrections below to polish your resume.':'Use the detailed feedback below to identify your next improvement.'}`:'Review your detailed analysis for personalized next steps.';
  document.getElementById('rp-radar-wrap').innerHTML=radarSvg(scores);
  document.getElementById('rp-top-strengths').innerHTML=(strengths.slice(0,4).map(x=>`<li>${esc(x)}</li>`).join(''))||'<li>No strengths returned.</li>';
  const focus=[];
  if(weakest)focus.push(`${weakest.label} (${weakest.value}%)`);
  list(a.sectionFeedback).filter(x=>/improv|weak|needs|poor|fair/i.test(String(x.status||''))).slice(0,2).forEach(x=>focus.push(x.section));
  if(list(a.mistakes).length)focus.push(`${list(a.mistakes).length} writing correction${list(a.mistakes).length===1?'':'s'}`);
  document.getElementById('rp-focus-areas').innerHTML=(focus.slice(0,3).map(x=>`<li>${esc(x)}</li>`).join(''))||'<li>Keep refining your resume.</li>';
  const skills=list(a.detectedSkills).map(String);
  document.getElementById('rp-skill-count').textContent=`${skills.length} skill${skills.length===1?'':'s'}`;
  document.getElementById('rp-skills').innerHTML=groupSkills(skills);

  const projects=list(a.projects);
  document.getElementById('rp-projects').innerHTML=projects.length?projects.slice(0,4).map((p,i)=>`<article class="rp-project-highlight"><div class="rp-project-symbol ${i%2?'blue':'gold'}">${i%2?'⬡':'✦'}</div><div class="rp-project-copy"><div class="rp-project-top"><h4>${esc(p.name||'Project')}</h4><span>${clamp(p.score)}%</span></div><div class="rp-chips">${list(p.domains).map(d=>`<span>${esc(d)}</span>`).join('')}</div>${p.suggestion?`<p>${esc(p.suggestion)}</p>`:''}</div></article>`).join(''):'<div class="rp-empty-state">No projects were detected in this analysis.</div>';

  const recs=[];
  list(a.sectionFeedback).filter(x=>/improv|needs|weak|fair/i.test(String(x.status||''))).slice(0,2).forEach(x=>recs.push({title:`Strengthen ${x.section||'this section'}`,body:x.feedback||'Review this section for clarity.',tag:x.status||'Review'}));
  list(a.mistakes).slice(0,1).forEach(x=>recs.push({title:`Improve ${x.type||'writing accuracy'}`,body:x.suggestion||x.explanation||'Review the suggested correction.',tag:'Writing'}));
  if(weakest)recs.push({title:`Focus on ${weakest.label}`,body:`Your current score is ${weakest.value}%. Review the detailed feedback and make targeted improvements.`,tag:'Priority'});
  list(a.domainSuggestions).slice(0,1).forEach(x=>recs.push({title:'Explore a matching domain',body:x,tag:'Career direction'}));
  const unique=recs.filter((x,i)=>recs.findIndex(y=>y.title===x.title)===i).slice(0,4);
  document.getElementById('rp-recommendations').innerHTML=unique.length?unique.map((r,i)=>`<article class="rp-recommendation"><span class="rp-rec-number n${i+1}">${i+1}</span><div class="rp-rec-copy"><div class="rp-rec-title-row"><h4>${esc(r.title)}</h4><span>${esc(r.tag)}</span></div><p>${esc(r.body)}</p></div><span class="rp-rec-arrow">↗</span></article>`).join(''):'<div class="rp-empty-state">Your analysis did not return specific recommendations.</div>';

  const v=a.vocabulary||{};
  const vocabulary=`<div class="rp-detail-label">Weak / repeated words</div><div class="rp-chips">${list(v.weakWords).map(x=>`<span class="weak-chip">${esc(x)}</span>`).join('')||'<em>None detected</em>'}</div><div class="rp-detail-label">Better alternatives</div><div class="rp-chips">${list(v.betterAlternatives).map(x=>`<span>${esc(x)}</span>`).join('')||'<em>None suggested</em>'}</div>${list(v.notes).map(x=>`<p>${esc(x)}</p>`).join('')}`;
  const mistakes=list(a.mistakes).map(x=>`<div class="rp-correction-item"><div class="rp-correction-heading"><b>${esc(x.type||'Writing issue')}</b><span>Suggested fix</span></div><div class="rp-original">${esc(x.original)}</div><div class="rp-suggestion">${esc(x.suggestion)}</div>${x.explanation?`<p>${esc(x.explanation)}</p>`:''}</div>`).join('')||'<div class="rp-empty-state">No specific mistakes were detected.</div>';
  const sections=list(a.sectionFeedback).map(x=>`<div class="rp-section-feedback"><div class="rp-section-feedback-top"><b>${esc(x.section)}</b><span class="rp-status-pill">${esc(x.status)}</span></div><p>${esc(x.feedback)}</p></div>`).join('')||'<div class="rp-empty-state">No section feedback returned.</div>';
  const projectDetails=projects.map(x=>`<div class="rp-project-detail"><div><b>${esc(x.name||'Project')}</b><span>${clamp(x.score)}%</span></div><p>${esc(x.suggestion||'No additional suggestion provided.')}</p><div class="rp-chips">${list(x.domains).map(d=>`<span>${esc(d)}</span>`).join('')}</div></div>`).join('')||'<div class="rp-empty-state">No projects detected.</div>';
  const domains=list(a.domainSuggestions).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>No domain suggestions returned.</li>';
  const summary=`<p class="rp-summary-detail">${esc(a.summary||'No summary returned.')}</p><h4>Strengths</h4><ul class="rp-detail-list">${strengths.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>No strengths returned.</li>'}</ul>`;
  document.getElementById('rp-detail-accordions').innerHTML=[
    detailAccordion('Summary & Strengths','✦',summary,true),
    detailAccordion('Vocabulary Intelligence','Aa',vocabulary),
    detailAccordion('Mistakes & Corrections','✓',mistakes),
    detailAccordion('Project Analysis','♜',projectDetails),
    detailAccordion('Section Feedback','▤',sections),
    detailAccordion('Domain Suggestions','◎',`<ul class="rp-detail-list">${domains}</ul>`)
  ].join('');
  const uploadState=document.getElementById('rp-upload-state'); if(uploadState){uploadState.innerHTML='<i></i> Analysis complete';uploadState.classList.add('complete')}
}

async function loadSaved(){
  try { const r=await api('/student/resume/analysis'); if(r.data?.analysis) render(r.data.analysis,r.data.resume_file_name); } catch(e) { /* first visit may have no analysis */ }
}

export function mount(){
  const fileInput=document.getElementById('rp-file');
  const analyze=document.getElementById('rp-analyze');
  const status=document.getElementById('rp-status');
  let selected=null;
  if(!fileInput||!analyze||!status)return;
  fileInput.addEventListener('change',()=>{
    selected=fileInput.files?.[0]||null;
    const uploadState=document.getElementById('rp-upload-state');
    if(!selected){analyze.disabled=true;return;}
    document.getElementById('rp-file-name').textContent=selected.name;
    document.getElementById('rp-file-meta').textContent=`${(selected.size/1024/1024).toFixed(2)} MB · PDF`;
    analyze.disabled=selected.type!=='application/pdf'||selected.size>10*1024*1024;
    status.textContent=analyze.disabled?'Please choose a valid PDF smaller than 10 MB.':'Ready to analyze your resume.';
    status.className='rp-status '+(analyze.disabled?'error':'ok');
    if(uploadState){uploadState.innerHTML=analyze.disabled?'<i></i> Check file':'<i></i> Ready to analyze';uploadState.classList.toggle('complete',false)}
  });
  analyze.addEventListener('click',async()=>{
    if(!selected)return;
    analyze.disabled=true;fileInput.disabled=true;
    status.textContent='Uploading your resume and asking AI to analyze the actual PDF…';status.className='rp-status loading';
    try{
      const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Could not read the PDF.'));r.readAsDataURL(selected)});
      await api('/student/resume',{method:'POST',body:JSON.stringify({fileName:selected.name,mimeType:selected.type||'application/pdf',data:dataUrl})});
      const result=await api('/student/resume/analyze',{method:'POST',body:JSON.stringify({})});
      render(result.data.analysis,result.data.file_name);
      status.textContent='Analysis complete. Your resume insights are ready.';status.className='rp-status ok';
    }catch(e){status.textContent=e.message||'Could not analyze the resume.';status.className='rp-status error'}
    finally{analyze.disabled=false;fileInput.disabled=false}
  });
  loadSaved();
}
