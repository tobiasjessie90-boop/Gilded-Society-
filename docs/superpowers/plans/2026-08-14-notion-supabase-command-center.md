# Notion → Supabase Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 one-way Notion-to-Supabase inventory backend without changing authoritative Notion business data.

**Architecture:** Notion remains authoritative. Supabase receives normalized, idempotent inventory upserts and records synchronization metadata. GitHub versions the database migration and sync implementation.

**Tech Stack:** Notion API/connector, Supabase PostgreSQL, Supabase Edge Functions (Deno/TypeScript), GitHub.

## Global Constraints
- Notion is the source of truth.
- Phase 1 synchronization direction is Notion → Supabase only.
- Do not fabricate missing business values; preserve them as null/unknown.
- Do not expose service-role secrets to browser clients.
- Do not write price, status, priority, readiness, or product identity back to Notion.
- Use Notion Page ID as stable external identity; SKU is a business identifier when present.

---

### Task 1: Restore and inspect Supabase
**Deliverable:** Active project with existing schema inspected before any DDL.
- [ ] Restore the existing inactive Supabase project.
- [ ] Confirm project status becomes active/healthy.
- [ ] List existing public tables and migrations.
- [ ] Record any conflicts with planned table names.

### Task 2: Create inventory synchronization schema
**Deliverable:** RLS-protected `inventory_items` and `sync_runs` tables.
- [ ] Apply a versioned migration creating `inventory_items` with UUID primary key, unique `notion_page_id`, nullable canonical business fields, JSONB platforms, timestamps, and sync timestamp.
- [ ] Create `sync_runs` with run status, counts, error text, start/end timestamps.
- [ ] Add indexes for SKU, status, priority, and updated timestamp.
- [ ] Enable RLS on both tables.
- [ ] Do not add permissive anonymous write policies.
- [ ] Run Supabase security/performance advisors and resolve critical issues introduced by this migration.

### Task 3: Implement normalization/upsert Edge Function
**Deliverable:** Authenticated server-side endpoint that accepts normalized Notion records and performs idempotent upserts.
- [ ] Deploy an Edge Function with JWT verification enabled.
- [ ] Validate required `notion_page_id` and reject malformed payloads.
- [ ] Map only approved Phase 1 fields.
- [ ] Convert absent/UNKNOWN business values to null rather than guesses.
- [ ] Upsert on `notion_page_id`.
- [ ] Record a `sync_runs` result for each invocation.
- [ ] Return structured success/failure counts.

### Task 4: Verify with current Master Inventory sample
**Deliverable:** Demonstrated mapping using actual current Notion source content without altering it.
- [ ] Read the existing Master Inventory source.
- [ ] Map known records to the canonical schema.
- [ ] Verify representative records preserve known SKU/status/price values and null unknown values.
- [ ] Confirm re-running the same payload does not create duplicates.
- [ ] Confirm Notion content remains unchanged.

### Task 5: Document integration contract
**Deliverable:** GitHub documentation for Lovable and future automation.
- [ ] Document field mapping and ownership rules.
- [ ] Document one-way Phase 1 boundary.
- [ ] Document authentication/secrets requirements without committing secrets.
- [ ] Document the future controlled write-back gate as explicitly out of scope.
- [ ] Commit implementation artifacts to the feature branch and perform final verification.
