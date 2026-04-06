// ============================================================
// AutomationHire — Local Development Server
// Serves static HTML files + mounts all /api/* routes
// Run with:  node server.js
// Opens at:  http://localhost:3000
// ============================================================

require('dotenv').config({ path: '.env.local' });

const express = require('express');
const path    = require('path');
const app     = express();
const PORT    = 3000;

// ---- Body parsing ----
// Stripe webhook needs raw body — handle before json parser
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- CORS (local dev — allow everything) ----
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ---- Mount API routes ----
// Each file exports a function(req, res) — same as Vercel serverless

const routes = [
  { path: '/api/submit-listing',        handler: './api/submit-listing'        },
  { path: '/api/request-quote',         handler: './api/request-quote'         },
  { path: '/api/get-matched',           handler: './api/get-matched'           },
  { path: '/api/newsletter',            handler: './api/newsletter'            },
  { path: '/api/providers',             handler: './api/providers'             },
  { path: '/api/auth/register',         handler: './api/auth/register'         },
  { path: '/api/stripe/create-checkout',handler: './api/stripe/create-checkout'},
  { path: '/api/stripe/webhook',        handler: './api/stripe/webhook'        },
];

routes.forEach(({ path: routePath, handler }) => {
  app.all(routePath, (req, res) => {
    try {
      const fn = require(handler);
      fn(req, res);
    } catch (e) {
      console.error(`[${routePath}] Error:`, e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
});

// ---- Serve static HTML/CSS/JS files ----
app.use(express.static(path.join(__dirname), {
  extensions: ['html'], // allows /pricing → /pricing.html
}));

// ---- Fallback: serve index.html for unknown routes ----
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---- Start ----
app.listen(PORT, () => {
  console.log('');
  console.log('  ⚡ AutomationHire running at:');
  console.log(`  → http://localhost:${PORT}`);
  console.log('');
  console.log('  Pages:');
  console.log(`  → http://localhost:${PORT}/                    Homepage`);
  console.log(`  → http://localhost:${PORT}/providers           Directory`);
  console.log(`  → http://localhost:${PORT}/provider-profile    Profile`);
  console.log(`  → http://localhost:${PORT}/submit-listing      List Your Business`);
  console.log(`  → http://localhost:${PORT}/request-quote       Get Matched`);
  console.log(`  → http://localhost:${PORT}/pricing             Pricing`);
  console.log(`  → http://localhost:${PORT}/dashboard           Dashboard`);
  console.log(`  → http://localhost:${PORT}/blog                Blog`);
  console.log(`  → http://localhost:${PORT}/book                Book a Call`);
  console.log('');
  console.log('  API routes: /api/providers  /api/submit-listing  /api/get-matched ...');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
