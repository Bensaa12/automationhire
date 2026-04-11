/* ============================================================
   AutomationHire — Aria AI Voice Receptionist
   Powered by Google Gemini + Web Speech API
   ============================================================ */

(function () {
  'use strict';

  /* ── Language / Voice Options ── */
  const VOICE_OPTIONS = [
    { code: 'en-GB', label: 'British English',    flag: '🇬🇧', search: ['Google UK English Female', 'Microsoft Hazel', 'Microsoft Susan', 'en-GB'], default: true },
    { code: 'en-US', label: 'American English',   flag: '🇺🇸', search: ['Google US English', 'Microsoft Zira', 'Samantha', 'en-US'] },
    { code: 'en-AU', label: 'Australian English', flag: '🇦🇺', search: ['Karen', 'Catherine', 'en-AU'] },
    { code: 'en-IN', label: 'Indian English',     flag: '🇮🇳', search: ['Veena', 'en-IN'] },
    { code: 'en-NG', label: 'Nigerian English',   flag: '🇳🇬', search: ['en-NG', 'en-GB'] },
    { code: 'fr-FR', label: 'French',             flag: '🇫🇷', search: ['Google français', 'Amelie', 'Thomas', 'fr-FR'] },
    { code: 'es-ES', label: 'Spanish',            flag: '🇪🇸', search: ['Google español', 'Monica', 'es-ES'] },
    { code: 'pt-BR', label: 'Portuguese',         flag: '🇧🇷', search: ['Google português', 'Luciana', 'pt-BR'] },
    { code: 'ar-XA', label: 'Arabic',             flag: '🇸🇦', search: ['ar-SA', 'ar-XA', 'ar'] },
    { code: 'hi-IN', label: 'Hindi',              flag: '🇮🇳', search: ['Google हिन्दी', 'Lekha', 'hi-IN'] },
    { code: 'zh-CN', label: 'Mandarin Chinese',   flag: '🇨🇳', search: ['Google 普通话', 'Ting-Ting', 'zh-CN'] },
    { code: 'sw-KE', label: 'Swahili',            flag: '🇰🇪', search: ['sw', 'en-GB'] },
    { code: 'yo-NG', label: 'Yoruba',             flag: '🇳🇬', search: ['yo', 'en-GB'] },
    { code: 'ja-JP', label: 'Japanese',           flag: '🇯🇵', search: ['Google 日本語', 'Kyoko', 'ja-JP'] },
    { code: 'de-DE', label: 'German',             flag: '🇩🇪', search: ['Google Deutsch', 'Anna', 'de-DE'] },
  ];

  const API_ENDPOINT   = '/api/receptionist';
  const OPENING_MSG    = "Hello! Welcome to AutomationHire. I'm Aria, your AI receptionist. How can I help you today? Are you looking to automate part of your business, or would you like to find an automation expert?";

  /* ── State ── */
  let selectedVoice    = VOICE_OPTIONS[0];
  let browserVoices    = [];
  let messages         = [];          // [{role, content}]
  let isListening      = false;
  let isSpeaking       = false;
  let isThinking       = false;
  let recognition      = null;
  let isOpen           = false;
  let hasGreeted       = false;
  let currentUtterance = null;

  /* ────────────────────────────────────────────────────────── */
  /*  Styles                                                   */
  /* ────────────────────────────────────────────────────────── */
  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      /* ── Launcher button ── */
      #aria-launcher {
        position: fixed;
        bottom: 90px;
        right: 24px;
        z-index: 9998;
        font-family: 'Inter', system-ui, sans-serif;
      }
      #aria-btn {
        display: flex;
        align-items: center;
        gap: 9px;
        background: linear-gradient(135deg, #7c3aed 0%, #2979ff 100%);
        color: #fff;
        font-size: 13px;
        font-weight: 700;
        padding: 12px 20px;
        border-radius: 50px;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 24px rgba(124,58,237,0.5), 0 2px 8px rgba(0,0,0,0.4);
        transition: transform 0.2s, box-shadow 0.2s;
        white-space: nowrap;
        letter-spacing: -0.01em;
      }
      #aria-btn:hover {
        transform: translateY(-2px) scale(1.03);
        box-shadow: 0 8px 32px rgba(124,58,237,0.6), 0 4px 12px rgba(0,0,0,0.5);
      }
      #aria-btn:active { transform: scale(0.97); }
      #aria-btn-icon { font-size: 17px; line-height: 1; }
      .aria-pulse {
        width: 8px; height: 8px;
        background: #fff;
        border-radius: 50%;
        animation: ariaPulse 2s infinite;
        flex-shrink: 0;
      }
      @keyframes ariaPulse {
        0%,100% { opacity:1; transform:scale(1); }
        50%      { opacity:.5; transform:scale(1.5); }
      }

      /* ── Modal overlay ── */
      #aria-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(6,8,16,0.85);
        backdrop-filter: blur(8px);
        z-index: 10000;
        align-items: center;
        justify-content: center;
        padding: 16px;
        font-family: 'Inter', system-ui, sans-serif;
      }
      #aria-overlay.open { display: flex; }

      /* ── Modal box ── */
      #aria-modal {
        background: #0d1117;
        border: 1px solid rgba(124,58,237,0.2);
        border-radius: 24px;
        width: 100%;
        max-width: 480px;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04);
        animation: ariaFadeIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
      }
      @keyframes ariaFadeIn {
        from { opacity:0; transform:scale(0.9) translateY(20px); }
        to   { opacity:1; transform:scale(1) translateY(0); }
      }

      /* Header */
      #aria-header {
        background: linear-gradient(135deg, #7c3aed 0%, #2979ff 100%);
        padding: 18px 20px;
        display: flex;
        align-items: center;
        gap: 14px;
        flex-shrink: 0;
      }
      #aria-avatar {
        width: 46px; height: 46px;
        background: rgba(255,255,255,0.15);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px;
        flex-shrink: 0;
        border: 2px solid rgba(255,255,255,0.3);
      }
      #aria-header-info { flex: 1; min-width: 0; }
      #aria-header-info h3 { font-size:16px; font-weight:800; color:#fff; margin:0 0 2px; }
      #aria-header-info p { font-size:12px; color:rgba(255,255,255,0.7); margin:0; }
      #aria-close {
        background:none; border:none; cursor:pointer;
        font-size:20px; color:rgba(255,255,255,0.6);
        padding:2px; line-height:1; transition:color .15s;
      }
      #aria-close:hover { color:#fff; }

      /* Language selector */
      #aria-lang-section {
        padding: 16px 18px 0;
        flex-shrink: 0;
      }
      #aria-lang-section label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: rgba(255,255,255,0.4);
        display: block;
        margin-bottom: 10px;
      }
      #aria-lang-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .aria-lang-chip {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 5px 11px;
        border-radius: 50px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.04);
        color: rgba(255,255,255,0.6);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
      }
      .aria-lang-chip:hover {
        border-color: rgba(124,58,237,0.5);
        color: #fff;
        background: rgba(124,58,237,0.1);
      }
      .aria-lang-chip.active {
        background: rgba(124,58,237,0.2);
        border-color: rgba(124,58,237,0.6);
        color: #fff;
        font-weight: 700;
      }

      /* Transcript */
      #aria-transcript {
        flex: 1;
        overflow-y: auto;
        padding: 14px 18px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 140px;
        max-height: 220px;
        scroll-behavior: smooth;
      }
      #aria-transcript::-webkit-scrollbar { width: 3px; }
      #aria-transcript::-webkit-scrollbar-thumb {
        background: rgba(124,58,237,0.3);
        border-radius: 3px;
      }
      .aria-bubble {
        max-width: 85%;
        padding: 9px 14px;
        border-radius: 14px;
        font-size: 13px;
        line-height: 1.55;
        animation: ariaMsgIn 0.18s ease;
        word-break: break-word;
      }
      @keyframes ariaMsgIn {
        from { opacity:0; transform:translateY(6px); }
        to   { opacity:1; transform:translateY(0); }
      }
      .aria-bubble.aria {
        align-self: flex-start;
        background: rgba(124,58,237,0.12);
        border: 1px solid rgba(124,58,237,0.2);
        color: #e2e8f0;
        border-bottom-left-radius: 4px;
      }
      .aria-bubble.user {
        align-self: flex-end;
        background: rgba(41,121,255,0.15);
        border: 1px solid rgba(41,121,255,0.25);
        color: #f0f4ff;
        border-bottom-right-radius: 4px;
      }

      /* Status bar */
      #aria-status {
        text-align: center;
        font-size: 12px;
        font-weight: 600;
        padding: 6px 18px 0;
        height: 22px;
        flex-shrink: 0;
        color: rgba(255,255,255,0.4);
        transition: color 0.2s;
      }
      #aria-status.listening { color: #00e676; }
      #aria-status.thinking  { color: #2979ff; }
      #aria-status.speaking  { color: #7c3aed; }

      /* Sound wave viz */
      #aria-wave {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        height: 32px;
        padding: 0 18px;
        flex-shrink: 0;
      }
      .aria-bar {
        width: 3px;
        background: rgba(124,58,237,0.4);
        border-radius: 3px;
        height: 4px;
        transition: height 0.1s;
      }
      #aria-wave.active .aria-bar { animation: ariaBarAnim 0.8s infinite ease-in-out; }
      #aria-wave.active .aria-bar:nth-child(1) { animation-delay:0s;     background:rgba(0,230,118,0.7); }
      #aria-wave.active .aria-bar:nth-child(2) { animation-delay:0.1s;   background:rgba(0,230,118,0.7); }
      #aria-wave.active .aria-bar:nth-child(3) { animation-delay:0.2s;   background:rgba(124,58,237,0.9); }
      #aria-wave.active .aria-bar:nth-child(4) { animation-delay:0.3s;   background:rgba(124,58,237,0.9); }
      #aria-wave.active .aria-bar:nth-child(5) { animation-delay:0.2s;   background:rgba(41,121,255,0.8); }
      #aria-wave.active .aria-bar:nth-child(6) { animation-delay:0.1s;   background:rgba(41,121,255,0.8); }
      #aria-wave.active .aria-bar:nth-child(7) { animation-delay:0s;     background:rgba(0,230,118,0.7); }
      @keyframes ariaBarAnim {
        0%,100% { height:4px;  }
        50%     { height:22px; }
      }

      /* Mic button */
      #aria-controls {
        padding: 12px 18px 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        flex-shrink: 0;
      }
      #aria-mic-btn {
        width: 68px; height: 68px;
        border-radius: 50%;
        background: linear-gradient(135deg, #7c3aed, #2979ff);
        border: none;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        font-size: 28px;
        box-shadow: 0 4px 24px rgba(124,58,237,0.5);
        transition: transform 0.2s, box-shadow 0.2s;
        position: relative;
      }
      #aria-mic-btn:hover { transform: scale(1.05); }
      #aria-mic-btn.listening {
        background: linear-gradient(135deg, #00e676, #00b4d8);
        box-shadow: 0 0 0 12px rgba(0,230,118,0.15), 0 4px 24px rgba(0,230,118,0.4);
        animation: ariaMicPulse 1.5s infinite;
      }
      #aria-mic-btn.thinking {
        background: linear-gradient(135deg, #2979ff, #7c3aed);
        animation: ariaThinkSpin 2s linear infinite;
      }
      #aria-mic-btn.speaking {
        background: linear-gradient(135deg, #7c3aed, #db2777);
        box-shadow: 0 0 0 12px rgba(124,58,237,0.15), 0 4px 24px rgba(124,58,237,0.4);
      }
      @keyframes ariaMicPulse {
        0%,100% { box-shadow:0 0 0 6px rgba(0,230,118,0.15),0 4px 24px rgba(0,230,118,0.4); }
        50%     { box-shadow:0 0 0 18px rgba(0,230,118,0.08),0 4px 32px rgba(0,230,118,0.5); }
      }
      @keyframes ariaThinkSpin {
        from { filter: hue-rotate(0deg); }
        to   { filter: hue-rotate(360deg); }
      }

      /* Stop/mute btn */
      #aria-stop-btn {
        width: 40px; height: 40px;
        border-radius: 50%;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px;
        color: rgba(255,255,255,0.5);
        transition: all 0.15s;
      }
      #aria-stop-btn:hover {
        background: rgba(255,0,0,0.1);
        border-color: rgba(255,0,0,0.3);
        color: #ff4444;
      }

      /* Type-to-speak fallback */
      #aria-type-row {
        padding: 0 18px 14px;
        display: flex;
        gap: 8px;
        flex-shrink: 0;
        border-top: 1px solid rgba(255,255,255,0.04);
        padding-top: 12px;
      }
      #aria-type-input {
        flex: 1;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 9px 14px;
        font-size: 13px;
        color: #fff;
        font-family: 'Inter', system-ui, sans-serif;
        outline: none;
        transition: border-color 0.2s;
      }
      #aria-type-input:focus { border-color: rgba(124,58,237,0.5); }
      #aria-type-input::placeholder { color: rgba(255,255,255,0.25); }
      #aria-type-send {
        background: linear-gradient(135deg, #7c3aed, #2979ff);
        border: none;
        border-radius: 10px;
        width: 38px; height: 38px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        font-size: 15px;
        color: #fff;
        transition: transform 0.15s;
      }
      #aria-type-send:hover { transform: scale(1.08); }

      /* Footer */
      #aria-footer {
        text-align: center;
        font-size: 10.5px;
        color: rgba(255,255,255,0.18);
        padding: 0 18px 12px;
        flex-shrink: 0;
      }
      #aria-footer span { color: rgba(124,58,237,0.6); font-weight:600; }

      /* No speech support notice */
      #aria-no-speech {
        display: none;
        background: rgba(255,180,0,0.1);
        border: 1px solid rgba(255,180,0,0.2);
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 12px;
        color: rgba(255,180,0,0.9);
        margin: 0 18px 10px;
        flex-shrink: 0;
      }
      #aria-no-speech.show { display: block; }

      @media (max-width:480px) {
        #aria-launcher { bottom:84px; right:16px; }
        #aria-modal { max-height:95vh; border-radius:18px; }
        #aria-transcript { max-height:160px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Build DOM                                                */
  /* ────────────────────────────────────────────────────────── */
  function buildDOM() {
    // Launcher button
    const launcher = document.createElement('div');
    launcher.id = 'aria-launcher';
    launcher.innerHTML = `
      <button id="aria-btn" aria-label="Open AI Voice Receptionist">
        <span id="aria-btn-icon">🎙️</span>
        AI Receptionist
        <span class="aria-pulse"></span>
      </button>
    `;
    document.body.appendChild(launcher);

    // Overlay + modal
    const overlay = document.createElement('div');
    overlay.id = 'aria-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Aria AI Voice Receptionist');
    overlay.innerHTML = `
      <div id="aria-modal">

        <!-- Header -->
        <div id="aria-header">
          <div id="aria-avatar">🎙️</div>
          <div id="aria-header-info">
            <h3>Aria</h3>
            <p>AI Voice Receptionist · AutomationHire</p>
          </div>
          <button id="aria-close" aria-label="Close">✕</button>
        </div>

        <!-- Language selector -->
        <div id="aria-lang-section">
          <label>Choose your language / accent</label>
          <div id="aria-lang-grid">
            ${VOICE_OPTIONS.map(v => `
              <button class="aria-lang-chip${v.default ? ' active' : ''}" data-code="${v.code}" data-label="${v.label}">
                ${v.flag} ${v.label}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- No speech notice -->
        <div id="aria-no-speech">
          ⚠️ Your browser doesn't support the microphone. Use the text box below to type instead.
        </div>

        <!-- Transcript -->
        <div id="aria-transcript" role="log" aria-live="polite"></div>

        <!-- Status -->
        <div id="aria-status">Tap the mic to start</div>

        <!-- Wave visualiser -->
        <div id="aria-wave">
          <div class="aria-bar"></div><div class="aria-bar"></div>
          <div class="aria-bar"></div><div class="aria-bar"></div>
          <div class="aria-bar"></div><div class="aria-bar"></div>
          <div class="aria-bar"></div>
        </div>

        <!-- Mic + stop controls -->
        <div id="aria-controls">
          <button id="aria-stop-btn" title="Stop speaking">⏹</button>
          <button id="aria-mic-btn" aria-label="Start listening">🎤</button>
          <div style="width:40px"></div>
        </div>

        <!-- Type fallback -->
        <div id="aria-type-row">
          <input id="aria-type-input" type="text" placeholder="Or type your message here…" autocomplete="off" />
          <button id="aria-type-send" aria-label="Send">➤</button>
        </div>

        <div id="aria-footer">Powered by <span>Google Gemini</span> · <span>AutomationHire</span></div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Voice helpers                                            */
  /* ────────────────────────────────────────────────────────── */
  function loadBrowserVoices() {
    browserVoices = window.speechSynthesis.getVoices();
  }

  function findVoice(option) {
    if (!browserVoices.length) browserVoices = window.speechSynthesis.getVoices();
    const searches = option.search || [option.code];

    // Try each search term — prefer female voices
    for (const term of searches) {
      const match = browserVoices.find(v =>
        (v.name.toLowerCase().includes(term.toLowerCase()) || v.lang === term) &&
        !v.name.toLowerCase().includes('male')
      );
      if (match) return match;
    }
    // Fallback — any voice matching the language code prefix
    const langPrefix = option.code.split('-')[0];
    const fallback = browserVoices.find(v => v.lang.startsWith(langPrefix));
    if (fallback) return fallback;

    // Last resort — first available voice
    return browserVoices[0] || null;
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    const voice = findVoice(selectedVoice);
    if (voice) utt.voice = voice;
    utt.lang  = selectedVoice.code;
    utt.rate  = 0.95;
    utt.pitch = 1.05;

    utt.onstart = () => {
      isSpeaking = true;
      setStatus('speaking', '🔊 Aria is speaking…');
      setWave(true);
      document.getElementById('aria-mic-btn').className = 'speaking';
    };
    utt.onend = utt.onerror = () => {
      isSpeaking = false;
      setStatus('', 'Tap the mic to respond');
      setWave(false);
      document.getElementById('aria-mic-btn').className = '';
    };

    currentUtterance = utt;
    window.speechSynthesis.speak(utt);
  }

  function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    isSpeaking = false;
    setStatus('', 'Tap the mic to respond');
    setWave(false);
    const micBtn = document.getElementById('aria-mic-btn');
    if (micBtn) micBtn.className = '';
  }

  /* ── Speech recognition setup ── */
  function setupRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      const notice = document.getElementById('aria-no-speech');
      if (notice) notice.classList.add('show');
      const micBtn = document.getElementById('aria-mic-btn');
      if (micBtn) micBtn.style.opacity = '0.4';
      return null;
    }

    const rec = new SR();
    rec.continuous    = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      isListening = true;
      setStatus('listening', '🎤 Listening…');
      document.getElementById('aria-mic-btn').className = 'listening';
      setWave(true);
    };

    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('');
      if (e.results[e.results.length - 1].isFinal) {
        addBubble('user', transcript);
        sendToAI(transcript);
      }
    };

    rec.onerror = (e) => {
      isListening = false;
      setStatus('', 'Tap the mic to try again');
      setWave(false);
      document.getElementById('aria-mic-btn').className = '';
    };

    rec.onend = () => {
      isListening = false;
      if (!isThinking && !isSpeaking) {
        setStatus('', 'Tap the mic to respond');
        setWave(false);
        document.getElementById('aria-mic-btn').className = '';
      }
    };

    return rec;
  }

  function toggleListening() {
    if (isSpeaking) { stopSpeaking(); return; }
    if (isThinking) return;

    if (!recognition) recognition = setupRecognition();
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
    } else {
      recognition.lang = selectedVoice.code;
      try { recognition.start(); } catch(e) { /* already started */ }
    }
  }

  /* ────────────────────────────────────────────────────────── */
  /*  UI helpers                                               */
  /* ────────────────────────────────────────────────────────── */
  function addBubble(role, text) {
    const t = document.getElementById('aria-transcript');
    if (!t) return;
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

  /* ────────────────────────────────────────────────────────── */
  /*  AI call                                                  */
  /* ────────────────────────────────────────────────────────── */
  async function sendToAI(userText) {
    if (!userText.trim()) return;

    messages.push({ role: 'user', content: userText });
    isThinking = true;
    setStatus('thinking', '💭 Thinking…');
    document.getElementById('aria-mic-btn').className = 'thinking';
    setWave(true);

    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          language: selectedVoice.code,
          langLabel: selectedVoice.label,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.reply) throw new Error(data.error || 'No reply');

      const reply = data.reply;
      messages.push({ role: 'assistant', content: reply });

      isThinking = false;
      addBubble('aria', reply);
      speak(reply);

    } catch (e) {
      console.error('[Aria]', e.message);
      isThinking = false;
      const sorry = "I'm having a little trouble right now. Could you try again?";
      addBubble('aria', sorry);
      speak(sorry);
    }
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Open / Close                                             */
  /* ────────────────────────────────────────────────────────── */
  function openReceptionist() {
    if (isOpen) return;
    isOpen = true;
    const overlay = document.getElementById('aria-overlay');
    if (overlay) overlay.classList.add('open');

    // Load voices (needed for some browsers)
    loadBrowserVoices();

    // Greet on first open
    if (!hasGreeted) {
      hasGreeted = true;
      setTimeout(() => {
        addBubble('aria', OPENING_MSG);
        messages.push({ role: 'assistant', content: OPENING_MSG });
        speak(OPENING_MSG);
      }, 400);
    }
  }

  function closeReceptionist() {
    isOpen = false;
    stopSpeaking();
    if (recognition && isListening) recognition.stop();
    const overlay = document.getElementById('aria-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Init                                                     */
  /* ────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();
    buildDOM();

    // Load voices async (Chrome loads them async)
    if (window.speechSynthesis) {
      loadBrowserVoices();
      window.speechSynthesis.onvoiceschanged = loadBrowserVoices;
    }

    const ariaBtn   = document.getElementById('aria-btn');
    const closeBtn  = document.getElementById('aria-close');
    const micBtn    = document.getElementById('aria-mic-btn');
    const stopBtn   = document.getElementById('aria-stop-btn');
    const typeInput = document.getElementById('aria-type-input');
    const typeSend  = document.getElementById('aria-type-send');
    const overlay   = document.getElementById('aria-overlay');
    const langGrid  = document.getElementById('aria-lang-grid');

    ariaBtn.addEventListener('click', openReceptionist);
    closeBtn.addEventListener('click', closeReceptionist);

    // Close on overlay background click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeReceptionist();
    });

    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) closeReceptionist();
    });

    micBtn.addEventListener('click', toggleListening);
    stopBtn.addEventListener('click', stopSpeaking);

    // Language selection
    langGrid.addEventListener('click', function (e) {
      const chip = e.target.closest('.aria-lang-chip');
      if (!chip) return;

      document.querySelectorAll('.aria-lang-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const code  = chip.dataset.code;
      const label = chip.dataset.label;
      selectedVoice = VOICE_OPTIONS.find(v => v.code === code) || VOICE_OPTIONS[0];

      if (recognition) {
        recognition.lang = code;
      }

      // Announce language change
      const note = `Switching to ${label}. Please speak in ${label}.`;
      addBubble('aria', note);
      speak(note);
    });

    // Type-to-speak
    function sendTyped() {
      const text = typeInput.value.trim();
      if (!text || isThinking) return;
      typeInput.value = '';
      addBubble('user', text);
      sendToAI(text);
    }

    typeSend.addEventListener('click', sendTyped);
    typeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sendTyped(); }
    });
  });

})();
