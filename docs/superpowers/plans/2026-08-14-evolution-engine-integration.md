# Evolution Engine Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 Evolution Engine integration that reads verified Notion telemetry, preserves evidence in Supabase, creates evidence-grounded Evolution Lab proposals, enforces human approval gates, and remains idempotent across retries.

**Architecture:** Notion remains authoritative for Product Factory, Telemetry, Evolution Lab, and approval state. A small Python service normalizes evidence, applies deterministic recommendation rules, persists operational state to Supabase, and writes proposals back to Notion. Supabase stores evidence, recommendations, and run logs only; GitHub stores code, migrations, tests, and configuration examples.

**Tech Stack:** Python 3.11+, `httpx`, `pydantic>=2`, `psycopg` or Supabase REST-compatible persistence adapter, `pytest`, PostgreSQL/Supabase, Notion API, GitHub Actions-compatible environment variables.

## Global Constraints

- Notion is authoritative for Product Factory records, Performance Telemetry, Evolution Lab decisions, and human approval state.
- Supabase is downstream operational storage for normalized mirrors, recommendation state, run logs, and integration observability.
- No API keys, service-role keys, Notion tokens, or OpenAI secrets may be committed.
- Protected commercial changes always require human approval.
- Missing metrics remain null; they are never converted to zero.
- Revenue in this subsystem is actual recorded revenue only, never projected revenue.
- Re-running the same evidence must update existing state instead of creating duplicates.
- Phase 1 does not publish listings, change live prices, delete/replace files, scrape speculative market data, spend advertising money, or self-modify production code.

---

## File Structure

- `src/evolution_engine/__init__.py` — package exports.
- `src/evolution_engine/config.py` — environment-only runtime configuration.
- `src/evolution_engine/models.py` — typed domain models and validation.
- `src/evolution_engine/notion_reader.py` — Notion read adapter and source-field extraction.
- `src/evolution_engine/normalizer.py` — evidence normalization and null-preserving metric handling.
- `src/evolution_engine/recommendation_engine.py` — deterministic, evidence-grounded recommendation rules.
- `src/evolution_engine/approval_gate.py` — protected-change approval policy.
- `src/evolution_engine/supabase_store.py` — evidence/recommendation/run persistence and idempotent upserts.
- `src/evolution_engine/notion_writer.py` — Evolution Lab proposal create/update behavior.
- `src/evolution_engine/runner.py` — orchestration and partial-failure accounting.
- `migrations/20260814_create_evolution_engine_tables.sql` — Supabase tables, indexes, timestamps, constraints, and RLS enablement.
- `tests/test_normalizer.py` — null/zero and revenue integrity tests.
- `tests/test_recommendation_engine.py` — deterministic recommendation behavior.
- `tests/test_approval_gate.py` — protected-action approval tests.
- `tests/test_idempotency.py` — evidence/recommendation retry behavior.
- `tests/test_runner.py` — partial failure and retry orchestration.
- `.env.example` — variable names only.
- `README.md` — local run and architecture instructions.

### Task 1: Supabase schema and migration

**Files:**
- Create: `migrations/20260814_create_evolution_engine_tables.sql`
- Test: Supabase schema inspection after migration.

**Interfaces:**
- Consumes: existing Supabase project `ormihkqvdedargcwggwg`.
- Produces: `public.evolution_evidence`, `public.evolution_recommendations`, `public.evolution_runs`.

- [ ] **Step 1: Write the migration with explicit constraints**

