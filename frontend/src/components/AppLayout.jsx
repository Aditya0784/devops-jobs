import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, MapPin, Globe, Eye, CheckCircle2, Send,
  RefreshCw, Clock, Cloud, Boxes, Layers, Linkedin,
} from "lucide-react";
import { toast } from "sonner";
import { apiJobsStats, apiStatus, apiScrape } from "@/lib/api";

const formatRelative = (iso) => {
  if (!iso) return "never";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
};

export default function AppLayout() {
  const [stats, setStats] = useState({ by_status: { new: 0, reviewed: 0, applied: 0 }, by_region: { india: 0, remote: 0 }, by_tag: {}, by_platform: {}, total: 0 });
  const [status, setStatus] = useState(null);
  const [scraping, setScraping] = useState(false);
  const location = useLocation();

  const refresh = async () => {
    try { setStats(await apiJobsStats()); } catch { /* ignore */ }
    try { setStatus(await apiStatus()); } catch { /* ignore */ }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  // Refresh stats whenever the route changes (e.g. user marked something on the jobs page)
  useEffect(() => { refresh(); }, [location.pathname]);

  const handleRefreshNow = async () => {
    setScraping(true);
    toast.message("Refreshing jobs...", { description: "Scanning company career pages" });
    try {
      const r = await apiScrape(null);
      toast.success(`Updated: ${r.count} matching roles found`);
      await refresh();
      window.dispatchEvent(new CustomEvent("jobs:refresh"));
    } catch {
      toast.error("Refresh failed");
    } finally {
      setScraping(false);
    }
  };

  const nav = [
    { to: "/", label: "Overview", icon: LayoutDashboard, exact: true },
    { section: "Sources" },
    { to: "/jobs/india", label: "India MNCs", icon: MapPin, count: stats.by_region.india },
    { to: "/jobs/remote", label: "Remote (India OK)", icon: Globe, count: stats.by_region.remote || 0 },
    { to: "/jobs/linkedin", label: "LinkedIn", icon: Linkedin, count: stats.by_platform?.linkedin || 0 },
    { section: "Categories" },
    { to: "/jobs/aws", label: "AWS / Cloud", icon: Cloud, count: stats.by_tag?.aws || 0 },
    { to: "/jobs/kubernetes", label: "Kubernetes", icon: Boxes, count: stats.by_tag?.kubernetes || 0 },
    { to: "/jobs/terraform", label: "Terraform / IaC", icon: Layers, count: stats.by_tag?.terraform || 0 },
    { section: "Pipeline" },
    { to: "/jobs/new", label: "To Check", icon: Eye, count: stats.by_status.new },
    { to: "/jobs/reviewed", label: "Reviewed", icon: CheckCircle2, count: stats.by_status.reviewed },
    { to: "/jobs/applied", label: "Applied", icon: Send, count: stats.by_status.applied },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-zinc-800 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-zinc-800 flex items-center gap-3">
          <img
            src="/logo.png"
            alt="AdityaJobTool"
            className="w-11 h-11 object-contain bg-zinc-100 border border-zinc-700"
            data-testid="sidebar-logo"
          />
          <div>
            <div className="text-base font-semibold tracking-tight">AdityaJobTool</div>
            <div className="text-[10px] font-mono text-zinc-500">DevOps · SRE · Cloud Arch</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" data-testid="sidebar-nav">
          {nav.map((n, i) =>
            n.section ? (
              <div key={i} className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-mono">
                {n.section}
              </div>
            ) : (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.exact}
                data-testid={`nav-${n.to.replace(/\//g, "-")}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400 -ml-[2px] pl-[10px]"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                  }`
                }
              >
                <n.icon className="w-4 h-4" strokeWidth={1.75} />
                <span className="flex-1">{n.label}</span>
                {typeof n.count === "number" && (
                  <span className="text-[11px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5">
                    {n.count}
                  </span>
                )}
              </NavLink>
            ),
          )}
        </nav>

        <div className="px-4 py-3 border-t border-zinc-800 text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            <span>Updated {formatRelative(status?.last_scrape)}</span>
          </div>
          <div className="mt-1 text-zinc-600">
            auto twice daily · {(status?.scrape_times_ist || ["08:00", "20:00"]).join(" & ")} IST
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar (mobile + actions) */}
        <header className="border-b border-zinc-800 sticky top-0 z-30 bg-zinc-950/95 backdrop-blur">
          <div className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="md:hidden flex items-center gap-2">
              <img src="/logo.png" alt="" className="w-7 h-7 object-contain bg-zinc-100" />
              <span className="font-semibold">AdityaJobTool</span>
            </div>
            <div className="hidden md:block text-xs font-mono text-zinc-500">
              <span className="text-emerald-400">●</span> online · {stats.total} roles tracked
            </div>
            <button
              data-testid="refresh-now-btn"
              onClick={handleRefreshNow}
              disabled={scraping}
              className="text-xs font-medium tracking-wide bg-emerald-500 text-zinc-950 px-4 py-2 hover:bg-emerald-400 disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scraping ? "animate-spin" : ""}`} />
              {scraping ? "Refreshing..." : "Refresh Now"}
            </button>
          </div>

          {/* Mobile nav strip */}
          <div className="md:hidden flex overflow-x-auto border-t border-zinc-800">
            {nav.filter((n) => n.to).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.exact}
                className={({ isActive }) =>
                  `flex-shrink-0 px-4 py-2 text-xs whitespace-nowrap ${
                    isActive ? "text-emerald-400 border-b-2 border-emerald-400" : "text-zinc-500"
                  }`
                }
              >
                {n.label}{typeof n.count === "number" ? ` (${n.count})` : ""}
              </NavLink>
            ))}
          </div>
        </header>

        <main className="flex-1 px-6 py-8 max-w-[1280px] w-full">
          <Outlet context={{ stats, status, refreshStats: refresh }} />
        </main>

        <footer className="border-t border-zinc-800 py-4">
          <div className="px-6 text-xs font-mono text-zinc-500 flex flex-wrap items-center justify-between gap-3">
            <span>AdityaJobTool · auto-refreshing twice daily at {(status?.scrape_times_ist || ["08:00", "20:00"]).join(" & ")} IST</span>
            <span>{stats.total} roles · {stats.by_region.india} India · {stats.by_region.remote || 0} Remote</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
