import { useState } from "react";
import { ExternalLink, MapPin, Check, Eye, Send, Sparkles, ChevronDown, Download, FileText, AlertCircle, X, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { apiAnalyze, apiDownload, downloadBlob } from "@/lib/api";

const ROLE_BADGE = {
  devops: { label: "DEVOPS", cls: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" },
  sre: { label: "SRE", cls: "border-cyan-500/30 text-cyan-400 bg-cyan-500/10" },
  cloud_architect: { label: "ARCH", cls: "border-amber-500/30 text-amber-400 bg-amber-500/10" },
};

const STATUS_OPTIONS = [
  { key: "new", short: "New", icon: Eye },
  { key: "reviewed", short: "Reviewed", icon: Check },
  { key: "applied", short: "Applied", icon: Send },
  { key: "ignored", short: "Ignore", icon: EyeOff },
];

const STATUS_BAR_CLS = {
  new: "border-l-2 border-transparent",
  reviewed: "border-l-2 border-cyan-400/70",
  applied: "border-l-2 border-emerald-400",
  ignored: "border-l-2 border-rose-500/50 opacity-60",
};

export default function JobList({ jobs, loading, onStatusChange, resume, llmReady, onSelectForResume }) {
  if (loading) {
    return (
      <div className="p-8 text-center font-mono text-zinc-500 text-sm" data-testid="jobs-loading">
        <span className="inline-block animate-pulse">[ loading jobs... ]</span>
      </div>
    );
  }
  if (!jobs.length) {
    return (
      <div className="p-8 text-center font-mono text-zinc-500 text-sm" data-testid="jobs-empty">
        <div>No jobs in this view</div>
        <div className="mt-2 text-xs">Click <span className="text-emerald-400">Refresh Now</span> or switch tabs.</div>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-zinc-800" data-testid="jobs-list">
      {jobs.map((j) => (
        <JobRow
          key={j.id}
          job={j}
          onStatusChange={onStatusChange}
          resume={resume}
          llmReady={llmReady}
          onSelectForResume={onSelectForResume}
        />
      ))}
    </ul>
  );
}

function JobRow({ job, onStatusChange, resume, llmReady, onSelectForResume }) {
  const badge = ROLE_BADGE[job.role_type] || ROLE_BADGE.devops;
  const status = job.status || "new";
  const [expanded, setExpanded] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(null);

  const runTailor = async () => {
    if (!resume) {
      onSelectForResume?.();
      return toast.error("Upload your resume first (drop it in the Resume box above).");
    }
    if (!llmReady) return toast.error("AI engine not configured yet.");
    setBusy(true);
    setExpanded(true);
    try {
      const r = await apiAnalyze({ resume_id: resume.id, job_id: job.id });
      setAnalysis(r);
      toast.success(`Match score: ${r.match_score}/100`);
      if (status === "new") onStatusChange(job, "reviewed");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Tailoring failed");
    } finally {
      setBusy(false);
    }
  };

  const download = async (format) => {
    if (!analysis) return;
    setDownloading(format);
    try {
      const res = await apiDownload(analysis.id, format);
      downloadBlob(res.data, `tailored_${job.company.replace(/\s+/g, "_")}_${analysis.id.slice(0, 6)}.${format}`);
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <li data-testid={`job-${job.id}`} className={`${STATUS_BAR_CLS[status] || "border-l-2 border-transparent"} ${expanded ? "bg-zinc-900/60" : ""} transition-colors`}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="font-medium text-sm text-zinc-100 flex-1">{job.title}</div>
              {job.experience_text && (
                <span
                  data-testid={`exp-${job.id}`}
                  className="text-[10px] font-mono text-amber-300 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 whitespace-nowrap"
                  title="Estimated experience required"
                >
                  {job.experience_text}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 font-mono">
              <span className="text-emerald-400">{job.company}</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {job.location || "Remote"}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 border ${badge.cls}`}>
              {badge.label}
            </span>
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              data-testid={`job-external-${job.id}`}
              className="text-zinc-500 hover:text-emerald-400"
              title="Open job posting"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Action row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {status !== "ignored" && (
            <button
              data-testid={`tailor-btn-${job.id}`}
              onClick={runTailor}
              disabled={busy}
              className="text-[11px] font-medium tracking-wide bg-emerald-500 text-zinc-950 px-3 py-1.5 hover:bg-emerald-400 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className={`w-3 h-3 ${busy ? "animate-pulse" : ""}`} />
              {busy ? "Tailoring..." : analysis ? "Re-tailor" : "Tailor Resume"}
            </button>
          )}

          {STATUS_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = status === opt.key;
            const base = "text-[10px] font-medium tracking-wide px-2 py-1 border flex items-center gap-1 transition-colors";
            const inactive = "border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-600";
            const activeCls = {
              new: "border-zinc-600 text-zinc-200 bg-zinc-800",
              reviewed: "border-cyan-500/50 text-cyan-300 bg-cyan-500/15",
              applied: "border-emerald-500/60 text-emerald-300 bg-emerald-500/20",
              ignored: "border-rose-500/50 text-rose-300 bg-rose-500/15",
            }[opt.key];
            return (
              <button
                key={opt.key}
                data-testid={`status-${opt.key}-${job.id}`}
                onClick={() => { if (!isActive) onStatusChange(job, opt.key); }}
                className={`${base} ${isActive ? activeCls : inactive}`}
              >
                <Icon className="w-3 h-3" strokeWidth={2} />
                {opt.short}
              </button>
            );
          })}

          {(analysis || expanded) && (
            <button
              data-testid={`toggle-${job.id}`}
              onClick={() => setExpanded((v) => !v)}
              className="ml-auto text-[11px] text-zinc-400 hover:text-zinc-100 flex items-center gap-1"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
              {expanded ? "Hide details" : "Show details"}
            </button>
          )}
        </div>

        {!resume && status !== "ignored" && (
          <div className="mt-2 text-[11px] text-zinc-500 font-mono flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Upload a resume above to enable tailoring for this job.
          </div>
        )}
      </div>

      {/* Inline expanded analysis */}
      {expanded && (busy || analysis) && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-800/60" data-testid={`analysis-${job.id}`}>
          {busy && !analysis ? (
            <div className="py-6 text-center font-mono text-xs text-zinc-500 animate-pulse">
              Analyzing resume against this job…
            </div>
          ) : analysis ? (
            <div className="space-y-4 pt-3">
              <div className="flex items-center justify-between">
                <ScorePill score={analysis.match_score} />
                <button onClick={() => setExpanded(false)} className="text-zinc-500 hover:text-zinc-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed">{analysis.summary}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <PillSection title="Matched" items={analysis.matched_skills} color="emerald" />
                <PillSection title="Missing" items={analysis.missing_skills} color="rose" />
                <PillSection title="Add keywords" items={analysis.keywords_to_add} color="amber" />
              </div>

              {analysis.suggestions?.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-mono">Suggestions</div>
                  <ul className="space-y-1.5">
                    {analysis.suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-zinc-300 border-l-2 border-emerald-500/40 pl-3 py-0.5">
                        <span className="text-emerald-400 uppercase font-mono">[{s.action}]</span>{" "}
                        <span className="text-zinc-500 font-mono">{s.section}:</span>{" "}
                        <span>{s.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.tailored_resume && (
                <details className="border border-zinc-800 bg-zinc-950">
                  <summary className="px-3 py-2 cursor-pointer text-xs font-mono text-zinc-400 hover:text-emerald-400">
                    Preview tailored resume
                  </summary>
                  <pre className="px-3 pb-3 text-[11px] text-zinc-300 font-mono whitespace-pre-wrap max-h-72 overflow-y-auto">
                    {analysis.tailored_resume}
                  </pre>
                </details>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  data-testid={`download-pdf-${job.id}`}
                  onClick={() => download("pdf")}
                  disabled={!!downloading}
                  className="text-xs font-medium tracking-wide border border-zinc-800 text-zinc-300 px-3 py-2 hover:border-emerald-500/50 hover:text-emerald-400 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloading === "pdf" ? "..." : "Download PDF"}
                </button>
                <button
                  data-testid={`download-docx-${job.id}`}
                  onClick={() => download("docx")}
                  disabled={!!downloading}
                  className="text-xs font-medium tracking-wide border border-zinc-800 text-zinc-300 px-3 py-2 hover:border-emerald-500/50 hover:text-emerald-400 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {downloading === "docx" ? "..." : "Download DOCX"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </li>
  );
}

function ScorePill({ score }) {
  const color =
    score >= 80 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
    : score >= 50 ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
    : "text-rose-400 border-rose-500/40 bg-rose-500/10";
  return (
    <span className={`font-mono text-xs px-2 py-0.5 border ${color}`} data-testid="match-score">
      Match {score}/100
    </span>
  );
}

function PillSection({ title, items, color }) {
  const cls = {
    emerald: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
    rose: "border-rose-500/30 text-rose-400 bg-rose-500/10",
    amber: "border-amber-500/30 text-amber-400 bg-amber-500/10",
  }[color];
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5 font-mono">{title}</div>
      {items?.length ? (
        <div className="flex flex-wrap gap-1">
          {items.map((it, i) => (
            <span key={i} className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${cls}`}>{it}</span>
          ))}
        </div>
      ) : (
        <div className="text-xs text-zinc-600 font-mono">—</div>
      )}
    </div>
  );
}