```sql
create extension if not exists pgcrypto;

create table if not exists public.evolution_evidence (
  id uuid primary key default gen_random_uuid(),
  product_notion_page_id text not null,
  telemetry_notion_page_id text not null unique,
  measurement_date timestamptz null,
  platform text null,
  impressions numeric null check (impressions is null or impressions >= 0),
  clicks numeric null check (clicks is null or clicks >= 0),
  views numeric null check (views is null or views >= 0),
  sales numeric null check (sales is null or sales >= 0),
  revenue numeric null check (revenue is null or revenue >= 0),
  ctr_percent numeric null,
  sales_conversion_percent numeric null,
  revenue_per_sale numeric null,
  evidence_notes text null,
  source_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evolution_recommendations (
  id uuid primary key default gen_random_uuid(),
  notion_evolution_page_id text unique,
  recommendation_fingerprint text not null unique,
  product_notion_page_id text not null,
  telemetry_notion_page_id text null,
  optimization_area text not null,
  evidence_summary text not null,
  hypothesis text not null,
  proposed_change text not null,
  success_metric text not null,
  baseline_value numeric null,
  target_value numeric null,
  confidence text not null check (confidence in ('low','medium','high')),
  human_approval_required boolean not null default true,
  human_approved boolean not null default false,
  approval_reason text null,
  stage text not null,
  decision text null,
  next_action text null,
  pending_notion_sync boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evolution_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null,
  status text not null,
  evidence_records_read integer not null default 0,
  recommendations_created integer not null default 0,
  recommendations_updated integer not null default 0,
  skipped_count integer not null default 0,
  failure_count integer not null default 0,
  error_text text null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.evolution_evidence enable row level security;
alter table public.evolution_recommendations enable row level security;
alter table public.evolution_runs enable row level security;

create index if not exists evolution_evidence_product_idx on public.evolution_evidence(product_notion_page_id);
create index if not exists evolution_recommendations_product_idx on public.evolution_recommendations(product_notion_page_id);
create index if not exists evolution_runs_started_idx on public.evolution_runs(started_at desc);
```

- [ ] **Step 2: Apply the migration**

Run through Supabase migration tooling using name `create_evolution_engine_tables`.

- [ ] **Step 3: Verify schema and RLS**

Run SQL inspection against `information_schema.columns` and `pg_class`/`pg_tables` to confirm all three tables exist, required unique constraints are present, and RLS is enabled.

- [ ] **Step 4: Commit the migration**

```bash
git add migrations/20260814_create_evolution_engine_tables.sql
git commit -m "feat: add evolution engine persistence schema"
```

### Task 2: Domain models and configuration

**Files:**
- Create: `src/evolution_engine/__init__.py`
- Create: `src/evolution_engine/config.py`
- Create: `src/evolution_engine/models.py`
- Create: `tests/test_normalizer.py`
- Create: `.env.example`

**Interfaces:**
- Produces: `Settings`, `RawTelemetry`, `NormalizedEvidence`, `Recommendation`, `RunSummary`.

- [ ] **Step 1: Write failing validation tests**

```python
from evolution_engine.models import RawTelemetry


def test_raw_telemetry_preserves_missing_metrics_as_none():
    raw = RawTelemetry(
        product_notion_page_id="product-1",
        telemetry_notion_page_id="telemetry-1",
        revenue=None,
        sales=None,
    )
    assert raw.revenue is None
    assert raw.sales is None


def test_raw_telemetry_rejects_negative_revenue():
    import pytest
    with pytest.raises(ValueError):
        RawTelemetry(
            product_notion_page_id="product-1",
            telemetry_notion_page_id="telemetry-1",
            revenue=-1,
        )
```

- [ ] **Step 2: Implement typed models**

Use Pydantic models with nonnegative validators on actual count/revenue fields, optional metrics, strict confidence values `low|medium|high`, and no projected-revenue property.

- [ ] **Step 3: Implement environment settings**

Required names:

```text
NOTION_TOKEN=
NOTION_PRODUCT_FACTORY_DATA_SOURCE_ID=37f7a70e-b79b-801c-8882-000b66862123
NOTION_TELEMETRY_DATA_SOURCE_ID=bd6dbcc2-977e-4367-9a9d-5e44e83610e8
NOTION_EVOLUTION_LAB_DATA_SOURCE_ID=4b2775ca-a3b5-4b4c-a4b2-df4f258de8c8
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`.env.example` contains variable names and safe fixed Notion collection IDs only; no secrets.

- [ ] **Step 4: Run model tests**

Run: `pytest tests/test_normalizer.py -v`
Expected: PASS.

### Task 3: Evidence normalizer

**Files:**
- Create: `src/evolution_engine/normalizer.py`
- Modify: `tests/test_normalizer.py`

**Interfaces:**
- Consumes: `RawTelemetry`.
- Produces: `normalize_telemetry(raw: RawTelemetry) -> NormalizedEvidence`.

- [ ] **Step 1: Add failing null/zero calculation tests**

```python
def test_ctr_is_none_when_impressions_missing():
    ...

def test_ctr_is_zero_when_impressions_positive_and_clicks_zero():
    ...

def test_conversion_is_none_when_clicks_missing():
    ...

def test_revenue_per_sale_is_none_when_sales_zero():
    ...
