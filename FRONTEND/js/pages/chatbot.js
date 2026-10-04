/* ============================================================
   chatbot.js — "Step", the StepUp AI assistant (home page only)

   Features: new chat / refresh, saved history, stop & regenerate,
   retry on error, copy, 👍/👎 feedback, timestamps, typing reveal,
   suggested questions, voice input, download transcript, expand,
   scroll-to-bottom, Enter to send / Shift+Enter for new line.

   Talks to POST /api/chat. If the backend or AI key is unavailable it
   falls back to built-in answers so the bot never feels broken.
============================================================ */

import { API_BASE } from '../core/api.js';

const ROBOT = 'assets/robot.png';
const STORE = 'stepupChatV1';
const MAX_SAVED = 40;
const MAX_CHARS = 500;

const SUGGESTIONS = [
  'How do I prepare for placements?',
  'Tips to improve my resume',
  'Which skills are in demand?',
  'How do I use StepUp?'
];

const FALLBACKS = [
  [/resume|cv/i, 'Keep your resume to one page. Lead with projects and skills, use action verbs with numbers (e.g. "cut load time by 30%"), and tailor it to each role. Add your GitHub or portfolio link.'],
  [/interview|hr|round/i, 'For interviews: revise core subjects, practise coding aloud, prepare 3 project stories using STAR (Situation, Task, Action, Result), and research the company. Try mock interviews with friends.'],
  [/skill|demand|learn|role/i, 'Open the Demands and Skills tabs to see roles and skills trending right now. Pick one skill, build a small project with it, and track it in Progress.'],
  [/job|apply|opening/i, 'Head to the Jobs tab to browse openings and apply. Keep your Profile and resume updated first, since companies see them when you apply.'],
  [/placement|prepare|preparation|aptitude/i, 'A simple plan:\n- Aptitude and logic practice daily\n- DSA basics plus one language you know well\n- Two solid projects\n- A polished resume\n- Weekly mock interviews\nTrack it all in Progress.'],
  [/stepup|use|tab|how/i, 'Home shows your overview, Jobs lists openings, Demands shows market trends, Skills helps you build abilities, and Progress tracks your placement journey. Your Profile is under the avatar.'],
  [/hi|hello|hey/i, 'Hi! I am Step. Ask me about placements, resumes, interviews or skills.']
];

const ICON = {
  send:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z"/></svg>',
  stop:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>',
  mic:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  renew: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  down:  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></svg>',
  big:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
  small: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7"/></svg>',
  copy:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>',
  up:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11v9H4v-9zM7 11l4-8a2.5 2.5 0 0 1 2.5 3L13 9h5.5a2 2 0 0 1 2 2.4l-1.3 6.6a2 2 0 0 1-2 1.6H7"/></svg>',
  dn:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 13V4h3v9zM17 13l-4 8a2.5 2.5 0 0 1-2.5-3l.5-3H5.5a2 2 0 0 1-2-2.4l1.3-6.6A2 2 0 0 1 6.800 4H17"/></svg>',
  redo:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  close: '&times;'
};

function fallbackReply(text) {
  const hit = FALLBACKS.find(([re]) => re.test(text));
  return hit ? hit[1] : 'I can help with placement prep, resumes, interviews, skills and using StepUp. Try asking one of those!';
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function clock(t) {
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Small, safe markdown: **bold**, bullet / numbered lines, paragraphs. */
function format(text) {
  let html = '', inList = false;
  for (const raw of esc(text).split('\n')) {
    const line = raw.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    const m = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (m) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${m[1]}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (line.trim()) html += `<p>${line}</p>`;
    }
  }
  return html + (inList ? '</ul>' : '');
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE) || '[]');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function save(list) {
  try { localStorage.setItem(STORE, JSON.stringify(list.slice(-MAX_SAVED))); } catch { /* storage unavailable */ }
}

