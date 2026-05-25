# Breathe ESG — Emissions Data Ingestion Platform

A prototype for ingesting, normalizing, and reviewing emissions data from multiple sources before audit sign-off.

## Live App

Access the deployed ESG Data Ingestion & Review Dashboard here:

## Deployed App URL

https://esg-data-ingestion-r-puy3.bolt.host/

## Overview

This platform handles the ingestion of emissions and activity data from three source types:

1. **SAP Fuel & Procurement** (Scope 1 & 3) — Flat file exports with German/English headers
2. **Utility Electricity** (Scope 2) — Portal CSV exports with billing period data
3. **Corporate Travel** (Scope 3) — Concur/Navan-style expense exports

Each source is parsed, normalized to a common schema, and presented for analyst review before being locked for audit.

## Features

- **Dashboard** — Total emissions by scope, review queue status, anomaly detection, source breakdown
- **Ingest Data** — Paste CSV content or upload files for each source type; sample data included
- **Review** — Filterable table with approve/flag/reject actions; detailed drawer with raw source data
- **Run History** — All ingestion events with record/error counts

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: PostgreSQL with Row Level Security

## Documentation

| File | Description |
|------|-------------|
| `MODEL.md` | Data model design, multi-tenancy, scope classification, provenance tracking |
| `DECISIONS.md` | Ambiguities resolved and what would be asked of the PM |
| `TRADEOFFS.md` | What was deliberately not built and why |
| `SOURCES.md` | Research on each data source format and production considerations |

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase CLI (optional, for local development)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Sample Data

Each source type includes realistic sample data accessible via the "Load Sample Data" button on the Ingest page:

- **SAP Fuel**: German locale flat file with WERKS/MATNR/BUDAT/MENGE columns
- **SAP Procurement**: Material movement data with USD spend values
- **Utility Electricity**: Green Button-compatible portal export with billing periods
- **Corporate Travel**: Concur-style expense export with flights, hotels, and ground transport

## Data Flow

1. Paste or upload CSV on Ingest page
2. Edge function parses and normalizes records
3. Records appear in Review page with status "pending"
4. Analyst approves, flags, or rejects each record
5. Approved records are locked and immutable
6. All actions logged to `record_audits` table

## Emission Factors

Sources used:

- **Fuel**: DEFRA 2023 (diesel 2.68 kg/L, petrol 2.31 kg/L, natural gas 2.02 kg/m3)
- **Electricity**: EPA eGRID 2022 US average (0.386 kg/kWh), DEFRA 2023 UK grid (0.233 kg/kWh)
- **Travel**: DEFRA 2023 (flight short-haul 0.255 kg/km, long-haul 0.195 kg/km, hotel 31.7 kg/night)

## Security

- Row Level Security enabled on all tables
- Records locked after approval (immutable)
- Full audit trail in `record_audits` table

## License

This is a prototype for evaluation purposes.
