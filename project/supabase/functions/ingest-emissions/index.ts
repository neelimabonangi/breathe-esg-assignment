import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ---- Emission factor tables (kg CO2e per unit) ----
// Source: DEFRA 2023, EPA eGRID 2022
const EMISSION_FACTORS: Record<string, { factor: number; source: string; unit: string }> = {
  diesel: { factor: 2.68, source: "DEFRA 2023", unit: "L" },
  petrol: { factor: 2.31, source: "DEFRA 2023", unit: "L" },
  natural_gas: { factor: 2.02, source: "DEFRA 2023", unit: "m3" },
  electricity_us: { factor: 0.386, source: "EPA eGRID 2022", unit: "kWh" },
  electricity_uk: { factor: 0.233, source: "DEFRA 2023", unit: "kWh" },
  flight_short: { factor: 0.255, source: "DEFRA 2023", unit: "km" },
  flight_long: { factor: 0.195, source: "DEFRA 2023", unit: "km" },
  hotel_night: { factor: 31.7, source: "DEFRA 2023", unit: "night" },
  car_rental: { factor: 0.192, source: "DEFRA 2023", unit: "km" },
  taxi: { factor: 0.149, source: "DEFRA 2023", unit: "km" },
};

// Rough airport distances (km) for common routes used in sample data
const AIRPORT_DISTANCES: Record<string, number> = {
  "JFK-LAX": 3983, "LAX-JFK": 3983,
  "JFK-LHR": 5540, "LHR-JFK": 5540,
  "ORD-ATL": 1524, "ATL-ORD": 1524,
  "SFO-SEA": 1093, "SEA-SFO": 1093,
  "LAX-LHR": 8757, "LHR-LAX": 8757,
  "DFW-MIA": 1779, "MIA-DFW": 1779,
};

