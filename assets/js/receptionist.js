/* ============================================================
   AutomationHire — Sharon AI Voice Receptionist
   Web Speech API (free) + Claude Haiku via /api/sharon
   No LiveKit, no Gemini, no cost for TTS/STT
   ============================================================ */

(function () {
  'use strict';

  const GREETING = "Welcome to AutomationHire! I'm Sharon, your AI guide. Whether you're looking to automate your business or find the perfect specialist, I'm here to help. What brings you in today?";

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const sttSupported = !!SpeechRecognition;

  /* ── State ── */
  let isOpen        = false;
  let isMuted       = false;
  let isSpeaking    = false;
  let isListening   = false;
  let recognition   = null;
  let messages      = [];     // [{role, content}] conversation history

  /* ────────────────────────────────────────────────────────── */
  /*  Styles (identical look to previous version)             */
  /* ────────────────────────────────────────────────────────── */
  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      #aria-launcher {
        position: fixed; bottom: 90px; right: 24px; z-index: 9998;
        font-family: 'Inter', system-ui, sans-serif;
      }
      #aria-btn {
        display: flex; align-items: center; gap: 9px;
        background: linear-gradient(135deg, #7c3aed 0%, #2979ff 100%);
        color: #fff; font-size: 13px; font-weight: 700;
        padding: 12px 20px; border-radius: 50px; border: none; cursor: pointer;
        box-shadow: 0 4px 24px rgba(124,58,237,0.5), 0 2px 8px rgba(0,0,0,0.4);
        transition: transform 0.2s, box-shadow 0.2s; white-space: nowrap; letter-spacing: -0.01em;
      }
      #aria-btn:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 8px 32px rgba(124,58,237,0.6), 0 4px 12px rgba(0,0,0,0.5); }
      #aria-btn:active { transform: scale(0.97); }
      #aria-btn-icon { font-size: 17px; line-height: 1; }
      .aria-pulse { width: 8px; height: 8px; background: #fff; border-radius: 50%; animation: ariaPulse 2s infinite; flex-shrink: 0; }
      @keyframes ariaPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.5; transform:scale(1.5); } }

      #aria-overlay {
        display: none; position: fixed; inset: 0;
        background: rgba(6,8,16,0.85); backdrop-filter: blur(8px);
        z-index: 10000; align-items: center; justify-content: center;
        padding: 16px; font-family: 'Inter', system-ui, sans-serif;
      }
      #aria-overlay.open { display: flex; }

      #aria-modal {
        background: #0d1117; border: 1px solid rgba(124,58,237,0.2);
        border-radius: 24px; width: 100%; max-width: 480px; max-height: 90vh;
        overflow: hidden; display: flex; flex-direction: column;
        box-shadow: 0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04);
        animation: ariaFadeIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
      }
      @keyframes ariaFadeIn { from { opacity:0; transform:scale(0.9) translateY(20px); } to { opacity:1; transform:scale(1) translateY(0); } }

      #aria-header {
        background: linear-gradient(135deg, #7c3aed 0%, #2979ff 100%);
        padding: 18px 20px; display: flex; align-items: center; gap: 14px; flex-shrink: 0;
      }
      #aria-avatar { width: 46px; height: 46px; background: rgba(255,255,255,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; border: 2px solid rgba(255,255,255,0.3); }
      #aria-header-info { flex: 1; min-width: 0; }
      #aria-header-info h3 { font-size: 16px; font-weight: 800; color: #fff; margin: 0 0 2px; }
      #aria-header-info p  { font-size: 12px; color: rgba(255,255,255,0.7); margin: 0; }
      #aria-close { background: none; border: none; cursor: pointer; font-size: 20px; color: rgba(255,255,255,0.6); padding: 2px; line-height: 1; transition: color .15s; }
      #aria-close:hover { color: #fff; }

      #aria-compat-notice {
        padding: 10px 18px; font-size: 12px; text-align: center; flex-shrink: 0;
        color: rgba(255,180,0,0.85); background: rgba(255,180,0,0.07);
        border-bottom: 1px solid rgba(255,180,0,0.15); display: none;
      }
      #aria-compat-notice.show { display: block; }

      #aria-transcript { flex: 1; overflow-y: auto; padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; min-height: 140px; max-height: 240px; scroll-behavior: smooth; }
      #aria-transcript::-webkit-scrollbar { width: 3px; }
      #aria-transcript::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.3); border-radius: 3px; }
      .aria-bubble { max-width: 85%; padding: 9px 14px; border-radius: 14px; font-size: 13px; line-height: 1.55; animation: ariaMsgIn 0.18s ease; word-break: break-word; }
      @keyframes ariaMsgIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
      .aria-bubble.aria { align-self: flex-start; background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.2); color: #e2e8f0; border-bottom-left-radius: 4px; }
      .aria-bubble.user { align-self: flex-end; background: rgba(41,121,255,0.15); border: 1px solid rgba(41,121,255,0.25); color: #f0f4ff; border-bottom-right-radius: 4px; }

      #aria-status { text-align: center; font-size: 12px; font-weight: 600; padding: 6px 18px 0; height: 22px; flex-shrink: 0; color: rgba(255,255,255,0.4); transition: color 0.2s; }
      #aria-status.listening { color: #00e676; }
      #aria-status.thinking  { color: #2979ff; }
      #aria-status.speaking  { color: #7c3aed; }
      #aria-status.error     { color: #ff5555; }

      #aria-wave { display: flex; align-items: center; justify-content: center; gap: 3px; height: 32px; padding: 0 18px; flex-shrink: 0; }
      .aria-bar { width: 3px; background: rgba(124,58,237,0.4); border-radius: 3px; height: 4px; transition: height 0.1s; }
      #aria-wave.active .aria-bar { animation: ariaBarAnim 0.8s infinite ease-in-out; }
      #aria-wave.active .aria-bar:nth-child(1) { animation-delay:0s;   background: rgba(0,230,118,0.7); }
      #aria-wave.active .aria-bar:nth-child(2) { animation-delay:0.1s; background: rgba(0,230,118,0.7); }
      #aria-wave.active .aria-bar:nth-child(3) { animation-delay:0.2s; background: rgba(124,58,237,0.9); }
      #aria-wave.active .aria-bar:nth-child(4) { animation-delay:0.3s; background: rgba(124,58,237,0.9); }
      #aria-wave.active .aria-bar:nth-child(5) { animation-delay:0.2s; background: rgba(41,121,255,0.8); }
      #aria-wave.active .aria-bar:nth-child(6) { animation-delay:0.1s; background: rgba(41,121,255,0.8); }
      #aria-wave.active .aria-bar:nth-child(7) { animation-delay:0s;   background: rgba(0,230,118,0.7); }
      @keyframes ariaBarAnim { 0%,100% { height:4px; } 50% { height:22px; } }

      #aria-controls { padding: 12px 18px 18px; display: flex; align-items: center; justify-content: center; gap: 16px; flex-shrink: 0; }
      #aria-mic-btn {
        width: 68px; height: 68px; border-radius: 50%;
        background: linear-gradient(135deg, #7c3aed, #2979ff);
        border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        font-size: 28px;
        box-shadow: 0 4px 24px rgba(124,58,237,0.5);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      #aria-mic-btn:hover { transform: scale(1.05); }
      #aria-mic-btn.listening {
        background: linear-gradient(135deg, #00e676, #00b4d8);
        box-shadow: 0 0 0 12px rgba(0,230,118,0.15), 0 4px 24px rgba(0,230,118,0.4);
        animation: ariaMicPulse 2s infinite;
      }
      #aria-mic-btn.speaking {
        background: linear-gradient(135deg, #7c3aed, #2979ff);
        animation: ariaThinkSpin 2s linear infinite;
      }
      @keyframes ariaMicPulse { 0%,100% { box-shadow: 0 0 0 6px rgba(0,230,118,0.15), 0 4px 24px rgba(0,230,118,0.4); } 50% { box-shadow: 0 0 0 18px rgba(0,230,118,0.08), 0 4px 32px rgba(0,230,118,0.5); } }
      @keyframes ariaThinkSpin { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }

      #aria-mute-btn {
        width: 40px; height: 40px; border-radius: 50%;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font-size: 16px; color: rgba(255,255,255,0.5); transition: all 0.15s;
      }
      #aria-mute-btn:hover { background: rgba(255,152,0,0.1); border-color: rgba(255,152,0,0.3); color: #ff9800; }
      #aria-mute-btn.muted { background: rgba(255,152,0,0.15); border-color: rgba(255,152,0,0.4); color: #ff9800; }

      #aria-footer { text-align: center; font-size: 10.5px; color: rgba(255,255,255,0.18); padding: 0 18px 12px; flex-shrink: 0; }
      #aria-footer span { color: rgba(124,58,237,0.6); font-weight: 600; }

      @media (max-width:480px) {
        #aria-launcher { bottom: 84px; right: 16px; }
        #aria-modal { max-height: 95vh; border-radius: 18px; }
        #aria-transcript { max-height: 180px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Build DOM                                                */
  /* ────────────────────────────────────────────────────────── */
  function buildDOM() {
    const launcher = document.createElement('div');
    launcher.id = 'aria-launcher';
    launcher.innerHTML = `
      <button id="aria-btn" aria-label="Open AI Voice Receptionist">
        <span id="aria-btn-icon">📞</span>
        AI Receptionist
        <span class="aria-pulse"></span>
      </button>
    `;
    document.body.appendChild(launcher);

    const overlay = document.createElement('div');
    overlay.id = 'aria-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Sharon AI Voice Receptionist');
    overlay.innerHTML = `
      <div id="aria-modal">
        <div id="aria-header">
          <div id="aria-avatar">📞</div>
          <div id="aria-header-info">
            <h3>Sharon</h3>
            <p>AI Voice Receptionist · AutomationHire</p>
          </div>
          <button id="aria-close" aria-label="Close">✕</button>
        </div>

        <div id="aria-compat-notice">
          🎤 Voice input works best in Chrome or Edge. You can still listen to Sharon speak.
        </div>

        <div id="aria-transcript" role="log" aria-live="polite"></div>

        <div id="aria-status">Tap the mic to start</div>

        <div id="aria-wave">
          <div class="aria-bar"></div><div class="aria-bar"></div>
          <div class="aria-bar"></div><div class="aria-bar"></div>
          <div class="aria-bar"></div><div class="aria-bar"></div>
          <div class="aria-bar"></div>
        </div>

        <div id="aria-controls">
          <button id="aria-mute-btn" title="Mute microphone">🎤</button>
          <button id="aria-mic-btn" aria-label="Start conversation">📞</button>
          <div style="width:40px"></div>
        </div>

        <div id="aria-footer">Powered by <span>Web Speech API</span> · <span>AutomationHire</span></div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  /* ────────────────────────────────────────────────────────── */
  /*  UI helpers                                               */
  /* ────────────────────────────────────────────────────────── */
  function addBubble(role, text) {
    const t = document.getElementById('aria-transcript');
    if (!t || !text.trim()) return;
    const d = document.createElement('div');
    d.className = `aria-bubble ${role}`;
    d.textContent = text;
    t.appendChild(d);
    t.scrollTop = t.scrollHeight;
  }

  function setStatus(cls, text) {
    const s = document.getElementById('aria-status');
    if (!s) return;
    s.className = cls;
    s.textContent = text;
  }

  function setWave(active) {
    const w = document.getElementById('aria-wave');
    if (w) w.classList.toggle('active', active);
  }

  function setMicBtn(state) {
    const btn = document.getElementById('aria-mic-btn');
    if (!btn) return;
    btn.className = state; // 'listening' | 'speaking' | ''
    if (state === 'listening') btn.textContent = '🎙️';
    else if (state === 'speaking') btn.textContent = '🔊';
    else btn.textContent = '📞';
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Voice selection — prefer UK English neural voices        */
  /* ────────────────────────────────────────────────────────── */
  function getBestVoice() {
    const voices = window.speechSynthesis.getVoices();
    const checks = [
      v => /Sonia|Libby|Abbi|Bella|Hollie|Mia|Olivia/.test(v.name),     // Microsoft UK female neural
      v => v.lang === 'en-GB' && v.name.includes('Microsoft'),
      v => v.lang === 'en-GB' && v.localService,
      v => v.lang === 'en-GB',
      v => v.lang.startsWith('en-') && v.name.includes('Microsoft'),
      v => /Samantha|Victoria|Karen|Moira/.test(v.name),                  // Apple English
      v => v.lang.startsWith('en-'),
    ];
    for (const check of checks) {
      const found = voices.find(check);
      if (found) return found;
    }
    return voices[0] || null;
  }

  /* ────────────────────────────────────────────────────────── */
  /*  TTS — speak text, call onDone when finished              */
  /* ────────────────────────────────────────────────────────── */
  function speak(text, onDone) {
    if (!('speechSynthesis' in window)) { if (onDone) onDone(); return; }

    window.speechSynthesis.cancel();
    isSpeaking = true;
    setMicBtn('speaking');
    setWave(true);
    setStatus('speaking', '🔊 Sharon is speaking…');

    const utt = new SpeechSynthesisUtterance(text);
    utt.voice = getBestVoice();
    utt.rate  = 1.05;
    utt.pitch = 1.0;
    utt.lang  = 'en-GB';

    utt.onend = utt.onerror = () => {
      isSpeaking = false;
      setWave(false);
      if (onDone) onDone();
    };

    // Chrome bug: speechSynthesis can stall on long text — chunk if needed
    window.speechSynthesis.speak(utt);
  }

  /* ────────────────────────────────────────────────────────── */
  /*  STT — Web Speech API                                     */
  /* ────────────────────────────────────────────────────────── */
  function startListening() {
    if (!sttSupported || isMuted || isSpeaking || isListening) return;

    recognition = new SpeechRecognition();
    recognition.continuous    = false;
    recognition.interimResults = true;
    recognition.lang          = 'en-GB';
    recognition.maxAlternatives = 1;

    let finalText = '';

    recognition.onstart = () => {
      isListening = true;
      setMicBtn('listening');
      setStatus('listening', '🎤 Listening…');
    };

    recognition.onresult = (e) => {
      let interim = '';
      finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (interim) setStatus('listening', `🎤 "${interim}"`);
    };

    recognition.onend = () => {
      isListening = false;
      const text = finalText.trim();
      if (text) {
        addBubble('user', text);
        sendToSharon(text);
      } else if (isOpen && !isMuted) {
        // Nothing heard — restart listening after short pause
        setMicBtn('');
        setStatus('', 'Tap the mic or speak again');
      }
    };

    recognition.onerror = (e) => {
      isListening = false;
      if (e.error === 'no-speech') {
        setStatus('', 'No speech detected — tap to try again');
        setMicBtn('');
      } else if (e.error === 'not-allowed') {
        setStatus('error', '⚠ Microphone access denied');
        setMicBtn('');
      } else {
        setStatus('error', `⚠ ${e.error}`);
        setMicBtn('');
      }
    };

    recognition.start();
  }

  function stopListening() {
    if (recognition) { try { recognition.stop(); } catch {} recognition = null; }
    isListening = false;
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Send to /api/sharon, speak reply                         */
  /* ────────────────────────────────────────────────────────── */
  async function sendToSharon(text) {
    setStatus('thinking', '⏳ Sharon is thinking…');
    setMicBtn('speaking');
    setWave(false);

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
      addBubble('aria', reply);

      speak(reply, () => {
        if (isOpen && !isMuted) {
          setMicBtn('');
          setStatus('', 'Tap the mic to reply');
        }
      });
    } catch {
      setStatus('error', '⚠ Connection error — tap to retry');
      setMicBtn('');
      setWave(false);
    }
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Open / Close                                             */
  /* ────────────────────────────────────────────────────────── */
  function open() {
    if (isOpen) return;
    isOpen = true;
    messages = [];
    document.getElementById('aria-overlay').classList.add('open');
    document.getElementById('aria-transcript').innerHTML = '';

    if (!sttSupported) {
      document.getElementById('aria-compat-notice').classList.add('show');
    }

    // Sharon greets first — voices may not be loaded yet, wait briefly
    setTimeout(() => {
      addBubble('aria', GREETING);
      messages.push({ role: 'assistant', content: GREETING });
      speak(GREETING, () => {
        if (isOpen && !isMuted && sttSupported) {
          setStatus('', 'Tap the mic to reply');
          setMicBtn('');
        }
      });
    }, 150);
  }

  function close() {
    isOpen = false;
    stopListening();
    window.speechSynthesis && window.speechSynthesis.cancel();
    isSpeaking  = false;
    isListening = false;
    messages    = [];
    document.getElementById('aria-overlay').classList.remove('open');
    setMicBtn('');
    setWave(false);
    setStatus('', 'Tap the mic to start');
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Mic button — tap to listen, tap again to stop            */
  /* ────────────────────────────────────────────────────────── */
  function handleMicClick() {
    if (isSpeaking) {
      // Interrupt Sharon
      window.speechSynthesis.cancel();
      isSpeaking = false;
      setWave(false);
    }
    if (isListening) {
      stopListening();
      setMicBtn('');
      setStatus('', 'Tap the mic to reply');
    } else {
      if (sttSupported) {
        startListening();
      } else {
        setStatus('error', '⚠ Voice input needs Chrome or Edge');
      }
    }
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Mute toggle                                              */
  /* ────────────────────────────────────────────────────────── */
  function toggleMute() {
    isMuted = !isMuted;
    const btn = document.getElementById('aria-mute-btn');
    if (btn) {
      btn.textContent = isMuted ? '🔇' : '🎤';
      btn.title = isMuted ? 'Unmute microphone' : 'Mute microphone';
      btn.classList.toggle('muted', isMuted);
    }
    if (isMuted) {
      stopListening();
      setStatus('', '🔇 Muted');
    } else {
      setStatus('', 'Tap the mic to reply');
    }
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Init                                                     */
  /* ────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();
    buildDOM();

    document.getElementById('aria-btn').addEventListener('click', open);
    document.getElementById('aria-close').addEventListener('click', close);
    document.getElementById('aria-mic-btn').addEventListener('click', handleMicClick);
    document.getElementById('aria-mute-btn').addEventListener('click', toggleMute);

    document.getElementById('aria-overlay').addEventListener('click', function (e) {
      if (e.target === this) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) close();
    });

    // Pre-load voices (Chrome loads them async)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', () => {});
    }
  });

})();
