import { api } from '../core/api.js';

const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const list = (v) => Array.isArray(v) ? v : [];

function scoreCard(label, value){
  const n = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="rp-score-card"><span>${esc(label)}</span><strong>${n}%</strong><div class="rp-score-track"><i style="width:${n}%"></i></div></div>`;
}

function render(a, fileName){
  document.getElementById('rp-results').hidden = false;
  document.getElementById('rp-analyzed-file').textContent = fileName ? `Analyzed: ${fileName}` : '';
  document.getElementById('rp-score-grid').innerHTML = [
    scoreCard('Overall', a.overallScore), scoreCard('ATS', a.atsScore), scoreCard('Content', a.contentScore),
    scoreCard('Skills', a.skillsScore), scoreCard('Projects', a.projectsScore), scoreCard('Vocabulary', a.vocabularyScore)
  ].join('');
  document.getElementById('rp-summary').textContent = a.summary || 'No summary returned.';
  document.getElementById('rp-strengths').innerHTML = list(a.strengths).map(x => `<li>${esc(x)}</li>`).join('') || '<li>No strengths returned.</li>';
  const v = a.vocabulary || {};
  document.getElementById('rp-vocabulary').innerHTML = `
    <div class="rp-label">Weak / repeated words</div><div class="rp-chips">${list(v.weakWords).map(x=>`<span>${esc(x)}</span>`).join('') || '<em>None detected</em>'}</div>
    <div class="rp-label">Better alternatives</div><div class="rp-chips">${list(v.betterAlternatives).map(x=>`<span>${esc(x)}</span>`).join('') || '<em>None suggested</em>'}</div>
    ${list(v.notes).map(x=>`<p class="rp-note">${esc(x)}</p>`).join('')}`;
  document.getElementById('rp-skills').innerHTML = list(a.detectedSkills).map(x=>`<span>${esc(x)}</span>`).join('') || '<em>No skills detected.</em>';
  document.getElementById('rp-mistakes').innerHTML = list(a.mistakes).map(x => `
    <div class="rp-item"><div class="rp-item-top"><b>${esc(x.type || 'Issue')}</b></div><div class="rp-original">${esc(x.original)}</div><div class="rp-suggestion">${esc(x.suggestion)}</div>${x.explanation ? `<p>${esc(x.explanation)}</p>` : ''}</div>`).join('') || '<div class="rp-empty">No specific mistakes were detected.</div>';
  document.getElementById('rp-projects').innerHTML = list(a.projects).map(x => `
    <div class="rp-item"><div class="rp-item-top"><b>${esc(x.name || 'Project')}</b><strong>${Number(x.score)||0}%</strong></div><div class="rp-chips">${list(x.domains).map(d=>`<span>${esc(d)}</span>`).join('')}</div><p>${esc(x.suggestion)}</p></div>`).join('') || '<div class="rp-empty">No projects detected.</div>';
  document.getElementById('rp-domains').innerHTML = list(a.domainSuggestions).map(x=>`<li>${esc(x)}</li>`).join('') || '<li>No domain suggestions returned.</li>';
  document.getElementById('rp-sections').innerHTML = list(a.sectionFeedback).map(x=>`<div class="rp-section-feedback"><b>${esc(x.section)}</b><span class="rp-status-pill">${esc(x.status)}</span><p>${esc(x.feedback)}</p></div>`).join('') || '<div class="rp-empty">No section feedback returned.</div>';
}

async function loadSaved(){
  try { const r = await api('/student/resume/analysis'); if(r.data?.analysis) render(r.data.analysis, r.data.resume_file_name); } catch(e) { /* first visit may have no analysis */ }
}

export function mount(){
  const fileInput = document.getElementById('rp-file');
  const analyze = document.getElementById('rp-analyze');
  const status = document.getElementById('rp-status');
  let selected = null;

  fileInput.addEventListener('change', () => {
    selected = fileInput.files?.[0] || null;
    if(!selected){ analyze.disabled = true; return; }
    document.getElementById('rp-file-name').textContent = selected.name;
    document.getElementById('rp-file-meta').textContent = `${(selected.size/1024/1024).toFixed(2)} MB · PDF`;
    analyze.disabled = selected.type !== 'application/pdf' || selected.size > 10*1024*1024;
    status.textContent = analyze.disabled ? 'Please choose a valid PDF smaller than 10 MB.' : 'Ready to analyze.';
    status.className = 'rp-status ' + (analyze.disabled ? 'error' : 'ok');
  });

  analyze.addEventListener('click', async () => {
    if(!selected) return;
    analyze.disabled = true; fileInput.disabled = true;
    status.textContent = 'Uploading your resume and asking AI to analyze the actual PDF…';
    status.className = 'rp-status loading';
    try{
      const dataUrl = await new Promise((resolve,reject)=>{
        const r = new FileReader(); r.onload=()=>resolve(r.result); r.onerror=()=>reject(new Error('Could not read the PDF.')); r.readAsDataURL(selected);
      });
      await api('/student/resume', { method:'POST', body: JSON.stringify({ fileName:selected.name, mimeType:selected.type || 'application/pdf', data:dataUrl }) });
      const result = await api('/student/resume/analyze', { method:'POST', body: JSON.stringify({}) });
      render(result.data.analysis, result.data.file_name);
      status.textContent = 'Analysis complete.'; status.className = 'rp-status ok';
    }catch(e){
      status.textContent = e.message || 'Could not analyze the resume.'; status.className = 'rp-status error';
    }finally{
      analyze.disabled = false; fileInput.disabled = false;
    }
  });

  loadSaved();
}
