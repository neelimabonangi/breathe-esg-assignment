import { ReactNode } from "react";
import { Activity, BarChart3, Upload, ClipboardCheck, Leaf } from "lucide-react";

interface Props {
  children: ReactNode;
  page: "dashboard" | "ingest" | "review" | "history";
  onNavigate: (page: "dashboard" | "ingest" | "review" | "history") => void;
}

const nav = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "ingest", label: "Ingest Data", icon: Upload },
  { key: "review", label: "Review", icon: ClipboardCheck },
  { key: "history", label: "Run History", icon: Activity },
] as const;

export function Layout({ children, page, onNavigate }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Breathe ESG</div>
              <div className="text-xs text-slate-500">Acme Manufacturing</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ key, label, icon: Icon }) => {
            const active = page === key;
            return (
              <button
                key={key}
                onClick={() => onNavigate(key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-emerald-600" : "text-slate-400"}`} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center">
              <span className="text-xs font-semibold text-slate-600">NB</span>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-800">Neelima Bonangi</div>
              <div className="text-xs text-slate-400">Analyst</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-8 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
