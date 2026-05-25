# Data Model

## Overview

The model is built around three concerns that are harder than they look in ESG data:

1. **Provenance** — every row must be traceable back to exactly one ingestion event and one raw source record.
2. **Mutability control** — analysts need to correct data, but auditors need an immutable record.
3. **Multi-tenancy** — client data must never bleed across tenant boundaries.

---

## Tables

### `tenants`

The root of multi-tenancy. Every other table foreign-keys to `tenants.id`. Slug is a URL-safe identifier used in API calls; we avoid exposing raw UUIDs in URLs.

### `ingestion_runs`

One row per ingestion event (file upload or API pull). This is the source-of-truth anchor: `emission_records.ingestion_run_id` links every normalized record back to the exact event that produced it.

Fields worth noting:
- `source_type` — constrained enum, not free text. Prevents drift in naming.
- `record_count` / `error_count` — written at the end of parsing so analysts can see at a glance whether an upload had parse failures.
- `status` — `processing → complete | failed`. Lets the UI show in-progress uploads without a polling loop.

### `emission_records`

The core table. One row = one normalized emission measurement from one source row.

**Scope/Category design:**
Scope (1/2/3) is a Postgres integer with a CHECK constraint. Category is free text within scope — e.g., `fuel_combustion`, `purchased_electricity`, `business_travel_air`. This lets us add GHG Protocol sub-categories without a migration.

**Unit normalization:**
- `activity_value` / `activity_unit` store the raw quantity in its original unit (liters, kWh, nights, km).
- `energy_kwh` normalizes all energy to kWh for cross-source comparison. NULL for non-energy records (hotel nights, procurement spend).
- `co2e_kg` is the final emission quantity, always in kg CO₂e.

This two-column pattern (raw + normalized) means we can re-compute `co2e_kg` if emission factors are updated without losing what the source said.

**Source-of-truth tracking:**
- `source_row_hash` — a deterministic hash of the raw row dict. Used for deduplication: if the same row is ingested twice, we can detect it.
- `raw_data jsonb` — the full original row stored verbatim. This means we can always reconstruct what we received, even if we later realize the parser had a bug.
- `was_edited` + `edit_reason` — set when an analyst manually corrects a value. We keep the original `raw_data` unchanged so the edit history is visible.
- `ingestion_run_id` — links back to exactly when this row entered the system.

**Review workflow:**
`review_status` is a four-state enum: `pending → approved | rejected | flagged`.

- `approved` triggers `locked_at` being set. Once locked, the row is immutable (enforced at RLS level: `USING (locked_at IS NULL)` on UPDATE policy).
- `flagged` keeps the row visible in the review queue with higher priority.
- `rejected` means the row will not count toward final numbers.

**Anomaly detection:**
`is_anomaly` + `anomaly_reason` are set at parse time by comparing `co2e_kg` against per-category thresholds. This is intentionally simple — the goal is to surface obvious data quality issues (a fuel record showing 10× the usual volume) without false precision on what counts as anomalous.

### `record_audits`

Append-only audit trail. One row per action on a record. Stores:
- `action` — enum: `created | updated | approved | rejected | flagged | locked`
- `changed_fields jsonb` — which fields changed and their new values
- `snapshot jsonb` — full record state at the moment of the action

The `snapshot` field is deliberately redundant with `changed_fields` — it's more expensive to store but means auditors can reconstruct the state of any record at any point in time without replaying a chain of deltas.

No UPDATE or DELETE policies exist on this table. It is insert-only by design.

### `analysts`

Lightweight user table. Not wired to Supabase Auth in this prototype (see TRADEOFFS.md), but structured so Auth integration is a one-migration change. Role is `analyst | admin`.

---

## Multi-tenancy

`tenant_id` is on every table. RLS policies check it. In production, the JWT would carry the tenant claim and the RLS policy would compare `auth.jwt() -> 'app_metadata' -> 'tenant_id'` rather than using the anon key pattern we use here. The schema change is zero — only the RLS policy expressions change.

---

## Scope classification rationale

| Scope | Source | Rationale |
|-------|--------|-----------|
| 1 | SAP fuel movements | Direct combustion at owned/controlled facilities |
| 2 | Utility electricity | Purchased electricity, market-based or location-based |
| 3 | SAP procurement | Upstream supply chain (spend-based EEIO approximation) |
| 3 | Corporate travel | Downstream employee business travel |

Procurement is Scope 3 Category 1 (purchased goods and services). Travel is Scope 3 Category 6 (business travel). These are tracked separately via `category` so they can be reported independently.

---

## Emission factor design

Factors are stored per-record at write time (`emission_factor`, `emission_factor_source`). They are not stored in a separate lookup table in this prototype. The reason: if DEFRA updates their factors next year, we need to know which factor produced which row. Storing it inline makes this unambiguous and means re-runs with new factors produce new records rather than silently rewriting history.

The cost is that updating all records when factors change requires a new ingestion run, not a simple table update. This is the right tradeoff for audit integrity.
