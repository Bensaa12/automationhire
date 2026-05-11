/* ============================================================
   AutomationHire.co.uk — Frontend API Client
   Connects all forms to Vercel serverless API routes.
   Supabase public key for client-side reads.
   ============================================================ */

'use strict';

// --- CONFIG ---
// These are PUBLIC keys — safe to expose in frontend JS.
// Set them to your actual values after Supabase + Stripe setup.
const CONFIG = {
  supabaseUrl:    window.__ENV?.SUPABASE_URL    || 'https://lywcjlhfpucohuaxthem.supabase.co',
  supabaseAnon:   window.__ENV?.SUPABASE_ANON   || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d2NqbGhmcHVjb2h1YXh0aGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDMxMDIsImV4cCI6MjA5MDk3OTEwMn0.SYzs_uWk2A-aSyVCAsKJZldFbeZHwOCi75i_S5LSlVg',
  stripePublicKey: window.__ENV?.STRIPE_PK      || 'pk_live_...',
  apiBase:        '',  // empty = same origin (Vercel serverless functions at /api/...)
};


/* ============================================================
   API HELPERS
   ============================================================ */

async function apiPost(endpoint, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${CONFIG.apiBase}/api/${endpoint}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function apiGet(endpoint, params = {}) {
  const headers = {};
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const qs  = new URLSearchParams(params).toString();
  const url = `${CONFIG.apiBase}/api/${endpoint}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}


/* ============================================================
   AUTH — session management
   ============================================================ */

const Auth = {
  KEYS: ['ah_access_token','ah_refresh_token','ah_token_expires','ah_provider_id','ah_provider_slug','ah_plan','ah_provider_name'],

  getToken()    { return localStorage.getItem('ah_access_token'); },

  getProvider() {
    const id = localStorage.getItem('ah_provider_id');
    if (!id) return null;
    return {
      id,
      slug: localStorage.getItem('ah_provider_slug') || '',
      plan: localStorage.getItem('ah_plan') || 'free',
      name: localStorage.getItem('ah_provider_name') || '',
    };
  },

  save(result) {
    if (result.access_token)  localStorage.setItem('ah_access_token',  result.access_token);
    if (result.refresh_token) localStorage.setItem('ah_refresh_token', result.refresh_token);
    if (result.expires_in)    localStorage.setItem('ah_token_expires', String(Date.now() + result.expires_in * 1000));
    if (result.provider?.id) {
      localStorage.setItem('ah_provider_id',   result.provider.id);
      localStorage.setItem('ah_provider_slug', result.provider.slug         || '');
      localStorage.setItem('ah_plan',          result.provider.plan         || 'free');
      localStorage.setItem('ah_provider_name', result.provider.business_name || '');
    }
  },

  clear() { this.KEYS.forEach(k => localStorage.removeItem(k)); },

  logout() {
    this.clear();
    window.location.href = 'login.html';
  },

  isLoggedIn() { return !!this.getToken(); },

  async refresh() {
    const refreshToken = localStorage.getItem('ah_refresh_token');
    if (!refreshToken) return false;
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.access_token)  localStorage.setItem('ah_access_token',  data.access_token);
      if (data.refresh_token) localStorage.setItem('ah_refresh_token', data.refresh_token);
      if (data.expires_in)    localStorage.setItem('ah_token_expires', String(Date.now() + data.expires_in * 1000));
      return true;
    } catch { return false; }
  },

  async requireAuth() {
    if (!this.getToken()) {
      window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return false;
    }
    const expires = parseInt(localStorage.getItem('ah_token_expires') || '0');
    if (expires && Date.now() > expires - 60000) {
      const ok = await this.refresh();
      if (!ok) { this.logout(); return false; }
    }
    return true;
  },
};


/* ============================================================
   TOAST NOTIFICATION (re-used from main.js if loaded)
   ============================================================ */

function toast(msg, icon = '✅', isError = false) {
  if (typeof showToast === 'function') {
    showToast(msg, isError ? '❌' : icon);
    return;
  }
  // Fallback
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.innerHTML = `<span class="toast-icon">${isError ? '❌' : icon}</span><span>${msg}</span>`;
  el.style.cssText = `
    position:fixed;bottom:24px;right:24px;background:${isError?'#1a0a0a':'#0d1117'};
    border:1px solid ${isError?'rgba(239,68,68,0.3)':'rgba(0,230,118,0.3)'};
    border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:10px;
    font-size:14px;z-index:9999;font-family:Inter,sans-serif;color:#fff;
    box-shadow:0 8px 30px rgba(0,0,0,.5);
    transform:translateY(0);opacity:1;transition:all .3s;
  `;
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateY(60px)'; }, 3500);
}

function setButtonLoading(btn, loading, originalText) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = '<span style="display:inline-block;animation:spin .8s linear infinite">⟳</span> &nbsp;Processing...';
  } else {
    btn.textContent = originalText || btn.dataset.originalText || 'Submit';
  }
}


/* ============================================================
   FORM: SUBMIT LISTING  (submit-listing.html)
   ============================================================ */

function initSubmitListingForm() {
  const form = document.getElementById('submit-listing-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    setButtonLoading(btn, true);

    try {
      // Collect checkbox arrays
      const getChecked = (name) =>
        [...form.querySelectorAll(`input[data-group="${name}"]:checked`)].map(el => el.value);

      const payload = {
        contact_name:       form.querySelector('[name="contact_name"]')?.value?.trim(),
        email:              form.querySelector('[name="email"]')?.value?.trim(),
        password:           form.querySelector('[name="password"]')?.value,
        business_name:      form.querySelector('[name="business_name"]')?.value?.trim(),
        provider_type:      form.querySelector('[name="provider_type"]')?.value,
        description:        form.querySelector('[name="description"]')?.value?.trim(),
        website_url:        form.querySelector('[name="website_url"]')?.value?.trim(),
        linkedin_url:       form.querySelector('[name="linkedin_url"]')?.value?.trim(),
        location_city:      form.querySelector('[name="location_city"]')?.value?.trim(),
        location_country:   form.querySelector('[name="location_country"]')?.value,
        remote_work:        form.querySelector('[name="remote_work"]')?.value !== 'On-site only',
        team_size:          form.querySelector('[name="team_size"]')?.value,
        years_experience:   form.querySelector('[name="years_experience"]')?.value,
        hourly_rate:        form.querySelector('[name="hourly_rate"]')?.value,
        min_project_budget: form.querySelector('[name="min_project_budget"]')?.value,
        categories:         getChecked('categories'),
        tools:              getChecked('tools'),
        industries:         getChecked('industries'),
      };

      const result = await apiPost('submit-listing', payload);

      // Auto-login with tokens returned from registration
      Auth.save(result);

      toast(result.message || 'Listing submitted! Under review within 24 hours.', '🎉');
      form.reset();

      setTimeout(() => {
        window.location.href = `dashboard.html?new=true&slug=${result.provider?.slug || ''}`;
      }, 2000);

    } catch (e) {
      toast(e.message || 'Submission failed. Please try again.', '❌', true);
    } finally {
      setButtonLoading(btn, false);
    }
  });
}


/* ============================================================
   FORM: QUOTE REQUEST  (provider-profile.html)
   ============================================================ */

function initQuoteForm() {
  const form = document.getElementById('quote-request-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    setButtonLoading(btn, true);

    try {
      // Get provider slug from URL or data attribute
      const providerSlug = form.dataset.providerSlug ||
        new URLSearchParams(window.location.search).get('slug') ||
        document.querySelector('[data-provider-slug]')?.dataset.providerSlug;

      const payload = {
        provider_slug:   providerSlug,
        automation_type: form.querySelector('[name="automation_type"]')?.value,
        description:     form.querySelector('[name="description"]')?.value?.trim(),
        budget:          form.querySelector('[name="budget"]')?.value,
        client_name:     form.querySelector('[name="client_name"]')?.value?.trim(),
        client_email:    form.querySelector('[name="client_email"]')?.value?.trim(),
        client_company:  form.querySelector('[name="client_company"]')?.value?.trim(),
        source_page:     window.location.pathname,
      };

      const result = await apiPost('request-quote', payload);
      toast(result.message || 'Quote request sent!', '⚡');
      form.reset();

    } catch (e) {
      toast(e.message || 'Failed to send request.', '❌', true);
    } finally {
      setButtonLoading(btn, false);
    }
  });
}


/* ============================================================
   FORM: GET MATCHED  (request-quote.html)
   ============================================================ */

function initGetMatchedForm() {
  const form = document.getElementById('get-matched-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    setButtonLoading(btn, true);

    try {
      const payload = {
        automation_type:  form.querySelector('[name="automation_type"]')?.value,
        description:      form.querySelector('[name="description"]')?.value?.trim(),
        budget:           form.querySelector('[name="budget"]')?.value,
        timeline:         form.querySelector('[name="timeline"]')?.value,
        tools_mentioned:  form.querySelector('[name="tools_mentioned"]')?.value?.trim(),
        client_name:      form.querySelector('[name="client_name"]')?.value?.trim(),
        client_email:     form.querySelector('[name="client_email"]')?.value?.trim(),
        client_company:   form.querySelector('[name="client_company"]')?.value?.trim(),
      };

      const result = await apiPost('get-matched', payload);

      // Replace form with success state
      const successHtml = `
        <div style="text-align:center;padding:40px 0">
          <div style="font-size:52px;margin-bottom:16px">🎉</div>
          <h3 style="font-family:var(--font-head);font-size:24px;font-weight:700;margin-bottom:12px">
            You've been matched with ${result.match_count} expert${result.match_count !== 1 ? 's' : ''}!
          </h3>
          <p style="font-size:15px;color:var(--white-60);line-height:1.7;max-width:400px;margin:0 auto 28px">
            Check your inbox — each matched provider will contact you directly within 4 hours.
          </p>
          <a href="providers.html" class="btn btn-primary btn-lg">Browse More Experts →</a>
        </div>
      `;
      form.closest('.form-card').innerHTML = successHtml;

    } catch (e) {
      toast(e.message || 'Matching failed. Please try again.', '❌', true);
    } finally {
      setButtonLoading(btn, false);
    }
  });
}


/* ============================================================
   FORM: NEWSLETTER  (homepage, blog)
   ============================================================ */

function initNewsletterForms() {
  document.querySelectorAll('form[data-newsletter]').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn   = form.querySelector('button[type="submit"]');
      const input = form.querySelector('input[type="email"]');
      if (!input?.value?.trim()) return;

      setButtonLoading(btn, true);

      try {
        const result = await apiPost('newsletter', {
          email:  input.value.trim(),
          source: form.dataset.newsletter || 'website',
        });
        toast(result.message || 'Subscribed!', '🎉');
        form.reset();
      } catch (e) {
        toast(e.message || 'Subscription failed.', '❌', true);
      } finally {
        setButtonLoading(btn, false);
      }
    });
  });
}


/* ============================================================
   DIRECTORY: Load providers via API  (providers.html)
   ============================================================ */

function initDirectoryPage() {
  const grid = document.getElementById('providers-api-grid');
  if (!grid) return;

  const state = {
    page:     1,
    loading:  false,
    filters:  {},
    total:    0,
  };

  async function loadProviders(reset = false) {
    if (state.loading) return;
    state.loading = true;

    if (reset) {
      state.page = 1;
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--white-60)"><span style="font-size:32px;display:block;margin-bottom:12px;animation:spin .8s linear infinite">⟳</span>Loading providers...</div>';
    }

    const params = { page: state.page, limit: 12, ...state.filters };
    // Remove empty params
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });

    try {
      const { providers, total, total_pages } = await apiGet('providers', params);

      document.getElementById('result-count-num')?.setAttribute('data-total', total);
      const countEl = document.getElementById('result-count-num');
      if (countEl) countEl.textContent = total.toLocaleString();

      state.total = total;

      if (reset) grid.innerHTML = '';

      if (providers.length === 0 && reset) {
        grid.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--white-60)">
            <div style="font-size:48px;margin-bottom:16px">🔍</div>
            <h3 style="font-family:var(--font-head);font-size:20px;color:#fff;margin-bottom:8px">No providers found</h3>
            <p>Try adjusting your filters or <a href="request-quote.html" style="color:var(--green)">get matched instead</a>.</p>
          </div>`;
        state.loading = false;
        return;
      }

      providers.forEach(p => {
        const card = buildProviderCard(p);
        grid.insertAdjacentHTML('beforeend', card);
      });

      // Load more button
      const loadMoreBtn = document.getElementById('load-more-btn');
      if (loadMoreBtn) {
        loadMoreBtn.style.display = state.page < total_pages ? 'inline-flex' : 'none';
      }

    } catch (e) {
      console.error('Failed to load providers:', e);
      if (reset) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--white-60)">Failed to load providers. <button onclick="location.reload()" style="color:var(--green);background:none;border:none;cursor:pointer;text-decoration:underline">Retry</button></div>`;
      }
    } finally {
      state.loading = false;
    }
  }

  function buildProviderCard(p) {
    const stars     = '★'.repeat(Math.round(p.rating_avg || 0)) + '☆'.repeat(5 - Math.round(p.rating_avg || 0));
    const rateStr   = p.hourly_rate_min ? `From <span>£${p.hourly_rate_min}</span>/hr` : 'Rate on request';
    const location  = [p.location_city, p.location_country === 'United Kingdom' ? 'UK' : p.location_country].filter(Boolean).join(', ');
    const tags      = [...(p.tools || []).slice(0, 3), ...(p.categories || []).slice(0, 2)]
      .slice(0, 4)
      .map(t => `<span class="tag tag-${Math.random() > 0.5 ? 'green' : 'blue'}">${t}</span>`)
      .join('');

    return `
      <div class="provider-card${p.is_featured ? ' featured' : ''}">
        ${p.is_featured ? '<span class="featured-label">⭐ Featured</span>' : ''}
        <div class="card-header">
          <div class="card-avatar" style="background:linear-gradient(135deg,var(--blue),var(--green))">${p.avatar_emoji || '🚀'}</div>
          <div class="card-info">
            <div class="card-name">${escHtml(p.business_name)}</div>
            <div class="card-type">${capitalize(p.provider_type || 'Provider')} · ${escHtml(location || 'Remote')}</div>
          </div>
        </div>
        <div class="card-rating">
          <span class="stars">${stars}</span>
          <strong>${(p.rating_avg || 0).toFixed(1)}</strong>
          <span class="text-muted">(${p.review_count || 0} reviews)</span>
          ${p.is_verified ? '<span class="verified-badge" style="margin-left:auto">✓ Verified</span>' : ''}
        </div>
        <div class="card-tags">${tags}</div>
        <div class="card-footer">
          <div class="card-price">${rateStr}</div>
          <a href="provider-profile.html?slug=${p.slug}" class="btn btn-primary btn-sm">View Profile</a>
        </div>
      </div>
    `;
  }

  // ---- Filter listeners ----
  function attachFilterListeners() {
    document.querySelectorAll('[data-filter]').forEach(el => {
      el.addEventListener('change', () => {
        state.filters[el.dataset.filter] = el.type === 'checkbox' ? (el.checked ? el.value : '') : el.value;
        loadProviders(true);
      });
    });

    const searchInput = document.getElementById('provider-search');
    if (searchInput) {
      let searchTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          state.filters.search = searchInput.value.trim();
          loadProviders(true);
        }, 400);
      });
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        state.filters.sort = sortSelect.value;
        loadProviders(true);
      });
    }

    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        state.page++;
        loadProviders(false);
      });
    }

    // Clear All button
    document.querySelectorAll('.filter-sidebar button').forEach(btn => {
      if (btn.textContent.trim() === 'Clear All') {
        btn.addEventListener('click', () => {
          // Uncheck all checkboxes in the sidebar
          document.querySelectorAll('.filter-sidebar input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
          });
          // Reset range slider to max
          const rateSlider = document.getElementById('rate-slider');
          if (rateSlider) {
            rateSlider.value = rateSlider.max;
            rateSlider.dispatchEvent(new Event('input'));
          }
          // Clear search input
          const searchInput = document.getElementById('provider-search');
          if (searchInput) searchInput.value = '';
          // Reset sort select
          const sortSelect = document.getElementById('sort-select');
          if (sortSelect) sortSelect.value = sortSelect.options[0]?.value || '';
          // Reset state and reload
          state.filters = {};
          loadProviders(true);
        });
      }
    });
  }

  attachFilterListeners();
  loadProviders(true);
}