function hashRow(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function detectAnomaly(co2e_kg: number, category: string): { is_anomaly: boolean; reason: string } {
  // Simple threshold anomaly detection
  const thresholds: Record<string, number> = {
    fuel_combustion: 50000,
    purchased_electricity: 100000,
    business_travel_air: 20000,
    business_travel_hotel: 5000,
    business_travel_ground: 2000,
    procurement: 200000,
  };
  const threshold = thresholds[category] ?? 50000;
  if (co2e_kg > threshold) {
    return { is_anomaly: true, reason: `co2e_kg ${co2e_kg.toFixed(1)} exceeds typical threshold ${threshold} for ${category}` };
  }
  if (co2e_kg < 0) {
    return { is_anomaly: true, reason: "Negative emission value" };
  }
  return { is_anomaly: false, reason: "" };
}

// ---- SAP Fuel/Procurement CSV Parser ----
// SAP flat file export: semicolon-delimited, German-ish headers mapped here
// Columns: WERKS (plant), MATNR (material), BUDAT (posting date), MENGE (quantity), MEINS (unit), BWART (movement type)
function parseSapCsv(csvText: string, sourceType: "sap_fuel" | "sap_procurement") {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) throw new Error("SAP CSV must have header + data rows");

  const rawHeaders = lines[0].split(";").map((h) => h.trim().replace(/^"|"$/g, ""));

  // Map known SAP column names to our internal names
  const headerMap: Record<string, string> = {
    WERKS: "plant_code", PLANT: "plant_code",
    MATNR: "material", MATERIAL: "material", "MATERIAL NUMBER": "material",
    BUDAT: "posting_date", "POSTING DATE": "posting_date", DATE: "posting_date",
    MENGE: "quantity", QUANTITY: "quantity", AMOUNT: "quantity",
    MEINS: "unit", UNIT: "unit", UOM: "unit",
    BWART: "movement_type", "MOVEMENT TYPE": "movement_type",
    TXTMD: "description", DESCRIPTION: "description", TEXT: "description",
    WERKS_DESC: "plant_name", "PLANT NAME": "plant_name",
  };

  const normalizedHeaders = rawHeaders.map((h) => headerMap[h.toUpperCase()] ?? h.toLowerCase().replace(/\s+/g, "_"));

  const records = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(";").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    normalizedHeaders.forEach((h, idx) => { row[h] = values[idx] ?? ""; });

    try {
      // Normalize date: SAP uses DD.MM.YYYY or YYYYMMDD
      let postingDate = row.posting_date ?? "";
      if (/^\d{8}$/.test(postingDate)) {
        postingDate = `${postingDate.slice(0, 4)}-${postingDate.slice(4, 6)}-${postingDate.slice(6, 8)}`;
      } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(postingDate)) {
        const [d, m, y] = postingDate.split(".");
        postingDate = `${y}-${m}-${d}`;
      }

      const qty = parseFloat((row.quantity ?? "0").replace(",", "."));
      if (isNaN(qty)) throw new Error(`Invalid quantity: ${row.quantity}`);

      const unit = (row.unit ?? "L").toUpperCase();
      const material = (row.material ?? "").toLowerCase();

      // Determine fuel type from material code
      let fuelType = "diesel";
      if (material.includes("petrol") || material.includes("gasol") || material.includes("benz")) fuelType = "petrol";
      else if (material.includes("gas") || material.includes("erdgas")) fuelType = "natural_gas";

      const ef = sourceType === "sap_fuel" ? EMISSION_FACTORS[fuelType] : { factor: 0.5, source: "spend-based estimate", unit: "USD" };
      let co2e_kg = 0;

      if (sourceType === "sap_fuel") {
        // Convert units to match emission factor unit
        let normalizedQty = qty;
        if (unit === "GAL") normalizedQty = qty * 3.785; // US gal to L
        else if (unit === "M3" && fuelType !== "natural_gas") normalizedQty = qty * 1000;
        co2e_kg = normalizedQty * ef.factor;
      } else {
        // Procurement: spend-based approximation (USD * industry avg kg/USD)
        co2e_kg = qty * 0.5; // rough placeholder; real = EEIO model
      }

      const dateObj = new Date(postingDate);
      const periodStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).toISOString().split("T")[0];
      const periodEnd = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).toISOString().split("T")[0];

      const anomaly = detectAnomaly(co2e_kg, sourceType === "sap_fuel" ? "fuel_combustion" : "procurement");

      records.push({
        scope: sourceType === "sap_fuel" ? 1 : 3,
        category: sourceType === "sap_fuel" ? "fuel_combustion" : "procurement",
        source_type: sourceType,
        period_start: periodStart,
        period_end: periodEnd,
        facility_code: row.plant_code ?? null,
        facility_name: row.plant_name ?? null,
        country_code: "US",
        activity_value: qty,
        activity_unit: unit,
        activity_description: row.description ?? material,
        energy_kwh: sourceType === "sap_fuel" ? (fuelType === "natural_gas" ? qty * 10.55 : qty * 9.7) : null,
        emission_factor: ef.factor,
        emission_factor_source: ef.source,
        co2e_kg,
        source_row_hash: hashRow(row),
        raw_data: row,
        review_status: "pending",
        is_anomaly: anomaly.is_anomaly,
        anomaly_reason: anomaly.reason || null,
      });
    } catch (e: unknown) {
      errors.push({ row: i + 1, error: e instanceof Error ? e.message : String(e), raw: line });
    }
  }

  return { records, errors };
}

