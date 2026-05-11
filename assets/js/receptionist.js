/* ============================================================
   AutomationHire — Sharon AI Voice Receptionist
   Powered by LiveKit + Google Gemini Realtime
   ============================================================ */

(function () {
  'use strict';

  const TOKEN_URL = 'https://automationhire-receptionist.fly.dev/token';
  const SDK_URL   = 'https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.min.js';

  /* ── Language options ── */
  const VOICE_OPTIONS = [
    { code: 'en-GB', label: 'British English',    flag: '🇬🇧', abbr: 'GB', default: true },
    { code: 'en-US', label: 'American English',   flag: '🇺🇸', abbr: 'US' },
    { code: 'en-AU', label: 'Australian English', flag: '🇦🇺', abbr: 'AU' },
    { code: 'en-IN', label: 'Indian English',     flag: '🇮🇳', abbr: 'IN' },
    { code: 'en-NG', label: 'Nigerian English',   flag: '🇳🇬', abbr: 'NG' },
    { code: 'fr-FR', label: 'French',             flag: '🇫🇷', abbr: 'FR' },
    { code: 'es-ES', label: 'Spanish',            flag: '🇪🇸', abbr: 'ES' },
    { code: 'pt-BR', label: 'Portuguese',         flag: '🇧🇷', abbr: 'BR' },
    { code: 'ar-SA', label: 'Arabic',             flag: '🇸🇦', abbr: 'SA' },
    { code: 'hi-IN', label: 'Hindi',              flag: '🇮🇳', abbr: 'IN' },
    { code: 'zh-CN', label: 'Mandarin Chinese',   flag: '🇨🇳', abbr: 'CN' },
    { code: 'sw-KE', label: 'Swahili',            flag: '🇰🇪', abbr: 'KE' },
    { code: 'yo-NG', label: 'Yoruba',             flag: '🇳🇬', abbr: 'NG' },
    { code: 'ja-JP', label: 'Japanese',           flag: '🇯🇵', abbr: 'JP' },
    { code: 'de-DE', label: 'German',             flag: '🇩🇪', abbr: 'DE' },
  ];

  /* ── State ── */
  let room         = null;
  let isOpen       = false;
  let isMuted      = false;
  let isConnected  = false;
  let isConnecting = false;
  let sdkPromise   = null;

  /* ── Lazy-load LiveKit SDK ── */
  function ensureSDK() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      if (window.LivekitClient) { resolve(); return; }
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load LiveKit SDK'));
      document.head.appendChild(s);
    });
    return sdkPromise;
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Styles                                                   */
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

      #aria-lang-section { padding: 16px 18px 0; flex-shrink: 0; }
      #aria-lang-section label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.4); display: block; margin-bottom: 10px; }
      #aria-lang-grid { display: flex; flex-wrap: wrap; gap: 6px; }
      .aria-lang-chip { display: flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.6); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
      .aria-lang-chip:hover { border-color: rgba(124,58,237,0.5); color: #fff; background: rgba(124,58,237,0.1); }
      .aria-lang-chip.active { background: rgba(124,58,237,0.2); border-color: rgba(124,58,237,0.6); color: #fff; font-weight: 700; }

      #aria-transcript { flex: 1; overflow-y: auto; padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; min-height: 140px; max-height: 220px; scroll-behavior: smooth; }
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
      #aria-mic-btn.connected {
        background: linear-gradient(135deg, #00e676, #00b4d8);
        box-shadow: 0 0 0 12px rgba(0,230,118,0.15), 0 4px 24px rgba(0,230,118,0.4);
        animation: ariaMicPulse 2s infinite;
      }
      #aria-mic-btn.connecting {
        background: linear-gradient(135deg, #2979ff, #7c3aed);
        animation: ariaThinkSpin 2s linear infinite;
      }
      @keyframes ariaMicPulse { 0%,100% { box-shadow: 0 0 0 6px rgba(0,230,118,0.15), 0 4px 24px rgba(0,230,118,0.4); } 50% { box-shadow: 0 0 0 18px rgba(0,230,118,0.08), 0 4px 32px rgba(0,230,118,0.5); } }
      @keyframes ariaThinkSpin { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }

      #aria-stop-btn {
        width: 40px; height: 40px; border-radius: 50%;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font-size: 16px; color: rgba(255,255,255,0.5); transition: all 0.15s;
      }
      #aria-stop-btn:hover { background: rgba(255,152,0,0.1); border-color: rgba(255,152,0,0.3); color: #ff9800; }
      #aria-stop-btn.muted { background: rgba(255,152,0,0.15); border-color: rgba(255,152,0,0.4); color: #ff9800; }

      #aria-footer { text-align: center; font-size: 10.5px; color: rgba(255,255,255,0.18); padding: 0 18px 12px; flex-shrink: 0; }
      #aria-footer span { color: rgba(124,58,237,0.6); font-weight: 600; }

      @media (max-width:480px) {
        #aria-launcher { bottom: 84px; right: 16px; }
        #aria-modal { max-height: 95vh; border-radius: 18px; }
        #aria-transcript { max-height: 160px; }
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

        <div id="aria-transcript" role="log" aria-live="polite"></div>

        <div id="aria-status">Tap the mic to connect</div>

        <div id="aria-wave">
          <div class="aria-bar"></div><div class="aria-bar"></div>
          <div class="aria-bar"></div><div class="aria-bar"></div>
          <div class="aria-bar"></div><div class="aria-bar"></div>
          <div class="aria-bar"></div>
        </div>

        <div id="aria-controls">
          <button id="aria-stop-btn" title="Mute">🎤</button>
          <button id="aria-mic-btn" aria-label="Connect to Sharon">📞</button>
          <div style="width:40px"></div>
        </div>

        <div id="aria-footer">Powered by <span>LiveKit</span> · <span>AutomationHire</span></div>
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

  /* ────────────────────────────────────────────────────────── */
  /*  Connect                                                  */
  /* ────────────────────────────────────────────────────────── */
  async function connect() {
    if (isConnected || isConnecting) return;
    isConnecting = true;

    const micBtn  = document.getElementById('aria-mic-btn');
    const stopBtn = document.getElementById('aria-stop-btn');
    if (micBtn) micBtn.className = 'connecting';
    setStatus('thinking', '⏳ Connecting…');

    try {
      await ensureSDK();

      const res = await fetch(TOKEN_URL);
      if (!res.ok) throw new Error('Token fetch failed: ' + res.status);
      const { token, url } = await res.json();

      room = new LivekitClient.Room({ adaptiveStream: true, dynacast: true });

      // Play Sharon's audio
      room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== 'audio') return;
        const el = track.attach();
        el.className = 'aria-remote-audio';
        el.style.display = 'none';
        document.body.appendChild(el);
      });

      room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach(el => el.remove());
      });

      // Populate transcript from speech-to-text
      room.on(LivekitClient.RoomEvent.TranscriptionReceived, (segments, participant) => {
        const isAgent = participant && !participant.isLocal;
        segments.forEach(seg => {
          if (seg.final && seg.text.trim()) {
            addBubble(isAgent ? 'aria' : 'user', seg.text.trim());
          }
        });
      });

      // Wave + status driven by who's speaking
      room.on(LivekitClient.RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const agentSpeaking = speakers.some(p => !p.isLocal);
        const userSpeaking  = speakers.some(p => p.isLocal);
        setWave(speakers.length > 0);
        if (agentSpeaking)     setStatus('speaking', '🔊 Sharon is speaking…');
        else if (userSpeaking) setStatus('listening', '🎤 Listening…');
        else                   setStatus('listening', '🎤 Sharon is listening…');
      });

      room.on(LivekitClient.RoomEvent.Disconnected, () => {
        resetToIdle('Call ended. Tap to talk again.');
      });

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);

      isConnected  = true;
      isConnecting = false;

      if (micBtn)  { micBtn.textContent = '📵'; micBtn.className = 'connected'; }
      if (stopBtn) { stopBtn.textContent = '🎤'; stopBtn.title = 'Mute'; }
      setStatus('listening', '🎤 Sharon is listening…');
      setWave(true);

    } catch (e) {
      console.error('[Sharon]', e);
      isConnecting = false;
      if (micBtn) { micBtn.textContent = '📞'; micBtn.className = ''; }
      setStatus('error', '⚠️ Connection failed — try again.');
      setWave(false);
    }
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Disconnect                                               */
  /* ────────────────────────────────────────────────────────── */
  async function disconnect() {
    if (room) { await room.disconnect(); room = null; }
    resetToIdle();
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Mute toggle                                              */
  /* ────────────────────────────────────────────────────────── */
  async function toggleMute() {
    if (!room || !isConnected) return;
    isMuted = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!isMuted);
    const stopBtn = document.getElementById('aria-stop-btn');
    if (stopBtn) {
      stopBtn.textContent = isMuted ? '🔇' : '🎤';
      stopBtn.title       = isMuted ? 'Unmute' : 'Mute';
      stopBtn.classList.toggle('muted', isMuted);
    }
    setStatus(isMuted ? '' : 'listening', isMuted ? '🔇 Muted' : '🎤 Sharon is listening…');
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Reset UI to idle                                         */
  /* ────────────────────────────────────────────────────────── */
  function resetToIdle(msg) {
    isConnected  = false;
    isConnecting = false;
    isMuted      = false;
    room         = null;
    document.querySelectorAll('.aria-remote-audio').forEach(el => el.remove());
    const micBtn  = document.getElementById('aria-mic-btn');
    const stopBtn = document.getElementById('aria-stop-btn');
    if (micBtn)  { micBtn.textContent = '📞'; micBtn.className = ''; }
    if (stopBtn) { stopBtn.textContent = '🎤'; stopBtn.title = 'Mute'; stopBtn.classList.remove('muted'); }
    setWave(false);
    setStatus('', msg || 'Tap the mic to connect');
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Open / Close                                             */
  /* ────────────────────────────────────────────────────────── */
  function openReceptionist() {
    if (isOpen) return;
    isOpen = true;
    const overlay = document.getElementById('aria-overlay');
    if (overlay) overlay.classList.add('open');
  }

  function closeReceptionist() {
    isOpen = false;
    if (isConnected || isConnecting) disconnect();
    const overlay = document.getElementById('aria-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Init                                                     */
  /* ────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();
    buildDOM();

    const ariaBtn  = document.getElementById('aria-btn');
    const closeBtn = document.getElementById('aria-close');
    const micBtn   = document.getElementById('aria-mic-btn');
    const stopBtn  = document.getElementById('aria-stop-btn');
    const overlay  = document.getElementById('aria-overlay');
    const langGrid = document.getElementById('aria-lang-grid');

    ariaBtn.addEventListener('click', openReceptionist);
    closeBtn.addEventListener('click', closeReceptionist);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeReceptionist();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) closeReceptionist();
    });

    // Main button: connect when idle, disconnect when connected
    micBtn.addEventListener('click', function () {
      if (isConnected) disconnect();
      else connect();
    });

    // Side button: mute/unmute during a call
    stopBtn.addEventListener('click', toggleMute);

    // Language chips — Gemini Realtime auto-detects language from speech,
    // but we track the selection to show user preference visually
    langGrid.addEventListener('click', function (e) {
      const chip = e.target.closest('.aria-lang-chip');
      if (!chip) return;
      document.querySelectorAll('.aria-lang-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

})();
