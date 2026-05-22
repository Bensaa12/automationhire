/* ============================================================
   AutomationHire — Sharon AI Voice Receptionist
   Web Speech API (free) + Claude Haiku via /api/sharon
   Green/white brand theme
   ============================================================ */

(function () {
  'use strict';

  const GREETING = "Welcome to AutomationHire! I'm Sharon, your AI guide. Whether you're looking to automate your business or find the perfect specialist, I'm here to help. What brings you in today?";

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const sttSupported = !!SpeechRecognition;

  /* ── State ── */
  let isOpen      = false;
  let isMuted     = false;
  let isSpeaking  = false;
  let isListening = false;
  let isThinking  = false;
  let recognition = null;
  let messages    = [];

  /* ────────────────────────────────────────────────────────── */
  /*  Styles                                                   */
  /* ────────────────────────────────────────────────────────── */
  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      /* ── Launcher button ── */
      #sh-launcher {
        position: fixed; bottom: 88px; right: 24px; z-index: 9998;
        font-family: 'Inter', system-ui, sans-serif;
      }
      #sh-btn {
        display: flex; align-items: center; gap: 10px;
        background: #00e676; color: #0a0f0a;
        font-size: 13px; font-weight: 700; letter-spacing: -.01em;
        padding: 12px 22px; border-radius: 50px; border: none; cursor: pointer;
        box-shadow: 0 4px 20px rgba(0,230,118,0.45), 0 2px 8px rgba(0,0,0,0.3);
        transition: transform .18s, box-shadow .18s;
        white-space: nowrap;
      }
      #sh-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,230,118,0.55); }
      #sh-btn:active { transform: scale(.97); }
      .sh-pulse {
        width: 8px; height: 8px; background: #0a0f0a; border-radius: 50%;
        animation: shPulse 2s ease-in-out infinite; flex-shrink: 0;
      }
      @keyframes shPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.6)} }

      /* ── Overlay ── */
      #sh-overlay {
        display: none; position: fixed; inset: 0;
        background: rgba(4,8,6,.88); backdrop-filter: blur(10px);
        z-index: 10000; align-items: center; justify-content: center;
        padding: 16px; font-family: 'Inter', system-ui, sans-serif;
      }
      #sh-overlay.open { display: flex; }

      /* ── Modal ── */
      #sh-modal {
        background: #0d1410; border: 1px solid rgba(0,230,118,.18);
        border-radius: 24px; width: 100%; max-width: 420px;
        overflow: hidden; display: flex; flex-direction: column;
        box-shadow: 0 0 0 1px rgba(0,230,118,.06), 0 32px 80px rgba(0,0,0,.85);
        animation: shFadeIn .25s cubic-bezier(.34,1.56,.64,1);
      }
      @keyframes shFadeIn { from{opacity:0;transform:scale(.92) translateY(18px)} to{opacity:1;transform:scale(1) translateY(0)} }

      /* ── Header ── */
      #sh-header {
        padding: 18px 20px 16px;
        display: flex; align-items: center; gap: 14px;
        border-bottom: 1px solid rgba(0,230,118,.1);
        background: rgba(0,230,118,.05);
      }
      #sh-avatar {
        width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0;
        background: rgba(0,230,118,.15);
        border: 2px solid rgba(0,230,118,.35);
        display: flex; align-items: center; justify-content: center;
        font-size: 20px;
        position: relative;
      }
      #sh-avatar::after {
        content:''; position:absolute; bottom:1px; right:1px;
        width:10px; height:10px; border-radius:50%;
        background:#00e676; border:2px solid #0d1410;
      }
      #sh-header-info { flex:1; min-width:0; }
      #sh-header-info h3 { font-size:16px; font-weight:800; color:#fff; margin:0 0 2px; }
      #sh-header-info p  { font-size:12px; color:rgba(255,255,255,.45); margin:0; }
      #sh-close {
        background:none; border:none; cursor:pointer;
        width:30px; height:30px; border-radius:8px;
        display:flex; align-items:center; justify-content:center;
        color:rgba(255,255,255,.35); font-size:16px;
        transition:background .15s, color .15s;
      }
      #sh-close:hover { background:rgba(255,255,255,.07); color:#fff; }

      /* ── Status bar ── */
      #sh-status-bar {
        display:flex; align-items:center; justify-content:center; gap:8px;
        padding:8px 20px; min-height:36px; flex-shrink:0;
        font-size:12px; font-weight:600; color:rgba(255,255,255,.35);
        transition:color .2s;
      }
      #sh-status-bar.listening { color:#00e676; }
      #sh-status-bar.speaking  { color:#a0f0c4; }
      #sh-status-bar.thinking  { color:rgba(255,255,255,.5); }
      #sh-status-bar.error     { color:#ff6b6b; }
      #sh-status-dot {
        width:6px; height:6px; border-radius:50%;
        background:currentColor; flex-shrink:0;
        transition:transform .2s;
      }
      #sh-status-bar.listening #sh-status-dot { animation:shPulse 1.2s ease-in-out infinite; }

      /* ── Transcript ── */
      #sh-transcript {
        flex:1; overflow-y:auto; padding:14px 16px;
        display:flex; flex-direction:column; gap:10px;
        min-height:160px; max-height:220px; scroll-behavior:smooth;
      }
      #sh-transcript::-webkit-scrollbar { width:3px; }
      #sh-transcript::-webkit-scrollbar-thumb { background:rgba(0,230,118,.2); border-radius:3px; }
      .sh-bubble {
        max-width:88%; padding:10px 14px; border-radius:14px;
        font-size:13px; line-height:1.6; word-break:break-word;
        animation:shMsgIn .18s ease;
      }
      @keyframes shMsgIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
      .sh-bubble.sharon {
        align-self:flex-start;
        background:rgba(0,230,118,.08); border:1px solid rgba(0,230,118,.18);
        color:#e8f5ee; border-bottom-left-radius:4px;
      }
      .sh-bubble.user {
        align-self:flex-end;
        background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1);
        color:#f0f4f2; border-bottom-right-radius:4px;
      }

      /* ── Wave ── */
      #sh-wave {
        display:flex; align-items:center; justify-content:center;
        gap:3px; height:28px; padding:0 20px; flex-shrink:0;
      }
      .sh-bar {
        width:3px; background:rgba(0,230,118,.25);
        border-radius:3px; height:3px; transition:height .1s;
      }
      #sh-wave.active .sh-bar { animation:shBar .8s infinite ease-in-out; background:rgba(0,230,118,.7); }
      #sh-wave.active .sh-bar:nth-child(1){animation-delay:0s}
      #sh-wave.active .sh-bar:nth-child(2){animation-delay:.1s}
      #sh-wave.active .sh-bar:nth-child(3){animation-delay:.2s}
      #sh-wave.active .sh-bar:nth-child(4){animation-delay:.3s}
      #sh-wave.active .sh-bar:nth-child(5){animation-delay:.2s}
      #sh-wave.active .sh-bar:nth-child(6){animation-delay:.1s}
      #sh-wave.active .sh-bar:nth-child(7){animation-delay:0s}
      @keyframes shBar { 0%,100%{height:3px} 50%{height:20px} }

      /* ── Controls ── */
      #sh-controls {
        padding:12px 20px 20px;
        display:flex; align-items:center; justify-content:center; gap:14px;
        flex-shrink:0;
      }
      #sh-mic-btn {
        width:64px; height:64px; border-radius:50%; border:none; cursor:pointer;
        display:flex; align-items:center; justify-content:center; font-size:24px;
        background:#00e676; color:#0a0f0a;
        box-shadow:0 4px 20px rgba(0,230,118,.4);
        transition:transform .2s, box-shadow .2s, background .2s;
      }
      #sh-mic-btn:hover { transform:scale(1.06); box-shadow:0 6px 28px rgba(0,230,118,.55); }
      #sh-mic-btn:active { transform:scale(.96); }
      #sh-mic-btn.listening {
        background:#00e676;
        animation:shMicPulse 1.8s ease-in-out infinite;
      }
      #sh-mic-btn.speaking {
        background:rgba(0,230,118,.15);
        border:2px solid rgba(0,230,118,.3);
        color:#00e676;
        box-shadow:none;
        animation:none;
      }
      #sh-mic-btn.thinking {
        background:rgba(255,255,255,.06);
        border:2px solid rgba(255,255,255,.1);
        color:rgba(255,255,255,.4);
        box-shadow:none;
        animation:shSpin 1.5s linear infinite;
      }
      @keyframes shMicPulse {
        0%,100%{box-shadow:0 0 0 0 rgba(0,230,118,.4),0 4px 20px rgba(0,230,118,.4)}
        50%{box-shadow:0 0 0 14px rgba(0,230,118,.08),0 4px 24px rgba(0,230,118,.5)}
      }
      @keyframes shSpin { to{filter:hue-rotate(360deg)} }

      #sh-mute-btn {
        width:38px; height:38px; border-radius:50%;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1);
        cursor:pointer; display:flex; align-items:center; justify-content:center;
        font-size:15px; color:rgba(255,255,255,.4); transition:all .15s;
      }
      #sh-mute-btn:hover { background:rgba(0,230,118,.08); border-color:rgba(0,230,118,.25); color:#00e676; }
      #sh-mute-btn.muted { background:rgba(255,107,107,.1); border-color:rgba(255,107,107,.3); color:#ff6b6b; }

      /* ── Footer ── */
      #sh-footer {
        text-align:center; font-size:10.5px; padding:0 20px 14px;
        color:rgba(255,255,255,.15);
      }
      #sh-footer b { color:rgba(0,230,118,.4); font-weight:600; }

      /* ── No STT notice ── */
      #sh-no-stt {
        display:none; margin:0 16px 4px; padding:8px 12px;
        background:rgba(255,200,0,.07); border:1px solid rgba(255,200,0,.2);
        border-radius:8px; font-size:11.5px; color:rgba(255,200,0,.8); text-align:center;
      }
      #sh-no-stt.show { display:block; }

      @media(max-width:480px){
        #sh-launcher{bottom:80px;right:16px}
        #sh-modal{border-radius:18px;max-height:94vh}
        #sh-transcript{max-height:180px}
      }
    `;
    document.head.appendChild(s);
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Build DOM                                                */
  /* ────────────────────────────────────────────────────────── */
  function buildDOM() {
    // Launcher
    const launcher = document.createElement('div');
    launcher.id = 'sh-launcher';
    launcher.innerHTML = `
      <button id="sh-btn" aria-label="Talk to Sharon, AI Receptionist">
        <span>🎙️</span> Talk to Sharon
        <span class="sh-pulse"></span>
      </button>`;
    document.body.appendChild(launcher);

    // Modal
    const overlay = document.createElement('div');
    overlay.id = 'sh-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Sharon AI Receptionist');
    overlay.innerHTML = `
      <div id="sh-modal">

        <div id="sh-header">
          <div id="sh-avatar">🤖</div>
          <div id="sh-header-info">
            <h3>Sharon</h3>
            <p>AI Receptionist · AutomationHire</p>
          </div>
          <button id="sh-close" aria-label="Close">✕</button>
        </div>

        <div id="sh-no-stt">
          🎤 Voice input requires Chrome or Edge — Sharon can still speak to you.
        </div>

        <div id="sh-status-bar">
          <span id="sh-status-dot"></span>
          <span id="sh-status-text">Starting…</span>
        </div>

        <div id="sh-transcript" role="log" aria-live="polite"></div>

        <div id="sh-wave">
          <div class="sh-bar"></div><div class="sh-bar"></div>
          <div class="sh-bar"></div><div class="sh-bar"></div>
          <div class="sh-bar"></div><div class="sh-bar"></div>
          <div class="sh-bar"></div>
        </div>

        <div id="sh-controls">
          <button id="sh-mute-btn" title="Mute microphone">🎤</button>
          <button id="sh-mic-btn" aria-label="Tap to speak">🎙️</button>
          <div style="width:38px"></div>
        </div>

        <div id="sh-footer">Powered by <b>Web Speech API</b> · <b>Claude AI</b></div>
      </div>`;
    document.body.appendChild(overlay);
  }

  /* ────────────────────────────────────────────────────────── */
  /*  UI helpers                                               */
  /* ────────────────────────────────────────────────────────── */
  function addBubble(who, text) {
    const t = document.getElementById('sh-transcript');
    if (!t || !text.trim()) return;
    const d = document.createElement('div');
    d.className = `sh-bubble ${who}`;
    d.textContent = text;
    t.appendChild(d);
    t.scrollTop = t.scrollHeight;
  }

  function setStatus(state, text) {
    const bar  = document.getElementById('sh-status-bar');
    const span = document.getElementById('sh-status-text');
    if (bar)  bar.className  = state || '';
    if (span) span.textContent = text || '';
  }

  function setWave(on) {
    const w = document.getElementById('sh-wave');
    if (w) w.classList.toggle('active', on);
  }

  function setMic(state) {
    const b = document.getElementById('sh-mic-btn');
    if (!b) return;
    b.className = state;
    const icons = { listening: '🎙️', speaking: '🔊', thinking: '⏳', '': '🎙️' };
    b.textContent = icons[state] ?? '🎙️';
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Voice selection — prefer UK English                      */
  /* ────────────────────────────────────────────────────────── */
  function getBestVoice() {
    const v = window.speechSynthesis.getVoices();
    return v.find(x => /Sonia|Libby|Abbi|Bella|Hollie/.test(x.name))
        || v.find(x => x.lang === 'en-GB' && x.name.includes('Microsoft'))
        || v.find(x => x.lang === 'en-GB' && x.localService)
        || v.find(x => x.lang === 'en-GB')
        || v.find(x => /Samantha|Victoria|Karen/.test(x.name))
        || v.find(x => x.lang.startsWith('en-'))
        || v[0] || null;
  }

  /* ────────────────────────────────────────────────────────── */
  /*  TTS                                                      */
  /* ────────────────────────────────────────────────────────── */
  function speak(text, onDone) {
    if (!('speechSynthesis' in window)) { onDone && onDone(); return; }
    window.speechSynthesis.cancel();
    isSpeaking = true;
    setMic('speaking');
    setWave(true);
    setStatus('speaking', '🔊 Sharon is speaking…');

    const utt   = new SpeechSynthesisUtterance(text);
    utt.voice   = getBestVoice();
    utt.lang    = 'en-GB';
    utt.rate    = 1.05;
    utt.pitch   = 1.0;
    const done  = () => { isSpeaking = false; setWave(false); onDone && onDone(); };
    utt.onend   = done;
    utt.onerror = done;
    window.speechSynthesis.speak(utt);
  }

  /* ────────────────────────────────────────────────────────── */
  /*  STT                                                      */
  /* ────────────────────────────────────────────────────────── */
  function startListening() {
    if (!sttSupported || isMuted || isSpeaking || isListening || isThinking) return;

    recognition = new SpeechRecognition();
    recognition.continuous     = false;
    recognition.interimResults = true;
    recognition.lang           = 'en-GB';

    let final = '';

    recognition.onstart = () => {
      isListening = true;
      setMic('listening');
      setStatus('listening', '🎤 Listening…');
    };

    recognition.onresult = (e) => {
      let interim = '';
      final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (interim) setStatus('listening', `"${interim}"`);
    };

    recognition.onend = () => {
      isListening = false;
      const txt = final.trim();
      if (txt) {
        addBubble('user', txt);
        sendToSharon(txt);
      } else {
        setMic('');
        setStatus('', 'Tap the mic to speak');
      }
    };

    recognition.onerror = (e) => {
      isListening = false;
      setMic('');
      if (e.error === 'not-allowed') {
        setStatus('error', '⚠ Microphone access denied');
      } else if (e.error !== 'no-speech') {
        setStatus('error', `⚠ ${e.error} — tap to retry`);
      } else {
        setStatus('', 'Tap the mic to speak');
      }
    };

    recognition.start();
  }

  function stopListening() {
    if (recognition) { try { recognition.stop(); } catch {} recognition = null; }
    isListening = false;
  }

  /* ────────────────────────────────────────────────────────── */
  /*  API call                                                 */
  /* ────────────────────────────────────────────────────────── */
  async function sendToSharon(text) {
    isThinking = true;
    setMic('thinking');
    setWave(false);
    setStatus('thinking', '⏳ Thinking…');

    messages.push({ role: 'user', content: text });

    try {
      const res  = await fetch('/api/sharon', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages }),
      });
      const data = await res.json();
      const reply = data.reply || "I'm sorry, could you say that again?";

      messages.push({ role: 'assistant', content: reply });
      addBubble('sharon', reply);
      isThinking = false;

      speak(reply, () => {
        if (isOpen && !isMuted) {
          setMic('');
          setStatus('', 'Tap the mic to reply');
        }
      });
    } catch {
      isThinking = false;
      setMic('');
      setWave(false);
      setStatus('error', '⚠ Connection error — tap to retry');
    }
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Open / Close                                             */
  /* ────────────────────────────────────────────────────────── */
  function openModal() {
    if (isOpen) return;
    isOpen = true;
    messages = [];
    document.getElementById('sh-overlay').classList.add('open');
    document.getElementById('sh-transcript').innerHTML = '';

    if (!sttSupported) document.getElementById('sh-no-stt').classList.add('show');

    setTimeout(() => {
      addBubble('sharon', GREETING);
      messages.push({ role: 'assistant', content: GREETING });
      speak(GREETING, () => {
        if (isOpen && !isMuted) {
          setMic('');
          setStatus('', sttSupported ? 'Tap the mic to reply' : 'Sharon is ready');
        }
      });
    }, 200);
  }

  function closeModal() {
    isOpen = false;
    stopListening();
    isThinking = false;
    window.speechSynthesis && window.speechSynthesis.cancel();
    isSpeaking = false;
    messages   = [];
    document.getElementById('sh-overlay').classList.remove('open');
    setMic('');
    setWave(false);
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Mic button handler                                       */
  /* ────────────────────────────────────────────────────────── */
  function handleMicClick() {
    if (isThinking) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      isSpeaking = false;
      setWave(false);
    }
    if (isListening) {
      stopListening();
      setMic('');
      setStatus('', 'Tap the mic to speak');
      return;
    }
    if (!sttSupported) {
      setStatus('error', '⚠ Voice input needs Chrome or Edge');
      return;
    }
    startListening();
  }

  function toggleMute() {
    isMuted = !isMuted;
    const b = document.getElementById('sh-mute-btn');
    if (b) {
      b.textContent = isMuted ? '🔇' : '🎤';
      b.title = isMuted ? 'Unmute' : 'Mute microphone';
      b.classList.toggle('muted', isMuted);
    }
    if (isMuted) {
      stopListening();
      setStatus('', '🔇 Muted');
    } else {
      setStatus('', 'Tap the mic to speak');
    }
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Init                                                     */
  /* ────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    buildDOM();

    document.getElementById('sh-btn').addEventListener('click', openModal);
    document.getElementById('sh-close').addEventListener('click', closeModal);
    document.getElementById('sh-mic-btn').addEventListener('click', handleMicClick);
    document.getElementById('sh-mute-btn').addEventListener('click', toggleMute);
    document.getElementById('sh-overlay').addEventListener('click', e => {
      if (e.target.id === 'sh-overlay') closeModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) closeModal(); });

    // Pre-warm Chrome's async voice list
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {};
    }
  });

})();
