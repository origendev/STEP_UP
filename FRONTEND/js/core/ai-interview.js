/* AI interviewer for Technical interview, HR interview and Group discussion rounds.
   - The bot speaks (browser text-to-speech) and every word is shown as a subtitle.
   - The student answers by voice (browser speech recognition, live subtitles) or by typing.
   - Camera is optional, shown only to the student and never recorded or uploaded.
   - The text transcript is saved by the server for the company and admins. */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
const SILENCE_MS = 3200;

export function aiInterviewSupport() {
  return { voiceInput: Boolean(SpeechRecognitionApi), voiceOutput: 'speechSynthesis' in window, camera: Boolean(navigator.mediaDevices?.getUserMedia) };
}

export function runAiInterview({ applicationId, roundIndex, roundName, request }) {
  return new Promise(resolve => {
    const support = aiInterviewSupport();
    const modal = document.createElement('div');
    modal.className = 'ai-iv-backdrop';
    modal.innerHTML = `<section class="ai-iv-modal" role="dialog" aria-modal="true" aria-labelledby="aiIvTitle">
      <header class="ai-iv-head"><div><span class="ai-iv-eyebrow">AI INTERVIEW</span><h2 id="aiIvTitle">${esc(roundName)}</h2><p data-status>Check your setup, then begin.</p></div><button type="button" class="ai-iv-leave" data-leave>Leave</button></header>
      <div data-lobby class="ai-iv-lobby">
        <p>An AI interviewer will ask you questions related to this job and your skills. You can see what it says as subtitles, and what you say is shown as subtitles too.</p>
        <label class="ai-iv-option"><input type="checkbox" data-opt-camera ${support.camera ? 'checked' : 'disabled'}> Turn my camera on <small>${support.camera ? 'Only you can see it. It is not recorded or uploaded.' : 'Camera is not available in this browser.'}</small></label>
        <label class="ai-iv-option"><input type="checkbox" data-opt-voice ${support.voiceInput ? 'checked' : 'disabled'}> Answer by speaking <small>${support.voiceInput ? 'Your speech is converted to text by your browser.' : 'Voice input is not supported here (try Chrome or Edge). You can type answers instead.'}</small></label>
        <label class="ai-iv-option"><input type="checkbox" data-opt-sound ${support.voiceOutput ? 'checked' : 'disabled'}> Let the interviewer speak aloud <small>Subtitles are always shown.</small></label>
        <p class="ai-iv-privacy">The full text transcript of this interview is saved and shared with the company and the placement admins. Closing the window pauses the interview; you can resume it later from Progress.</p>
        <div class="ai-iv-lobby-actions"><button type="button" class="ai-iv-primary" data-begin>Start interview</button></div>
      </div>
      <div data-stage class="ai-iv-stage" hidden>
        <div class="ai-iv-main">
          <div class="ai-iv-tiles">
            <div class="ai-iv-tile ai-iv-bot" data-bot-tile><div class="ai-iv-avatar" aria-hidden="true"><span></span><span></span><span></span></div><strong>StepUp AI Interviewer</strong><small data-bot-state>Getting ready…</small></div>
            <div class="ai-iv-tile ai-iv-you" data-you-tile><video data-video autoplay playsinline muted hidden></video><div class="ai-iv-you-off" data-video-off>Camera off</div><strong>You</strong><small data-you-state></small></div>
          </div>
          <div class="ai-iv-subtitle" data-subtitle aria-live="polite"><b data-sub-speaker>Interviewer</b><span data-sub-text></span></div>
          <div class="ai-iv-typebox" data-typebox hidden><textarea data-typed rows="2" maxlength="2500" placeholder="Type your answer here…"></textarea></div>
          <div class="ai-iv-controls">
            <button type="button" data-mic class="ai-iv-ctl" hidden>🎤 Answer by voice</button>
            <button type="button" data-send class="ai-iv-primary" disabled>Send answer</button>
            <button type="button" data-toggle-type class="ai-iv-ctl">⌨ Type instead</button>
            <button type="button" data-toggle-cam class="ai-iv-ctl">📷 Camera</button>
            <button type="button" data-toggle-sound class="ai-iv-ctl">🔊 Voice</button>
            <button type="button" data-toggle-cc class="ai-iv-ctl is-on">CC</button>
            <button type="button" data-end class="ai-iv-danger">Finish interview</button>
          </div>
        </div>
        <aside class="ai-iv-side"><h3>Transcript <small data-progress></small></h3><div class="ai-iv-log" data-log></div></aside>
      </div>
      <div data-done class="ai-iv-done" hidden><div class="ai-iv-done-icon">✓</div><h3>Interview submitted</h3><p>Your answers have been recorded and shared with the company. Watch your Progress page for their decision.</p><button type="button" class="ai-iv-primary" data-close>Close</button></div>
    </section>`;
    document.body.append(modal);
    const $ = sel => modal.querySelector(sel);
    const statusEl = $('[data-status]');
    const setStatus = t => { statusEl.textContent = t; };

    const state = { sessionId: null, phase: 'lobby', maxQuestions: 0, asked: 0, ended: false, cameraStream: null, wantVoice: support.voiceInput, wantSound: support.voiceOutput, ccOn: true, typing: !support.voiceInput, recognition: null, listening: false, finalText: '', silenceTimer: null, revealTimer: null, speakToken: 0, chosenVoice: null, busy: false };

    /* ---------- subtitles & transcript ---------- */
    const subtitle = $('[data-subtitle]');
    function showSubtitle(speaker, text, live = false) {
      $('[data-sub-speaker]').textContent = speaker;
      $('[data-sub-text]').textContent = text;
      subtitle.classList.toggle('is-live', live);
      subtitle.classList.toggle('is-you', speaker === 'You');
    }
    function addLog(role, text) {
      const log = $('[data-log]');
      const row = document.createElement('div');
      row.className = `ai-iv-line ${role === 'bot' ? 'bot' : 'you'}`;
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      row.innerHTML = `<b>${role === 'bot' ? 'Interviewer' : 'You'}</b><time>${esc(time)}</time><p>${esc(text)}</p>`;
      log.append(row); log.scrollTop = log.scrollHeight;
    }
    const setProgress = () => { $('[data-progress]').textContent = state.maxQuestions ? `· Question ${Math.min(state.asked, state.maxQuestions)} of ${state.maxQuestions}` : ''; };
    function setBotState(text, speaking = false) { $('[data-bot-state]').textContent = text; $('[data-bot-tile]').classList.toggle('is-speaking', speaking); }
    function setYouState(text, listening = false) { $('[data-you-state]').textContent = text; $('[data-you-tile]').classList.toggle('is-listening', listening); }

    /* ---------- bot voice ---------- */
    function pickVoice() {
      if (!support.voiceOutput) return;
      const voices = speechSynthesis.getVoices();
      state.chosenVoice = voices.find(v => /^en-IN/i.test(v.lang)) || voices.find(v => /^en-(US|GB)/i.test(v.lang) && /female|google|natural|samantha|zira/i.test(v.name)) || voices.find(v => /^en/i.test(v.lang)) || null;
    }
    if (support.voiceOutput) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }
    function stopSpeaking() { state.speakToken++; clearInterval(state.revealTimer); if (support.voiceOutput) speechSynthesis.cancel(); }
    function botSpeak(text) {
      return new Promise(resolve => {
        stopSpeaking();
        const token = ++state.speakToken;
        const words = text.split(/\s+/).filter(Boolean);
        let shown = 0, finished = false, boundarySeen = false;
        const finish = () => { if (finished) return; finished = true; clearInterval(state.revealTimer); if (token === state.speakToken) showSubtitle('Interviewer', text, false); setBotState('Waiting for your answer', false); resolve(); };
        showSubtitle('Interviewer', '', true); setBotState('Speaking…', true); setYouState('');
        const wordsPerSecond = 2.4;
        const startedAt = Date.now();
        state.revealTimer = setInterval(() => {
          if (token !== state.speakToken) { clearInterval(state.revealTimer); return; }
          if (boundarySeen) return;
          shown = Math.min(words.length, Math.floor((Date.now() - startedAt) / 1000 * wordsPerSecond) + 1);
          showSubtitle('Interviewer', words.slice(0, shown).join(' '), true);
          if (!state.wantSound && shown >= words.length) setTimeout(finish, 500);
        }, 120);
        if (state.wantSound && support.voiceOutput) {
          const utter = new SpeechSynthesisUtterance(text);
          if (state.chosenVoice) { utter.voice = state.chosenVoice; utter.lang = state.chosenVoice.lang; } else utter.lang = 'en-IN';
          utter.rate = 0.98; utter.pitch = 1;
          utter.onboundary = e => { if (token !== state.speakToken || typeof e.charIndex !== 'number') return; boundarySeen = true; const end = text.indexOf(' ', e.charIndex); showSubtitle('Interviewer', text.slice(0, end > 0 ? end : text.length), true); };
          utter.onend = finish; utter.onerror = finish;
          speechSynthesis.speak(utter);
          setTimeout(() => { if (!finished && token === state.speakToken && !speechSynthesis.speaking && !speechSynthesis.pending) finish(); }, 2500);
        }
      });
    }

    /* ---------- student answers ---------- */
    const sendBtn = $('[data-send]'), typed = $('[data-typed]'), micBtn = $('[data-mic]'), typeBox = $('[data-typebox]');
    function currentAnswer() { return (state.typing ? typed.value : (state.finalText + (state.interim || ''))).replace(/\s+/g, ' ').trim(); }
    function refreshSend() { sendBtn.disabled = state.busy || state.phase !== 'answering' || !currentAnswer(); }
    typed.addEventListener('input', () => { if (state.typing) showSubtitle('You', typed.value, true); refreshSend(); });

    function stopListening() {
      clearTimeout(state.silenceTimer);
      state.listening = false;
      try { state.recognition?.abort(); } catch { /* ignore */ }
      state.recognition = null;
      micBtn.textContent = '🎤 Answer by voice';
      setYouState('', false);
    }
    function startListening() {
      if (!state.wantVoice || state.typing || state.phase !== 'answering' || state.listening) return;
      const rec = new SpeechRecognitionApi();
      rec.lang = 'en-IN'; rec.continuous = true; rec.interimResults = true;
      state.recognition = rec; state.listening = true; state.finalText = ''; state.interim = '';
      micBtn.textContent = '⏹ Stop listening';
      setYouState('Listening…', true); showSubtitle('You', '…', true);
      rec.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const piece = e.results[i][0].transcript;
          if (e.results[i].isFinal) state.finalText += piece + ' '; else interim += piece;
        }
        state.interim = interim;
        const shown = (state.finalText + interim).trim();
        showSubtitle('You', shown || '…', true);
        refreshSend();
        clearTimeout(state.silenceTimer);
        if (shown) state.silenceTimer = setTimeout(() => { if (state.listening && currentAnswer()) submitAnswer(); }, SILENCE_MS);
      };
      rec.onerror = e => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        state.listening = false;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setStatus('Microphone access was blocked. You can type your answer instead.');
        else setStatus('Voice input stopped working. You can type your answer instead.');
        switchToTyping();
      };
      rec.onend = () => { if (state.listening && state.phase === 'answering' && state.recognition === rec) { try { rec.start(); } catch { /* ignore */ } } };
      try { rec.start(); } catch { switchToTyping(); }
    }
    function switchToTyping() {
      stopListening(); state.typing = true; typeBox.hidden = false; $('[data-toggle-type]').textContent = support.voiceInput ? '🎤 Use voice' : '⌨ Typing';
      if (state.phase === 'answering') typed.focus(); refreshSend();
    }
    function switchToVoice() {
      if (!support.voiceInput) return;
      state.typing = false; state.wantVoice = true; typeBox.hidden = true; $('[data-toggle-type]').textContent = '⌨ Type instead';
      if (state.phase === 'answering') startListening(); refreshSend();
    }
    micBtn.addEventListener('click', () => { if (state.listening) { stopListening(); refreshSend(); } else startListening(); });
    $('[data-toggle-type]').addEventListener('click', () => { if (!support.voiceInput) return; state.typing ? switchToVoice() : switchToTyping(); });

    async function askBot(botMessage) {
      state.phase = 'speaking'; refreshSend();
      addLog('bot', botMessage.text);
      await botSpeak(botMessage.text);
      if (state.ended || modal.isConnected === false) return;
      if (botMessage.kind === 'closing') return;
      state.phase = 'answering';
      state.finalText = ''; state.interim = ''; typed.value = '';
      setYouState(state.typing ? 'Your turn — type your answer' : 'Your turn', false);
      if (state.typing) typed.focus(); else startListening();
      refreshSend();
    }

    async function submitAnswer() {
      const text = currentAnswer();
      if (!text || state.busy || state.phase !== 'answering') return;
      state.busy = true; stopListening(); state.phase = 'thinking'; refreshSend();
      showSubtitle('You', text, false); addLog('you', text);
      setBotState('Thinking…', false); setYouState('');
      try {
        const result = await request('/student/ai-interviews/' + state.sessionId + '/answer', { method: 'POST', body: JSON.stringify({ text }) });
        state.asked = result.questionsAsked || state.asked; setProgress();
        state.busy = false;
        if (result.done) { await askBot(result.botMessage); showDone(); return; }
        await askBot(result.botMessage);
      } catch (error) {
        state.busy = false; state.phase = 'answering'; setStatus(error.message || 'Could not send your answer. Please try again.');
        typed.value = state.typing ? text : ''; state.finalText = state.typing ? '' : text + ' '; refreshSend();
      }
    }
    sendBtn.addEventListener('click', submitAnswer);
    typed.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitAnswer(); } });

    /* ---------- camera ---------- */
    const video = $('[data-video]'), videoOff = $('[data-video-off]');
    async function setCamera(on) {
      if (on) {
        try {
          state.cameraStream = state.cameraStream || await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
          video.srcObject = state.cameraStream; video.hidden = false; videoOff.hidden = true; return true;
        } catch { setStatus('Could not access the camera. You can continue without it.'); }
      }
      state.cameraStream?.getTracks().forEach(t => t.stop()); state.cameraStream = null; video.srcObject = null; video.hidden = true; videoOff.hidden = false; return false;
    }
    $('[data-toggle-cam]').addEventListener('click', async () => { const on = await setCamera(!state.cameraStream); $('[data-toggle-cam]').classList.toggle('is-on', on); });
    $('[data-toggle-sound]').addEventListener('click', e => { state.wantSound = !state.wantSound; if (!state.wantSound) stopSpeaking(); e.currentTarget.classList.toggle('is-on', state.wantSound); e.currentTarget.textContent = state.wantSound ? '🔊 Voice' : '🔇 Voice'; });
    $('[data-toggle-cc]').addEventListener('click', e => { state.ccOn = !state.ccOn; subtitle.hidden = !state.ccOn; e.currentTarget.classList.toggle('is-on', state.ccOn); });

    /* ---------- lifecycle ---------- */
    function cleanUp() {
      state.ended = true; stopSpeaking(); stopListening();
      state.cameraStream?.getTracks().forEach(t => t.stop());
      modal.remove(); resolve();
    }
    function showDone() { state.ended = true; stopListening(); stopSpeaking(); state.cameraStream?.getTracks().forEach(t => t.stop()); $('[data-stage]').hidden = true; $('[data-done]').hidden = false; setStatus('Completed'); }
    $('[data-close]').addEventListener('click', cleanUp);
    $('[data-leave]').addEventListener('click', () => {
      if (state.phase === 'lobby' || state.sessionId === null || confirm('Leave now? Your answers so far are saved and you can resume this interview later from Progress.')) cleanUp();
    });
    $('[data-end]').addEventListener('click', async () => {
      if (!confirm('Finish the interview now? You will not be able to answer more questions.')) return;
      stopListening(); stopSpeaking();
      try { await request('/student/ai-interviews/' + state.sessionId + '/end', { method: 'POST' }); showDone(); }
      catch (error) { setStatus(error.message || 'Could not finish the interview.'); }
    });
    $('[data-begin]').addEventListener('click', async () => {
      const begin = $('[data-begin]'); begin.disabled = true; setStatus('Starting your interview…');
      state.wantVoice = support.voiceInput && $('[data-opt-voice]').checked;
      state.wantSound = support.voiceOutput && $('[data-opt-sound]').checked;
      state.typing = !state.wantVoice;
      const wantCamera = support.camera && $('[data-opt-camera]').checked;
      try {
        const cameraOn = wantCamera ? await setCamera(true) : false;
        $('[data-toggle-cam]').classList.toggle('is-on', cameraOn);
        $('[data-toggle-sound]').classList.toggle('is-on', state.wantSound); $('[data-toggle-sound]').textContent = state.wantSound ? '🔊 Voice' : '🔇 Voice';
        const data = await request('/student/ai-interviews/start', { method: 'POST', body: JSON.stringify({ applicationId, roundIndex, cameraEnabled: cameraOn }) });
        state.sessionId = data.sessionId; state.maxQuestions = data.maxQuestions; state.asked = data.questionsAsked || 0; setProgress();
        $('[data-lobby]').hidden = true; $('[data-stage]').hidden = false; state.phase = 'speaking';
        if (support.voiceInput) micBtn.hidden = false; else $('[data-toggle-type]').hidden = true;
        typeBox.hidden = !state.typing; if (state.typing && support.voiceInput) $('[data-toggle-type]').textContent = '🎤 Use voice';
        setStatus(data.resumed ? 'Interview resumed' : 'Interview in progress');
        data.transcript.slice(0, -1).forEach(t => addLog(t.role, t.text));
        await askBot(data.transcript[data.transcript.length - 1]);
      } catch (error) {
        begin.disabled = false; setStatus(error.message || 'Could not start the interview.');
        state.cameraStream?.getTracks().forEach(t => t.stop()); state.cameraStream = null;
      }
    });
  });
}
