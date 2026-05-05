-- ============================================================
-- AutomationHire.co.uk — Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text search

-- ============================================================
-- PROVIDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS providers (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  business_name         TEXT NOT NULL,
  slug                  TEXT UNIQUE NOT NULL,
  provider_type         TEXT CHECK (provider_type IN ('agency','freelancer','consultant')),
  tagline               TEXT,
  description           TEXT,
  avatar_emoji          TEXT DEFAULT '🚀',

  -- Contact & Links
  website_url           TEXT,
  linkedin_url          TEXT,
  github_url            TEXT,
  video_intro_url       TEXT,
  contact_email         TEXT,
  phone                 TEXT,

  -- Location
  location_city         TEXT,
  location_country      TEXT DEFAULT 'United Kingdom',
  timezone              TEXT DEFAULT 'Europe/London',
  remote_work           BOOLEAN DEFAULT TRUE,
  remote_scope          TEXT DEFAULT 'worldwide',

  -- Pricing
  hourly_rate_min       INTEGER,
  hourly_rate_max       INTEGER,
  min_project_budget    TEXT,
  pricing_model         TEXT[] DEFAULT '{}',

  -- Skills
  categories            TEXT[] DEFAULT '{}',
  tools                 TEXT[] DEFAULT '{}',
  industries            TEXT[] DEFAULT '{}',
  languages             TEXT[] DEFAULT '{"English"}',
  team_size             TEXT,
  years_experience      TEXT,

  -- Certifications (JSON array of {name, issuer, year, verified})
  certifications        JSONB DEFAULT '[]',

  -- Subscription / Plan
  plan                  TEXT DEFAULT 'free' CHECK (plan IN ('free','growth','pro','agency')),
  plan_expires_at       TIMESTAMPTZ,
  stripe_customer_id    TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id       TEXT,

  -- Status
  is_verified           BOOLEAN DEFAULT FALSE,
  is_featured           BOOLEAN DEFAULT FALSE,
  is_active             BOOLEAN DEFAULT TRUE,
  is_approved           BOOLEAN DEFAULT FALSE,
  submitted_at          TIMESTAMPTZ,
  approved_at           TIMESTAMPTZ,

  -- Analytics (denormalised for speed)
  profile_views         INTEGER DEFAULT 0,
  lead_count            INTEGER DEFAULT 0,
  rating_avg            NUMERIC(3,2) DEFAULT 0.00,
  review_count          INTEGER DEFAULT 0,
  response_time_hrs     INTEGER DEFAULT 24,

  -- Timestamps
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_providers_slug         ON providers(slug);
CREATE INDEX idx_providers_plan         ON providers(plan);
CREATE INDEX idx_providers_is_featured  ON providers(is_featured);
CREATE INDEX idx_providers_is_active    ON providers(is_active);
CREATE INDEX idx_providers_categories   ON providers USING GIN(categories);
CREATE INDEX idx_providers_tools        ON providers USING GIN(tools);
CREATE INDEX idx_providers_industries   ON providers USING GIN(industries);
CREATE INDEX idx_providers_country      ON providers(location_country);
CREATE INDEX idx_providers_city         ON providers(location_city);
CREATE INDEX idx_providers_rating       ON providers(rating_avg DESC);
CREATE INDEX idx_providers_search       ON providers USING GIN(
  to_tsvector('english', coalesce(business_name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(tagline,''))
);

-- ============================================================
-- PORTFOLIO / CASE STUDIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS portfolio_items (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  provider_id     UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  industry        TEXT,
  problem         TEXT,
  solution        TEXT,
  results_summary TEXT,
  tools_used      TEXT[] DEFAULT '{}',
  metrics         JSONB DEFAULT '[]',  -- [{label, value}]
  image_url       TEXT,
  video_url       TEXT,
  is_featured     BOOLEAN DEFAULT FALSE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portfolio_provider ON portfolio_items(provider_id);

-- ============================================================
-- REVIEWS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  provider_id     UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  reviewer_name   TEXT NOT NULL,
  reviewer_email  TEXT,
  reviewer_company TEXT,
  reviewer_role   TEXT,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body            TEXT NOT NULL,
  is_verified     BOOLEAN DEFAULT FALSE,
  is_approved     BOOLEAN DEFAULT FALSE,
  provider_reply  TEXT,
  helpful_count   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_provider    ON reviews(provider_id);
CREATE INDEX idx_reviews_approved    ON reviews(is_approved);

-- ============================================================
-- LEADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  provider_id       UUID REFERENCES providers(id) ON DELETE SET NULL,
  is_matched_lead   BOOLEAN DEFAULT FALSE,  -- TRUE = from "Get Matched" form

  -- Project details
  automation_type   TEXT,
  description       TEXT NOT NULL,
  budget            TEXT,
  timeline          TEXT,
  tools_mentioned   TEXT,
  industry          TEXT,

  -- Client info
  client_name       TEXT NOT NULL,
  client_email      TEXT NOT NULL,
  client_company    TEXT,
  client_phone      TEXT,

  -- Status lifecycle
  status            TEXT DEFAULT 'new'
                    CHECK (status IN ('new','viewed','contacted','quoted','won','lost','spam')),
  viewed_at         TIMESTAMPTZ,
  contacted_at      TIMESTAMPTZ,

  -- Metadata
  source_page       TEXT,  -- which page the lead came from
  ip_address        INET,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_provider     ON leads(provider_id);
CREATE INDEX idx_leads_status       ON leads(status);
CREATE INDEX idx_leads_created      ON leads(created_at DESC);
CREATE INDEX idx_leads_email        ON leads(client_email);

-- ============================================================
-- NEWSLETTER SUBSCRIBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  is_active    BOOLEAN DEFAULT TRUE,
  source       TEXT DEFAULT 'website',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX idx_newsletter_email  ON newsletter_subscribers(email);
CREATE INDEX idx_newsletter_active ON newsletter_subscribers(is_active);

-- ============================================================
-- STRIPE EVENTS LOG (webhook idempotency)
-- ============================================================
CREATE TABLE IF NOT EXISTS stripe_events (
  id            TEXT PRIMARY KEY,  -- Stripe event ID
  type          TEXT NOT NULL,
  processed_at  TIMESTAMPTZ DEFAULT NOW(),
  payload       JSONB
);

-- ============================================================
-- PROFILE VIEW TRACKING
-- ============================================================
CREATE TABLE IF NOT EXISTS profile_views (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  provider_id   UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  visitor_ip    INET,
  referrer      TEXT,
  user_agent    TEXT,
  viewed_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_views_provider ON profile_views(provider_id);
CREATE INDEX idx_views_date     ON profile_views(viewed_at DESC);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at on providers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Recalculate provider rating avg when review is inserted/updated
CREATE OR REPLACE FUNCTION recalculate_provider_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE providers
  SET
    rating_avg   = (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM reviews WHERE provider_id = NEW.provider_id AND is_approved = TRUE),
    review_count = (SELECT COUNT(*) FROM reviews WHERE provider_id = NEW.provider_id AND is_approved = TRUE)
  WHERE id = NEW.provider_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_rating_sync
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION recalculate_provider_rating();

-- Auto-generate slug from business_name
CREATE OR REPLACE FUNCTION generate_slug(name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  base_slug := LOWER(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := REGEXP_REPLACE(base_slug, '\s+', '-', 'g');
  base_slug := REGEXP_REPLACE(base_slug, '-+', '-', 'g');
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM providers WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Increment profile view count
CREATE OR REPLACE FUNCTION increment_profile_views(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE providers SET profile_views = profile_views + 1 WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE providers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews            ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_views      ENABLE ROW LEVEL SECURITY;

-- PROVIDERS: anyone can read approved+active; only owner can write
CREATE POLICY "providers_public_read" ON providers
  FOR SELECT USING (is_active = TRUE AND is_approved = TRUE);

CREATE POLICY "providers_owner_write" ON providers
  FOR ALL USING (auth.uid() = user_id);

-- Service role bypasses RLS (used in API routes)
CREATE POLICY "providers_service_all" ON providers
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- PORTFOLIO: public read, owner write
CREATE POLICY "portfolio_public_read" ON portfolio_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM providers p WHERE p.id = provider_id AND p.is_active AND p.is_approved)
  );
CREATE POLICY "portfolio_owner_write" ON portfolio_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM providers p WHERE p.id = provider_id AND p.user_id = auth.uid())
  );
CREATE POLICY "portfolio_service_all" ON portfolio_items
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- REVIEWS: approved reviews are public; service role full access
CREATE POLICY "reviews_public_read" ON reviews
  FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "reviews_service_all" ON reviews
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- LEADS: provider can read their own leads; service role full access
CREATE POLICY "leads_owner_read" ON leads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM providers p WHERE p.id = provider_id AND p.user_id = auth.uid())
  );
CREATE POLICY "leads_service_all" ON leads
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- NEWSLETTER: service role only
CREATE POLICY "newsletter_service_all" ON newsletter_subscribers
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- PROFILE VIEWS: service role only
CREATE POLICY "views_service_all" ON profile_views
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- SEED: PLAN PRICING REFERENCE (static config)
-- ============================================================
CREATE TABLE IF NOT EXISTS plans (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  price_monthly   INTEGER NOT NULL,  -- pence (GBP)
  price_yearly    INTEGER NOT NULL,
  stripe_price_monthly TEXT,
  stripe_price_yearly  TEXT,
  max_leads       INTEGER,           -- NULL = unlimited
  max_categories  INTEGER,
  max_portfolio   INTEGER,
  features        JSONB DEFAULT '[]'
);

INSERT INTO plans VALUES
  ('free',    'Free',    0,     0,     NULL, NULL, 0,  1,  0,  '["Basic listing","Appear in search"]'),
  ('growth',  'Growth',  7900,  55300, NULL, NULL, 20, 5,  3,  '["Verified badge","20 leads/mo","Featured in category"]'),
  ('pro',     'Pro',     14900, 104300,NULL, NULL, NULL,NULL,NULL,'["Everything","Unlimited leads","Homepage featured"]'),
  ('agency',  'Agency',  29900, 209300,NULL, NULL, NULL,NULL,NULL,'["10 profiles","White-label","API access"]')
ON CONFLICT (id) DO NOTHING;
