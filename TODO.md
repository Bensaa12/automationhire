# AutomationHire — TODO List

## 🔧 Blog Agent Setup (do before using /admin)

- [ ] **Supabase** — run SQL to create `blog_posts` table:
  ```sql
  CREATE TABLE blog_posts (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title            TEXT NOT NULL,
    slug             TEXT NOT NULL UNIQUE,
    meta_description TEXT,
    excerpt          TEXT,
    content          TEXT,
    keywords         TEXT[] DEFAULT '{}',
    reading_time     INTEGER DEFAULT 5,
    word_count       INTEGER DEFAULT 0,
    status           TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
    published_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "public_read_published" ON blog_posts FOR SELECT USING (status = 'published');
  ```

- [ ] **Vercel env vars** — add these in Vercel → Project → Settings → Environment Variables:
  | Key | Value |
  |-----|-------|
  | `ANTHROPIC_API_KEY` | Get from console.anthropic.com |
  | `TAVILY_API_KEY` | `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` |
  | `ADMIN_EMAIL` | `bensaa123@gmail.com` |

- [ ] **Redeploy** on Vercel after adding env vars

---

## 🤖 Agent Dashboard — Phases Remaining

- [ ] **Phase 2 — Social Posts**: generate LinkedIn + X copy from blog posts
- [ ] **Phase 3 — SEO Brief**: weekly keyword research and competitor gap analysis
- [ ] **Phase 4 — Analytics**: Vercel Analytics integration panel

---

## 🎙️ Sharon Voice Agent

- [ ] **Add credit card to Fly.io** (fly.io/dashboard/billing) — machine stops every 5 min on trial plan

---

## 💳 Stripe

- [ ] Verify Stripe checkout flow works end-to-end after the tax ID fixes
