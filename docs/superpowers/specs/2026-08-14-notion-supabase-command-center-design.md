# Gilded Society Notion → Supabase Command Center Design

## Decision
Notion remains the business source of truth. Supabase is a downstream automation and application backend. Lovable reads operational data from Supabase. GitHub versions schema, synchronization logic, and system documentation.

## Safety boundary
Phase 1 is one-way: Notion → Supabase. Supabase/Lovable must not overwrite core Notion product fields, including price, status, priority, readiness, or product identity. Unknown or missing values remain null/unknown; the sync must not invent business data.

## Canonical Phase 1 fields
Product/Project Name; SKU; Type; Brand/Collection; Status; Readiness Score; Priority; Platform; Price; Revenue Potential; Effort; Final File Location; Listing URL; Next Action; Last Updated; Notion Page ID.

## Architecture
1. Notion Master Inventory is curated by the owner and remains authoritative.
2. A sync service reads approved Notion records and upserts them into Supabase using Notion Page ID as the stable external identity, with SKU as a business identifier when present.
3. Supabase stores the synchronized operational representation plus sync metadata.
4. Lovable and other applications read Supabase rather than scraping Notion.
5. GitHub stores migrations and sync code.

## Initial Supabase model
Use a single `inventory_items` table for Phase 1 rather than prematurely splitting products/projects/assets/systems. The table includes the canonical fields plus `source_type`, `notion_page_id`, `synced_at`, and timestamps. Add a `sync_runs` table for observability and error reporting.

## Data flow
Notion change → sync invocation → validate/normalize → Supabase upsert → record sync result. Failures are logged without modifying the authoritative Notion record.

## Security
Enable Row Level Security. Do not expose service-role credentials to Lovable/browser clients. Browser-facing access should use least-privilege policies. Server-side synchronization uses secrets stored outside source control.

## Failure behavior
A failed or partial sync never deletes Notion data. Missing Notion values become null rather than guessed values. Sync runs record success/failure counts and error text sufficient to diagnose the failure.

## Phase boundaries
Phase 1: schema + one-way synchronization foundation.
Phase 2: controlled write-back only after explicit field-level approval.
Phase 3: consider making Supabase authoritative only if the app becomes the primary operating workspace.

## Acceptance criteria
- Existing Notion source remains intact.
- Supabase contains a normalized inventory representation.
- Re-running sync is idempotent.
- No core business field is written back to Notion in Phase 1.
- Unknown data is not fabricated.
- Security advisors show no unaddressed critical RLS exposure introduced by the schema.
