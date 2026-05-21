# PartForge — Architecture Document

> Version: 1.0 | Date: 2026-05-19 | Status: Draft

PartForge is a SaaS product built on top of **Articraft**, the open-source agentic 3D geometry generation system (CadQuery / OpenCascade). Users upload a photo and a text description of a real engineering component; PartForge returns production-grade CAD files (STEP, OBJ, STL, URDF, Plant 3D .pcat) in under five minutes.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Frontend](#2-frontend)
3. [Backend API](#3-backend-api)
4. [Database Schema](#4-database-schema)
5. [Job Queue](#5-job-queue)
6. [Generation Pipeline](#6-generation-pipeline)
7. [Auth](#7-auth)
8. [Payments](#8-payments)
9. [Storage](#9-storage)
10. [Cost Model](#10-cost-model)
11. [Deployment](#11-deployment)
12. [Development Phases](#12-development-phases)
13. [Environment Variables](#13-environment-variables)
14. [Security](#14-security)

---

## 1. System Overview

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│  automationhire.co.uk/forge  (Vercel CDN — static HTML/JS/CSS)           │
│                                                                           │
│   ┌──────────────┐   fetch()   ┌──────────────────────────────────────┐  │
│   │  Forge Page  │ ──────────> │  PartForge API  (Fly.io, api VM)     │  │
│   │  (Three.js)  │ <────────── │  FastAPI / Python 3.12               │  │
│   └──────────────┘  JSON/SSE  └────────┬────────────┬─────────────────┘  │
└────────────────────────────────────────│────────────│────────────────────┘
                                         │            │
                          enqueue job    │            │  auth checks / RLS
                                         ▼            ▼
                              ┌─────────────┐  ┌────────────────────┐
                              │  Redis      │  │  Supabase          │
                              │  (Upstash)  │  │  PostgreSQL + Auth  │
                              │  RQ queue   │  │  + Storage buckets │
                              └──────┬──────┘  └────────────────────┘
                                     │ dequeue                  ▲
                                     ▼                          │ upload files
                           ┌──────────────────────┐            │
                           │  Worker VM (Fly.io)  │ ───────────┘
                           │  RQ worker process   │
                           │                      │
                           │  1. Claude Vision    │
                           │     (image→desc)     │
                           │  2. Articraft CLI    │
                           │     external init    │
                           │  3. Write model.py   │
                           │  4. external check   │
                           │     (retry ≤5)       │
                           │  5. external         │
                           │     finalize         │
                           │  6. Export STEP      │
                           │  7. Convert formats  │
                           │  8. Upload → Storage │
                           └──────────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │  Supabase Storage   │
                          │  bucket: job-outputs│
                          │  STEP/OBJ/STL/URDF  │
                          │  .pcat (Pro only)   │
                          └─────────────────────┘
```

### Component Responsibilities

| Component | Technology | Responsibility |
|---|---|---|
| Frontend | Vanilla JS + Three.js | Job submission, polling, 3D preview, download |
| API | FastAPI (Python 3.12) | Auth gate, job creation, status, file manifests, Stripe webhooks |
| Queue | Redis (Upstash) + RQ | Job dispatch and worker coordination |
| Worker | Articraft + Python | Full generation pipeline, format conversion, uploads |
| Database | Supabase PostgreSQL | Users, subscriptions, jobs, file records, RLS |
| Auth | Supabase Auth | JWT-based email + Google OAuth |
| Storage | Supabase Storage | Signed-URL file delivery with per-tier TTL |
| Payments | Stripe Checkout | Subscription billing, webhook-driven tier sync |

---

## 2. Frontend

The frontend is a **single HTML page** embedded in the existing automationhire.co.uk static site. No framework is required — vanilla JS with `fetch` keeps the bundle zero-dependency and the page loads from the existing Vercel deployment.

**URL:** `https://automationhire.co.uk/forge`  
**File path in repo:** `forge.html` (served by Vercel at `/forge`)

### Key UI Sections

```
┌────────────────────────────────────────────────┐
│  HEADER: PartForge logo + tier badge + credits │
├────────────────────────────────────────────────┤
│  INPUT PANEL                                   │
│  ┌──────────────────┐  ┌──────────────────┐    │
│  │  Photo upload    │  │  Text prompt     │    │
│  │  (drag + drop)   │  │  (textarea)      │    │
│  │  Premium / Pro   │  │  all tiers       │    │
│  └──────────────────┘  └──────────────────┘    │
│  Format checkboxes: OBJ STL [STEP] [URDF] [PC] │
│  [Generate Part]  button                       │
├────────────────────────────────────────────────┤
│  PROGRESS BAR  ─── state label ───  cost badge │
├────────────────────────────────────────────────┤
│  3D PREVIEW (Three.js OBJLoader canvas)        │
│  orbit controls, reset, wireframe toggle       │
├────────────────────────────────────────────────┤
│  DOWNLOAD PANEL                                │
│  Per-file signed-URL buttons                   │
└────────────────────────────────────────────────┘
```

### JavaScript Architecture

```html
<!-- forge.html — single file, no build step needed -->
<script src="https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.165.0/examples/js/loaders/OBJLoader.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.165.0/examples/js/controls/OrbitControls.js"></script>
```

Core JS modules (inline or separate `.js` files in `/scripts/forge/`):

```
forge-auth.js     — Supabase JS client, session management, tier detection
forge-submit.js   — multipart form upload, POST /api/jobs
forge-poll.js     — GET /api/jobs/{id} on 3-second interval, state machine
forge-preview.js  — Three.js scene, OBJLoader, orbit controls
forge-download.js — render download panel from GET /api/jobs/{id}/files
forge-upgrade.js  — Stripe Checkout redirect for tier upgrades
```

### State Machine (client-side)

```
idle → submitting → queued → processing → compiling → complete
                                                     → failed
```

Transitions driven by polling `status` field returned from `GET /api/jobs/{id}`.

### Tier-Gated UI

```javascript
// forge-auth.js
async function getTierCapabilities(session) {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', session.user.id)
    .single();

  const tier = sub?.tier ?? 'free';
  return {
    canUploadPhoto:  tier !== 'free',
    canDownloadSTEP: tier !== 'free',
    canDownloadURDF: tier !== 'free',
    canDownloadPcat: tier === 'pro',
    hasApiAccess:    tier === 'pro',
    monthlyLimit:    { free: 1, premium: 15, pro: Infinity }[tier],
  };
}
```

---

## 3. Backend API

**Technology:** FastAPI (Python 3.12), deployed on Fly.io (`api` VM).  
**Base URL:** `https://api.partforge.io` (proxied via `automationhire.co.uk/forge/api` or separate subdomain).

### Endpoint Reference

```python
# app/main.py
from fastapi import FastAPI
from app.routers import jobs, auth, stripe, health

app = FastAPI(title="PartForge API", version="1.0.0")
app.include_router(health.router)
app.include_router(auth.router,   prefix="/api/auth")
app.include_router(jobs.router,   prefix="/api/jobs")
app.include_router(stripe.router, prefix="/api/stripe")
```

#### POST /api/jobs

Create a new generation job. Requires a valid Supabase JWT in `Authorization: Bearer <token>`.

```python
# app/routers/jobs.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, Form, File
from typing import Annotated
from app.auth import require_user
from app.db import get_db
from app.queue import enqueue_job
from app.models import JobResponse, TierLimits
import uuid, datetime

router = APIRouter()

@router.post("", response_model=JobResponse, status_code=202)
async def create_job(
    prompt:     Annotated[str,             Form(max_length=2000)],
    formats:    Annotated[list[str],       Form()],   # ["obj","stl","step","urdf","pcat"]
    image:      Annotated[UploadFile | None, File()] = None,
    user=Depends(require_user),
    db=Depends(get_db),
):
    # 1. Resolve tier and enforce limits
    sub   = await db.get_subscription(user.id)
    tier  = sub.tier if sub else "free"
    caps  = TierLimits.for_tier(tier)

    if image and not caps.can_upload_photo:
        raise HTTPException(402, "Photo upload requires Premium or Pro")
    
    disallowed = set(formats) - caps.allowed_formats
    if disallowed:
        raise HTTPException(402, f"Formats {disallowed} not available on {tier} tier")

    # 2. Enforce monthly quota
    usage = await db.count_jobs_this_month(user.id)
    if usage >= caps.monthly_limit:
        raise HTTPException(429, f"Monthly limit of {caps.monthly_limit} generations reached")

    # 3. Store image in Supabase Storage (inputs bucket, private)
    image_storage_path = None
    if image:
        image_bytes = await image.read()
        image_storage_path = await db.upload_input_image(
            user_id=user.id,
            filename=image.filename,
            content=image_bytes,
        )

    # 4. Create job record
    job_id = str(uuid.uuid4())
    job = await db.create_job(
        id=job_id,
        user_id=user.id,
        tier=tier,
        prompt=prompt,
        formats=formats,
        image_path=image_storage_path,
        status="queued",
    )

    # 5. Enqueue
    await enqueue_job(job_id)
    return JobResponse(id=job_id, status="queued", created_at=job.created_at)
```

#### GET /api/jobs/{id}

Poll job status. Returns current state plus optional error message.

```python
@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    user=Depends(require_user),
    db=Depends(get_db),
):
    job = await db.get_job(job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(404, "Job not found")
    return JobStatusResponse(
        id=job.id,
        status=job.status,           # queued|processing|compiling|complete|failed
        progress_message=job.progress_message,
        error=job.error,
        created_at=job.created_at,
        completed_at=job.completed_at,
        cost_gbp=job.cost_gbp,
    )
```

#### GET /api/jobs/{id}/files

Return signed download URLs for all output files of a completed job.

```python
@router.get("/{job_id}/files", response_model=list[JobFileResponse])
async def get_job_files(
    job_id: str,
    user=Depends(require_user),
    db=Depends(get_db),
):
    job = await db.get_job(job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(404, "Job not found")
    if job.status != "complete":
        raise HTTPException(409, "Job not yet complete")

    files = await db.get_job_files(job_id)
    result = []
    for f in files:
        signed = await db.create_signed_url(
            bucket="job-outputs",
            path=f.storage_path,
            expires_in=3600,   # 1-hour link validity (separate from file TTL)
        )
        result.append(JobFileResponse(
            format=f.format,
            filename=f.filename,
            size_bytes=f.size_bytes,
            signed_url=signed,
        ))
    return result
```

#### POST /api/auth/*

Delegated entirely to Supabase Auth SDK. The FastAPI layer only validates JWTs issued by Supabase and exposes no custom auth endpoints — the frontend calls Supabase directly.

```python
# app/auth.py
from supabase import create_client
from fastapi import HTTPException, Header
import jwt, os

SUPABASE_JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]

async def require_user(authorization: str = Header(...)):
    try:
        token = authorization.removeprefix("Bearer ").strip()
        payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"],
                             audience="authenticated")
        return payload  # contains sub (user_id), email, role
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
```

#### POST /api/stripe/webhook

Stripe delivers subscription lifecycle events; the handler syncs tier to Supabase.

```python
# app/routers/stripe.py
import stripe, os
from fastapi import APIRouter, Request, HTTPException
from app.db import get_db_direct

router  = APIRouter()
STRIPE_SECRET = os.environ["STRIPE_WEBHOOK_SECRET"]

PRICE_TO_TIER = {
    os.environ["STRIPE_PRICE_PREMIUM"]: "premium",
    os.environ["STRIPE_PRICE_PRO"]:     "pro",
}

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload   = await request.body()
    sig       = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid Stripe signature")

    db = get_db_direct()
    if event["type"] in ("customer.subscription.created",
                          "customer.subscription.updated"):
        sub = event["data"]["object"]
        tier = PRICE_TO_TIER.get(sub["items"]["data"][0]["price"]["id"], "free")
        await db.upsert_subscription(
            stripe_customer_id=sub["customer"],
            stripe_subscription_id=sub["id"],
            tier=tier,
            status=sub["status"],
            current_period_end=sub["current_period_end"],
        )

    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        await db.upsert_subscription(
            stripe_customer_id=sub["customer"],
            stripe_subscription_id=sub["id"],
            tier="free",
            status="canceled",
            current_period_end=None,
        )

    return {"received": True}
```

---

## 4. Database Schema

All tables live in Supabase PostgreSQL. Row Level Security (RLS) is enabled on every table. Connection strings use the Supabase pooler (`pgbouncer`) for the API, and the direct connection string for the worker (which needs `LISTEN/NOTIFY` and long transactions).

```sql
-- ─────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";   -- optional: for TTL cleanup job

-- ─────────────────────────────────────────────
-- TABLE: users (mirrors Supabase auth.users)
-- ─────────────────────────────────────────────
create table public.users (
    id            uuid primary key references auth.users(id) on delete cascade,
    email         text not null,
    full_name     text,
    avatar_url    text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
alter table public.users enable row level security;
create policy "users: read own row"
    on public.users for select
    using (auth.uid() = id);
create policy "users: update own row"
    on public.users for update
    using (auth.uid() = id);

-- Auto-create user row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
    insert into public.users (id, email, full_name, avatar_url)
    values (
        new.id,
        new.email,
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'avatar_url'
    );
    return new;
end;
$$;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();


-- ─────────────────────────────────────────────
-- TABLE: subscriptions
-- ─────────────────────────────────────────────
create type subscription_tier   as enum ('free', 'premium', 'pro');
create type subscription_status as enum ('active', 'past_due', 'canceled', 'trialing');

create table public.subscriptions (
    id                      uuid primary key default uuid_generate_v4(),
    user_id                 uuid not null references public.users(id) on delete cascade,
    stripe_customer_id      text unique,
    stripe_subscription_id  text unique,
    tier                    subscription_tier   not null default 'free',
    status                  subscription_status not null default 'active',
    current_period_end      timestamptz,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);
create unique index subscriptions_user_id_idx on public.subscriptions(user_id);

alter table public.subscriptions enable row level security;
create policy "subscriptions: read own"
    on public.subscriptions for select
    using (auth.uid() = user_id);
-- Only service_role (backend) can write subscriptions
create policy "subscriptions: service write"
    on public.subscriptions for all
    using (auth.role() = 'service_role');


-- ─────────────────────────────────────────────
-- TABLE: jobs
-- ─────────────────────────────────────────────
create type job_status as enum (
    'queued', 'processing', 'compiling', 'complete', 'failed'
);

create table public.jobs (
    id                  uuid primary key default uuid_generate_v4(),
    user_id             uuid not null references public.users(id) on delete cascade,
    tier                subscription_tier not null,
    status              job_status not null default 'queued',
    prompt              text not null,
    formats             text[] not null,           -- e.g. ARRAY['obj','stl','step']
    image_storage_path  text,                      -- null for text-only (Free tier)
    progress_message    text,
    error               text,
    cost_gbp            numeric(8,4),              -- actual API cost incurred
    articraft_record_id text,                      -- Articraft record_id once created
    created_at          timestamptz not null default now(),
    started_at          timestamptz,
    completed_at        timestamptz,
    -- TTL: set by worker based on tier (7d/30d/1y)
    expires_at          timestamptz
);
create index jobs_user_id_status_idx on public.jobs(user_id, status);
create index jobs_created_at_idx     on public.jobs(created_at desc);

alter table public.jobs enable row level security;
create policy "jobs: read own"
    on public.jobs for select
    using (auth.uid() = user_id);
create policy "jobs: insert own"
    on public.jobs for insert
    with check (auth.uid() = user_id);
create policy "jobs: service write"
    on public.jobs for update
    using (auth.role() = 'service_role');


-- ─────────────────────────────────────────────
-- TABLE: job_files
-- ─────────────────────────────────────────────
create table public.job_files (
    id            uuid primary key default uuid_generate_v4(),
    job_id        uuid not null references public.jobs(id) on delete cascade,
    format        text not null,          -- 'step', 'obj', 'stl', 'urdf', 'pcat'
    filename      text not null,          -- e.g. 'component.step'
    storage_path  text not null,          -- Supabase Storage object path
    size_bytes    bigint,
    sha256        text,
    created_at    timestamptz not null default now()
);
create index job_files_job_id_idx on public.job_files(job_id);

alter table public.job_files enable row level security;
-- Users can read their own job files (join via jobs table)
create policy "job_files: read own"
    on public.job_files for select
    using (
        exists (
            select 1 from public.jobs j
            where j.id = job_id
              and j.user_id = auth.uid()
        )
    );
create policy "job_files: service write"
    on public.job_files for all
    using (auth.role() = 'service_role');


-- ─────────────────────────────────────────────
-- HELPER: usage count for current calendar month
-- ─────────────────────────────────────────────
create or replace function public.jobs_this_month(p_user_id uuid)
returns integer language sql stable security definer as $$
    select count(*)::integer
    from public.jobs
    where user_id = p_user_id
      and created_at >= date_trunc('month', now())
      and status != 'failed';
$$;
```

---

## 5. Job Queue

### Technology Choice

**Redis + RQ** (Python) running on **Upstash** (serverless Redis, no ops overhead).

RQ is chosen over Celery because:
- No broker protocol complexity — straightforward Python task functions
- Native Fly.io VM compatibility (no daemonisation required)
- Built-in job result TTL, retry, and failure queues

### Queue Layout

```
partforge:default    — standard jobs (Free / Premium)
partforge:pro        — Pro jobs (higher concurrency budget, separate worker threads)
partforge:failed     — auto-moved on unhandled exception (RQ default)
```

### Enqueueing from the API

```python
# app/queue.py
from rq import Queue
from redis import Redis
import os

redis_conn = Redis.from_url(os.environ["REDIS_URL"])

queues = {
    "free":    Queue("partforge:default", connection=redis_conn),
    "premium": Queue("partforge:default", connection=redis_conn),
    "pro":     Queue("partforge:pro",     connection=redis_conn),
}

async def enqueue_job(job_id: str, tier: str = "free") -> None:
    q = queues.get(tier, queues["free"])
    q.enqueue(
        "worker.tasks.run_generation",
        job_id,
        job_timeout=600,          # 10 min hard timeout
        result_ttl=86400,
        failure_ttl=86400 * 7,
    )
```

### Job State Transitions

```
┌────────┐  enqueue   ┌─────────┐  worker picks up  ┌────────────┐
│ queued │ ─────────> │ queued  │ ────────────────> │ processing │
└────────┘            │ (Redis) │                   └─────┬──────┘
                      └─────────┘                         │
                                               Articraft compiling
                                                         │
                                                         ▼
                                                  ┌────────────┐
                                                  │ compiling  │  (check loop)
                                                  └─────┬──────┘
                                                        │
                                           check passes │  check fails (retry)
                                          ┌─────────────┴──────┐
                                          ▼                     ▼ (max 5 retries)
                                    ┌──────────┐          ┌────────┐
                                    │ complete │          │ failed │
                                    └──────────┘          └────────┘
```

Workers update `jobs.status` and `jobs.progress_message` directly via the service-role Supabase client at each transition.

### Worker Process

```python
# worker/main.py  — entrypoint run on the worker VM
from rq import Worker
from redis import Redis
import os

redis_conn = Redis.from_url(os.environ["REDIS_URL"])
worker = Worker(
    ["partforge:pro", "partforge:default"],  # pro queue drained first
    connection=redis_conn,
    name="partforge-worker",
)
worker.work()
```

---

## 6. Generation Pipeline

The worker runs the full pipeline inside `worker/tasks.py`. Each step updates `jobs.progress_message` so the frontend can show meaningful status text.

### Full Pipeline (worker/tasks.py)

```python
# worker/tasks.py
import subprocess, os, shutil, tempfile, time, hashlib
from pathlib import Path
from anthropic import Anthropic
from app.db import get_db_direct

ARTICRAFT_REPO  = Path(os.environ["ARTICRAFT_REPO_PATH"])   # /opt/articraft
MAX_CHECK_TRIES = 5

def run_generation(job_id: str) -> None:
    db = get_db_direct()
    job = db.get_job_sync(job_id)

    try:
        _set_status(db, job_id, "processing", "Analysing input...")
        _pipeline(db, job)
    except Exception as exc:
        _set_status(db, job_id, "failed", error=str(exc))
        raise


def _pipeline(db, job) -> None:
    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # ── STEP 1: Vision — image → enriched description ─────────────────────────
    prompt_text = job.prompt
    if job.image_storage_path:
        _set_status(db, job.id, "processing", "Analysing photo with Claude Vision...")
        image_bytes = db.download_storage_file(job.image_storage_path)
        vision_resp = client.messages.create(
            model=_vision_model(job.tier),
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": _b64(image_bytes),
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "You are a mechanical engineering expert. "
                            "Describe this component in precise detail: "
                            "dimensions, geometry, material appearance, mechanisms, "
                            "joints, and any notable features. "
                            "Your description will be used to generate a 3D CAD model. "
                            f"The user also provided this context: {job.prompt}"
                        ),
                    },
                ],
            }],
        )
        prompt_text = vision_resp.content[0].text

    # ── STEP 2: Articraft external init ────────────────────────────────────────
    _set_status(db, job.id, "processing", "Initialising Articraft record...")
    result = _run_articraft([
        "external", "init",
        "--agent",         "claude-code",
        "--model-id",      _generation_model(job.tier),
        "--thinking-level", _thinking_level(job.tier),
        "--repo-root",     str(ARTICRAFT_REPO),
        prompt_text,
    ])
    record_id  = _parse_kv(result.stdout, "record_id")
    record_dir = Path(_parse_kv(result.stdout, "record_dir"))
    model_path = Path(_parse_kv(result.stdout, "model="))
    db.set_job_articraft_record(job.id, record_id)

    # ── STEP 3: Generate model.py via Claude ───────────────────────────────────
    _set_status(db, job.id, "processing", "Generating CadQuery model code...")
    model_py = _generate_model_py(client, job.tier, prompt_text, record_dir)
    model_path.write_text(model_py, encoding="utf-8")

    # ── STEP 4: Check loop (max MAX_CHECK_TRIES attempts) ─────────────────────
    for attempt in range(1, MAX_CHECK_TRIES + 1):
        _set_status(
            db, job.id, "compiling",
            f"Compiling geometry (attempt {attempt}/{MAX_CHECK_TRIES})..."
        )
        check = _run_articraft([
            "external", "check",
            "--repo-root", str(ARTICRAFT_REPO),
            str(record_dir),
        ], check=False)

        if check.returncode == 0:
            break

        if attempt == MAX_CHECK_TRIES:
            raise RuntimeError(
                f"Articraft check failed after {MAX_CHECK_TRIES} attempts.\n"
                f"Last error:\n{check.stdout[-2000:]}"
            )

        # Auto-fix: feed compile error back to Claude for a patch
        _set_status(db, job.id, "compiling", f"Fixing compile error (attempt {attempt})...")
        model_py = _fix_model_py(client, job.tier, model_py, check.stdout)
        model_path.write_text(model_py, encoding="utf-8")

    # ── STEP 5: Finalize ───────────────────────────────────────────────────────
    _set_status(db, job.id, "compiling", "Finalising Articraft record...")
    _run_articraft([
        "external", "finalize",
        "--repo-root", str(ARTICRAFT_REPO),
        str(record_dir),
    ])

    # ── STEP 6: Export formats ─────────────────────────────────────────────────
    _set_status(db, job.id, "compiling", "Exporting CAD files...")
    output_dir = Path(tempfile.mkdtemp(prefix="partforge_"))
    exported   = _export_formats(job, record_dir, output_dir)

    # ── STEP 7: Upload to Supabase Storage ────────────────────────────────────
    _set_status(db, job.id, "compiling", "Uploading files...")
    ttl_days = {"free": 7, "premium": 30, "pro": 365}[job.tier]
    for fmt, local_path in exported.items():
        storage_path = f"{job.user_id}/{job.id}/{local_path.name}"
        db.upload_job_file(
            job_id=job.id,
            format=fmt,
            local_path=local_path,
            storage_path=storage_path,
            ttl_days=ttl_days,
        )

    # ── STEP 8: Done ───────────────────────────────────────────────────────────
    shutil.rmtree(output_dir, ignore_errors=True)
    _set_status(db, job.id, "complete", "Done")


def _export_formats(job, record_dir: Path, output_dir: Path) -> dict:
    """Run articraft compile and then convert to requested formats."""
    # Compile to STEP (canonical output from CadQuery/OpenCascade)
    _run_articraft([
        "compile", "--repo-root", str(ARTICRAFT_REPO),
        "--target", "full",
        str(record_dir),
    ])
    cache_dir = ARTICRAFT_REPO / "data" / "cache" / "record_materialization" / _record_id(record_dir)

    exported = {}
    stem = "component"

    if "step" in job.formats or True:   # always produce STEP as source of truth
        step_src = _find_step(cache_dir)
        if step_src:
            dst = output_dir / f"{stem}.step"
            shutil.copy2(step_src, dst)
            exported["step"] = dst

    if "obj" in job.formats:
        dst = output_dir / f"{stem}.obj"
        _convert_step_to_obj(exported["step"], dst)
        exported["obj"] = dst

    if "stl" in job.formats:
        dst = output_dir / f"{stem}.stl"
        _convert_step_to_stl(exported["step"], dst)
        exported["stl"] = dst

    if "urdf" in job.formats:
        urdf_src = _find_urdf(cache_dir)
        if urdf_src:
            exported["urdf"] = urdf_src

    if "pcat" in job.formats and job.tier == "pro":
        pcat_src = _find_pcat(cache_dir)
        if pcat_src:
            exported["pcat"] = pcat_src

    return {k: v for k, v in exported.items() if k in job.formats or k == "step"}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _vision_model(tier: str) -> str:
    return "claude-opus-4-5" if tier == "pro" else "claude-sonnet-4-6"

def _generation_model(tier: str) -> str:
    models = {"free": "claude-haiku-3-5", "premium": "claude-sonnet-4-6", "pro": "claude-opus-4-5"}
    return models[tier]

def _thinking_level(tier: str) -> str:
    return {"free": "low", "premium": "med", "pro": "high"}[tier]

def _run_articraft(args: list[str], check: bool = True):
    cmd = ["uv", "run", "--project", str(ARTICRAFT_REPO), "articraft"] + args
    result = subprocess.run(
        cmd, cwd=str(ARTICRAFT_REPO),
        capture_output=True, text=True, timeout=300,
    )
    if check and result.returncode != 0:
        raise RuntimeError(f"Articraft command failed:\n{result.stdout}\n{result.stderr}")
    result.stdout = result.stdout + "\n" + result.stderr
    return result

def _parse_kv(output: str, key: str) -> str:
    for line in output.splitlines():
        if key + "=" in line:
            return line.split(key + "=", 1)[1].strip().split()[0]
    raise ValueError(f"Key '{key}' not found in Articraft output")

def _b64(data: bytes) -> str:
    import base64
    return base64.standard_b64encode(data).decode()

def _set_status(db, job_id, status, message="", error=None):
    db.update_job_status_sync(job_id, status=status,
                              progress_message=message, error=error)
```

### Model Code Generation (Claude API)

```python
def _generate_model_py(client, tier: str, prompt: str, record_dir: Path) -> str:
    sdk_docs = _read_sdk_docs()   # reads sdk/_docs/ from ARTICRAFT_REPO
    thinking = {"free": None, "premium": {"type": "enabled", "budget_tokens": 8000},
                "pro": {"type": "enabled", "budget_tokens": 32000}}[tier]

    kwargs = dict(
        model=_generation_model(tier),
        max_tokens=16000,
        system=f"""You are an expert CadQuery mechanical engineer.
Generate a high-quality articulated 3D model as a model.py file
following the Articraft SDK contract exactly.

SDK Documentation:
{sdk_docs}

Rules:
- Import only from the Articraft SDK
- Implement build_model() returning ArticulatedObject
- Implement run_tests() with geometry assertions
- Use realistic dimensions and materials
- Model hollow/curved/beveled geometry faithfully
""",
        messages=[{"role": "user", "content": f"Create: {prompt}"}],
    )
    if thinking:
        kwargs["thinking"] = thinking

    response = client.messages.create(**kwargs)
    # Extract the Python code block
    text = next(b.text for b in response.content if hasattr(b, "text"))
    if "```python" in text:
        text = text.split("```python", 1)[1].split("```", 1)[0]
    return text.strip()


def _fix_model_py(client, tier: str, current_model_py: str, error_output: str) -> str:
    response = client.messages.create(
        model=_generation_model(tier),
        max_tokens=16000,
        messages=[{
            "role": "user",
            "content": (
                f"This CadQuery model.py has compile errors. Fix only the errors, "
                f"preserve the geometry intent.\n\n"
                f"ERRORS:\n{error_output[-3000:]}\n\n"
                f"CURRENT model.py:\n```python\n{current_model_py}\n```\n\n"
                f"Return the complete fixed model.py."
            ),
        }],
    )
    text = next(b.text for b in response.content if hasattr(b, "text"))
    if "```python" in text:
        text = text.split("```python", 1)[1].split("```", 1)[0]
    return text.strip()
```

---

## 7. Auth

### Provider

**Supabase Auth** — handles all user identity. PartForge does not manage passwords or OAuth tokens directly.

### Methods

| Method | Notes |
|---|---|
| Email + Password | Standard Supabase signup/login |
| Google OAuth | Supabase Google provider, redirect callback to `automationhire.co.uk/auth-callback` |

### Frontend Integration

```javascript
// forge-auth.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
    window.SUPABASE_URL,        // injected at build/serve time
    window.SUPABASE_ANON_KEY,
);

// Sign up
await supabase.auth.signUp({ email, password });

// Sign in
await supabase.auth.signInWithPassword({ email, password });

// Google OAuth
await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://automationhire.co.uk/auth-callback' }
});

// Get JWT for API calls
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// API call with auth header
fetch('/api/jobs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
});
```

### Session Persistence

Supabase JS client stores the session in `localStorage`. On page load, `supabase.auth.getSession()` restores the session silently.

---

## 8. Payments

### Stripe Products

| Product | Stripe Price ID env var | Amount |
|---|---|---|
| Premium Monthly | `STRIPE_PRICE_PREMIUM` | £12.00/mo |
| Pro Monthly | `STRIPE_PRICE_PRO` | £39.00/mo |

### Checkout Flow

```javascript
// forge-upgrade.js
async function startCheckout(tier) {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier }),
    });
    const { url } = await resp.json();
    window.location.href = url;
}
```

```python
# app/routers/stripe.py (additional endpoint)
@router.post("/create-checkout")
async def create_checkout(tier: str, user=Depends(require_user), db=Depends(get_db)):
    price_id = {
        "premium": os.environ["STRIPE_PRICE_PREMIUM"],
        "pro":     os.environ["STRIPE_PRICE_PRO"],
    }[tier]

    # Get or create Stripe customer linked to this user
    customer_id = await db.get_stripe_customer_id(user["sub"])
    if not customer_id:
        customer = stripe.Customer.create(email=user["email"])
        customer_id = customer.id
        await db.set_stripe_customer_id(user["sub"], customer_id)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url="https://automationhire.co.uk/forge?checkout=success",
        cancel_url="https://automationhire.co.uk/forge?checkout=cancel",
    )
    return {"url": session.url}
```

### Webhook Events Handled

| Event | Action |
|---|---|
| `customer.subscription.created` | Upsert subscription row, set tier |
| `customer.subscription.updated` | Update tier (upgrade/downgrade) |
| `customer.subscription.deleted` | Downgrade to free, set status = canceled |
| `invoice.payment_failed` | Set status = past_due (optional: email alert) |

### Subscription Sync Table

The `subscriptions` table is the source of truth for tier enforcement inside the API. The Stripe webhook is the only writer (via service role). The API reads the tier on every job creation request.

---

## 9. Storage

### Supabase Storage Buckets

| Bucket | Access | Purpose |
|---|---|---|
| `job-inputs` | Private (service role only) | Uploaded reference photos |
| `job-outputs` | Private (signed URLs) | Generated CAD files |

### File Path Convention

```
job-outputs/{user_id}/{job_id}/{filename}
```

Example:
```
job-outputs/a1b2c3d4-user/e5f6g7h8-job/component.step
job-outputs/a1b2c3d4-user/e5f6g7h8-job/component.obj
job-outputs/a1b2c3d4-user/e5f6g7h8-job/component.stl
```

### TTL by Tier

| Tier | File Retention | `expires_at` column |
|---|---|---|
| Free | 7 days | `now() + interval '7 days'` |
| Premium | 30 days | `now() + interval '30 days'` |
| Pro | 1 year | `now() + interval '1 year'` |

Supabase Storage does not natively support object TTL. Files are deleted by a scheduled `pg_cron` job that runs daily:

```sql
-- Scheduled cleanup — runs daily at 03:00 UTC
select cron.schedule(
    'delete-expired-job-files',
    '0 3 * * *',
    $$
    do $$
    declare
        r record;
    begin
        for r in
            select jf.storage_path
            from job_files jf
            join jobs j on j.id = jf.job_id
            where j.expires_at < now()
        loop
            -- Supabase Storage delete via SQL extension
            perform storage.delete_object('job-outputs', r.storage_path);
        end loop;

        -- Mark jobs as expired
        update jobs set status = 'failed', error = 'Files expired'
        where expires_at < now() and status = 'complete';
    end;
    $$ language plpgsql;
    $$
);
```

Alternatively, trigger deletion from the API when a user requests a file that has passed `expires_at`.

### Signed URL Delivery

Files are never served publicly. Every download request hits `GET /api/jobs/{id}/files` which generates a 1-hour signed URL per file. The frontend renders these as direct download links.

```python
# 1-hour signed download URL
signed = supabase.storage.from_("job-outputs").create_signed_url(
    path=storage_path,
    expires_in=3600,
)
```

---

## 10. Cost Model

### API Cost per Job (approximate, May 2026 pricing)

| Tier | Model | Thinking | Vision | Est. input tokens | Est. cost | Target margin |
|---|---|---|---|---|---|---|
| Free | claude-haiku-3-5 | low (~4k) | No | ~10k in / ~4k out | ~£0.08 | Lost leader |
| Premium | claude-sonnet-4-6 | med (~8k) | Yes (sonnet) | ~25k in / ~12k out | ~£1.40 | ~£10.60 / gen |
| Pro | claude-opus-4-5 | high (~32k) | Yes (opus) | ~60k in / ~20k out | ~£5.80 | ~£33.20 / gen |

Notes:
- Costs include vision call + model generation call + up to 2 fix iterations (expected)
- Free tier is subsidised by premium/pro — capped at 1/month to limit exposure
- Pro unlimited generation means a heavy user at ~£6/gen breaks even at ~6.5 gens/month; the median Pro user generates fewer than 3 per month based on comparable tools

### Infrastructure Costs (monthly estimate at launch)

| Service | Plan | Monthly Cost |
|---|---|---|
| Fly.io (2 VMs: api + worker, shared-cpu-1x, 256MB) | Pay-as-you-go | ~£12 |
| Supabase (Pro plan) | Pro | ~£20 |
| Upstash Redis | Pay-as-you-go | ~£2 |
| Stripe | 0.5% + 25p per subscription transaction | ~£2 per 10 subs |
| Vercel (existing) | Existing plan | £0 additional |

**Break-even:** ~3 Premium subscribers or ~1 Pro subscriber covers all infrastructure.

### Margin Analysis at Scale

| Scenario | Revenue | API Costs | Infra | Net Margin |
|---|---|---|---|---|
| 10 Premium (avg 8 gens/mo) + 5 Free | £120 | ~£90 | £35 | ~-£5 (near zero) |
| 20 Premium + 5 Pro + 20 Free | £435 | ~£175 | £50 | ~£210 (48%) |
| 50 Premium + 15 Pro + 100 Free | £1,185 | ~£500 | £80 | ~£605 (51%) |

---

## 11. Deployment

### Infrastructure Map

```
Vercel (CDN)                     Fly.io (London, LHR)
├── automationhire.co.uk         ├── partforge-api   (api VM)
│   └── /forge (forge.html)      │   fastapi + uvicorn, port 8080
│                                └── partforge-worker (worker VM)
                                     rq worker, Articraft installed

Upstash (Redis)                  Supabase (eu-west-2)
└── partforge Redis instance      ├── PostgreSQL (jobs, users, subs)
                                  ├── Auth (email + Google)
                                  └── Storage (job-inputs, job-outputs)

Stripe
└── Products: Premium £12, Pro £39
```

### Fly.io Configuration

**API VM** (`fly.api.toml`):

```toml
app = "partforge-api"
primary_region = "lhr"

[build]
  image = "ghcr.io/your-org/partforge-api:latest"

[http_service]
  internal_port = 8080
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"

[env]
  PORT = "8080"
  ENVIRONMENT = "production"
```

**Worker VM** (`fly.worker.toml`):

```toml
app = "partforge-worker"
primary_region = "lhr"

[build]
  image = "ghcr.io/your-org/partforge-worker:latest"
  # Worker image includes: Python 3.12, uv, Articraft repo, CadQuery, OpenCascade

[[vm]]
  size = "shared-cpu-2x"    # More CPU for CadQuery compile
  memory = "2gb"

[env]
  ARTICRAFT_REPO_PATH = "/opt/articraft"
  ENVIRONMENT = "production"
```

### Docker Images

**API image** (slim):
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app/ ./app/
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**Worker image** (heavier — includes Articraft + CadQuery):
```dockerfile
FROM python:3.12-slim
RUN apt-get update && apt-get install -y git curl build-essential libgl1
# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:$PATH"
# Clone and set up Articraft
RUN git clone https://github.com/mattzh72/articraft /opt/articraft
WORKDIR /opt/articraft
RUN uv sync --group dev
# Install worker app
COPY worker/ /app/worker/
COPY app/ /app/app/
WORKDIR /app
RUN pip install rq supabase anthropic stripe
CMD ["python", "-m", "worker.main"]
```

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --config fly.api.toml --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

  deploy-worker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --config fly.worker.toml --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

---

## 12. Development Phases

### Phase 1 — Landing + Waitlist (1 week)

**Goal:** Ship a `/forge` page that collects waitlist emails before any backend exists.

Tasks:
- [ ] Create `forge.html` in automationhire.co.uk with hero, feature list, tier pricing table
- [ ] Waitlist form → POST to Supabase `waitlist` table (anon insert with RLS)
- [ ] Add `vercel.json` rewrite: `/forge` → `forge.html`
- [ ] Configure Supabase project, enable Auth, create `users` and `waitlist` tables
- [ ] Deploy and test

Deliverable: Live waitlist page at `automationhire.co.uk/forge`

---

### Phase 2 — Auth + Payments + Basic Pipeline (2 weeks)

**Goal:** Users can sign up, subscribe via Stripe, and submit a text-only generation job that runs end-to-end (no photo, OBJ+STL output only).

Tasks:
- [ ] Supabase Auth: email signup + Google OAuth + `auth-callback` page
- [ ] DB schema: full SQL migration (users, subscriptions, jobs, job_files)
- [ ] FastAPI project scaffold with health check, auth middleware, `/api/jobs` POST+GET
- [ ] Stripe products, Checkout endpoint, webhook handler
- [ ] Redis (Upstash) + RQ worker scaffold on Fly.io
- [ ] Worker: text-only path through `articraft external init` → `generate model.py` → `external check` (1 attempt) → `external finalize` → export OBJ+STL → upload to Supabase Storage
- [ ] Frontend: auth UI (login/signup modal), simple text form, polling display, download links
- [ ] Fly.io deployment of API + worker VMs

Deliverable: End-to-end text-only generation for Free tier

---

### Phase 3 — Full Pipeline + 3D Preview (2 weeks)

**Goal:** Photo upload for Premium/Pro, all formats, Three.js preview, retry loop.

Tasks:
- [ ] Image upload endpoint (POST /api/jobs with multipart form)
- [ ] Worker: Claude Vision path (image → enriched description)
- [ ] Worker: full retry loop (max 5 check attempts with `_fix_model_py`)
- [ ] STEP/URDF export (post-compile from Articraft cache)
- [ ] Pro-only: Plant 3D .pcat export
- [ ] Frontend: photo drag-drop upload (gated by tier), format checkboxes
- [ ] Three.js OBJ preview: orbit controls, wireframe toggle, reset
- [ ] Tier-gated UI (lock icons on Premium/Pro features, upgrade CTA)
- [ ] File TTL implementation (pg_cron daily cleanup job)
- [ ] End-to-end Premium + Pro path tested

Deliverable: Full product with photo → 3D preview → CAD download

---

### Phase 4 — Dashboard + API Access (1 week)

**Goal:** Job history dashboard, Pro API key management, rate limit tuning.

Tasks:
- [ ] Dashboard page: job history table (status, date, formats, download)
- [ ] Pro API key generation (`api_keys` table, HMAC-based validation)
- [ ] `GET /api/jobs` (list with pagination) for dashboard
- [ ] Docs page: Pro API reference (OpenAPI spec auto-generated by FastAPI)
- [ ] Rate limiting tuning (per-tier Redis counters)
- [ ] Monitoring: Fly.io metrics + Supabase dashboard + Sentry error tracking
- [ ] Load test: 5 concurrent Pro jobs

Deliverable: Production-ready SaaS with API access

---

## 13. Environment Variables

Create `.env` in both the API and worker projects. Never commit this file.

```bash
# .env.example — copy to .env and fill in values

# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...           # Public anon key (used by frontend too)
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Private service role (API + worker only)
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase-settings

# ── Anthropic (Claude API) ────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── Stripe ────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...          # or sk_test_... for dev
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PREMIUM=price_...        # £12/mo Premium price ID
STRIPE_PRICE_PRO=price_...            # £39/mo Pro price ID

# ── Redis (Upstash) ───────────────────────────────────────────────────────────
REDIS_URL=rediss://default:...@your-instance.upstash.io:6379

# ── Worker: Articraft ─────────────────────────────────────────────────────────
ARTICRAFT_REPO_PATH=/opt/articraft    # Absolute path on worker VM

# ── App ───────────────────────────────────────────────────────────────────────
ENVIRONMENT=production                # production | development
PORT=8080
ALLOWED_ORIGINS=https://automationhire.co.uk,https://www.automationhire.co.uk

# ── Frontend (injected via Vercel env vars, public) ───────────────────────────
# NEXT_PUBLIC_ prefix not needed — these are set as window.* in forge.html
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
PARTFORGE_API_URL=https://partforge-api.fly.dev
```

### Secrets Setup per Service

**Fly.io API VM:**
```bash
fly secrets set SUPABASE_URL="..." \
                SUPABASE_SERVICE_ROLE_KEY="..." \
                SUPABASE_JWT_SECRET="..." \
                ANTHROPIC_API_KEY="..." \
                STRIPE_SECRET_KEY="..." \
                STRIPE_WEBHOOK_SECRET="..." \
                STRIPE_PRICE_PREMIUM="..." \
                STRIPE_PRICE_PRO="..." \
                REDIS_URL="..." \
                --app partforge-api
```

**Fly.io Worker VM:**
```bash
fly secrets set SUPABASE_URL="..." \
                SUPABASE_SERVICE_ROLE_KEY="..." \
                ANTHROPIC_API_KEY="..." \
                REDIS_URL="..." \
                ARTICRAFT_REPO_PATH="/opt/articraft" \
                --app partforge-worker
```

**Vercel (frontend):**
```
SUPABASE_URL          (exposed as window.SUPABASE_URL via _headers or inject script)
SUPABASE_ANON_KEY     (public anon key — safe to expose)
PARTFORGE_API_URL     https://partforge-api.fly.dev
```

---

## 14. Security

### Authentication & Authorisation

- All `/api/jobs` endpoints require a valid Supabase JWT. The JWT is validated server-side against `SUPABASE_JWT_SECRET` on every request — no session state in the API.
- RLS on every Supabase table ensures rows are only accessible to their owning `user_id`. The API uses the service role only for writes; reads use the user's JWT where possible.
- Tier enforcement happens in the API, not in the client. The client cannot self-select a higher tier by modifying the request.

### Rate Limiting

```python
# app/middleware/rate_limit.py
from fastapi import HTTPException, Request
from redis import Redis
import os, time

redis = Redis.from_url(os.environ["REDIS_URL"])

LIMITS = {
    "POST /api/jobs": {
        "free":    (1,  2592000),   # 1 per month
        "premium": (15, 2592000),   # 15 per month
        "pro":     (999999, 86400), # effectively unlimited
    },
    # Burst protection: all tiers max 5 requests per 60 seconds
    "burst": (5, 60),
}

async def rate_limit_jobs(request: Request, user_id: str, tier: str):
    # Burst protection
    burst_key = f"rl:burst:{user_id}"
    burst_count = redis.incr(burst_key)
    if burst_count == 1:
        redis.expire(burst_key, 60)
    if burst_count > 5:
        raise HTTPException(429, "Too many requests — please wait 60 seconds")

    # Monthly quota (enforced in DB with jobs_this_month() function)
    # API enforces before DB write, DB function is the authoritative check
```

### File Upload Validation

```python
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

async def validate_image(image: UploadFile):
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(415, f"Unsupported image type: {image.content_type}")
    
    content = await image.read()
    if len(content) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(413, "Image too large (max 10 MB)")
    
    # Magic bytes check — don't trust Content-Type header alone
    if not _is_valid_image_magic(content):
        raise HTTPException(415, "File does not appear to be a valid image")
    
    await image.seek(0)  # Reset for downstream use
    return content

def _is_valid_image_magic(data: bytes) -> bool:
    return (
        data[:3] == b'\xff\xd8\xff' or   # JPEG
        data[:8] == b'\x89PNG\r\n\x1a\n' or  # PNG
        data[:4] == b'RIFF'              # WebP
    )
```

### Articraft Code Execution Safety

Articraft executes the generated `model.py` files as Python code. On the worker VM:

- The worker runs as a non-root user (`appuser`, UID 1000)
- The Articraft repo and `data/` directory are mounted on a separate filesystem from system paths
- Generated `model.py` files never touch the network (no `import requests`, `import socket`, etc.) — the worker VM has no egress firewall rules needed because Articraft's SDK restricts imports
- Each job's Articraft record is created in a unique path and cleaned up after upload

For extra isolation, consider wrapping `_run_articraft()` calls in a Docker `--network none` subprocess on the worker (Phase 4 hardening).

### API Key Security (Pro tier)

```python
# Pro API keys are stored as HMAC-SHA256 hashes — the raw key is shown once at creation

import hashlib, secrets, os

def generate_api_key() -> tuple[str, str]:
    """Returns (raw_key, hashed_key). Store only hashed_key."""
    raw = "pfk_" + secrets.token_urlsafe(32)
    hashed = hashlib.sha256(
        (raw + os.environ["API_KEY_HMAC_SALT"]).encode()
    ).hexdigest()
    return raw, hashed

async def validate_api_key(raw_key: str, db) -> dict | None:
    hashed = hashlib.sha256(
        (raw_key + os.environ["API_KEY_HMAC_SALT"]).encode()
    ).hexdigest()
    return await db.get_api_key_by_hash(hashed)
```

### CORS

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ["ALLOWED_ORIGINS"].split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### HTTPS / TLS

- Fly.io terminates TLS for the API (`partforge-api.fly.dev` or custom domain)
- Supabase Storage signed URLs are HTTPS-only
- All frontend resources served over Vercel's HTTPS CDN
- Stripe webhooks are validated by signature — never trust payload without `stripe.Webhook.construct_event`

### Supabase RLS Checklist

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| users | own row only | via trigger only | own row only | cascade from auth.users |
| subscriptions | own row only | service role only | service role only | cascade from users |
| jobs | own rows only | own user_id only | service role only | service role only |
| job_files | via job ownership | service role only | service role only | service role only |

---

*This document is the single source of truth for PartForge system design. Update it when architectural decisions change. A developer reading this document should have everything needed to set up a local development environment, deploy to production, and understand every data flow in the system.*
