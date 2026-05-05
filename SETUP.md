# AutomationHire.co.uk — Setup & Deployment Guide

## Stack
- **Frontend**: Static HTML/CSS/JS (this folder)
- **Backend**: Vercel Serverless Functions (`/api/`)
- **Database**: Supabase (PostgreSQL + Auth)
- **Payments**: Stripe Subscriptions
- **Email**: Resend

---

## Step 1 — Supabase Setup

1. Go to https://supabase.com → New Project
2. Name: `automationhire` | Region: **EU West (London)**
3. Once created, go to **SQL Editor** → **New Query**
4. Paste the entire contents of `supabase/schema.sql` and click **Run**
5. Go to **Project Settings → API** and copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon / public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2 — Resend Setup

1. Go to https://resend.com → Sign Up
2. **Domains** → Add Domain → Enter `automationhire.co.uk`
3. Add the DNS records shown (MX, TXT, DKIM) to your domain registrar
4. Wait for verification (usually < 30 min)
5. **API Keys** → Create API Key → Copy → `RESEND_API_KEY`

---

## Step 3 — Stripe Setup

1. Go to https://dashboard.stripe.com → Activate account
2. **Products** → Create Product: "AutomationHire Listing"
3. Add 8 prices (monthly + yearly for each plan):

   | Plan    | Monthly | Yearly |
   |---------|---------|--------|
   | Growth  | £79/mo  | £55/mo |
   | Pro     | £149/mo | £104/mo |
   | Agency  | £299/mo | £209/mo |

4. Copy each Price ID (starts with `price_...`) into `.env.local`
5. **Developers → API Keys** → copy `sk_live_...` and `pk_live_...`
6. **Webhooks** → Add endpoint:
   - URL: `https://automationhire.co.uk/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `invoice.payment_failed`
   - Copy the **Signing Secret** → `STRIPE_WEBHOOK_SECRET`

---

## Step 4 — Vercel Deployment

1. Install Vercel CLI: `npm install -g vercel`
2. In this folder: `npm install`
3. Copy `.env.example` to `.env.local` and fill in all values
4. Run `vercel` → follow prompts → connect to your GitHub repo
5. In **Vercel Dashboard → Settings → Environment Variables**:
   - Add every variable from `.env.example` with real values
   - Set for: **Production**, **Preview**, **Development**
6. Run `vercel --prod` to deploy

### Custom Domain
In Vercel Dashboard → Domains → Add `automationhire.co.uk`
Update your DNS: add the CNAME/A records Vercel provides.

---

## Step 5 — Update Frontend Config

In `assets/js/api.js`, update the CONFIG object:

```js
const CONFIG = {
  supabaseUrl:     'https://YOUR_PROJECT_REF.supabase.co',
  supabaseAnon:    'YOUR_ANON_KEY',
  stripePublicKey: 'pk_live_...',
  apiBase:         '',  // empty = same origin on Vercel
};
```

Or, add a `<script>` block in each HTML page's `<head>` to inject these:

```html
<script>
  window.__ENV = {
    SUPABASE_URL:  'https://xyz.supabase.co',
    SUPABASE_ANON: 'your_anon_key',
    STRIPE_PK:     'pk_live_...',
  };
</script>
```

---

## File Structure

```
automationhire/
├── index.html              Homepage
├── providers.html          Directory listing (API-driven)
├── provider-profile.html   Provider profile page
├── submit-listing.html     Provider signup form
├── request-quote.html      Client "Get Matched" form
├── pricing.html            Pricing / Stripe checkout
├── dashboard.html          Provider dashboard
├── blog.html               Blog index
├── categories.html         Category browser
│
├── assets/
│   ├── css/style.css       All styles
│   ├── js/main.js          UI effects, particles, tabs
│   └── js/api.js           API client (forms → /api/*)
│
├── api/
│   ├── _lib.js             Shared utilities (Supabase, Resend, emails)
│   ├── submit-listing.js   POST: new provider signup
│   ├── request-quote.js    POST: direct quote to provider
│   ├── get-matched.js      POST: match client to 5 providers
│   ├── newsletter.js       POST: email subscribe
│   ├── providers.js        GET:  directory listings (filtered)
│   ├── auth/
│   │   └── register.js     POST: provider login
│   └── stripe/
│       ├── create-checkout.js  POST: Stripe checkout session
│       └── webhook.js          POST: Stripe event handler
│
├── supabase/
│   └── schema.sql          Full DB schema (run in Supabase SQL Editor)
│
├── vercel.json             Vercel routing config
├── package.json            Node dependencies
├── .env.example            All required env vars (copy to .env.local)
└── SETUP.md                This file
```

---

## Local Development

```bash
npm install
cp .env.example .env.local
# fill in .env.local with your keys
vercel dev
# Opens http://localhost:3000
```

---

## Supabase RLS Note

All API routes use the **service role key** (bypasses RLS).
The frontend JS uses only the **anon key** (respects RLS).
Never expose the service role key in frontend code.
