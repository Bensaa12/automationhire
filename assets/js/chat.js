/* ============================================================
   AutomationHire — Lily AI Chat
   Intelligent sales assistant powered by Claude
   ============================================================ */

(function () {
  'use strict';

  /* ── Config ── */
  const API_ENDPOINT    = '/api/chat';
  const BRAND_NAME      = 'Lily';
  const BRAND_SUBTITLE  = 'AI Sales Consultant · AutomationHire';
  const OPEN_DELAY_MS   = 3000;   // auto-open after 3s on first visit
  const STORAGE_KEY     = 'ah_chat_history';
  const SESSION_KEY     = 'ah_chat_opened';

  /* ── Opening message ── */
  const OPENING_MESSAGE = "Hi 👋 Welcome to AutomationHire! I'm Lily, your AI sales consultant.\n\nWhat part of your business are you looking to automate today—sales, customer support, follow-ups, operations, or something else?";

  /* ── State ── */
  let messages    = [];   // [{role, content}]
  let isTyping    = false;
  let isOpen      = false;
  let hasGreeted  = false;

  /* ────────────────────────────────────────────────────────── */
  /*  Inject Styles                                            */
  /* ────────────────────────────────────────────────────────── */
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* ── Launcher wrapper ── */
      #ah-chat-launcher {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 12px;
        pointer-events: none;
        font-family: 'Inter', system-ui, sans-serif;
      }

      /* ── Bubble button ── */
      #ah-chat-bubble {
        display: flex;
        align-items: center;
        gap: 10px;
        background: linear-gradient(135deg, #00e676 0%, #00b4d8 100%);
        color: #060810;
        font-size: 14px;
        font-weight: 700;
        padding: 13px 22px;
        border-radius: 50px;
        border: none;
        cursor: pointer;
        pointer-events: all;
        box-shadow: 0 4px 24px rgba(0,230,118,0.4), 0 2px 8px rgba(0,0,0,0.4);
        transition: transform 0.2s, box-shadow 0.2s;
        white-space: nowrap;
        letter-spacing: -0.01em;
      }
      #ah-chat-bubble:hover {
        transform: translateY(-2px) scale(1.03);
        box-shadow: 0 8px 32px rgba(0,230,118,0.5), 0 4px 12px rgba(0,0,0,0.5);
      }
      #ah-chat-bubble:active { transform: scale(0.97); }
      #ah-chat-bubble .ah-chat-icon { font-size: 18px; line-height: 1; }

      /* Unread badge */
      #ah-unread-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        width: 18px;
        height: 18px;
        background: #ff4444;
        border-radius: 50%;
        font-size: 11px;
        font-weight: 700;
        color: #fff;
        display: none;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      #ah-unread-badge.show { display: flex; }

      /* Online pulse dot */
      #ah-online-dot {
        width: 8px; height: 8px;
        background: #060810;
        border-radius: 50%;
        flex-shrink: 0;
        animation: ahPulse 2s infinite;
      }
      @keyframes ahPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%       { opacity: 0.5; transform: scale(1.4); }
      }

      /* ── Chat window ── */
      #ah-chat-window {
        width: 360px;
        height: 520px;
        background: #0d1117;
        border: 1px solid rgba(0,230,118,0.15);
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04);
        pointer-events: all;
        display: none;
        flex-direction: column;
        transform-origin: bottom right;
        animation: ahSlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1);
      }
      #ah-chat-window.open {
        display: flex;
      }
      @keyframes ahSlideUp {
        from { opacity: 0; transform: scale(0.85) translateY(16px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }

      /* Header */
      #ah-chat-header {
        background: linear-gradient(135deg, #00e676 0%, #00b4d8 100%);
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 11px;
        flex-shrink: 0;
      }
      #ah-chat-avatar {
        width: 38px; height: 38px;
        background: rgba(6,8,16,0.25);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }
      #ah-chat-header-info { flex: 1; min-width: 0; }
      #ah-chat-header-info h4 {
        font-size: 13px; font-weight: 700; color: #060810;
        margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #ah-chat-header-info p {
        font-size: 11px; color: rgba(6,8,16,0.65);
        margin: 0;
      }
      #ah-chat-close {
        background: none; border: none; cursor: pointer;
        font-size: 18px; color: rgba(6,8,16,0.5);
        padding: 2px; line-height: 1; flex-shrink: 0;
        transition: color 0.15s;
      }
      #ah-chat-close:hover { color: rgba(6,8,16,0.9); }

      /* Message thread */
      #ah-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        scroll-behavior: smooth;
      }
      #ah-chat-messages::-webkit-scrollbar { width: 4px; }
      #ah-chat-messages::-webkit-scrollbar-track { background: transparent; }
      #ah-chat-messages::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.1);
        border-radius: 4px;
      }

      /* Message bubbles */
      .ah-msg {
        display: flex;
        flex-direction: column;
        max-width: 82%;
        animation: ahMsgIn 0.18s ease;
      }
      @keyframes ahMsgIn {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .ah-msg.ah-msg-ai  { align-self: flex-start; }
      .ah-msg.ah-msg-user { align-self: flex-end; }

      .ah-msg-bubble {
        padding: 10px 14px;
        border-radius: 16px;
        font-size: 13px;
        line-height: 1.55;
        word-break: break-word;
      }
      .ah-msg-ai .ah-msg-bubble {
        background: rgba(0,230,118,0.08);
        border: 1px solid rgba(0,230,118,0.15);
        color: #e2e8f0;
        border-bottom-left-radius: 4px;
      }
      .ah-msg-user .ah-msg-bubble {
        background: linear-gradient(135deg, rgba(0,230,118,0.2), rgba(0,180,216,0.2));
        border: 1px solid rgba(0,230,118,0.25);
        color: #f0fdf4;
        border-bottom-right-radius: 4px;
      }
      .ah-msg-time {
        font-size: 10px;
        color: rgba(255,255,255,0.25);
        margin-top: 3px;
        padding: 0 2px;
      }
      .ah-msg-ai .ah-msg-time  { align-self: flex-start; }
      .ah-msg-user .ah-msg-time { align-self: flex-end; }

      /* Typing indicator */
      #ah-typing-indicator {
        display: none;
        align-self: flex-start;
        background: rgba(0,230,118,0.08);
        border: 1px solid rgba(0,230,118,0.15);
        border-radius: 16px;
        border-bottom-left-radius: 4px;
        padding: 10px 16px;
        gap: 5px;
        align-items: center;
        animation: ahMsgIn 0.18s ease;
      }
      #ah-typing-indicator.show { display: flex; }
      .ah-typing-dot {
        width: 6px; height: 6px;
        background: rgba(0,230,118,0.6);
        border-radius: 50%;
        animation: ahTypingBounce 1.2s infinite;
      }
      .ah-typing-dot:nth-child(2) { animation-delay: 0.2s; }
      .ah-typing-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes ahTypingBounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
        30%            { transform: translateY(-5px); opacity: 1; }
      }

      /* Quick reply chips */
      #ah-quick-replies {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 0 14px 10px;
        flex-shrink: 0;
      }
      .ah-chip {
        background: rgba(0,230,118,0.06);
        border: 1px solid rgba(0,230,118,0.2);
        color: #00e676;
        font-size: 11.5px;
        font-weight: 500;
        padding: 5px 12px;
        border-radius: 50px;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
        white-space: nowrap;
        pointer-events: all;
      }
      .ah-chip:hover {
        background: rgba(0,230,118,0.14);
        border-color: rgba(0,230,118,0.4);
      }

      /* Input area */
      #ah-chat-input-area {
        padding: 10px 12px 12px;
        border-top: 1px solid rgba(255,255,255,0.06);
        display: flex;
        gap: 8px;
        align-items: flex-end;
        flex-shrink: 0;
      }
      #ah-chat-input {
        flex: 1;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 10px 14px;
        font-size: 13px;
        color: #fff;
        font-family: 'Inter', system-ui, sans-serif;
        outline: none;
        transition: border-color 0.2s;
        resize: none;
        max-height: 100px;
        min-height: 40px;
        line-height: 1.5;
        overflow-y: auto;
      }
      #ah-chat-input:focus { border-color: rgba(0,230,118,0.4); }
      #ah-chat-input::placeholder { color: rgba(255,255,255,0.3); }
      #ah-chat-send {
        background: linear-gradient(135deg, #00e676, #00b4d8);
        border: none;
        border-radius: 10px;
        width: 40px; height: 40px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        font-size: 16px;
        flex-shrink: 0;
        transition: transform 0.15s, opacity 0.15s;
      }
      #ah-chat-send:hover { transform: scale(1.08); }
      #ah-chat-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

      /* Footer brand */
      #ah-chat-footer {
        padding: 6px 14px 8px;
        text-align: center;
        font-size: 10.5px;
        color: rgba(255,255,255,0.2);
        flex-shrink: 0;
        border-top: 1px solid rgba(255,255,255,0.04);
      }
      #ah-chat-footer span { color: rgba(0,230,118,0.6); font-weight: 600; }

      /* Responsive */
      @media (max-width: 480px) {
        #ah-chat-launcher { bottom: 16px; right: 16px; }
        #ah-chat-window {
          width: calc(100vw - 32px);
          height: calc(100vh - 100px);
          max-height: 520px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Build DOM                                                */
  /* ────────────────────────────────────────────────────────── */
  function buildDOM() {
    const launcher = document.createElement('div');
    launcher.id = 'ah-chat-launcher';
    launcher.innerHTML = `
      <!-- Chat window -->
      <div id="ah-chat-window" role="dialog" aria-label="Lily chat">
        <div id="ah-chat-header">
          <div id="ah-chat-avatar">⚡</div>
          <div id="ah-chat-header-info">
            <h4>${BRAND_NAME}</h4>
            <p>🟢 Online · ${BRAND_SUBTITLE}</p>
          </div>
          <button id="ah-chat-close" aria-label="Close chat">✕</button>
        </div>

        <div id="ah-chat-messages" role="log" aria-live="polite">
          <div id="ah-typing-indicator" aria-label="AI is typing">
            <div class="ah-typing-dot"></div>
            <div class="ah-typing-dot"></div>
            <div class="ah-typing-dot"></div>
          </div>
        </div>

        <div id="ah-quick-replies"></div>

        <div id="ah-chat-input-area">
          <textarea
            id="ah-chat-input"
            placeholder="Type your message…"
            rows="1"
            aria-label="Message input"
          ></textarea>
          <button id="ah-chat-send" aria-label="Send message" disabled>➤</button>
        </div>

        <div id="ah-chat-footer">Powered by <span>AutomationHire AI</span></div>
      </div>

      <!-- Launcher bubble -->
      <div style="position:relative; pointer-events:all;">
        <button id="ah-chat-bubble" aria-label="Chat with Lily">
          <span class="ah-chat-icon">💬</span>
          Talk to Sales
          <span id="ah-online-dot"></span>
        </button>
        <span id="ah-unread-badge">1</span>
      </div>
    `;
    document.body.appendChild(launcher);
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Helpers                                                  */
  /* ────────────────────────────────────────────────────────── */
  function formatTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Convert newlines to <br> and basic bold **text** */
  function renderText(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function addMessage(role, content, time) {
    const thread = document.getElementById('ah-chat-messages');
    const indicator = document.getElementById('ah-typing-indicator');

    const div = document.createElement('div');
    div.className = `ah-msg ah-msg-${role === 'user' ? 'user' : 'ai'}`;
    div.innerHTML = `
      <div class="ah-msg-bubble">${renderText(content)}</div>
      <div class="ah-msg-time">${time || formatTime()}</div>
    `;

    // Insert before typing indicator
    thread.insertBefore(div, indicator);
    scrollToBottom();
  }

  function scrollToBottom() {
    const thread = document.getElementById('ah-chat-messages');
    if (thread) thread.scrollTop = thread.scrollHeight;
  }

  function setTyping(show) {
    isTyping = show;
    const indicator = document.getElementById('ah-typing-indicator');
    const sendBtn   = document.getElementById('ah-chat-send');
    if (indicator) indicator.classList.toggle('show', show);
    if (sendBtn)   sendBtn.disabled = show;
    if (show) scrollToBottom();
  }

  function showQuickReplies(chips) {
    const container = document.getElementById('ah-quick-replies');
    if (!container) return;
    container.innerHTML = '';
    chips.forEach(text => {
      const btn = document.createElement('button');
      btn.className = 'ah-chip';
      btn.textContent = text;
      btn.addEventListener('click', () => {
        container.innerHTML = '';
        sendMessage(text);
      });
      container.appendChild(btn);
    });
  }

  function hideUnreadBadge() {
    const badge = document.getElementById('ah-unread-badge');
    if (badge) badge.classList.remove('show');
  }

  /* ────────────────────────────────────────────────────────── */
  /*  API Call                                                 */
  /* ────────────────────────────────────────────────────────── */
  async function callAI(userText) {
    messages.push({ role: 'user', content: userText });

    setTyping(true);

    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });

      const data = await res.json();

      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'No reply');
      }

      setTyping(false);
      addMessage('assistant', data.reply);
      messages.push({ role: 'assistant', content: data.reply });

      // Show contextual quick replies after first AI response
      if (messages.length <= 3) {
        showQuickReplies([
          'Sales automation',
          'Customer support AI',
          'Lead generation',
          'CRM workflows',
          'Book a call',
        ]);
      }

    } catch (e) {
      console.error('[Lily]', e.message);
      setTyping(false);
      addMessage('assistant', "I'm having a moment — please try again or email us at hello@automationhire.co.uk");
    }
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Send Message                                             */
  /* ────────────────────────────────────────────────────────── */
  function sendMessage(text) {
    const input = document.getElementById('ah-chat-input');
    const msg   = (text || (input && input.value) || '').trim();
    if (!msg || isTyping) return;

    if (input) {
      input.value = '';
      input.style.height = '';
      input.dispatchEvent(new Event('input'));
    }

    addMessage('user', msg);
    callAI(msg);
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Open / Close                                             */
  /* ────────────────────────────────────────────────────────── */
  function openChat() {
    if (isOpen) return;
    isOpen = true;
    const win = document.getElementById('ah-chat-window');
    if (win) {
      win.classList.add('open');
      // Re-trigger animation
      win.style.animation = 'none';
      win.offsetHeight; // reflow
      win.style.animation = '';
    }
    hideUnreadBadge();
    sessionStorage.setItem(SESSION_KEY, '1');

    // Focus input
    setTimeout(() => {
      const inp = document.getElementById('ah-chat-input');
      if (inp) inp.focus();
    }, 250);

    // Greet on first open
    if (!hasGreeted) {
      hasGreeted = true;
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        addMessage('assistant', OPENING_MESSAGE);
        messages.push({ role: 'assistant', content: OPENING_MESSAGE });
        showQuickReplies([
          'Sales automation',
          'Customer support AI',
          'Lead generation',
          'CRM & workflows',
          'Tell me more',
        ]);
      }, 900);
    }
  }

  function closeChat() {
    isOpen = false;
    const win = document.getElementById('ah-chat-window');
    if (win) win.classList.remove('open');
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Init                                                     */
  /* ────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();
    buildDOM();

    const bubble   = document.getElementById('ah-chat-bubble');
    const closeBtn = document.getElementById('ah-chat-close');
    const sendBtn  = document.getElementById('ah-chat-send');
    const input    = document.getElementById('ah-chat-input');
    const badge    = document.getElementById('ah-unread-badge');

    /* Bubble click */
    bubble.addEventListener('click', function () {
      isOpen ? closeChat() : openChat();
    });

    /* Close button */
    closeBtn.addEventListener('click', closeChat);

    /* Send button */
    sendBtn.addEventListener('click', () => sendMessage());

    /* Enter key (Shift+Enter = newline) */
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    /* Enable/disable send based on content */
    input.addEventListener('input', function () {
      sendBtn.disabled = isTyping || !this.value.trim();
      // Auto-resize textarea
      this.style.height = '';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });

    /* Close on outside click */
    document.addEventListener('click', function (e) {
      const launcher = document.getElementById('ah-chat-launcher');
      if (isOpen && launcher && !launcher.contains(e.target)) {
        closeChat();
      }
    });

    /* Auto-open once per session after delay (shows badge first) */
    if (!sessionStorage.getItem(SESSION_KEY)) {
      setTimeout(() => {
        if (!isOpen && badge) badge.classList.add('show');
      }, OPEN_DELAY_MS);
    }
  });

})();
