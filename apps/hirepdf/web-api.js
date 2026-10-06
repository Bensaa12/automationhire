// HirePDF in the browser (iPhone, Android, any computer): stands in for preload.js + main.js.
// The app code (src/app.js) is the same as the Windows app; it talks to window.hirepdf.
// Files are never uploaded: everything is read, built and saved on the device.
(function () {
  'use strict';

  /* ---------- licence: same HP1 keys and rules as license.js ---------- */
  var PUBLIC_KEY_SPKI = 'MCowBQYDK2VwAyEA5Rdl71PU65p0gMs+dQVxKZ+G0vz2Oz3oY2C1oet3er4=';
  var TRIAL_DAYS = 14, DAY = 24 * 60 * 60 * 1000;
  var BUY_URL = 'https://automationhire.co.uk/pound-appstore/hirepdf';
  var BUY_URL_PRO = 'https://automationhire.co.uk/pound-appstore/hirepdf-pro';
  var PRICES = { Basic: '£1', Pro: '£9.99' };
  var LIC_KEY = 'hirepdf_web_license', TRIAL_KEY = 'hirepdf_web_trial';
  var VERSION = '1.0 (web app)';

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function b64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function b64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return b64(s); }
  var PUBLIC_KEY = b64(PUBLIC_KEY_SPKI).slice(-32);   // raw Ed25519 key = last 32 bytes of the SPKI
  var normEdition = function (e) { return /^pro$/i.test(String(e || '')) ? 'Pro' : 'Basic'; };

  function verifyKey(raw) {
    var key = String(raw || '').replace(/\s+/g, '');
    var m = key.match(/^HP1-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
    if (!m) return { ok: false, error: 'That doesn\'t look like a HirePDF licence key. It should start with "HP1-".' };
    try {
      var payloadBuf = b64u(m[1]);
      if (!window.nacl.sign.detached.verify(payloadBuf, b64u(m[2]), PUBLIC_KEY)) return { ok: false, error: 'This licence key is not valid. Please check you copied the whole key.' };
      var payload = JSON.parse(new TextDecoder().decode(payloadBuf));
      if (payload.v !== 1) return { ok: false, error: 'This licence key is for a different version of HirePDF.' };
      return { ok: true, key: key, payload: payload };
    } catch (e) {
      return { ok: false, error: 'This licence key is not valid. Please check you copied the whole key.' };
    }
  }

  function trialInfo() {
    var now = Date.now(), st = {};
    try { st = JSON.parse(store(TRIAL_KEY) || '{}') || {}; } catch (e) {}
    var firstRun = Number.isFinite(st.firstRun) ? st.firstRun : now;
    var lastSeen = Math.max(st.lastSeen || 0, now);
    store(TRIAL_KEY, JSON.stringify({ firstRun: firstRun, lastSeen: lastSeen }));
    var rolledBack = now < lastSeen - DAY;
    var daysLeft = rolledBack ? 0 : Math.max(0, Math.ceil((firstRun + TRIAL_DAYS * DAY - now) / DAY));
    return { daysLeft: daysLeft, expired: daysLeft <= 0 };
  }

  function status() {
    var stored = store(LIC_KEY);
    if (stored) {
      var v = verifyKey(stored);
      if (v.ok) {
        var edition = normEdition(v.payload.ed);
        var t = edition === 'Pro' ? null : trialInfo();
        var proTrial = !!t && !t.expired;
        return {
          licensed: true, name: v.payload.n, email: v.payload.e, edition: edition, pro: edition === 'Pro' || proTrial,
          proTrial: proTrial, trialDaysLeft: t ? t.daysLeft : 0, id: v.payload.id, buyUrl: BUY_URL, buyUrlPro: BUY_URL_PRO, prices: PRICES, version: VERSION,
        };
      }
    }
    var t2 = trialInfo();
    return { licensed: false, pro: !t2.expired, trialDays: TRIAL_DAYS, trialDaysLeft: t2.daysLeft, trialExpired: t2.expired, buyUrl: BUY_URL, buyUrlPro: BUY_URL_PRO, prices: PRICES, version: VERSION };
  }

  function canConvert(needsPro) {
    var s = status();
    if (!s.licensed && s.trialExpired) return { ok: false, reason: 'expired' };
    if (needsPro && !s.pro) return { ok: false, reason: 'pro' };
    return { ok: true };
  }

  /* ---------- files: the app works with paths, so each picked File gets a pretend one ---------- */
  var PDF_EXTS = ['pdf'], IMG_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'heic', 'heif'];
  var ALL_EXTS = PDF_EXTS.concat(IMG_EXTS);
  var files = new Map(), nextFile = 1;
  var extOf = function (name) { var m = /\.([^.]+)$/.exec(name || ''); return m ? m[1].toLowerCase() : ''; };
  function guessExt(file) {
    var e = extOf(file.name);
    if (e) return e;
    var t = (file.type || '').split('/')[1] || '';
    return t === 'jpeg' ? 'jpg' : t;
  }
  function register(file) {
    var ext = guessExt(file);
    var name = extOf(file.name) ? file.name : (file.name || 'file') + '.' + ext;
    var p = 'device' + (nextFile++) + '/' + name;     // unique, and dirOf() gives a harmless folder name
    files.set(p, file);
    return p;
  }

  var isPhone = function () { return window.matchMedia('(pointer: coarse)').matches; };

  function pickFiles(kind) {
    return new Promise(function (resolve) {
      var input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = kind === 'images' ? 'image/*,.heic,.heif' : kind === 'pdf' ? 'application/pdf,.pdf' : 'application/pdf,.pdf,image/*,.heic,.heif';
      input.style.display = 'none';
      var done = false;
      var finish = function (list) { if (done) return; done = true; input.remove(); resolve(list); };
      input.addEventListener('change', function () {
        finish(Array.prototype.slice.call(input.files).filter(function (f) { return ALL_EXTS.indexOf(guessExt(f)) >= 0; }).map(register));
      });
      input.addEventListener('cancel', function () { finish([]); });
      document.body.appendChild(input);
      input.click();
    });
  }

  function readFile(p) {
    var f = files.get(p);
    if (!f) return Promise.reject(new Error('That file is no longer available. Please add it again.'));
    return f.arrayBuffer().then(function (buf) {
      return { path: p, name: p.replace(/^[^/]*\//, ''), ext: extOf(p), size: buf.byteLength, data: new Uint8Array(buf) };
    });
  }

  // iPhones convert HEIC to JPG when a photo is picked, so this is only for HEIC files from Files/iCloud.
  // Safari can decode HEIC itself; most other browsers can't.
  function decodeHeic(p) {
    var f = files.get(p);
    return createImageBitmap(f).then(function (bmp) {
      var c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      var ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      bmp.close && bmp.close();
      var img = ctx.getImageData(0, 0, c.width, c.height);
      return { width: img.width, height: img.height, data: new Uint8Array(img.data.buffer) };
    }, function () {
      throw new Error('This browser can\'t open HEIC photos. Pick the photo from your Photos app instead (it\'s converted to JPG automatically), or save it as JPG first.');
    });
  }

  /* ---------- saving: the phone's Share sheet (Files, Mail, WhatsApp…) or a normal download ---------- */
  var MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png' };
  function toFile(item) { return new File([item.data], item.name, { type: MIME[extOf(item.name)] || 'application/octet-stream' }); }

  function download(list) {
    list.forEach(function (file, i) {
      setTimeout(function () {
        var url = URL.createObjectURL(file), a = document.createElement('a');
        a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      }, i * 400);
    });
    return true;
  }

  // Share needs a fresh tap. Building a big PDF can take longer than the browser allows,
  // so if it refuses, ask for one more tap.
  function sharePrompt(list) {
    return new Promise(function (resolve) {
      var box = document.getElementById('hpShare');
      box.querySelector('[data-msg]').textContent = list.length === 1 ? list[0].name + ' is ready.' : list.length + ' files are ready.';
      box.hidden = false;
      box.querySelector('[data-go]').onclick = function () {
        box.hidden = true;
        navigator.share({ files: list }).then(function () { resolve(true); }, function (e) {
          resolve(e && e.name === 'AbortError' ? false : download(list));
        });
      };
      box.querySelector('[data-cancel]').onclick = function () { box.hidden = true; resolve(false); };
    });
  }

  function deliver(items) {
    var list = items.map(toFile);
    if (isPhone() && navigator.canShare && navigator.canShare({ files: list })) {
      return navigator.share({ files: list }).then(function () { return true; }, function (e) {
        if (e && e.name === 'AbortError') return false;            // they closed the Share sheet
        if (e && e.name === 'NotAllowedError') return sharePrompt(list);
        return download(list);
      });
    }
    return Promise.resolve(download(list));
  }

  /* ---------- the bridge ---------- */
  var dirty = false, batch = [];
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  window.hirepdf = {
    isWeb: true,
    touchUI: isPhone(),
    testMode: function () { return Promise.resolve(/[?&]test=1\b/.test(location.search)); },
    startupPaths: function () { return Promise.resolve([]); },
    onAddPaths: function () {},
    pickFiles: pickFiles,
    pickFolder: function () { return pickFiles(); },
    expandPaths: function (paths) { return Promise.resolve(paths.filter(function (p) { return files.has(p) && ALL_EXTS.indexOf(extOf(p)) >= 0; })); },
    pathForFile: register,
    readFile: readFile,
    decodeHeic: decodeHeic,
    savePdf: function (o) {
      var allowed = canConvert(o.needsPro);
      if (!allowed.ok) return Promise.resolve({ blocked: true, reason: allowed.reason });
      var name = String(o.defaultName || 'document.pdf').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
      return deliver([{ name: name, data: o.data }]).then(function (ok) { return ok ? { path: name, size: o.data.byteLength } : null; });
    },
    // Split and "Save as JPG" save several files: collect them, then hand them over together (flush).
    pickOutputFolder: function (o) {
      var allowed = canConvert(o && o.needsPro);
      if (!allowed.ok) return Promise.resolve({ blocked: true, reason: allowed.reason });
      batch = [];
      return Promise.resolve({ dir: 'device' });
    },
    writeInto: function (o) {
      var allowed = canConvert(o.needsPro);
      if (!allowed.ok) return Promise.resolve({ blocked: true, reason: allowed.reason });
      var name = String(o.name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
      batch.push({ name: name, data: o.data });
      return Promise.resolve({ path: name, size: o.data.byteLength });
    },
    flush: function () { var b = batch; batch = []; return b.length ? deliver(b) : Promise.resolve(false); },
    showInFolder: function () { return Promise.resolve(); },
    openPath: function () { return Promise.resolve(); },
    setDirty: function (v) { dirty = !!v; },
    licenseStatus: function () { return Promise.resolve(status()); },
    activate: function (raw) {
      var v = verifyKey(raw);
      if (!v.ok) return Promise.resolve({ ok: false, error: v.error });
      store(LIC_KEY, v.key);
      return Promise.resolve({ ok: true, status: status() });
    },
    removeLicense: function () { store(LIC_KEY, null); return Promise.resolve(status()); },
    openExternal: function (url) {
      if (/^https:\/\/(www\.)?automationhire\.co\.uk(\/|$)/.test(url) || /^mailto:[^@]+@automationhire\.co\.uk$/.test(url)) window.open(url, '_blank', 'noopener');
      return Promise.resolve();
    },
  };

  /* ---------- page tweaks for phones ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('hp-web');
    var touch = isPhone();
    if (touch) document.body.classList.add('hp-touch');
    var setText = function (sel, text) { var n = document.querySelector(sel); if (n) n.textContent = text; };
    if (touch) {
      setText('.drop-zone strong', 'Add PDFs or photos');
      setText('.drop-zone span', 'Tap to choose from your phone · PDF, JPG, PNG, HEIC');
      setText('.hint-text', 'Tap pages to select them, then use ‹ › to move them, or rotate and delete.');
      setText('.quick-card[data-quick="organise"] > span:last-child', 'Put pages in order, rotate or delete them');
    }
    setText('#splitGo', 'Split & save');
    setText('#imgGo', 'Save pictures');

    // Save options fold away on phones to leave room for the pages.
    var bottom = document.getElementById('bottom');
    if (bottom) {
      var optBtn = document.createElement('button');
      optBtn.id = 'hpOptToggle';
      optBtn.className = 'btn';
      optBtn.type = 'button';
      optBtn.textContent = 'Options';
      optBtn.onclick = function () { document.body.classList.toggle('hp-opts-open'); };
      bottom.insertBefore(optBtn, bottom.firstChild);
    }

    // "Ready to share" box, used when the browser wants another tap before sharing.
    var share = document.createElement('div');
    share.id = 'hpShare';
    share.hidden = true;
    share.innerHTML = '<div class="hp-share-card"><strong data-msg></strong><span>Tap Share to save it to Files, email it or send it.</span>' +
      '<div class="hp-share-row"><button class="btn" data-cancel type="button">Cancel</button><button class="btn primary" data-go type="button">Share / Save</button></div></div>';
    document.body.appendChild(share);

    // Add to Home Screen tip.
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var banner = document.createElement('div');
    banner.id = 'hpInstall';
    banner.hidden = true;
    banner.innerHTML = '<span data-text></span><button class="btn primary" data-install type="button" hidden>Install</button><button class="icon-btn" data-close type="button" aria-label="Close">✕</button>';
    document.body.appendChild(banner);
    var dismissed = store('hirepdf_install_dismissed');
    banner.querySelector('[data-close]').onclick = function () { banner.hidden = true; store('hirepdf_install_dismissed', '1'); };
    if (!standalone && !dismissed && touch && ios) {
      banner.querySelector('[data-text]').textContent = 'Install HirePDF: tap Share, then "Add to Home Screen".';
      banner.hidden = false;
    }
    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      if (standalone || dismissed) return;
      banner.querySelector('[data-text]').textContent = 'Install HirePDF on this device: it opens like an app and works offline.';
      var b = banner.querySelector('[data-install]');
      b.hidden = false;
      b.onclick = function () { banner.hidden = true; deferred.prompt(); deferred = null; };
      banner.hidden = false;
    });
  });

  // Offline use once installed. On the website the page is /apps/hirepdf (no slash), one level above sw.js.
  if ('serviceWorker' in navigator) window.addEventListener('load', function () {
    var p = location.pathname.replace(/\/index\.html$/, '/');
    navigator.serviceWorker.register('sw.js', p.slice(-1) === '/' ? undefined : { scope: p }).catch(function () {});
  });
})();
