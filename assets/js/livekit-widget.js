(function () {
  'use strict';

  // ── Styles ────────────────────────────────────────────────────────────────
  const css = `
    #sh-overlay {
      display: none; position: fixed; inset: 0; z-index: 99999;
      background: rgba(4,7,18,0.92); backdrop-filter: blur(10px);
      align-items: center; justify-content: center;
      font-family: 'Inter', system-ui, sans-serif;
    }
    #sh-overlay.open { display: flex; }

    #sh-modal {
      background: #0d1117;
      border: 1px solid rgba(0,230,118,0.15);
      border-radius: 24px;
      width: 340px;
      padding: 36px 28px 28px;
      display: flex; flex-direction: column; align-items: center;
      gap: 18px;
      box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04);
      animation: shFadeIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
      position: relative;
    }
    @keyframes shFadeIn {
      from { opacity:0; transform: scale(0.88) translateY(20px); }
      to   { opacity:1; transform: scale(1) translateY(0); }
    }

    #sh-close {
      position: absolute; top: 14px; right: 16px;
      background: none; border: none; color: rgba(255,255,255,0.3);
      font-size: 20px; cursor: pointer; line-height:1; padding:4px;
      transition: color 0.15s;
    }
    #sh-close:hover { color: #fff; }

    #sh-avatar {
      width: 88px; height: 88px; border-radius: 50%;
      background: linear-gradient(135deg, #00e676 0%, #2979ff 100%);
      display: flex; align-items: center; justify-content: center;
      font-size: 40px;
      box-shadow: 0 0 0 8px rgba(0,230,118,0.08);
      transition: box-shadow 0.3s;
    }
    #sh-avatar.speaking {
      box-shadow: 0 0 0 8px rgba(0,230,118,0.2), 0 0 0 16px rgba(0,230,118,0.08);
      animation: shPulse 1.5s infinite;
    }
    #sh-avatar.listening {
      box-shadow: 0 0 0 8px rgba(41,121,255,0.25), 0 0 0 16px rgba(41,121,255,0.08);
    }
    @keyframes shPulse {
      0%,100% { box-shadow: 0 0 0 8px rgba(0,230,118,0.2), 0 0 0 16px rgba(0,230,118,0.08); }
      50%      { box-shadow: 0 0 0 12px rgba(0,230,118,0.15), 0 0 0 24px rgba(0,230,118,0.05); }
    }

    #sh-name { font-size: 20px; font-weight: 800; color: #fff; }
    #sh-title { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: -12px; letter-spacing: 0.03em; }

    #sh-wave {
      display: flex; align-items: flex-end; justify-content: center;
      gap: 3px; height: 32px; width: 100%;
    }
    .sh-bar {
      width: 4px; border-radius: 3px; height: 4px;
      background: rgba(0,230,118,0.3);
      transition: height 0.1s ease;
    }
    #sh-wave.active .sh-bar {
      animation: shBar 0.9s ease-in-out infinite;
      background: linear-gradient(to top, #00e676, #2979ff);
    }
    #sh-wave.active .sh-bar:nth-child(1)  { animation-delay: 0s;    }
    #sh-wave.active .sh-bar:nth-child(2)  { animation-delay: 0.1s;  }
    #sh-wave.active .sh-bar:nth-child(3)  { animation-delay: 0.2s;  }
    #sh-wave.active .sh-bar:nth-child(4)  { animation-delay: 0.3s;  }
    #sh-wave.active .sh-bar:nth-child(5)  { animation-delay: 0.2s;  }
    #sh-wave.active .sh-bar:nth-child(6)  { animation-delay: 0.1s;  }
    #sh-wave.active .sh-bar:nth-child(7)  { animation-delay: 0s;    }
    #sh-wave.active .sh-bar:nth-child(8)  { animation-delay: 0.15s; }
    #sh-wave.active .sh-bar:nth-child(9)  { animation-delay: 0.25s; }
    #sh-wave.active .sh-bar:nth-child(10) { animation-delay: 0.05s; }
    @keyframes shBar {
      0%,100% { height: 4px; }
      50%     { height: 28px; }
    }

    #sh-status {
      font-size: 13px; font-weight: 600;
      color: rgba(255,255,255,0.45);
      min-height: 18px; text-align: center;
      transition: color 0.2s;
    }
    #sh-status.connected  { color: #00e676; }
    #sh-status.connecting { color: #2979ff; }
    #sh-status.error      { color: #ef4444; }

    #sh-hangup {
      width: 60px; height: 60px; border-radius: 50%;
      background: #ef4444;
      border: none; cursor: pointer; font-size: 22px;
      display: none; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(239,68,68,0.4);
      transition: transform 0.15s, opacity 0.15s;
    }
    #sh-hangup:hover { transform: scale(1.08); opacity: 0.9; }

    #sh-connect-btn {
      width: 100%; padding: 14px;
      background: linear-gradient(135deg, #00e676 0%, #00b4d8 100%);
      color: #060810; font-weight: 700; font-size: 15px;
      border: none; border-radius: 12px; cursor: pointer;
      transition: opacity 0.2s; letter-spacing: -0.01em;
    }
    #sh-connect-btn:hover { opacity: 0.88; }
    #sh-connect-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    #sh-mute-btn {
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.5); border-radius: 8px; padding: 8px 18px;
      font-size: 12px; cursor: pointer; display: none; transition: all 0.15s;
    }
    #sh-mute-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }

    #sh-footer {
      font-size: 10px; color: rgba(255,255,255,0.15);
      border-top: 1px solid rgba(255,255,255,0.05);
      width: 100%; text-align: center; padding-top: 14px; margin-top: -4px;
    }

    /* Nav button */
    #sharon-voice-btn {
      display: flex; align-items: center; gap: 6px;
      background: linear-gradient(135deg, #00e676 0%, #00b4d8 100%);
      color: #060810 !important; font-weight: 700; font-size: 13px;
      padding: 8px 16px; border-radius: 50px; border: none; cursor: pointer;
      white-space: nowrap; letter-spacing: -0.01em;
      box-shadow: 0 2px 12px rgba(0,230,118,0.3);
      transition: transform 0.15s, box-shadow 0.15s;
      text-decoration: none;
    }
    #sharon-voice-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 20px rgba(0,230,118,0.45);
    }
    .sh-btn-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #060810; animation: shBtnPulse 2s infinite;
    }
    @keyframes shBtnPulse {
      0%,100% { opacity:1; transform:scale(1); }
      50%     { opacity:0.5; transform:scale(1.4); }
    }

    @media (max-width: 480px) {
      #sh-modal { width: calc(100vw - 32px); padding: 28px 20px 20px; }
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── Inject nav button ─────────────────────────────────────────────────────
  function injectNavButton() {
    const navCta = document.querySelector('.nav-cta');
    if (!navCta) return;
    const btn = document.createElement('button');
    btn.id = 'sharon-voice-btn';
    btn.setAttribute('aria-label', 'Talk to Sharon AI receptionist');
    btn.innerHTML = '<span class="sh-btn-dot"></span>Talk to Sharon';
    navCta.insertBefore(btn, navCta.firstChild);
    btn.addEventListener('click', openModal);
  }

  // ── Build modal DOM ───────────────────────────────────────────────────────
  function buildModal() {
    const overlay = document.createElement('div');
    overlay.id = 'sh-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Talk to Sharon');
    overlay.innerHTML = `
      <div id="sh-modal">
        <button id="sh-close" aria-label="Close">✕</button>
        <div id="sh-avatar">🤖</div>
        <div id="sh-name">Sharon</div>
        <div id="sh-title">AI RECEPTIONIST · AUTOMATIONHIRE</div>
        <div id="sh-wave">
          ${Array(10).fill('<div class="sh-bar"></div>').join('')}
        </div>
        <div id="sh-status">Ready to connect</div>
        <button id="sh-hangup" aria-label="End call">📵</button>
        <button id="sh-connect-btn">🎙️ Start Talking to Sharon</button>
        <button id="sh-mute-btn">🎤 Mute</button>
        <div id="sh-footer">Powered by LiveKit · AutomationHire.co.uk</div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.getElementById('sh-close').addEventListener('click', closeModal);
    document.getElementById('sh-hangup').addEventListener('click', hangUp);
    document.getElementById('sh-mute-btn').addEventListener('click', toggleMute);
    document.getElementById('sh-connect-btn').addEventListener('click', connect);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let room = null;
  let muted = false;

  function setStatus(text, cls) {
    const el = document.getElementById('sh-status');
    if (!el) return;
    el.textContent = text;
    el.className = cls || '';
  }
  function setWave(on) {
    const w = document.getElementById('sh-wave');
    if (w) w.classList.toggle('active', on);
  }
  function setAvatar(state) {
    const a = document.getElementById('sh-avatar');
    if (a) a.className = state || '';
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  async function connect() {
    const btn = document.getElementById('sh-connect-btn');
    btn.disabled = true;
    setStatus('Connecting to Sharon…', 'connecting');

    try {
      const res = await fetch('/api/livekit-token');
      if (!res.ok) throw new Error('Could not get token');
      const { token, url } = await res.json();

      room = new LivekitClient.Room({ adaptiveStream: true, dynacast: true });

      room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === 'audio') {
          track.attach();
          setAvatar('speaking');
          setWave(true);
          setStatus('Sharon is speaking…', 'connected');
        }
      });

      room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === 'audio') {
          setAvatar('listening');
          setWave(false);
          setStatus('Sharon is listening…', 'connected');
        }
      });

      room.on(LivekitClient.RoomEvent.Disconnected, () => {
        resetUI('Call ended.');
      });

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);

      btn.style.display = 'none';
      document.getElementById('sh-hangup').style.display = 'flex';
      document.getElementById('sh-mute-btn').style.display = 'block';
      setAvatar('listening');
      setStatus('Sharon is listening…', 'connected');

    } catch (e) {
      console.error('[Sharon LiveKit]', e.message);
      btn.disabled = false;
      setStatus('Connection failed — please try again.', 'error');
    }
  }

  // ── Hang up ───────────────────────────────────────────────────────────────
  async function hangUp() {
    if (room) { await room.disconnect(); room = null; }
    resetUI('Call ended. Talk again anytime.');
  }

  function resetUI(msg) {
    room = null; muted = false;
    setWave(false);
    setAvatar('');
    setStatus(msg || 'Ready to connect');
    const btn = document.getElementById('sh-connect-btn');
    if (btn) { btn.style.display = 'block'; btn.disabled = false; }
    const hangup = document.getElementById('sh-hangup');
    if (hangup) hangup.style.display = 'none';
    const muteBtn = document.getElementById('sh-mute-btn');
    if (muteBtn) { muteBtn.style.display = 'none'; muteBtn.textContent = '🎤 Mute'; }
  }

  // ── Mute ──────────────────────────────────────────────────────────────────
  async function toggleMute() {
    if (!room) return;
    muted = !muted;
    await room.localParticipant.setMicrophoneEnabled(!muted);
    const btn = document.getElementById('sh-mute-btn');
    if (btn) btn.textContent = muted ? '🔇 Unmute' : '🎤 Mute';
  }

  // ── Open / Close ──────────────────────────────────────────────────────────
  function openModal() {
    const o = document.getElementById('sh-overlay');
    if (o) o.classList.add('open');
  }
  function closeModal() {
    if (room) hangUp();
    const o = document.getElementById('sh-overlay');
    if (o) o.classList.remove('open');
    resetUI();
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    injectNavButton();
    buildModal();
  });

})();