/* ============================================================
   STRIPE: Upgrade plan button  (pricing.html, dashboard.html)
   ============================================================ */

function initUpgradeButtons() {
  document.querySelectorAll('[data-upgrade-plan]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const plan    = btn.dataset.upgradePlan;
      const billing = document.querySelector('.toggle-switch')?.classList.contains('active') ? 'yearly' : 'monthly';

      const provider = Auth.getProvider();
      if (!provider?.id) {
        toast('Please log in to upgrade your plan.', '🔒', true);
        setTimeout(() => { window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname)}`; }, 1500);
        return;
      }
      const providerId = provider.id;

      setButtonLoading(btn, true);

      try {
        const result = await apiPost('stripe/create-checkout', {
          plan,
          billing,
          provider_id: providerId,
        });

        if (result.checkout_url) {
          window.location.href = result.checkout_url;
        }
      } catch (e) {
        toast(e.message || 'Failed to start checkout.', '❌', true);
        setButtonLoading(btn, false);
      }
    });
  });
}


/* ============================================================
   AUTH: Simple login handler
   ============================================================ */

function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    setButtonLoading(btn, true);

    try {
      const result = await apiPost('auth/login', {
        email:    form.querySelector('[name="email"]')?.value?.trim(),
        password: form.querySelector('[name="password"]')?.value,
      });

      Auth.save(result);

      toast('Welcome back! Redirecting...', '✅');
      const next = new URLSearchParams(window.location.search).get('next');
      setTimeout(() => { window.location.href = next || 'dashboard.html'; }, 800);

    } catch (e) {
      toast(e.message || 'Login failed.', '❌', true);
      setButtonLoading(btn, false);
    }
  });
}


/* ============================================================
   UTILS
   ============================================================ */

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// Add CSS keyframe for spinner
const spinStyle = document.createElement('style');
spinStyle.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
document.head.appendChild(spinStyle);

// Show upgrade success toast from Stripe redirect
if (new URLSearchParams(window.location.search).get('upgraded') === 'true') {
  const plan = new URLSearchParams(window.location.search).get('plan') || '';
  toast(`🎉 You're now on the ${plan.charAt(0).toUpperCase()+plan.slice(1)} plan! Your profile is being updated.`, '🎉');
}


/* ============================================================
   INIT — run all initializers on DOMContentLoaded
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initSubmitListingForm();
  initQuoteForm();
  initGetMatchedForm();
  initNewsletterForms();
  initDirectoryPage();
  initUpgradeButtons();
  initLoginForm();
});
