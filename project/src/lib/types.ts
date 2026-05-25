export interface EmissionRecord {
  id: string;
  tenant_id: string;
  ingestion_run_id: string;
  scope: 1 | 2 | 3;
  category: string;
  source_type: "sap_fuel" | "sap_procurement" | "utility_electricity" | "travel";
  period_start: string;
  period_end: string;
  facility_code: string | null;
  facility_name: string | null;
  country_code: string;
  activity_value: number | null;
  activity_unit: string | null;
  activity_description: string | null;
  energy_kwh: number | null;
  emission_factor: number | null;
  emission_factor_source: string | null;
  co2e_kg: number | null;
  source_row_hash: string | null;
  raw_data: Record<string, unknown>;
  was_edited: boolean;
  edit_reason: string | null;
  review_status: "pending" | "approved" | "rejected" | "flagged";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  locked_at: string | null;
  is_anomaly: boolean;
  anomaly_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngestionRun {
  id: string;
  tenant_id: string;
  source_type: string;
  filename: string | null;
  ingested_by: string;
  ingested_at: string;
  record_count: number;
  error_count: number;
  status: "processing" | "complete" | "failed";
  notes: string | null;
}

export interface Stats {
  total_co2e_kg: number;
  total_records: number;
  by_scope: Record<number, number>;
  by_source: Record<string, number>;
  by_status: Record<string, number>;
  anomaly_count: number;
  recent_runs: IngestionRun[];
}

export interface RecordsResponse {
  records: EmissionRecord[];
  total: number;
  page: number;
  page_size: number;
}

export const SOURCE_LABELS: Record<string, string> = {
  sap_fuel: "SAP Fuel",
  sap_procurement: "SAP Procurement",
  utility_electricity: "Utility Electricity",
  travel: "Corporate Travel",
};

export const SOURCE_COLORS: Record<string, string> = {
  sap_fuel: "bg-orange-100 text-orange-800",
  sap_procurement: "bg-amber-100 text-amber-800",
  utility_electricity: "bg-blue-100 text-blue-800",
  travel: "bg-teal-100 text-teal-800",
};

export const SCOPE_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-800",
  2: "bg-yellow-100 text-yellow-800",
  3: "bg-green-100 text-green-800",
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  flagged: "bg-amber-100 text-amber-800",
};