export function initChatbot() {
  if (document.getElementById('sbChat')) return;   // already on the page

  const wrap = document.createElement('div');
  wrap.className = 'sb-chat';
  wrap.id = 'sbChat';
  wrap.innerHTML = `
    <section class="sb-panel" id="sbPanel" role="dialog" aria-label="StepUp assistant" aria-hidden="true">
      <header class="sb-head">
        <img class="sb-avatar" src="${ROBOT}" alt="">
        <div class="sb-title"><b>Step</b><span><i class="sb-dot"></i><em id="sbStatus">Online</em></span></div>
        <button class="sb-hb" id="sbNew"  title="New chat"            aria-label="Start a new chat">${ICON.renew}</button>
        <button class="sb-hb" id="sbSave" title="Download chat"       aria-label="Download this chat">${ICON.down}</button>
        <button class="sb-hb" id="sbBig"  title="Expand"              aria-label="Expand chat window">${ICON.big}</button>
        <button class="sb-hb sb-x" id="sbClose" title="Close"         aria-label="Close chat">${ICON.close}</button>
      </header>
      <div class="sb-confirm" id="sbConfirm" hidden>
        <span>Start a new chat? This clears the current conversation.</span>
        <button type="button" id="sbNo">Cancel</button>
        <button type="button" id="sbYes" class="go">New chat</button>
      </div>
      <div class="sb-body" id="sbBody" aria-live="polite"></div>
      <button class="sb-jump" id="sbJump" aria-label="Scroll to latest message" hidden>↓</button>
      <div class="sb-chips" id="sbChips"></div>
      <form class="sb-form" id="sbForm" autocomplete="off">
        <button type="button" class="sb-mic" id="sbMic" aria-label="Speak your question" title="Speak" hidden>${ICON.mic}</button>
        <div class="sb-field">
          <textarea id="sbInput" rows="1" maxlength="${MAX_CHARS}" placeholder="Ask Step anything…" aria-label="Message"></textarea>
          <small id="sbCount" hidden></small>
        </div>
        <button type="submit" class="sb-send" id="sbSend" aria-label="Send">${ICON.send}</button>
      </form>
    </section>
    <button class="sb-launcher" id="sbLauncher" aria-label="Chat with Step, the StepUp assistant" aria-expanded="false">
      <span class="sb-bubble">Hi, I'm Step! 👋</span>
      <img src="${ROBOT}" alt="">
    </button>`;
  document.body.appendChild(wrap);

  const $ = id => wrap.querySelector('#' + id);
  const panel = $('sbPanel'), body = $('sbBody'), input = $('sbInput'), form = $('sbForm');
  const launcher = $('sbLauncher'), chips = $('sbChips'), sendBtn = $('sbSend');
  const jump = $('sbJump'), confirmBar = $('sbConfirm'), count = $('sbCount'), status = $('sbStatus');

  let history = load();          // [{role, content, t, fb?, offline?}]
  let busy = false;
  let abort = null;              // AbortController for the request in flight
  let revealTimer = null;        // typing-reveal interval
  let revealing = null;          // {row, textEl, full, item}

  /* ---------- rendering ---------- */
  const nearBottom = () => body.scrollHeight - body.scrollTop - body.clientHeight < 60;
  const toBottom = (smooth = true) => body.scrollTo({ top: body.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });

  function bubble(role, html, item) {
    const row = document.createElement('div');
    row.className = 'sb-msg ' + role;
    if (role === 'bot') row.insertAdjacentHTML('beforeend', `<img src="${ROBOT}" alt="">`);
    const col = document.createElement('div');
    col.className = 'sb-col';
    const b = document.createElement('div');
    b.className = 'sb-text';
    b.innerHTML = html;
    col.appendChild(b);
    if (item) {
      const meta = document.createElement('div');
      meta.className = 'sb-meta';
      meta.innerHTML = `<time>${clock(item.t)}</time>${item.offline ? '<span class="sb-off" title="The AI service was unreachable, so this is a built-in answer">offline answer</span>' : ''}`;
      col.appendChild(meta);
    }
    row.appendChild(col);
    body.appendChild(row);
    return row;
  }

  function actionsFor(row, item, isLast) {
    const meta = row.querySelector('.sb-meta');
    const bar = document.createElement('span');
    bar.className = 'sb-acts';
    bar.innerHTML = `
      <button data-a="copy" title="Copy" aria-label="Copy answer">${ICON.copy}</button>
      <button data-a="up" title="Helpful" aria-label="Helpful" class="${item.fb === 'up' ? 'on' : ''}">${ICON.up}</button>
      <button data-a="down" title="Not helpful" aria-label="Not helpful" class="${item.fb === 'down' ? 'on' : ''}">${ICON.dn}</button>
      ${isLast ? `<button data-a="redo" title="Regenerate" aria-label="Regenerate answer">${ICON.redo}</button>` : ''}`;
    meta.appendChild(bar);
    bar.addEventListener('click', e => {
      const btn = e.target.closest('button'); if (!btn) return;
      const a = btn.dataset.a;
      if (a === 'copy') {
        (navigator.clipboard ? navigator.clipboard.writeText(item.content) : Promise.reject()).catch(() => {}).finally(() => {
          btn.classList.add('on'); setTimeout(() => btn.classList.remove('on'), 1200);
        });
      } else if (a === 'up' || a === 'down') {
        item.fb = item.fb === a ? undefined : a;
        bar.querySelectorAll('[data-a=up],[data-a=down]').forEach(x => x.classList.toggle('on', x.dataset.a === item.fb));
        save(history);
      } else if (a === 'redo') regenerate();
    });
  }

  function renderAll() {
    body.innerHTML = '';
    chips.innerHTML = '';
    if (!history.length) {
      bubble('bot', format('Hi! I am **Step**, your StepUp assistant. I can help with placements, resumes, interviews and skills. What would you like to know?'));
      chips.innerHTML = SUGGESTIONS.map(s => `<button type="button">${esc(s)}</button>`).join('');
    } else {
      history.forEach((m, i) => {
        const row = bubble(m.role === 'user' ? 'user' : 'bot', m.role === 'user' ? esc(m.content) : format(m.content), m);
        if (m.role === 'assistant') actionsFor(row, m, i === history.length - 1);
      });
    }
    toBottom(false);
    updateJump();
  }

  function updateJump() { jump.hidden = nearBottom(); }

  /* ---------- sending ---------- */
  function setBusy(state) {
    busy = state;
    sendBtn.innerHTML = state ? ICON.stop : ICON.send;
    sendBtn.classList.toggle('stop', state);
    sendBtn.setAttribute('aria-label', state ? 'Stop generating' : 'Send');
    status.textContent = state ? 'Typing…' : 'Online';
  }

  function typingRow() {
    return bubble('bot', '<span class="sb-typing"><i></i><i></i><i></i></span>');
  }

  async function ask(signal) {
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) throw new Error(data.error || 'No reply');
      return { text: data.reply, offline: false };
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      const last = history[history.length - 1];
      return { text: fallbackReply(last ? last.content : ''), offline: true };
    }
  }

  async function respond() {
    setBusy(true);
    chips.innerHTML = '';
    const typing = typingRow();
    toBottom();
    abort = new AbortController();
    let result;
    try {
      result = await ask(abort.signal);
    } catch {            // stopped while waiting
      typing.remove(); abort = null; setBusy(false); input.focus(); renderAll(); return;
    }
    abort = null;
    typing.remove();

    const item = { role: 'assistant', content: result.text, t: Date.now(), offline: result.offline };
    history.push(item);
    save(history);

    const row = bubble('bot', '', item);
    const textEl = row.querySelector('.sb-text');
    const words = result.text.split(/(\s+)/);
    let i = 0;
    revealing = { row, item, textEl };
    const keep = nearBottom();
    revealTimer = setInterval(() => {
      i = Math.min(words.length, i + 3);
      textEl.innerHTML = format(words.slice(0, i).join(''));
      if (keep) toBottom(false);
      if (i >= words.length) finishReveal(true);
    }, 28);
  }

  function finishReveal(complete) {
    clearInterval(revealTimer); revealTimer = null;
    if (revealing) {
      const { row, item, textEl } = revealing;
      if (!complete) {            // stopped part-way: keep what has been shown
        const shown = textEl.innerText.trim();
        item.content = shown ? shown + ' …' : item.content;
      }
      textEl.innerHTML = format(item.content);
      actionsFor(row, item, true);
      save(history);
      revealing = null;
    }
    setBusy(false);
    updateJump();
  }

  function stop() {
    if (abort) abort.abort();
    else if (revealing) finishReveal(false);
  }

  function send(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    history.push({ role: 'user', content: text, t: Date.now() });
    save(history);
    input.value = ''; autosize();
    renderAll();
    respond();
  }

  function regenerate() {
    if (busy) return;
    while (history.length && history[history.length - 1].role === 'assistant') history.pop();
    if (!history.length) return;
    save(history);
    renderAll();
    respond();
  }

  /* ---------- new chat / refresh ---------- */
  function newChat() {
    stop();
    history = [];
    save(history);
    confirmBar.hidden = true;
    renderAll();
    input.value = ''; autosize();
    input.focus();
  }
  function askNew() {
    if (!history.length) { newChat(); return; }   // nothing to lose: refresh straight away
    confirmBar.hidden = false;
    $('sbYes').focus();
  }

  /* ---------- download ---------- */
  function download() {
    if (!history.length) return;
    const lines = history.map(m => `[${new Date(m.t).toLocaleString()}] ${m.role === 'user' ? 'You' : 'Step'}:\n${m.content}\n`);
    const blob = new Blob([`StepUp chat with Step\n\n${lines.join('\n')}`], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'stepup-chat.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- input helpers ---------- */
  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 110) + 'px';
    const n = input.value.length;
    count.hidden = n < MAX_CHARS * 0.8;
    count.textContent = `${n}/${MAX_CHARS}`;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const mic = $('sbMic'); mic.hidden = false;
    let rec = null;
    mic.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = navigator.language || 'en-IN'; rec.interimResults = true;
      mic.classList.add('on');
      const base = input.value ? input.value + ' ' : '';
      rec.onresult = e => { input.value = base + [...e.results].map(r => r[0].transcript).join(''); autosize(); };
      rec.onend = rec.onerror = () => { mic.classList.remove('on'); rec = null; input.focus(); };
      rec.start();
    });
  }

  /* ---------- open / close ---------- */
  function open(state) {
    wrap.classList.toggle('open', state);
    panel.setAttribute('aria-hidden', String(!state));
    launcher.setAttribute('aria-expanded', String(state));
    if (state) {
      if (!body.children.length) renderAll();
      setTimeout(() => { toBottom(false); input.focus(); }, 280);
    }
  }

  /* ---------- events ---------- */
  launcher.addEventListener('click', () => open(!wrap.classList.contains('open')));
  $('sbClose').addEventListener('click', () => open(false));
  $('sbNew').addEventListener('click', askNew);
  $('sbYes').addEventListener('click', newChat);
  $('sbNo').addEventListener('click', () => { confirmBar.hidden = true; input.focus(); });
  $('sbSave').addEventListener('click', download);
  $('sbBig').addEventListener('click', () => {
    const big = wrap.classList.toggle('big');
    $('sbBig').innerHTML = big ? ICON.small : ICON.big;
    $('sbBig').title = big ? 'Shrink' : 'Expand';
  });
  jump.addEventListener('click', () => toBottom());
  body.addEventListener('scroll', updateJump, { passive: true });
  chips.addEventListener('click', e => { const b = e.target.closest('button'); if (b) send(b.textContent); });
  form.addEventListener('submit', e => { e.preventDefault(); if (busy) stop(); else send(input.value); });
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!busy) send(input.value); }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !wrap.classList.contains('open')) return;
    if (!confirmBar.hidden) confirmBar.hidden = true; else open(false);
  });

  renderAll();
}
