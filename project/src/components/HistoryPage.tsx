import { useEffect, useState } from "react";
import { supabase, DEMO_TENANT } from "../lib/supabase";
import { IngestionRun, SOURCE_LABELS } from "../lib/types";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw } from "lucide-react";

export function HistoryPage() {
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("ingestion_runs")
      .select("*")
      .eq("tenant_id", DEMO_TENANT)
      .order("ingested_at", { ascending: false })
      .limit(50);
    setRuns(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Ingestion Run History</h1>
          <p className="text-sm text-slate-500 mt-1">All data ingestion events for this tenant.</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">No ingestion runs yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">File</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ingested By</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Records</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Errors</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {SOURCE_LABELS[run.source_type] ?? run.source_type}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono truncate max-w-[160px]">
                    {run.filename ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{run.ingested_by}</td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums text-xs">
                    {new Date(run.ingested_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-800 font-medium">
                    {run.record_count}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {run.error_count > 0 ? (
                      <span className="text-amber-600 font-medium flex items-center justify-end gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {run.error_count}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {run.status === "complete" && (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                      </span>
                    )}
                    {run.status === "failed" && (
                      <span className="flex items-center gap-1.5 text-xs text-red-700 font-medium">
                        <XCircle className="w-3.5 h-3.5" /> Failed
                      </span>
                    )}
                    {run.status === "processing" && (
                      <span className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