```

- [ ] **Step 2: Implement normalization**

Rules:
- CTR = `clicks / impressions * 100` only when both are present and impressions > 0.
- Sales conversion = `sales / clicks * 100` only when both are present and clicks > 0.
- Revenue per sale = `revenue / sales` only when both are present and sales > 0.
- Missing inputs yield `None`, not zero.
- A legitimate numeric zero stays zero.

- [ ] **Step 3: Run normalizer tests**

Run: `pytest tests/test_normalizer.py -v`
Expected: PASS.

### Task 4: Approval gate

**Files:**
- Create: `src/evolution_engine/approval_gate.py`
- Create: `tests/test_approval_gate.py`

**Interfaces:**
- Produces: `approval_requirement(optimization_area: str, proposed_change: str) -> tuple[bool, str]` and `can_advance_to_testing(recommendation: Recommendation) -> bool`.

- [ ] **Step 1: Write failing protected-change tests**

```python
def test_price_always_requires_approval(): ...
def test_file_replacement_requires_approval(): ...
def test_live_listing_copy_requires_approval(): ...
def test_unapproved_protected_change_cannot_enter_testing(): ...
```

- [ ] **Step 2: Implement policy**

Protected categories/actions:
- `Price`
- publishing/unpublishing or status-to-Live text
- live customer-facing listing copy changes
- file delete/replace actions
- destructive Notion actions

Return a human-readable reason for every protected classification.

- [ ] **Step 3: Run approval tests**

Run: `pytest tests/test_approval_gate.py -v`
Expected: PASS.

### Task 5: Deterministic recommendation engine

**Files:**
- Create: `src/evolution_engine/recommendation_engine.py`
- Create: `tests/test_recommendation_engine.py`

**Interfaces:**
- Consumes: `NormalizedEvidence`.
- Produces: `generate_recommendations(evidence: NormalizedEvidence) -> list[Recommendation]`.

- [ ] **Step 1: Write failing evidence-grounding tests**

Required behaviors:
- no recommendation when evidence cannot support a concrete hypothesis;
- no invented benchmark thresholds;
- recommendations refer only to observed metrics;
- assumptions are explicitly labeled;
- approval policy is attached using `approval_gate`.

- [ ] **Step 2: Implement conservative deterministic rules**

Initial Phase 1 rules:
- If impressions and clicks are both present and impressions > 0, but clicks == 0: propose reviewing thumbnail/title presentation; success metric is CTR; baseline is observed CTR; confidence `medium`.
- If clicks and sales are both present and clicks > 0, but sales == 0: propose reviewing description/offer alignment; success metric is sales conversion; baseline is observed conversion; confidence `medium`.
- If sales > 0 and revenue is present: do not infer a pricing problem from revenue alone.
- Never create a price recommendation unless evidence notes explicitly contain a human-entered price hypothesis; such recommendation must require approval.
- Do not manufacture target values; leave `target_value=None` unless a target is present in verified source notes.

- [ ] **Step 3: Create deterministic fingerprint**

`sha256(product_notion_page_id + "|" + telemetry_notion_page_id + "|" + optimization_area + "|" + canonical_proposed_change)`.

- [ ] **Step 4: Run recommendation tests**

Run: `pytest tests/test_recommendation_engine.py -v`
Expected: PASS.

### Task 6: Supabase persistence adapter

**Files:**
- Create: `src/evolution_engine/supabase_store.py`
- Create: `tests/test_idempotency.py`

**Interfaces:**
- Produces methods:
  - `upsert_evidence(evidence: NormalizedEvidence) -> str`
  - `upsert_recommendation(rec: Recommendation) -> tuple[str, bool]`
  - `mark_notion_synced(recommendation_id: str, notion_page_id: str) -> None`
  - `start_run(trigger_type: str) -> str`
  - `finish_run(run_id: str, summary: RunSummary) -> None`

- [ ] **Step 1: Write idempotency tests using a fake store**

Prove duplicate telemetry IDs and duplicate fingerprints update rather than insert.

- [ ] **Step 2: Implement persistence with explicit conflict keys**

Evidence conflict key: `telemetry_notion_page_id`.
Recommendation conflict key: `recommendation_fingerprint` before Notion page creation; retain `notion_evolution_page_id` after synchronization.

- [ ] **Step 3: Preserve pending Notion sync state**

A successful Supabase write sets `pending_notion_sync=true`; only successful Notion writeback clears it.

- [ ] **Step 4: Run idempotency tests**

Run: `pytest tests/test_idempotency.py -v`
Expected: PASS.

### Task 7: Notion reader and writer adapters

**Files:**
- Create: `src/evolution_engine/notion_reader.py`
- Create: `src/evolution_engine/notion_writer.py`
- Create: `tests/test_runner.py`

**Interfaces:**
- Reader produces `list_optimization_telemetry() -> list[RawTelemetry]`.
- Writer produces `upsert_evolution_proposal(rec: Recommendation) -> str`.

- [ ] **Step 1: Define exact source mappings**

Telemetry fields:
- Product relation
- Measurement Date
- Platform
- Impressions
- Clicks
- Views
- Sales
- Revenue
- Conversion Notes
- Optimization Needed
- Next Optimization Action

Evolution Lab fields:
- Experiment / Improvement
- Product
- Telemetry Evidence
- Stage
- Optimization Area
- Evidence Summary
- Hypothesis
- Proposed Change
- Success Metric
- Baseline Value
- Target Value
- Human Approval Required
- Human Approved
- Next Action

- [ ] **Step 2: Reader rejects incomplete identity**

If Product relation or source telemetry page ID is absent, skip and return a structured error; never invent identity.

- [ ] **Step 3: Writer creates or updates by known Notion page ID**

New recommendations create `Stage=Proposed`. If human approval is required, set `Human Approval Required=true` and do not move to Testing. Existing recommendations update only recommendation fields and preserve Notion approval state.

- [ ] **Step 4: Test Notion-write failure retry semantics**

Simulate Supabase success followed by Notion failure. Assert recommendation remains pending and a second run updates the same recommendation rather than creating a duplicate.

### Task 8: Runner orchestration

**Files:**
- Create: `src/evolution_engine/runner.py`
- Modify: `tests/test_runner.py`

**Interfaces:**
- Produces: `run_once(trigger_type: str = "manual") -> RunSummary`.

- [ ] **Step 1: Write failing orchestration tests**

Cover:
- one valid telemetry record -> one evidence upsert -> one proposal -> one run summary;
- invalid identity -> skipped count increments;
- Supabase failure -> Notion write is not attempted;
- Notion failure -> failure recorded and recommendation remains retryable.

- [ ] **Step 2: Implement orchestration in this order**

1. start run;
2. read flagged telemetry;
3. validate/normalize;
4. upsert evidence;
5. generate recommendations;
6. upsert recommendation;
7. upsert Evolution Lab proposal;
8. clear pending sync only after Notion success;
9. finish run with counts/status.

- [ ] **Step 3: Run complete test suite**

Run: `pytest -v`
Expected: PASS.

### Task 9: Repository documentation and runtime entrypoint

**Files:**
- Create: `README.md`
- Modify: `.env.example`
- Create: `src/evolution_engine/__main__.py`

**Interfaces:**
- Produces: `python -m evolution_engine` manual execution path.

- [ ] **Step 1: Document source-of-truth and approval rules**

README must state explicitly that the engine creates recommendations only and cannot autonomously publish, change prices, or replace/delete final files.

- [ ] **Step 2: Document environment variables and local test command**

```bash
python -m pip install -e .
pytest -v
python -m evolution_engine
```

- [ ] **Step 3: Add runtime main**

Exit nonzero on failed run; print only sanitized counts/status, never secrets.

- [ ] **Step 4: Run tests again**

Run: `pytest -v`
Expected: PASS.

### Task 10: Production verification

**Files:**
- No new application files unless verification reveals a defect.

**Interfaces:**
- Verifies the approved Definition of Done.

- [ ] **Step 1: Inspect Supabase schema**

Confirm tables, RLS, unique keys, and zero production rows before the first controlled run unless real source evidence is intentionally processed.

- [ ] **Step 2: Run a dry integration path against one verified Notion telemetry record**

If no flagged telemetry record exists, do not fabricate one; report that live end-to-end verification is blocked on real evidence.

- [ ] **Step 3: Verify idempotency**

Repeat the same real record once and confirm no duplicate evidence or recommendation is created.

- [ ] **Step 4: Verify approval stop**

For any protected recommendation encountered, confirm Evolution Lab remains at `Proposed` until explicit human approval exists in Notion.

- [ ] **Step 5: Record implementation status in the canonical Control Tower**

Add an implementation note containing migration status, test status, live verification status, and any remaining blockers. Do not claim operational end-to-end success if there is no real telemetry record available for verification.
