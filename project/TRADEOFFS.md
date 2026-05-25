# Tradeoffs

Three things I deliberately did not build, and why.

---

## 1. Authentication

**What I skipped:** Real user authentication (Supabase Auth, JWT-gated routes, per-tenant access control).

**What I built instead:** A single demo tenant with a hardcoded analyst name. RLS is set up structurally (every table has it enabled, every policy is written), but the policies use `TO anon` because there are no real users. The data model already has an `analysts` table with `tenant_id` and `role` — wiring it to Auth is a policy change, not a schema change.

**Why I skipped it:** Auth adds significant surface area to a prototype: sign-up flow, session management, password reset, protected routes, token refresh. None of that is what's being evaluated here. The interesting parts — multi-tenant data isolation, the audit trail, the review workflow — are all present and would work correctly once Auth is plugged in. Spending two of four days on auth scaffolding would mean the core data model and ingestion logic were half-baked.

**What breaks in production:** Anyone with the anon key can read/write any tenant's data. This is obviously unacceptable in production and I would fix this before showing the app to a real client.

---

## 2. Re-ingestion and factor versioning

**What I skipped:** The ability to re-run an ingestion with updated emission factors, detect changed source rows, and produce a new version of records without touching locked ones.

**What I built instead:** Each ingestion creates new records. If you upload the same file twice, you get duplicate records (detectable via `source_row_hash`, but not automatically deduplicated).

**Why I skipped it:** This is genuinely hard. Factor updates require decisions about which locked records to re-open (if at all — some audits are already filed). Deduplication requires deciding what "same" means: same hash? Same facility + period? Same facility + period + material? Each definition has edge cases. The right answer depends on the client's reporting cycle and their auditor's requirements. Building a half-correct deduplication system would be worse than building none — it would silently suppress records that should be separate, or merge records that should be distinct. The `source_row_hash` column is there precisely so this can be implemented correctly when we have real client data to validate against.

---

## 3. Market-based Scope 2 calculation

**What I skipped:** Tracking renewable energy certificates (RECs), Power Purchase Agreements (PPAs), and supplier-specific emission factors for a market-based Scope 2 calculation.

**What I built instead:** Location-based Scope 2 only, using EPA eGRID 2022 US average or DEFRA 2023 UK grid factor. Clean, auditable, but incomplete.

**Why I skipped it:** Market-based Scope 2 requires a separate data source entirely: EAC/REC certificates (GOs in Europe), supplier emission disclosure statements, or utility green tariff documentation. These come from different systems than the utility portal export, require validation (was the REC retired? Does it match the right certificate period?), and the GHG Protocol has specific hierarchy rules for when market-based factors override location-based. Getting this right takes more than a day and requires knowing whether the client has any renewable procurement at all. A wrong market-based number submitted to an auditor is worse than a correct location-based one. The `emission_factor_source` column on every record means that when we do add market-based, we can clearly distinguish which methodology produced which number.
