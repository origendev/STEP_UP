/* Read-only viewer for AI interview transcripts (company and admin). Exposes window.openAiTranscript(session). */
(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = v => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : ''; };
  const kindLabel = k => ({ technical: 'Technical interview', hr: 'HR interview', group_discussion: 'Group discussion' }[k] || 'AI interview');
  window.openAiTranscript = function (session) {
    const turns = Array.isArray(session.transcript) ? session.transcript : [];
    const ev = session.evaluation && typeof session.evaluation === 'object' ? session.evaluation : null;
    const list = items => Array.isArray(items) && items.length ? `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
    const overlay = document.createElement('div');
    overlay.className = 'ai-tr-backdrop';
    overlay.innerHTML = `<section class="ai-tr-modal" role="dialog" aria-modal="true">
      <div class="ai-tr-head"><div><h3>${esc(session.student_name || 'Student')} · ${esc(session.round_name || kindLabel(session.round_kind))}</h3>
      <p>${esc(kindLabel(session.round_kind))}${session.job_title ? ' · ' + esc(session.job_title) : ''}${session.company_name ? ' · ' + esc(session.company_name) : ''} · ${session.status === 'completed' ? 'Completed ' + esc(when(session.ended_at)) : 'In progress'}${session.camera_enabled ? ' · Camera was on' : ''}</p></div>
      <div class="ai-tr-actions"><button type="button" data-dl>Download .txt</button><button type="button" data-x>Close</button></div></div>
      ${ev ? `<div class="ai-tr-eval"><b>AI summary${typeof ev.overallScore === 'number' ? ' · ' + esc(ev.overallScore) + '/100' : ''}</b>${esc(ev.summary || '')}${list(ev.strengths) ? '<br><b style="margin-top:6px">Strengths</b>' + list(ev.strengths) : ''}${list(ev.improvements) ? '<b style="margin-top:6px">To improve</b>' + list(ev.improvements) : ''}${ev.communication ? '<br>Communication: ' + esc(ev.communication) : ''}${ev.roleFit ? '<br>Role fit: ' + esc(ev.roleFit) : ''}<small>${esc(ev.advisory || 'Advisory only.')}</small></div>` : ''}
      <div class="ai-tr-log">${turns.length ? turns.map(t => `<div class="ai-tr-turn ${t.role === 'bot' ? 'bot' : 'student'}"><b>${t.role === 'bot' ? 'AI interviewer' : esc(session.student_name || 'Student')}</b><time>${esc(when(t.at))}</time><p>${esc(t.text)}</p></div>`).join('') : '<div class="ai-tr-empty">No messages yet.</div>'}</div></section>`;
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-x]').onclick = close;
    overlay.querySelector('[data-dl]').onclick = () => {
      const text = [`${session.student_name || 'Student'} — ${session.round_name || ''} (${kindLabel(session.round_kind)})`, session.job_title ? `Job: ${session.job_title}` : '', '']
        .concat(turns.map(t => `[${when(t.at)}] ${t.role === 'bot' ? 'AI interviewer' : (session.student_name || 'Student')}: ${t.text}`)).filter((l, i) => l || i === 2).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      a.download = `interview-transcript-${String(session.student_name || 'student').replace(/\W+/g, '-').toLowerCase()}-${session.id}.txt`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    document.body.append(overlay);
  };
})();
