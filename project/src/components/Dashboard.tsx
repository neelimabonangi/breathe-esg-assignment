import { useEffect, useState } from "react";
import { callEdge, DEMO_TENANT } from "../lib/supabase";
import { Stats, SOURCE_LABELS } from "../lib/types";
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, Zap, Car, Factory } from "lucide-react";

function fmt(n: number, digits = 0) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(digits);
}

function tCO2e(kg: number) {
  return (kg / 1000).toFixed(1);
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, sub, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function Dashboard({ onNavigate }: { onNavigate: (p: "review") => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callEdge(`/stats?tenant_id=${DEMO_TENANT}`)
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) return <div className="text-slate-500">Failed to load stats.</div>;

  const totalTCO2e = stats.total_co2e_kg / 1000;
  const scope1 = (stats.by_scope[1] ?? 0) / 1000;
  const scope2 = (stats.by_scope[2] ?? 0) / 1000;
  const scope3 = (stats.by_scope[3] ?? 0) / 1000;

  const sourceBreakdown = Object.entries(stats.by_source).map(([k, v]) => ({
    source: SOURCE_LABELS[k] ?? k,
    co2e: v / 1000,
    pct: stats.total_co2e_kg ? ((v / stats.total_co2e_kg) * 100) : 0,
  })).sort((a, b) => b.co2e - a.co2e);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Emissions Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Q1 2024 · Acme Manufacturing Corp</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Emissions"
          value={`${totalTCO2e.toFixed(1)} tCO₂e`}
          sub="all scopes"
          icon={<TrendingUp className="w-5 h-5 text-slate-600" />}
          color="bg-slate-100"
        />
        <StatCard
          label="Scope 1 · Direct"
          value={`${scope1.toFixed(1)} t`}
          sub="fuel combustion"
          icon={<Factory className="w-5 h-5 text-red-600" />}
          color="bg-red-50"
        />
        <StatCard
          label="Scope 2 · Electricity"
          value={`${scope2.toFixed(1)} t`}
          sub="purchased power"
          icon={<Zap className="w-5 h-5 text-yellow-600" />}
          color="bg-yellow-50"
        />
        <StatCard
          label="Scope 3 · Travel"
          value={`${scope3.toFixed(1)} t`}
          sub="business travel + procurement"
          icon={<Car className="w-5 h-5 text-green-600" />}
          color="bg-green-50"
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Pending Review"
          value={fmt(stats.by_status.pending ?? 0)}
          sub="records awaiting sign-off"
          icon={<Clock className="w-5 h-5 text-slate-500" />}
          color="bg-slate-100"
        />
        <StatCard
          label="Approved"
          value={fmt(stats.by_status.approved ?? 0)}
          sub="locked for audit"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          color="bg-emerald-50"
        />
        <StatCard
          label="Anomalies"
          value={fmt(stats.anomaly_count)}
          sub="flagged for review"
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
          color="bg-amber-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Scope breakdown bar chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Emissions by Scope</h2>
          <div className="space-y-3">
            {[
              { label: "Scope 1 · Direct Combustion", value: scope1, color: "bg-red-400", total: totalTCO2e },
              { label: "Scope 2 · Purchased Electricity", value: scope2, color: "bg-yellow-400", total: totalTCO2e },
              { label: "Scope 3 · Value Chain", value: scope3, color: "bg-green-400", total: totalTCO2e },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{s.label}</span>
                  <span className="font-medium">{s.value.toFixed(1)} tCO₂e</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${s.color} rounded-full transition-all duration-700`}
                    style={{ width: s.total ? `${(s.value / s.total) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Emissions by Source</h2>
          <div className="space-y-3">
            {sourceBreakdown.map((s) => (
              <div key={s.source}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{s.source}</span>
                  <span className="font-medium">{s.co2e.toFixed(1)} t ({s.pct.toFixed(0)}%)</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              </div>
            ))}
            {sourceBreakdown.length === 0 && (
              <p className="text-sm text-slate-400">No data yet. Ingest some records.</p>
            )}
          </div>
        </div>
      </div>

      {/* Review status + recent runs */}
      <div className="grid grid-cols-2 gap-6">
        {/* Review queue */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Review Queue</h2>
            <button
              onClick={() => onNavigate("review")}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Open review →
            </button>
          </div>
          <div className="space-y-2">
            {[
              { label: "Pending", count: stats.by_status.pending ?? 0, color: "bg-slate-200", text: "text-slate-700" },
              { label: "Flagged", count: stats.by_status.flagged ?? 0, color: "bg-amber-200", text: "text-amber-800" },
              { label: "Approved", count: stats.by_status.approved ?? 0, color: "bg-emerald-200", text: "text-emerald-800" },
              { label: "Rejected", count: stats.by_status.rejected ?? 0, color: "bg-red-200", text: "text-red-800" },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${s.color}`} />
                  <span className="text-sm text-slate-600">{s.label}</span>
                </div>
                <span className={`text-sm font-semibold ${s.text}`}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent runs */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Recent Ingestions</h2>
          {stats.recent_runs.length === 0 ? (
            <p className="text-sm text-slate-400">No ingestion runs yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.recent_runs.slice(0, 5).map((run) => (
                <div key={run.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{SOURCE_LABELS[run.source_type] ?? run.source_type}</div>
                    <div className="text-xs text-slate-400">{new Date(run.ingested_at).toLocaleDateString()} · {run.record_count} records</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    run.status === "complete" ? "bg-emerald-100 text-emerald-700" :
                    run.status === "failed" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {run.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
