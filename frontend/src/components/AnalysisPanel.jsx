import { useState } from "react";
import { Sparkles, Download, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { apiAnalyze, apiDownload, downloadBlob } from "@/lib/api";

export default function AnalysisPanel({ job, resume, analysis, setAnalysis, llmReady }) {
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(null);

  const canAnalyze = !!job && !!resume && !!llmReady;

  const runAnalysis = async () => {
    if (!resume) return toast.error("Upload your resume first");
    if (!job) return toast.error("Select a job from the list");
    if (!llmReady) return toast.error("Server LLM key not configured yet");
    setBusy(true);
    toast.message("Analyzing fit...", { description: "Running resume vs JD match" });
    try {
      const r = await apiAnalyze({ resume_id: resume.id, job_id: job.id });
      setAnalysis(r);
      toast.success(`Match score: ${r.match_score}/100`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  const download = async (format) => {
    if (!analysis) return;
    setDownloading(format);
    try {
      const res = await apiDownload(analysis.id, format);
      downloadBlob(res.data, `tailored_resume_${analysis.id.slice(0, 8)}.${format}`);
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="border border-zinc-800 bg-zinc-900/50 sticky top-24" data-testid="analysis-panel">
      <div className="border-b border-zinc-800 px-5 py-3 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Analysis</div>
        {analysis && <ScorePill score={analysis.match_score} />}
      </div>

      <div className="p-5">
        {!job ? (
          <Empty title="No job selected" hint="Pick a role from the list to analyze fit." />
        ) : (
          <>
            <div className="mb-4">
              <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Selected Role</div>
              <div className="text-sm text-zinc-100 mt-1 font-medium">{job.title}</div>
              <div className="text-xs text-emerald-400 mt-0.5 font-mono">@ {job.company}</div>
            </div>

            <button
              data-testid="run-analysis-btn"
              onClick={runAnalysis}
              disabled={busy || !canAnalyze}
              className="w-full text-xs font-medium tracking-wide bg-emerald-500 text-zinc-950 px-4 py-2.5 hover:bg-emerald-400 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
            >
              <Sparkles className={`w-3.5 h-3.5 ${busy ? "animate-pulse" : ""}`} />
              {busy ? "Analyzing..." : "Analyze & Tailor"}
            </button>

            {!canAnalyze && (
              <div className="mt-3 flex items-start gap-2 text-xs text-amber-400 font-mono" data-testid="analysis-prereq-warning">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  {!resume && "Upload resume. "}
                  {!llmReady && "AI engine warming up — try in a moment."}
                </span>
              </div>
            )}

            {analysis && (
              <div className="mt-5 space-y-4" data-testid="analysis-results">
                <Section title="Summary">
                  <p className="text-sm text-zinc-200 leading-relaxed">{analysis.summary}</p>
                </Section>

                <Section title={`Matched skills (${analysis.matched_skills.length})`}>
                  <Pills items={analysis.matched_skills} color="emerald" />
                </Section>

                <Section title={`Missing skills (${analysis.missing_skills.length})`}>
                  <Pills items={analysis.missing_skills} color="rose" />
                </Section>

                <Section title={`Keywords to add (${analysis.keywords_to_add.length})`}>
                  <Pills items={analysis.keywords_to_add} color="amber" />
                </Section>

                <Section title={`Suggestions (${analysis.suggestions.length})`}>
                  <ul className="space-y-2">
                    {analysis.suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-zinc-300 border-l-2 border-emerald-500/40 pl-3 py-1">
                        <span className="text-emerald-400 uppercase font-mono">[{s.action}]</span>{" "}
                        <span className="text-zinc-500 font-mono">{s.section}:</span>{" "}
                        <span>{s.detail}</span>
                      </li>
                    ))}
                  </ul>
                </Section>

                <div className="pt-2 border-t border-zinc-800 grid grid-cols-2 gap-2">
                  <button
                    data-testid="download-pdf-btn"
                    onClick={() => download("pdf")}
                    disabled={!!downloading}
                    className="text-xs font-medium tracking-wide border border-zinc-800 text-zinc-300 px-3 py-2 hover:border-emerald-500/50 hover:text-emerald-400 flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloading === "pdf" ? "..." : "PDF"}
                  </button>
                  <button
                    data-testid="download-docx-btn"
                    onClick={() => download("docx")}
                    disabled={!!downloading}
                    className="text-xs font-medium tracking-wide border border-zinc-800 text-zinc-300 px-3 py-2 hover:border-emerald-500/50 hover:text-emerald-400 flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {downloading === "docx" ? "..." : "DOCX"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ScorePill({ score }) {
  const color =
    score >= 80 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
    : score >= 50 ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
    : "text-rose-400 border-rose-500/40 bg-rose-500/10";
  return (
    <span className={`font-mono text-xs px-2 py-0.5 border ${color}`} data-testid="match-score">
      {score}/100
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-mono">{title}</div>
      {children}
    </div>
  );
}

function Pills({ items, color }) {
  if (!items?.length) return <div className="text-xs text-zinc-600 font-mono">—</div>;
  const cls = {
    emerald: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
    rose: "border-rose-500/30 text-rose-400 bg-rose-500/10",
    amber: "border-amber-500/30 text-amber-400 bg-amber-500/10",
  }[color];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span key={i} className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${cls}`}>
          {it}
        </span>
      ))}
    </div>
  );
}

function Empty({ title, hint }) {
  return (
    <div className="text-center py-8">
      <div className="text-sm text-zinc-400">{title}</div>
      <div className="text-xs text-zinc-600 mt-1">{hint}</div>
    </div>
  );
}
