/* ============================================================
   AutomationHire — Live Chat (Tawk.to)
   Replace TAWK_PROPERTY_ID with your actual Property ID from:
   tawk.to → Administration → Channels → Chat Widget
   ============================================================ */

const TAWK_PROPERTY_ID = 'YOUR_PROPERTY_ID';  // ← paste your ID here
const TAWK_WIDGET_ID   = '1iframe';            // default widget ID

/* ── Only load if a real property ID has been set ── */
if (TAWK_PROPERTY_ID !== 'YOUR_PROPERTY_ID') {
  var Tawk_API = Tawk_API || {};
  var Tawk_LoadStart = new Date();

  /* ── Pre-configure before script loads ── */
  Tawk_API.onLoad = function () {
    /* Match site theme: dark bg, green brand */
    Tawk_API.setAttributes({
      'name':  '',
      'email': '',
    }, function (error) {});
  };

  (function () {
    var s1 = document.createElement('script');
    var s0 = document.getElementsByTagName('script')[0];
    s1.async = true;
    s1.src = 'https://embed.tawk.to/' + TAWK_PROPERTY_ID + '/' + TAWK_WIDGET_ID;
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    s0.parentNode.insertBefore(s1, s0);
  })();
}

/* ============================================================
   Custom "Talk to Sales" launcher button
   Sits above the default Tawk widget bubble
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  /* Inject styles */
  const style = document.createElement('style');
  style.textContent = `
    #chat-launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 8888;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      pointer-events: none;
    }
    #chat-bubble {
      display: flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, #00e676, #00b4d8);
      color: #060810;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 700;
      padding: 12px 20px;
      border-radius: 50px;
      border: none;
      cursor: pointer;
      pointer-events: all;
      box-shadow: 0 4px 24px rgba(0,230,118,0.35), 0 2px 8px rgba(0,0,0,0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      white-space: nowrap;
    }
    #chat-bubble:hover {
      transform: translateY(-2px) scale(1.03);
      box-shadow: 0 8px 32px rgba(0,230,118,0.45), 0 4px 12px rgba(0,0,0,0.5);
    }
    #chat-bubble:active {
      transform: scale(0.97);
    }
    #chat-bubble .chat-icon {
      font-size: 18px;
      line-height: 1;
    }
    #chat-online-dot {
      width: 8px;
      height: 8px;
      background: #060810;
      border-radius: 50%;
      animation: chatPulse 2s infinite;
      flex-shrink: 0;
    }
    @keyframes chatPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.5; transform: scale(1.4); }
    }

    /* Chat popup window (shown before Tawk loads or as fallback) */
    #chat-popup {
      width: 320px;
      background: #0d1117;
      border: 1px solid rgba(0,230,118,0.2);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 16px 48px rgba(0,0,0,0.6);
      pointer-events: all;
      display: none;
      flex-direction: column;
      animation: chatSlideUp 0.25s ease;
    }
    #chat-popup.open {
      display: flex;
    }
    @keyframes chatSlideUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #chat-popup-header {
      background: linear-gradient(135deg, #00e676, #00b4d8);
      padding: 16px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    #chat-popup-avatar {
      width: 40px;
      height: 40px;
      background: rgba(6,8,16,0.3);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }
    #chat-popup-info h4 {
      font-family: 'Syne', 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #060810;
      margin: 0 0 2px;
    }
    #chat-popup-info p {
      font-size: 12px;
      color: rgba(6,8,16,0.7);
      margin: 0;
    }
    #chat-popup-close {
      margin-left: auto;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      color: rgba(6,8,16,0.6);
      line-height: 1;
      padding: 0;
    }
    #chat-popup-body {
      padding: 18px;
    }
    #chat-popup-body .chat-greeting {
      background: rgba(0,230,118,0.06);
      border: 1px solid rgba(0,230,118,0.12);
      border-radius: 12px 12px 12px 2px;
      padding: 12px 14px;
      font-size: 13px;
      color: #e2e8f0;
      line-height: 1.6;
      margin-bottom: 14px;
    }
    #chat-popup-body .chat-greeting strong {
      color: #00e676;
    }
    #chat-input-row {
      display: flex;
      gap: 8px;
    }
    #chat-message-input {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      color: #fff;
      font-family: 'Inter', sans-serif;
      outline: none;
      transition: border-color 0.2s;
    }
    #chat-message-input:focus {
      border-color: rgba(0,230,118,0.4);
    }
    #chat-message-input::placeholder {
      color: rgba(255,255,255,0.3);
    }
    #chat-send-btn {
      background: linear-gradient(135deg, #00e676, #00b4d8);
      border: none;
      border-radius: 10px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      flex-shrink: 0;
      transition: transform 0.15s;
    }
    #chat-send-btn:hover { transform: scale(1.08); }
    #chat-popup-footer {
      padding: 10px 18px;
      border-top: 1px solid rgba(255,255,255,0.05);
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: rgba(255,255,255,0.25);
    }
    #chat-popup-footer span { color: #00e676; font-weight: 600; }

    /* Hide our bubble once Tawk widget is visible */
    .tawk-min-container ~ #chat-launcher #chat-bubble,
    body.tawk-loaded #chat-bubble {
      display: none;
    }

    @media (max-width: 480px) {
      #chat-launcher { bottom: 16px; right: 16px; }
      #chat-popup { width: calc(100vw - 32px); }
    }
  `;
  document.head.appendChild(style);

  /* Inject HTML */
  const launcher = document.createElement('div');
  launcher.id = 'chat-launcher';
  launcher.innerHTML = `
    <div id="chat-popup">
      <div id="chat-popup-header">
        <div id="chat-popup-avatar">⚡</div>
        <div id="chat-popup-info">
          <h4>AutomationHire Sales</h4>
          <p>🟢 Online · Replies in minutes</p>
        </div>
        <button id="chat-popup-close" aria-label="Close chat">✕</button>
      </div>
      <div id="chat-popup-body">
        <div class="chat-greeting">
          👋 Hi there! I'm here to help you find the right <strong>AI automation expert</strong> for your business. What are you looking to automate?
        </div>
        <div id="chat-input-row">
          <input id="chat-message-input" type="text" placeholder="Type your message..." />
          <button id="chat-send-btn">➤</button>
        </div>
      </div>
      <div id="chat-popup-footer">
        Powered by <span>&nbsp;AutomationHire</span>
      </div>
    </div>
    <button id="chat-bubble" aria-label="Talk to Sales">
      <span class="chat-icon">💬</span>
      Talk to Sales
      <span id="chat-online-dot"></span>
    </button>
  `;
  document.body.appendChild(launcher);

  const bubble  = document.getElementById('chat-bubble');
  const popup   = document.getElementById('chat-popup');
  const closeBtn = document.getElementById('chat-popup-close');
  const sendBtn  = document.getElementById('chat-send-btn');
  const msgInput = document.getElementById('chat-message-input');

  /* Toggle popup */
  bubble.addEventListener('click', function () {
    /* If Tawk is loaded, open Tawk instead */
    if (window.Tawk_API && typeof window.Tawk_API.maximize === 'function') {
      window.Tawk_API.maximize();
      return;
    }
    popup.classList.toggle('open');
    if (popup.classList.contains('open')) {
      setTimeout(() => msgInput.focus(), 100);
    }
  });

  closeBtn.addEventListener('click', function () {
    popup.classList.remove('open');
  });

  /* Send message — opens Tawk or mailto fallback */
  function sendMessage() {
    const msg = msgInput.value.trim();
    if (!msg) return;

    if (window.Tawk_API && typeof window.Tawk_API.maximize === 'function') {
      window.Tawk_API.maximize();
    } else {
      /* Fallback: open email with message pre-filled */
      window.location.href = `mailto:hello@automationhire.co.uk?subject=Sales Enquiry&body=${encodeURIComponent(msg)}`;
    }
    msgInput.value = '';
    popup.classList.remove('open');
  }

  sendBtn.addEventListener('click', sendMessage);
  msgInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });

  /* Close popup on outside click */
  document.addEventListener('click', function (e) {
    if (!launcher.contains(e.target)) {
      popup.classList.remove('open');
    }
  });
});
