/*
  # Breathe ESG Data Model

  ## Overview
  Multi-tenant emission data ingestion platform supporting SAP (Scope 1/2 fuel & procurement),
  utility electricity (Scope 2), and corporate travel (Scope 3) data sources.

  ## New Tables
  1. `tenants` - Client companies (multi-tenancy root)
  2. `ingestion_runs` - Tracks each file/API ingestion event with metadata
  3. `emission_records` - Normalized emission records (one row = one measurement)
  4. `record_audits` - Immutable audit trail of every change to a record
  5. `analysts` - Analyst accounts tied to tenants

  ## Scope Classification
  - Scope 1: Direct emissions (fuel combustion) — SAP fuel data
  - Scope 2: Indirect electricity — Utility data
  - Scope 3: Value chain — Corporate travel

  ## Key Design Decisions
  - unit_normalized_kwh: all energy normalized to kWh for comparison
  - co2e_kg: all emissions in kg CO2-equivalent
  - source_row_hash: SHA of original row for dedup detection
  - review_status: pending → approved | rejected | flagged
  - locked_at: set when approved for audit, prevents further edits
*/

-- Tenants (client companies)
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Ingestion runs: each file upload or API pull
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('sap_fuel', 'sap_procurement', 'utility_electricity', 'travel')),
  filename text,
  ingested_by text NOT NULL,
  ingested_at timestamptz DEFAULT now(),
  record_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'complete', 'failed')),
  notes text
);

ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;

-- Normalized emission records
CREATE TABLE IF NOT EXISTS emission_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ingestion_run_id uuid NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,

  -- Scope classification
  scope integer NOT NULL CHECK (scope IN (1, 2, 3)),
  category text NOT NULL, -- e.g. 'fuel_combustion', 'purchased_electricity', 'business_travel_air'
  source_type text NOT NULL CHECK (source_type IN ('sap_fuel', 'sap_procurement', 'utility_electricity', 'travel')),

  -- Time period (billing periods may not align to calendar months)
  period_start date NOT NULL,
  period_end date NOT NULL,

  -- Location / asset
  facility_code text,
  facility_name text,
  country_code text DEFAULT 'US',

  -- Activity data (raw, before normalization)
  activity_value numeric,
  activity_unit text, -- e.g. 'L', 'kWh', 'MWh', 'kg', 'miles', 'km'
  activity_description text,

  -- Normalized energy (kWh equivalent)
  energy_kwh numeric,

  -- Emission factor applied
  emission_factor numeric, -- kg CO2e per unit
  emission_factor_source text, -- e.g. 'DEFRA 2023', 'EPA eGRID 2022'

  -- Final calculated emission
  co2e_kg numeric,

  -- Source-of-truth tracking
  source_row_hash text, -- SHA of original raw row for deduplication
  raw_data jsonb, -- full original row stored for traceability
  was_edited boolean DEFAULT false,
  edit_reason text,

  -- Review workflow
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'flagged')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,

  -- Audit lock: once approved for audit, row is immutable
  locked_at timestamptz,

  -- Anomaly detection flags
  is_anomaly boolean DEFAULT false,
  anomaly_reason text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS emission_records_tenant_id_idx ON emission_records(tenant_id);
CREATE INDEX IF NOT EXISTS emission_records_scope_idx ON emission_records(scope);
CREATE INDEX IF NOT EXISTS emission_records_review_status_idx ON emission_records(review_status);
CREATE INDEX IF NOT EXISTS emission_records_period_idx ON emission_records(period_start, period_end);
CREATE INDEX IF NOT EXISTS emission_records_source_row_hash_idx ON emission_records(source_row_hash);

ALTER TABLE emission_records ENABLE ROW LEVEL SECURITY;

-- Immutable audit trail
CREATE TABLE IF NOT EXISTS record_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES emission_records(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'approved', 'rejected', 'flagged', 'locked')),
  actor text NOT NULL,
  changed_fields jsonb, -- which fields changed and old values
  snapshot jsonb, -- full record snapshot at this point in time
  created_at timestamptz DEFAULT now()
);

ALTER TABLE record_audits ENABLE ROW LEVEL SECURITY;

-- Analysts
CREATE TABLE IF NOT EXISTS analysts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'analyst' CHECK (role IN ('analyst', 'admin')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analysts ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Tenants: admins only via service role (no user-level RLS for this prototype)
CREATE POLICY "Service role full access on tenants"
  ON tenants FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Service role insert tenants"
  ON tenants FOR INSERT
  TO anon
  WITH CHECK (true);

-- Ingestion runs
CREATE POLICY "Anon can select ingestion runs"
  ON ingestion_runs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert ingestion runs"
  ON ingestion_runs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update ingestion runs"
  ON ingestion_runs FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Emission records
CREATE POLICY "Anon can select emission records"
  ON emission_records FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert emission records"
  ON emission_records FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update emission records"
  ON emission_records FOR UPDATE
  TO anon
  USING (locked_at IS NULL)
  WITH CHECK (locked_at IS NULL);

-- Record audits
CREATE POLICY "Anon can select record audits"
  ON record_audits FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert record audits"
  ON record_audits FOR INSERT
  TO anon
  WITH CHECK (true);

-- Analysts
CREATE POLICY "Anon can select analysts"
  ON analysts FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert analysts"
  ON analysts FOR INSERT
  TO anon
  WITH CHECK (true);

-- Seed a demo tenant
INSERT INTO tenants (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Acme Manufacturing Corp', 'acme')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO analysts (tenant_id, email, name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'analyst@acme.com', 'Sarah Chen', 'analyst'),
  ('00000000-0000-0000-0000-000000000001', 'admin@acme.com', 'Dev Patel', 'admin')
ON CONFLICT (email) DO NOTHING;
