/* ============================================================
   AutomationHire.co.uk — Main JavaScript
   ============================================================ */

'use strict';

/* --- PARTICLE CANVAS --- */
(function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], animFrame;

  const COLORS = ['#00e676', '#2979ff', '#00b4d8'];
  const COUNT  = 80;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function rand(a, b) { return Math.random() * (b - a) + a; }

  function Particle() {
    this.reset();
  }
  Particle.prototype.reset = function() {
    this.x  = rand(0, W);
    this.y  = rand(0, H);
    this.r  = rand(1, 2.5);
    this.vx = rand(-0.3, 0.3);
    this.vy = rand(-0.5, -0.1);
    this.alpha = rand(0.2, 0.7);
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  };
  Particle.prototype.update = function() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 0.001;
    if (this.y < -10 || this.alpha <= 0) this.reset();
  };
  Particle.prototype.draw = function() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.alpha;
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  // Lines between close particles
  function drawLines() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = '#2979ff';
          ctx.globalAlpha = (1 - dist / 120) * 0.08;
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawLines();
    particles.forEach(p => { p.update(); p.draw(); });
    animFrame = requestAnimationFrame(loop);
  }

  resize();
  for (let i = 0; i < COUNT; i++) particles.push(new Particle());
  loop();
  window.addEventListener('resize', resize);
})();


/* --- THEME TOGGLE --- */
(function initTheme() {
  const saved = localStorage.getItem('ah-theme') || 'dark';
  if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');

  function inject() {
    const cta = document.querySelector('.nav-cta');
    if (!cta || document.querySelector('.theme-toggle')) return;

    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle light/dark mode');
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    btn.textContent = isDark ? '☀️' : '🌙';

    btn.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      if (isLight) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('ah-theme', 'dark');
        btn.textContent = '☀️';
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('ah-theme', 'light');
        btn.textContent = '🌙';
      }
    });

    cta.insertBefore(btn, cta.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();

/* --- NAVBAR SCROLL EFFECT --- */
(function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });
  // Hamburger
  const burger = document.querySelector('.nav-hamburger');
  const links  = document.querySelector('.nav-links');
  if (burger && links) {
    const cta = document.querySelector('.nav-cta');
    // Inject a cloned CTA block into the menu so users can still reach
    // "List Your Business" / "Hire an Expert" on mobile.
    if (cta && !links.querySelector('.nav-cta-mobile')) {
      const wrapper = document.createElement('li');
      wrapper.className = 'nav-cta-mobile';
      wrapper.innerHTML = cta.innerHTML;
      links.appendChild(wrapper);
    }
    const closeMenu = () => {
      links.classList.remove('open');
      burger.classList.remove('active');
      document.body.style.overflow = '';
    };
    burger.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      burger.classList.toggle('active', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    links.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && links.classList.contains('open')) closeMenu();
    });
  }
})();


/* --- SCROLL REVEAL --- */
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
})();


/* --- COUNTER ANIMATION --- */
(function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el     = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.suffix || '';
        const dur    = 1800;
        const step   = 16;
        const steps  = dur / step;
        let current  = 0;
        const inc = target / steps;
        const timer = setInterval(() => {
          current = Math.min(current + inc, target);
          el.textContent = Math.floor(current).toLocaleString() + suffix;
          if (current >= target) clearInterval(timer);
        }, step);
        obs.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => obs.observe(c));
})();


/* --- TYPEWRITER EFFECT --- */
(function initTypewriter() {
  const el = document.querySelector('[data-typewriter]');
  if (!el) return;
  const words = JSON.parse(el.dataset.typewriter);
  let wi = 0, ci = 0, deleting = false;
  function tick() {
    const word = words[wi];
    if (!deleting) {
      el.textContent = word.slice(0, ++ci);
      if (ci === word.length) { deleting = true; setTimeout(tick, 1800); return; }
    } else {
      el.textContent = word.slice(0, --ci);
      if (ci === 0) { deleting = false; wi = (wi + 1) % words.length; }
    }
    setTimeout(tick, deleting ? 60 : 100);
  }
  tick();
})();


/* --- FAQ ACCORDION --- */
(function initFaq() {
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
})();


/* --- PROFILE TABS --- */
(function initProfileTabs() {
  const tabs    = document.querySelectorAll('.profile-tab');
  const panels  = document.querySelectorAll('.tab-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.style.display = 'none');
      tab.classList.add('active');
      const panel = document.getElementById('tab-' + target);
      if (panel) panel.style.display = 'block';
    });
  });
})();


/* --- PRICING TOGGLE --- */
(function initPricingToggle() {
  const toggle  = document.querySelector('.toggle-switch');
  const monthly = document.querySelectorAll('[data-price-monthly]');
  const yearly  = document.querySelectorAll('[data-price-yearly]');
  if (!toggle) return;
  let isYearly = false;
  toggle.addEventListener('click', () => {
    isYearly = !isYearly;
    toggle.classList.toggle('active', isYearly);
    monthly.forEach(el => {
      el.textContent = isYearly ? el.dataset.priceYearly : el.dataset.priceMonthly;
    });
  });
})();


/* --- FILTER CHECKBOX CHIPS --- */
(function initCheckboxChips() {
  document.querySelectorAll('.checkbox-chip').forEach(chip => {
    const cb = chip.querySelector('input[type="checkbox"]');
    if (!cb) return;
    chip.addEventListener('click', (e) => {
      if (e.target !== cb) cb.checked = !cb.checked;
      chip.classList.toggle('checked', cb.checked);
    });
  });
})();


/* --- TOAST NOTIFICATION --- */
function showToast(msg, icon = '✅') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}


/* --- FORM SUBMIT INTERCEPT (demo) --- */
(function initForms() {
  document.querySelectorAll('form[data-demo]').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = form.dataset.demo;
      showToast(msg || 'Submitted successfully!');
      form.reset();
      document.querySelectorAll('.checkbox-chip.checked').forEach(c => c.classList.remove('checked'));
    });
  });
})();


/* --- SMOOTH SCROLL FOR ANCHOR LINKS --- */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});


/* --- STAR RATING HOVER --- */
(function initStarRating() {
  document.querySelectorAll('.star-rating-input').forEach(group => {
    const stars = group.querySelectorAll('.star');
    stars.forEach((star, i) => {
      star.addEventListener('mouseover', () => stars.forEach((s, j) => s.classList.toggle('active', j <= i)));
      star.addEventListener('click', () => { group.dataset.value = i + 1; });
      star.addEventListener('mouseleave', () => {
        const val = parseInt(group.dataset.value || 0);
        stars.forEach((s, j) => s.classList.toggle('active', j < val));
      });
    });
  });
})();


/* --- STICKY SEARCH TRANSITIONS --- */
(function initStickySearch() {
  const search = document.querySelector('.search-box');
  if (!search) return;
  const inputs = search.querySelectorAll('input, select');
  inputs.forEach(inp => {
    inp.addEventListener('focus', () => {
      search.style.borderColor = 'rgba(0,230,118,0.3)';
      search.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,230,118,0.08)';
    });
    inp.addEventListener('blur', () => {
      search.style.borderColor = '';
      search.style.boxShadow = '';
    });
  });
})();


/* --- PROGRESS BARS ANIMATE --- */
(function initProgressBars() {
  const bars = document.querySelectorAll('.progress-fill[data-width]');
  if (!bars.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.width = e.target.dataset.width;
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  bars.forEach(b => { b.style.width = '0'; obs.observe(b); });
})();
