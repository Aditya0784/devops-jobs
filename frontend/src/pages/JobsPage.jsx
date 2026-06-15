import { useEffect, useState, useCallback, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, X, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { toast } from "sonner";
import { apiListJobs, apiSetJobStatus, apiJobFacets } from "@/lib/api";
import JobList from "@/components/JobList";
import ResumeUploader from "@/components/ResumeUploader";
import { useResume } from "@/lib/resumeContext";

const ROLE_TABS = [
  { key: "all", label: "All Roles" },
  { key: "devops", label: "DevOps" },
  { key: "sre", label: "SRE" },
  { key: "cloud_architect", label: "Cloud Arch" },
];

const PAGE_SIZE = 15;

export default function JobsPage({ filterKey, filterValue, title, subtitle }) {
  const { status: appStatus, refreshStats } = useOutletContext();
  const { resume, setResume } = useResume();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, total_pages: 1 });
  const [companies, setCompanies] = useState([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const resumeBoxRef = useRef(null);

  const reload = useCallback(async (overridePage) => {
    setLoading(true);
    setJobs([]);
    const targetPage = overridePage ?? page;
    try {
      const params = { role, q: q || undefined, page: targetPage, page_size: PAGE_SIZE };
      params[filterKey] = filterValue;
      if (companyFilter) params.company = companyFilter;
      const r = await apiListJobs(params);
      setJobs(r.jobs || []);
      setPageInfo({ total: r.total, total_pages: r.total_pages });
    } catch {
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [filterKey, filterValue, role, q, page, companyFilter]);

  // Load companies list for the filter dropdown when filter/role changes
  useEffect(() => {
    const params = { role };
    params[filterKey] = filterValue;
    apiJobFacets(params).then((r) => setCompanies(r.companies || [])).catch(() => {});
  }, [filterKey, filterValue, role]);

  // Reset to page 1 whenever filter/role/company changes
  useEffect(() => { setPage(1); }, [filterKey, filterValue, role, companyFilter]);
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [filterKey, filterValue, role, page, companyFilter]);

  useEffect(() => {
    const h = () => reload();
    window.addEventListener("jobs:refresh", h);
    return () => window.removeEventListener("jobs:refresh", h);
  }, [reload]);

  const updateJobStatus = async (job, newStatus) => {
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: newStatus } : j)));
    try {
      await apiSetJobStatus(job.id, newStatus);
      refreshStats?.();
      if (filterKey === "status" && newStatus !== filterValue) {
        setJobs((prev) => prev.filter((j) => j.id !== job.id));
      }
    } catch {
      toast.error("Could not update status");
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: job.status } : j)));
    }
  };

  const focusResume = () => {
    resumeBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6" data-testid={`page-${filterKey}-${filterValue}`}>
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-zinc-400 mt-1">{subtitle}</p>
      </div>

      {/* Resume bar — compact, sticky reminder */}
      <div ref={resumeBoxRef}>
        {resume ? (
          <div className="border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex items-center justify-between gap-3" data-testid="resume-bar">
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-zinc-100 truncate">
                  Resume loaded: <span className="font-mono text-emerald-400">{resume.filename}</span>
                </div>
                <div className="text-[11px] text-zinc-500 font-mono">
                  {resume.chars} chars · ready to tailor on any job below
                </div>
              </div>
            </div>
            <button
              data-testid="remove-resume-btn"
              onClick={() => setResume(null)}
              className="text-zinc-500 hover:text-rose-400 flex items-center gap-1 text-xs"
            >
              <X className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        ) : (
          <ResumeUploader resume={resume} setResume={setResume} />
        )}
        {!appStatus?.llm_ready && (
          <div className="mt-2 flex items-start gap-2 text-xs text-amber-400 font-mono">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>AI engine is not configured yet — set LLM_API_KEY in backend/.env to enable resume tailoring.</span>
          </div>
        )}
      </div>

      {/* Jobs list */}
      <div className="border border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center border-b border-zinc-800">
          {ROLE_TABS.map((t) => (
            <button
              key={t.key}
              data-testid={`role-tab-${t.key}`}
              onClick={() => setRole(t.key)}
              className={`flex-1 px-4 py-3 text-xs font-medium tracking-wide transition-colors ${
                role === t.key
                  ? "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5"
                  : "text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-3 border-b border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <input
              data-testid="job-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && reload()}
              placeholder="Search by keyword, e.g. kubernetes, aws, terraform"
              className="flex-1 bg-transparent text-sm placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-950 px-2 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-zinc-500" />
              <select
                data-testid="company-filter"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none font-mono min-w-[140px]"
              >
                <option value="">All companies ({companies.reduce((a, c) => a + c.count, 0)})</option>
                {companies.map((c) => (
                  <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
                ))}
              </select>
              {companyFilter && (
                <button
                  data-testid="clear-company-filter"
                  onClick={() => setCompanyFilter("")}
                  className="text-zinc-500 hover:text-rose-400"
                  title="Clear company filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              data-testid="search-btn"
              onClick={reload}
              className="text-xs font-medium text-zinc-400 hover:text-emerald-400 px-3 py-1.5 border border-zinc-800 hover:border-emerald-500/40"
            >
              Search
            </button>
          </div>
        </div>
        <JobList
          jobs={jobs}
          loading={loading}
          onStatusChange={updateJobStatus}
          resume={resume}
          llmReady={!!appStatus?.llm_ready}
          onSelectForResume={focusResume}
        />
        <Pagination
          page={page}
          totalPages={pageInfo.total_pages}
          total={pageInfo.total}
          pageSize={PAGE_SIZE}
          onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        />
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, total, pageSize, onChange }) {
  if (!total) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pages = [];
  // Compact page list: 1 ... p-1 p p+1 ... last
  const push = (p) => pages.push(p);
  const seen = new Set();
  for (const p of [1, page - 1, page, page + 1, totalPages]) {
    if (p >= 1 && p <= totalPages && !seen.has(p)) { seen.add(p); push(p); }
  }
  pages.sort((a, b) => a - b);
  const withEllipsis = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) withEllipsis.push("…");
    withEllipsis.push(p);
  });

  return (
    <div className="border-t border-zinc-800 px-4 py-3 flex items-center justify-between gap-3" data-testid="pagination">
      <div className="text-xs font-mono text-zinc-500">
        Showing <span className="text-zinc-200">{start}–{end}</span> of <span className="text-zinc-200">{total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          data-testid="page-prev"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="px-2 py-1 border border-zinc-800 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 text-xs"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Prev
        </button>
        {withEllipsis.map((p, i) =>
          p === "…" ? (
            <span key={`e-${i}`} className="px-2 text-zinc-600 text-xs font-mono">…</span>
          ) : (
            <button
              key={p}
              data-testid={`page-${p}`}
              onClick={() => onChange(p)}
              className={`min-w-[28px] px-2 py-1 border text-xs font-mono ${
                p === page
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          data-testid="page-next"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="px-2 py-1 border border-zinc-800 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 text-xs"
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
