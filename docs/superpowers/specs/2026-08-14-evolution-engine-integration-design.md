# Gilded Society Evolution Engine — Integration Design

Date: 2026-08-14
Status: Approved architecture; implementation contract

## Purpose

Build a controlled integration layer connecting Notion, Supabase, and GitHub so verified marketplace performance can become structured optimization recommendations without silently publishing, changing prices, deleting assets, or replacing final files.

## Source-of-truth policy

- **Notion is authoritative** for Product Factory records, Performance Telemetry, Evolution Lab decisions, and human approval state.
- **Supabase is downstream operational storage** for normalized mirrors, recommendation state, run logs, and integration observability.
- **GitHub is authoritative for code, migrations, tests, configuration examples, and technical documentation.**
- No system may write a protected commercial change back to Notion unless the corresponding Evolution Lab record explicitly shows required human approval as granted.

## Existing verified infrastructure

### Notion
- Product Factory data source: `collection://37f7a70e-b79b-801c-8882-000b66862123`
- Performance Telemetry data source: `collection://bd6dbcc2-977e-4367-9a9d-5e44e83610e8`
- Evolution Lab data source: `collection://4b2775ca-a3b5-4b4c-a4b2-df4f258de8c8`
- Canonical Control Tower page: `3807a70e-b79b-8023-9d30-d5ff311b4649`

### Supabase
Project: `ormihkqvdedargcwggwg`

Existing tables:
- `public.inventory_items` — downstream Notion mirror
- `public.sync_runs` — synchronization observability

Both existing tables remain intact.

### GitHub
Repository: `tobiasjessie90-boop/Gilded-Society-`
Default branch: `main`

## Evolution Engine components

### 1. Notion Reader

Reads only the minimum fields needed from:
- Product Factory
- Performance Telemetry records flagged for optimization
- Evolution Lab records awaiting analysis or approval

Responsibilities:
- normalize Notion page IDs and relation references
- preserve exact source record URLs/IDs
- never infer missing sales data
- reject incomplete evidence rather than invent values

### 2. Evidence Normalizer

Converts raw telemetry into a stable internal payload.

Required normalized fields:
- product_notion_page_id
- telemetry_notion_page_id
- measurement_date
- platform
- impressions
- clicks
- views
- sales
- revenue
- ctr_percent
- sales_conversion_percent
- revenue_per_sale
- evidence_notes

Null and zero remain distinct. Missing values are not converted to zero.

### 3. Recommendation Engine

Produces a recommendation object from verified evidence.

Allowed recommendation categories:
- Thumbnail
- Title
- SEO Tags
- Description
- Price
- Offer / Bundle
- Product Files
- Mockups
- Platform
- Other

Every recommendation must include:
- evidence summary
- hypothesis
- proposed change
- success metric
- baseline value when available
- target value when justifiable
- confidence classification: low / medium / high
- human approval required: true / false
- reason for approval requirement

The engine must label assumptions as assumptions. It must not fabricate competitor data, market benchmarks, conversion thresholds, or revenue forecasts.

### 4. Approval Gate

Protected changes always require human approval before execution.

Protected changes include:
- price changes
- publishing or unpublishing
- changing customer-facing listing copy on a live product
- deleting or replacing final product files
- destructive Notion changes
- changing product status to Live

The engine may create or update a recommendation record, but it may not perform these actions autonomously.

### 5. Supabase Operational Layer

Add three tables without modifying the semantic purpose of `inventory_items` or `sync_runs`.

#### `evolution_evidence`
Normalized telemetry snapshots.

Core columns:
- id uuid primary key
- product_notion_page_id text not null
- telemetry_notion_page_id text not null unique
- measurement_date timestamptz/date as appropriate
- platform text
- impressions numeric
- clicks numeric
- views numeric
- sales numeric
- revenue numeric
- ctr_percent numeric
- sales_conversion_percent numeric
- revenue_per_sale numeric
- evidence_notes text
- source_payload jsonb
- synced_at timestamptz not null
- created_at timestamptz not null
- updated_at timestamptz not null

#### `evolution_recommendations`
Recommendation state mirrored from or destined for Evolution Lab.