// ---- Utility Electricity CSV Parser ----
// Portal export: standard columns from Green Button / utility portal
// Columns: meter_id, billing_period_start, billing_period_end, consumption_kwh, demand_kw, tariff, utility_name, facility
function parseUtilityCsv(csvText: string) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) throw new Error("Utility CSV must have header + data rows");

  const rawHeaders = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/\s+/g, "_"));

  const headerMap: Record<string, string> = {
    meter_id: "meter_id", meter: "meter_id",
    billing_period_start: "period_start", start_date: "period_start", from: "period_start",
    billing_period_end: "period_end", end_date: "period_end", to: "period_end",
    consumption_kwh: "kwh", "consumption_(kwh)": "kwh", energy_kwh: "kwh", kwh_usage: "kwh",
    demand_kw: "demand_kw", peak_demand_kw: "demand_kw",
    tariff: "tariff", rate_schedule: "tariff",
    utility_name: "utility", utility: "utility",
    facility: "facility", site: "facility", location: "facility",
    state: "state",
  };

  const normalizedHeaders = rawHeaders.map((h) => headerMap[h] ?? h);

  const records = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    normalizedHeaders.forEach((h, idx) => { row[h] = values[idx] ?? ""; });

    try {
      const kwh = parseFloat(row.kwh ?? "0");
      if (isNaN(kwh)) throw new Error(`Invalid kWh: ${row.kwh}`);

      const state = (row.state ?? "US").toUpperCase();
      // Use regional grid emission factors if known, else US average
      const efKey = state === "GB" ? "electricity_uk" : "electricity_us";
      const ef = EMISSION_FACTORS[efKey];
      const co2e_kg = kwh * ef.factor;

      const anomaly = detectAnomaly(co2e_kg, "purchased_electricity");

      records.push({
        scope: 2,
        category: "purchased_electricity",
        source_type: "utility_electricity",
        period_start: row.period_start,
        period_end: row.period_end,
        facility_code: row.meter_id ?? null,
        facility_name: row.facility ?? null,
        country_code: state === "GB" ? "GB" : "US",
        activity_value: kwh,
        activity_unit: "kWh",
        activity_description: `${row.utility ?? "Utility"} — ${row.tariff ?? "standard"}`,
        energy_kwh: kwh,
        emission_factor: ef.factor,
        emission_factor_source: ef.source,
        co2e_kg,
        source_row_hash: hashRow(row),
        raw_data: row,
        review_status: "pending",
        is_anomaly: anomaly.is_anomaly,
        anomaly_reason: anomaly.reason || null,
      });
    } catch (e: unknown) {
      errors.push({ row: i + 1, error: e instanceof Error ? e.message : String(e), raw: line });
    }
  }

  return { records, errors };
}

