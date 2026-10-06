/* HireSign on the web (iPhone, Android, any browser).
 * Provides the same window.hiresign bridge the Windows app gets from Electron (preload.js), so
 * src/app.js runs unchanged: opening files, saving (Share sheet on phones), Word -> PDF,
 * licence keys (same HS1 keys and rules as license.js) and the install-to-home-screen prompt.
 * Built into the website by web/build-web.js. */
(function () {
  'use strict';

  /* ---------- licence: a browser port of license.js ---------- */
  // Raw Ed25519 public key = the last 32 bytes of the SPKI key in license.js.
  var SPKI = 'MCowBQYDK2VwAyEANLa0/JY9g0ryp52ZL9z4vKL7K5gKBXcgDgMeJ120XE4=';
  var TRIAL_DAYS = 14, DAY = 86400000;
  var BUY_URL = 'https://automationhire.co.uk/pound-appstore/hiresign';
  var BUY_URL_PRO = 'https://automationhire.co.uk/pound-appstore/hiresign-pro';
  var PRICES = { Basic: '£1', Pro: '£9.99' };
  var LIC_KEY = 'hiresign_web_license', TRIAL_KEY = 'hiresign_web_trial';

  function b64(s) { var bin = atob(s), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  function b64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return b64(s); }
  var PUBLIC_KEY = b64(SPKI).slice(-32);
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

  function verifyKey(raw) {
    var key = String(raw || '').replace(/\s+/g, '').replace(/^["']|["']$/g, '');
    var m = key.match(/^HS1-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
    if (!m) return { ok: false, error: 'That doesn’t look like a HireSign licence key. It should start with "HS1-".' };
    try {
      var payloadBytes = b64u(m[1]);
      if (!window.nacl.sign.detached.verify(payloadBytes, b64u(m[2]), PUBLIC_KEY)) throw new Error('bad signature');
      var payload = JSON.parse(new TextDecoder().decode(payloadBytes));
      if (payload.v !== 1) return { ok: false, error: 'This licence key is for a different version of HireSign.' };
      return { ok: true, key: key, payload: payload };
    } catch (e) {
      return { ok: false, error: 'This licence key is not valid. Please check you copied the whole key.' };
    }
  }

  function trialInfo() {
    var now = Date.now(), rec = {};
    try { rec = JSON.parse(ls(TRIAL_KEY) || '{}'); } catch (e) { rec = {}; }
    var firstRun = Number.isFinite(rec.firstRun) ? rec.firstRun : now;
    var lastSeen = Math.max(rec.lastSeen || 0, now);
    ls(TRIAL_KEY, JSON.stringify({ firstRun: firstRun, lastSeen: lastSeen }));
    var rolledBack = now < (rec.lastSeen || 0) - DAY;
    var daysLeft = rolledBack ? 0 : Math.max(0, Math.ceil((firstRun + TRIAL_DAYS * DAY - now) / DAY));
    return { daysLeft: daysLeft, expired: daysLeft <= 0 };
  }

  function status() {
    var stored = ls(LIC_KEY);
    if (stored) {
      var v = verifyKey(stored);
      if (v.ok) {
        var edition = /^pro$/i.test(String(v.payload.ed || '')) ? 'Pro' : 'Basic';
        var t = edition === 'Pro' ? null : trialInfo(), proTrial = !!t && !t.expired;
        return { licensed: true, name: v.payload.n, email: v.payload.e, edition: edition, pro: edition === 'Pro' || proTrial, proTrial: proTrial, trialDaysLeft: t ? t.daysLeft : 0, id: v.payload.id, buyUrl: BUY_URL, buyUrlPro: BUY_URL_PRO, prices: PRICES, version: '1.0 (web app)' };
      }
    }
    var tr = trialInfo();
    return { licensed: false, pro: !tr.expired, trialDays: TRIAL_DAYS, trialDaysLeft: tr.daysLeft, trialExpired: tr.expired, buyUrl: BUY_URL, buyUrlPro: BUY_URL_PRO, prices: PRICES, version: '1.0 (web app)' };
  }

  function canSave(source) {
    var s = status();
    if (!s.licensed && s.trialExpired) return { ok: false, reason: 'expired' };
    if (source === 'docx' && !s.pro) return { ok: false, reason: 'pro' };
    return { ok: true };
  }

  /* ---------- files ---------- */
  var MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', png: 'image/png' };

  function pickFile() {
    return new Promise(function (resolve) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.docx,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      input.style.display = 'none';
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        input.remove();
        if (!f) return resolve(null);
        f.arrayBuffer().then(function (buf) { resolve({ name: f.name, path: null, data: new Uint8Array(buf) }); });
      });
      input.addEventListener('cancel', function () { input.remove(); resolve(null); });
      document.body.appendChild(input);
      input.click();
    });
  }

  function isPhone() { return window.matchMedia('(pointer: coarse)').matches; }

  // Phones: the Share sheet (Save to Files, Mail, WhatsApp...). Elsewhere, or if sharing isn't
  // allowed any more (it needs a recent tap), a normal download.
  function deliver(name, ext, data) {
    var file = new File([data], name, { type: MIME[ext] || 'application/octet-stream' });
    var download = function () {
      var url = URL.createObjectURL(file), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      return name;
    };
    if (isPhone() && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: name }).then(function () { return name; }, function (e) {
        if (e && e.name === 'AbortError') return null;      // they closed the Share sheet
        return download();
      });
    }
    return Promise.resolve(download());
  }

  // Word -> PDF without Electron's print engine: draw each page and put the pictures in a PDF.
  function wordToPdf() {
    var pages = Array.prototype.slice.call(document.querySelectorAll('#stage section.docx'));
    var stage = document.getElementById('stage'), prevTransform = stage.style.transform;
    stage.style.transform = 'none';                 // capture at full size, not the zoomed view
    var PDFDocument = window.PDFLib.PDFDocument;
    return PDFDocument.create().then(function (pdf) {
      var chain = Promise.resolve();
      pages.forEach(function (sec) {
        chain = chain.then(function () {
          var wPt = parseFloat(sec.style.width) || sec.offsetWidth * 0.75, hPt = parseFloat(sec.style.height) || sec.offsetHeight * 0.75;
          return window.html2canvas(sec, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true }).then(function (canvas) {
            return pdf.embedJpg(canvas.toDataURL('image/jpeg', 0.9)).then(function (img) {
              pdf.addPage([wPt, hPt]).drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
            });
          });
        });
      });
      return chain.then(function () { return pdf.save(); });
    }).finally(function () { stage.style.transform = prevTransform; });
  }

  /* ---------- the bridge ---------- */
  var dirty = false;
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  window.hiresign = {
    isWeb: true,
    testMode: function () { return Promise.resolve(false); },
    startupFile: function () { return Promise.resolve(null); },
    onOpenFile: function () {},
    openDialog: pickFile,
    readFile: function () { return Promise.reject(new Error('Not available on the web')); },
    pathForFile: function () { return ''; },
    saveDialog: function (o) {
      var allowed = canSave(o.source);
      if (!allowed.ok) return Promise.resolve({ blocked: true, reason: allowed.reason });
      var name = String(o.defaultPath || ('signed.' + o.ext)).split(/[\\/]/).pop();
      return deliver(name, o.ext, o.data);
    },
    printToPdf: wordToPdf,
    showInFolder: function () {},
    setDirty: function (v) { dirty = !!v; },
    licenseStatus: function () { return Promise.resolve(status()); },
    activate: function (key) {
      var v = verifyKey(key);
      if (!v.ok) return Promise.resolve({ ok: false, error: v.error });
      ls(LIC_KEY, v.key);
      return Promise.resolve({ ok: true, status: status() });
    },
    removeLicense: function () { ls(LIC_KEY, null); return Promise.resolve(status()); },
    openExternal: function (url) { window.open(url, '_blank', 'noopener'); return Promise.resolve(); }
  };

  /* ---------- phone layout + install prompt ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('hs-web');
    var sidebar = document.getElementById('sidebar');

    // Tools panel toggle (the sidebar becomes a slide-up panel on phones).
    var toggle = document.createElement('button');
    toggle.type = 'button'; toggle.id = 'hsPanelToggle'; toggle.className = 'btn primary';
    toggle.textContent = '✍ Sign';
    toggle.addEventListener('click', function () { document.body.classList.toggle('hs-panel-open'); });
    document.body.appendChild(toggle);
    var scrim = document.createElement('div'); scrim.id = 'hsScrim';
    scrim.addEventListener('click', function () { document.body.classList.remove('hs-panel-open'); });
    document.body.appendChild(scrim);
    // Picking a signature or tool "arms" it: close the panel so the page can be tapped.
    // Only touch the class when the panel is actually open: classList.remove() on an absent class
    // still counts as an attribute change and would re-trigger this observer forever.
    new MutationObserver(function () {
      var b = document.body.classList;
      if ((b.contains('armed') || b.contains('inking')) && b.contains('hs-panel-open')) b.remove('hs-panel-open');
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (sidebar) sidebar.addEventListener('click', function (e) { if (e.target.closest('[data-new]') && document.body.classList.contains('hs-panel-open')) document.body.classList.remove('hs-panel-open'); });

    // Install banner: Android/Chrome gets a one-tap button; iPhone gets the Share -> Add to Home Screen tip.
    var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (standalone || ls('hiresign_install_dismissed')) return;
    var banner = document.createElement('div'); banner.id = 'hsInstall'; banner.hidden = true;
    var text = document.createElement('span'), btn = document.createElement('button'), close = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn primary'; btn.textContent = 'Install';
    close.type = 'button'; close.className = 'icon-btn'; close.textContent = '✕'; close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', function () { banner.hidden = true; ls('hiresign_install_dismissed', '1'); });
    banner.append(text, btn, close);
    document.body.appendChild(banner);
    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferred = e;
      text.textContent = 'Install HireSign on this device for quick, offline signing.';
      btn.hidden = false; banner.hidden = false;
    });
    btn.addEventListener('click', function () { if (deferred) { deferred.prompt(); deferred = null; banner.hidden = true; } });
    var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (iOS) {
      text.innerHTML = 'Install on your iPhone: tap <b>Share</b> <span aria-hidden="true">⬆︎</span> then <b>Add to Home Screen</b>.';
      btn.hidden = true; banner.hidden = false;
    }
  });

  // Offline use once installed.
  // On the website the page is /apps/hiresign (no slash), one level above sw.js: the server allows that scope.
  if ('serviceWorker' in navigator) window.addEventListener('load', function () {
    var p = location.pathname.replace(/\/index\.html$/, '/');
    navigator.serviceWorker.register('sw.js', p.slice(-1) === '/' ? undefined : { scope: p }).catch(function () {}); });
})();
