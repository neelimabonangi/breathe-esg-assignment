import { useState } from "react";
import { callEdge, DEMO_TENANT, DEMO_ANALYST } from "../lib/supabase";
import { SAP_FUEL_CSV, SAP_PROCUREMENT_CSV, UTILITY_CSV, TRAVEL_CSV } from "../lib/sampleData";
import { Upload, FileText, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

const SOURCES = [
  {
    key: "sap_fuel",
    label: "SAP Fuel Data",
    scope: "Scope 1",
    scopeColor: "text-red-600 bg-red-50",
    description: "SAP flat-file export (semicolon-delimited). Columns: WERKS, MATNR, BUDAT, MENGE, MEINS, BWART.",
    sample: SAP_FUEL_CSV,
    hint: "Supports German SAP headers. Dates in YYYYMMDD or DD.MM.YYYY. Units: L, M3, GAL.",
  },
  {
    key: "sap_procurement",
    label: "SAP Procurement",
    scope: "Scope 3",
    scopeColor: "text-green-600 bg-green-50",
    description: "SAP procurement movement data. Same flat-file format. Material values in USD.",
    sample: SAP_PROCUREMENT_CSV,
    hint: "Spend-based emission calculation using industry average intensity factors.",
  },
  {
    key: "utility_electricity",
    label: "Utility Electricity",
    scope: "Scope 2",
    scopeColor: "text-yellow-700 bg-yellow-50",
    description: "Utility portal CSV export (comma-delimited). Green Button compatible.",
    sample: UTILITY_CSV,
    hint: "Billing periods may span non-calendar months. Regional grid factor applied by state.",
  },
  {
    key: "travel",
    label: "Corporate Travel",
    scope: "Scope 3",
    scopeColor: "text-green-600 bg-green-50",
    description: "Concur/Navan expense export. Air, hotel, car rental, taxi, train.",
    sample: TRAVEL_CSV,
    hint: "Airport codes used to estimate distance. Short/long-haul split at 3,700 km.",
  },
];

interface RunResult {
  run_id: string;
  records_inserted: number;
  errors: Array<{ row: number; error: string; raw: string }>;
}

export function IngestPage() {
  const [csvInputs, setCsvInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function loadSample(key: string, sample: string) {
    setCsvInputs((p) => ({ ...p, [key]: sample }));
  }

  async function ingest(sourceKey: string) {
    const csv = csvInputs[sourceKey];
    if (!csv?.trim()) {
      setErrors((p) => ({ ...p, [sourceKey]: "Paste CSV content first." }));
      return;
    }
    setLoading((p) => ({ ...p, [sourceKey]: true }));
    setErrors((p) => ({ ...p, [sourceKey]: "" }));
    try {
      const result = await callEdge("/upload", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: DEMO_TENANT,
          source_type: sourceKey,
          filename: `${sourceKey}_upload.csv`,
          ingested_by: DEMO_ANALYST,
          csv_content: csv,
        }),
      });
      setResults((p) => ({ ...p, [sourceKey]: result }));
    } catch (e: unknown) {
      setErrors((p) => ({ ...p, [sourceKey]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setLoading((p) => ({ ...p, [sourceKey]: false }));
    }
  }

  function handleFile(sourceKey: string, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCsvInputs((p) => ({ ...p, [sourceKey]: e.target?.result as string }));
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Ingest Emissions Data</h1>
        <p className="text-sm text-slate-500 mt-1">
          Paste CSV content or upload a file for each data source. Use "Load Sample" to test with realistic data.
        </p>
      </div>

      <div className="space-y-4">
        {SOURCES.map((source) => {
          const result = results[source.key];
          const err = errors[source.key];
          const isLoading = loading[source.key];
          const isOpen = expanded[source.key] !== false; // default open

          return (
            <div key={source.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded((p) => ({ ...p, [source.key]: !isOpen }))}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{source.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${source.scopeColor}`}>
                        {source.scope}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{source.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {result && (
                    <span className="text-xs text-emerald-600 font-medium">
                      {result.records_inserted} records ingested
                    </span>
                  )}
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3">
                  <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">{source.hint}</div>

                  {/* File drop / textarea */}
                  <div
                    className="relative"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) handleFile(source.key, file);
                    }}
                  >
                    <textarea
                      className="w-full h-40 text-xs font-mono border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder-slate-300"
                      placeholder={`Paste ${source.label} CSV here, or drag-and-drop a file…`}
                      value={csvInputs[source.key] ?? ""}
                      onChange={(e) => setCsvInputs((p) => ({ ...p, [source.key]: e.target.value }))}
                    />
                    <label className="absolute bottom-3 right-3 cursor-pointer">
                      <input
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFile(source.key, f);
                        }}
                      />
                      <span className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                        <Upload className="w-3 h-3" /> upload file
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => ingest(source.key)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {isLoading ? "Ingesting…" : "Ingest"}
                    </button>
                    <button
                      onClick={() => loadSample(source.key, source.sample)}
                      className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Load Sample Data
                    </button>
                    {csvInputs[source.key] && (
                      <button
                        onClick={() => setCsvInputs((p) => ({ ...p, [source.key]: "" }))}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {err && (
                    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 px-3 py-2.5 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {err}
                    </div>
                  )}

                  {result && (
                    <div className="bg-emerald-50 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        {result.records_inserted} records ingested successfully
                      </div>
                      {result.errors.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-amber-700 font-medium">{result.errors.length} parse errors:</div>
                          {result.errors.map((e, i) => (
                            <div key={i} className="text-xs text-amber-600">Row {e.row}: {e.error}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