Core columns:
- id uuid primary key
- notion_evolution_page_id text unique
- product_notion_page_id text not null
- telemetry_notion_page_id text
- optimization_area text not null
- evidence_summary text not null
- hypothesis text not null
- proposed_change text not null
- success_metric text not null
- baseline_value numeric
- target_value numeric
- confidence text not null
- human_approval_required boolean not null default true
- human_approved boolean not null default false
- stage text not null
- decision text
- next_action text
- created_at timestamptz not null
- updated_at timestamptz not null

#### `evolution_runs`
Engine execution observability.

Core columns:
- id uuid primary key
- trigger_type text not null
- status text not null
- evidence_records_read integer not null default 0
- recommendations_created integer not null default 0
- recommendations_updated integer not null default 0
- skipped_count integer not null default 0
- failure_count integer not null default 0
- error_text text
- started_at timestamptz not null
- finished_at timestamptz
- created_at timestamptz not null

RLS must remain enabled on new public tables.

## Data flow

1. Read Product Factory + optimization-flagged Performance Telemetry from Notion.
2. Validate source IDs and numeric evidence.
3. Upsert telemetry snapshot into `evolution_evidence` by `telemetry_notion_page_id`.
4. Generate recommendation only when evidence supports a concrete hypothesis.
5. Upsert recommendation into `evolution_recommendations`.
6. Create or update the corresponding Evolution Lab record in Notion.
7. If approval is required, stop at `Proposed` and set `Human Approval Required = true`.
8. After human approval in Notion, a later run may move the record to `Approved` / `Testing`, but protected commercial changes remain separately gated.
9. Record every run in `evolution_runs` and use `sync_runs` only for the broader Notion-to-Supabase mirror process.

## Idempotency

- Telemetry records key on Notion telemetry page ID.
- Evolution recommendations key on Notion Evolution Lab page ID once created.
- Before the Notion Evolution Lab page exists, use a deterministic recommendation fingerprint derived from product ID + telemetry ID + optimization area + proposed-change canonical text.
- Re-running the same evidence must update the existing record, not create duplicates.

## Failure handling

- Missing required source IDs: skip and log.
- Missing metric required for a specific calculation: retain null and do not invent a zero.
- Notion read failure: abort recommendation generation for affected records.
- Supabase write failure: do not mark the Notion recommendation as synchronized.
- Notion write failure after Supabase success: preserve Supabase state as pending sync and retry idempotently.
- Partial runs are recorded with counts and error text.

## Security and secrets

No API keys, service-role keys, Notion tokens, or OpenAI secrets are committed to GitHub.

Runtime secrets must come from environment variables / platform secret storage. Repository files may contain `.env.example` with names only.

## Repository layout

```text
src/
  evolution_engine/
    __init__.py
    config.py
    models.py
    notion_reader.py
    normalizer.py
    recommendation_engine.py
    approval_gate.py
    supabase_store.py
    notion_writer.py
    runner.py
migrations/
  <timestamp>_create_evolution_engine_tables.sql
tests/
  test_normalizer.py
  test_recommendation_engine.py
  test_approval_gate.py
  test_idempotency.py
.env.example
README.md
```

## Testing contract

Minimum tests before calling the engine operational:

1. Missing metrics remain null rather than becoming zero.
2. Duplicate telemetry page IDs do not create duplicate evidence rows.
3. Re-running the same recommendation does not create a duplicate Evolution Lab proposal.
4. Price recommendations always require human approval.
5. File replacement/deletion recommendations always require human approval.
6. A recommendation cannot advance to Testing when approval is required but absent.
7. Revenue is treated as actual evidence only; no projected revenue is inserted into telemetry/evidence tables.
8. Notion write failure after a Supabase write remains retryable and idempotent.

## Initial implementation scope

Phase 1 implements:
- schema migrations
- typed models
- Notion read/normalize path
- Supabase evidence/recommendation/run persistence
- deterministic recommendation rules
- Evolution Lab proposal creation/update
- approval gate
- tests

Phase 1 does **not** implement:
- autonomous Etsy/Gumroad publishing
- autonomous price changes
- file deletion/replacement
- speculative market scraping
- automatic advertising spend
- self-modifying production code

## Definition of done

The integration layer is operational when one verified Performance Telemetry record can flow through normalization into Supabase, produce an evidence-grounded Evolution Lab proposal, stop correctly at the approval gate when required, and repeat without creating duplicates.
