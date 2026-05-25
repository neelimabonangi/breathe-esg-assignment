import { useEffect, useState, useCallback } from "react";
import { callEdge, DEMO_TENANT, DEMO_ANALYST } from "../lib/supabase";
import {
  EmissionRecord, RecordsResponse,
  SOURCE_LABELS, SOURCE_COLORS, SCOPE_COLORS, STATUS_COLORS,
} from "../lib/types";
import { CheckCircle2, XCircle, Flag, ChevronLeft, ChevronRight, AlertTriangle, Info, Lock, CreditCard as Edit3, X, RotateCcw } from "lucide-react";

const PAGE_SIZE = 20;

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

interface RecordDrawerProps {
  record: EmissionRecord;
  onClose: () => void;
  onAction: (id: string, action: string, notes?: string) => Promise<void>;
}

function RecordDrawer({ record, onClose, onAction }: RecordDrawerProps) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(action: string) {
    setBusy(true);
    await onAction(record.id, action, notes);
    setBusy(false);
    onClose();
  }

  const rows = Object.entries(record.raw_data ?? {}).filter(([, v]) => v !== "" && v != null);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative w-[480px] bg-white h-full shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Record Detail</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          {/* Status + lock */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={STATUS_COLORS[record.review_status]}>{record.review_status}</Badge>
            <Badge className={SCOPE_COLORS[record.scope]}>Scope {record.scope}</Badge>
            <Badge className={SOURCE_COLORS[record.source_type]}>{SOURCE_LABELS[record.source_type]}</Badge>
            {record.locked_at && <Badge className="bg-slate-100 text-slate-600"><Lock className="w-3 h-3 mr-1" />Locked</Badge>}
            {record.is_anomaly && <Badge className="bg-amber-100 text-amber-700"><AlertTriangle className="w-3 h-3 mr-1" />Anomaly</Badge>}
            {record.was_edited && <Badge className="bg-blue-100 text-blue-700"><Edit3 className="w-3 h-3 mr-1" />Edited</Badge>}
          </div>

          {record.is_anomaly && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
              <div className="font-semibold mb-0.5">Anomaly detected</div>
              {record.anomaly_reason}
            </div>
          )}

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg px-3 py-2.5">
              <div className="text-xs text-slate-500 mb-0.5">CO₂e</div>
              <div className="text-base font-bold text-slate-900">{((record.co2e_kg ?? 0) / 1000).toFixed(3)} tCO₂e</div>
              <div className="text-xs text-slate-400">{(record.co2e_kg ?? 0).toFixed(1)} kg</div>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2.5">
              <div className="text-xs text-slate-500 mb-0.5">Activity</div>
              <div className="text-base font-bold text-slate-900">
                {(record.activity_value ?? 0).toLocaleString()} {record.activity_unit}
              </div>
              <div className="text-xs text-slate-400 truncate">{record.activity_description}</div>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2.5">
              <div className="text-xs text-slate-500 mb-0.5">Period</div>
              <div className="text-sm font-semibold text-slate-800">{record.period_start}</div>
              <div className="text-xs text-slate-400">→ {record.period_end}</div>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2.5">
              <div className="text-xs text-slate-500 mb-0.5">Emission Factor</div>
              <div className="text-sm font-semibold text-slate-800">{record.emission_factor} kg/{record.activity_unit}</div>
              <div className="text-xs text-slate-400">{record.emission_factor_source}</div>
            </div>
          </div>

          {(record.facility_name || record.facility_code) && (
            <div className="text-sm">
              <span className="text-slate-500">Facility: </span>
              <span className="text-slate-800 font-medium">{record.facility_name ?? record.facility_code}</span>
              {record.facility_code && record.facility_name && (
                <span className="text-slate-400 ml-1">({record.facility_code})</span>
              )}
            </div>
          )}

          {/* Raw data */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Raw Source Data</div>
            <div className="bg-slate-50 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {rows.map(([k, v]) => (
                    <tr key={k} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-1.5 text-slate-500 font-mono">{k}</td>
                      <td className="px-3 py-1.5 text-slate-800 font-mono">{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {record.review_notes && (
            <div className="bg-blue-50 rounded-lg px-3 py-2.5 text-xs text-blue-700">
              <div className="font-semibold mb-0.5 flex items-center gap-1"><Info className="w-3 h-3" />Review notes</div>
              {record.review_notes}
            </div>
          )}

          {record.locked_at && (
            <div className="bg-slate-100 rounded-lg px-3 py-2.5 text-xs text-slate-500 flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              Locked for audit on {new Date(record.locked_at).toLocaleDateString()}
              {record.reviewed_by && ` by ${record.reviewed_by}`}
            </div>
          )}
        </div>

        {/* Action footer */}
        {!record.locked_at && (
          <div className="border-t border-slate-200 px-5 py-4 space-y-3">
            <textarea
              className="w-full h-16 text-xs border border-slate-200 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Optional review note…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                disabled={busy || record.review_status === "approved"}
                onClick={() => act("approve")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Lock
              </button>
              <button
                disabled={busy || record.review_status === "flagged"}
                onClick={() => act("flag")}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium rounded-lg hover:bg-amber-100 disabled:opacity-40 transition-colors"
              >
                <Flag className="w-3.5 h-3.5" /> Flag
              </button>
              <button
                disabled={busy || record.review_status === "rejected"}
                onClick={() => act("reject")}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 text-xs font-medium rounded-lg hover:bg-red-100 disabled:opacity-40 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
              {record.review_status !== "pending" && (
                <button
                  disabled={busy}
                  onClick={() => act("flag")}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  title="Reset to pending"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReviewPage() {
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [selected, setSelected] = useState<EmissionRecord | null>(null);
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      tenant_id: DEMO_TENANT,
      page: String(page),
      page_size: String(PAGE_SIZE),
    });
    if (statusFilter) params.set("status", statusFilter);
    if (scopeFilter) params.set("scope", scopeFilter);
    if (sourceFilter) params.set("source_type", sourceFilter);
    try {
      const res = await callEdge(`/records?${params}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, scopeFilter, sourceFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id: string, action: string, notes?: string) {
    setActionBusy((p) => ({ ...p, [id]: true }));
    try {
      await callEdge(`/records/${id}`, {
        method: "PUT",
        body: JSON.stringify({ action, reviewed_by: DEMO_ANALYST, review_notes: notes }),
      });
      await load();
    } finally {
      setActionBusy((p) => ({ ...p, [id]: false }));
    }
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Review Records</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data ? `${data.total} records` : "Loading…"}
            {statusFilter && ` · ${statusFilter}`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="flagged">Flagged</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={scopeFilter}
          onChange={(e) => { setScopeFilter(e.target.value); setPage(1); }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
        >
          <option value="">All scopes</option>
          <option value="1">Scope 1</option>
          <option value="2">Scope 2</option>
          <option value="3">Scope 3</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
        >
          <option value="">All sources</option>
          <option value="sap_fuel">SAP Fuel</option>
          <option value="sap_procurement">SAP Procurement</option>
          <option value="utility_electricity">Utility Electricity</option>
          <option value="travel">Corporate Travel</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Scope</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Period</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Facility</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">CO₂e (kg)</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Flags</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      Loading…
                    </div>
                  </td>
                </tr>
              )}
              {!loading && data?.records.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    No records found. Ingest some data first.
                  </td>
                </tr>
              )}
              {!loading && data?.records.map((rec) => (
                <tr
                  key={rec.id}
                  onClick={() => setSelected(rec)}
                  className={`border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors ${
                    rec.is_anomaly ? "bg-amber-50/40" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <Badge className={SOURCE_COLORS[rec.source_type]}>{SOURCE_LABELS[rec.source_type]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={SCOPE_COLORS[rec.scope]}>S{rec.scope}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs tabular-nums">{rec.period_start}</td>
                  <td className="px-4 py-3 text-slate-700 truncate max-w-[140px]">
                    {rec.facility_name ?? rec.facility_code ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-800 tabular-nums">
                    {(rec.co2e_kg ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLORS[rec.review_status]}>{rec.review_status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {rec.is_anomaly && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" title={rec.anomaly_reason ?? ""} />}
                      {rec.locked_at && <Lock className="w-3.5 h-3.5 text-slate-400" title="Locked for audit" />}
                      {rec.was_edited && <Edit3 className="w-3.5 h-3.5 text-blue-400" title="Manually edited" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {!rec.locked_at && (
                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          disabled={actionBusy[rec.id] || rec.review_status === "approved"}
                          onClick={() => handleAction(rec.id, "approve")}
                          className="p-1 rounded hover:bg-emerald-100 text-emerald-600 disabled:opacity-30 transition-colors"
                          title="Approve"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          disabled={actionBusy[rec.id] || rec.review_status === "flagged"}
                          onClick={() => handleAction(rec.id, "flag")}
                          className="p-1 rounded hover:bg-amber-100 text-amber-600 disabled:opacity-30 transition-colors"
                          title="Flag"
                        >
                          <Flag className="w-4 h-4" />
                        </button>
                        <button
                          disabled={actionBusy[rec.id] || rec.review_status === "rejected"}
                          onClick={() => handleAction(rec.id, "reject")}
                          className="p-1 rounded hover:bg-red-100 text-red-600 disabled:opacity-30 transition-colors"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages} · {data.total} total
            </span>
            <div className="flex gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selected && (
        <RecordDrawer
          record={selected}
          onClose={() => setSelected(null)}
          onAction={handleAction}
        />
      )}
    </div>
  );
}