// ---- Travel CSV Parser ----
// Concur/Navan export: expense report style
// Columns: trip_id, traveler, expense_type, origin, destination, travel_date, distance_km, nights, amount_usd, currency
function parseTravelCsv(csvText: string) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) throw new Error("Travel CSV must have header + data rows");

  const rawHeaders = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_"));

  const headerMap: Record<string, string> = {
    trip_id: "trip_id", expense_report_id: "trip_id",
    traveler: "traveler", employee: "traveler", passenger: "traveler",
    expense_type: "expense_type", category: "expense_type", type: "expense_type",
    origin: "origin", from: "origin", departure: "origin",
    destination: "destination", to: "destination", arrival: "destination",
    travel_date: "travel_date", date: "travel_date", departure_date: "travel_date",
    distance_km: "distance_km", distance: "distance_km", km: "distance_km",
    nights: "nights", hotel_nights: "nights",
    amount_usd: "amount_usd", amount: "amount_usd", cost: "amount_usd",
    currency: "currency",
    flight_class: "flight_class", cabin_class: "flight_class",
  };

  const normalizedHeaders = rawHeaders.map((h) => headerMap[h] ?? h);

  const records = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    normalizedHeaders.forEach((h, idx) => { row[h] = values[idx] ?? ""; });

    try {
      const expenseType = (row.expense_type ?? "").toLowerCase().replace(/\s+/g, "_");
      const travelDate = row.travel_date ?? "";
      const dateObj = new Date(travelDate);
      const periodStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).toISOString().split("T")[0];
      const periodEnd = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).toISOString().split("T")[0];

      let co2e_kg = 0;
      let category = "business_travel_air";
      let activity_value = 0;
      let activity_unit = "km";
      let efFactor = 0;
      let efSource = "DEFRA 2023";

      if (expenseType.includes("air") || expenseType.includes("flight") || expenseType.includes("plane")) {
        category = "business_travel_air";
        // Try direct distance first, then airport code lookup
        let distKm = parseFloat(row.distance_km ?? "0");
        if (!distKm || isNaN(distKm)) {
          const routeKey = `${(row.origin ?? "").toUpperCase()}-${(row.destination ?? "").toUpperCase()}`;
          distKm = AIRPORT_DISTANCES[routeKey] ?? 1000; // fallback 1000km if unknown
        }
        // Short-haul < 3700km, long-haul otherwise
        const efKey = distKm < 3700 ? "flight_short" : "flight_long";
        efFactor = EMISSION_FACTORS[efKey].factor;
        co2e_kg = distKm * efFactor;
        activity_value = distKm;
        activity_unit = "km";
      } else if (expenseType.includes("hotel") || expenseType.includes("accommodation") || expenseType.includes("lodging")) {
        category = "business_travel_hotel";
        const nights = parseFloat(row.nights ?? "1");
        efFactor = EMISSION_FACTORS.hotel_night.factor;
        co2e_kg = nights * efFactor;
        activity_value = nights;
        activity_unit = "nights";
      } else if (expenseType.includes("car") || expenseType.includes("rental") || expenseType.includes("hire")) {
        category = "business_travel_ground";
        const distKm = parseFloat(row.distance_km ?? "100");
        efFactor = EMISSION_FACTORS.car_rental.factor;
        co2e_kg = distKm * efFactor;
        activity_value = distKm;
        activity_unit = "km";
      } else if (expenseType.includes("taxi") || expenseType.includes("rideshare") || expenseType.includes("uber")) {
        category = "business_travel_ground";
        const distKm = parseFloat(row.distance_km ?? "20");
        efFactor = EMISSION_FACTORS.taxi.factor;
        co2e_kg = distKm * efFactor;
        activity_value = distKm;
        activity_unit = "km";
      } else if (expenseType.includes("train") || expenseType.includes("rail")) {
        category = "business_travel_ground";
        const distKm = parseFloat(row.distance_km ?? "200");
        efFactor = 0.041; // DEFRA 2023 UK national rail
        co2e_kg = distKm * efFactor;
        activity_value = distKm;
        activity_unit = "km";
      } else {
        // Unknown type: flag it
        category = "business_travel_other";
        co2e_kg = 0;
      }

      const anomaly = detectAnomaly(co2e_kg, category);

      records.push({
        scope: 3,
        category,
        source_type: "travel",
        period_start: periodStart,
        period_end: periodEnd,
        facility_code: row.trip_id ?? null,
        facility_name: row.traveler ?? null,
        country_code: "US",
        activity_value,
        activity_unit,
        activity_description: `${row.traveler ?? "Unknown"}: ${expenseType} ${row.origin ? row.origin + "→" + row.destination : ""}`,
        energy_kwh: null,
        emission_factor: efFactor,
        emission_factor_source: efSource,
        co2e_kg,
        source_row_hash: hashRow(row),
        raw_data: row,
        review_status: "pending",
        is_anomaly: anomaly.is_anomaly,
        anomaly_reason: anomaly.reason || null,
      });
    } catch (e: unknown) {
      errors.push({ row: i + 1, error: e instanceof Error ? e.message : String(e), raw: line });
    }
  }

  return { records, errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/ingest-emissions/, "");

    if (req.method === "POST" && path === "/upload") {
      const body = await req.json();
      const { tenant_id, source_type, filename, ingested_by, csv_content } = body;

      if (!tenant_id || !source_type || !csv_content) {
        return new Response(JSON.stringify({ error: "tenant_id, source_type, csv_content required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create ingestion run
      const { data: run, error: runErr } = await supabase
        .from("ingestion_runs")
        .insert({ tenant_id, source_type, filename: filename ?? "upload", ingested_by: ingested_by ?? "system", status: "processing" })
        .select()
        .single();

      if (runErr) throw runErr;

      // Parse CSV based on source type
      let parsed: { records: Record<string, unknown>[]; errors: unknown[] };
      if (source_type === "sap_fuel") {
        parsed = parseSapCsv(csv_content, "sap_fuel");
      } else if (source_type === "sap_procurement") {
        parsed = parseSapCsv(csv_content, "sap_procurement");
      } else if (source_type === "utility_electricity") {
        parsed = parseUtilityCsv(csv_content);
      } else if (source_type === "travel") {
        parsed = parseTravelCsv(csv_content);
      } else {
        throw new Error(`Unknown source_type: ${source_type}`);
      }

      // Attach ingestion run and tenant IDs
      const toInsert = parsed.records.map((r) => ({
        ...r,
        tenant_id,
        ingestion_run_id: run.id,
      }));

      let insertedCount = 0;
      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase.from("emission_records").insert(toInsert);
        if (insertErr) throw insertErr;
        insertedCount = toInsert.length;
      }

      // Update ingestion run stats
      await supabase
        .from("ingestion_runs")
        .update({ status: "complete", record_count: insertedCount, error_count: parsed.errors.length })
        .eq("id", run.id);

      return new Response(JSON.stringify({
        run_id: run.id,
        records_inserted: insertedCount,
        errors: parsed.errors,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "GET" && path === "/records") {
      const tenantId = url.searchParams.get("tenant_id") ?? "00000000-0000-0000-0000-000000000001";
      const status = url.searchParams.get("status");
      const scope = url.searchParams.get("scope");
      const sourceType = url.searchParams.get("source_type");
      const page = parseInt(url.searchParams.get("page") ?? "1");
      const pageSize = parseInt(url.searchParams.get("page_size") ?? "50");
      const offset = (page - 1) * pageSize;

      let query = supabase
        .from("emission_records")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (status) query = query.eq("review_status", status);
      if (scope) query = query.eq("scope", parseInt(scope));
      if (sourceType) query = query.eq("source_type", sourceType);

      const { data, error, count } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ records: data, total: count, page, page_size: pageSize }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PUT" && path.startsWith("/records/")) {
      const recordId = path.replace("/records/", "");
      const body = await req.json();
      const { action, reviewed_by, review_notes, edit_reason, updates } = body;

      // Fetch current record
      const { data: record, error: fetchErr } = await supabase
        .from("emission_records")
        .select("*")
        .eq("id", recordId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!record) return new Response(JSON.stringify({ error: "Record not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (record.locked_at) return new Response(JSON.stringify({ error: "Record is locked for audit" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      let updatePayload: Record<string, unknown> = {};
      let auditAction = action;

      if (action === "approve") {
        updatePayload = { review_status: "approved", reviewed_by, reviewed_at: new Date().toISOString(), review_notes: review_notes ?? null, locked_at: new Date().toISOString() };
      } else if (action === "reject") {
        updatePayload = { review_status: "rejected", reviewed_by, reviewed_at: new Date().toISOString(), review_notes: review_notes ?? null };
      } else if (action === "flag") {
        updatePayload = { review_status: "flagged", reviewed_by, reviewed_at: new Date().toISOString(), review_notes: review_notes ?? null };
      } else if (action === "edit") {
        updatePayload = { ...updates, was_edited: true, edit_reason: edit_reason ?? null, updated_at: new Date().toISOString() };
        auditAction = "updated";
      } else {
        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error: updateErr } = await supabase.from("emission_records").update(updatePayload).eq("id", recordId);
      if (updateErr) throw updateErr;

      // Write audit trail
      await supabase.from("record_audits").insert({
        record_id: recordId,
        tenant_id: record.tenant_id,
        action: auditAction,
        actor: reviewed_by ?? "system",
        changed_fields: updatePayload,
        snapshot: { ...record, ...updatePayload },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && path === "/stats") {
      const tenantId = url.searchParams.get("tenant_id") ?? "00000000-0000-0000-0000-000000000001";

      const { data: records } = await supabase
        .from("emission_records")
        .select("scope, category, source_type, review_status, co2e_kg, is_anomaly, period_start")
        .eq("tenant_id", tenantId);

      if (!records) return new Response(JSON.stringify({}), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const total_co2e = records.reduce((s, r) => s + (r.co2e_kg ?? 0), 0);
      const by_scope = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
      const by_source: Record<string, number> = {};
      const by_status: Record<string, number> = { pending: 0, approved: 0, rejected: 0, flagged: 0 };
      let anomaly_count = 0;

      for (const r of records) {
        by_scope[r.scope] = (by_scope[r.scope] ?? 0) + (r.co2e_kg ?? 0);
        by_source[r.source_type] = (by_source[r.source_type] ?? 0) + (r.co2e_kg ?? 0);
        by_status[r.review_status] = (by_status[r.review_status] ?? 0) + 1;
        if (r.is_anomaly) anomaly_count++;
      }

      const { data: runs } = await supabase
        .from("ingestion_runs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("ingested_at", { ascending: false })
        .limit(10);

      return new Response(JSON.stringify({
        total_co2e_kg: total_co2e,
        total_records: records.length,
        by_scope,
        by_source,
        by_status,
        anomaly_count,
        recent_runs: runs ?? [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "GET" && path.startsWith("/audits/")) {
      const recordId = path.replace("/audits/", "");
      const { data, error } = await supabase
        .from("record_audits")
        .select("*")
        .eq("record_id", recordId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
