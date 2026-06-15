import { useOutletContext, Link } from "react-router-dom";
import { MapPin, Globe, Eye, CheckCircle2, Send, ArrowRight, FileUp } from "lucide-react";
import ResumeUploader from "@/components/ResumeUploader";
import { useResume } from "@/lib/resumeContext";

function Tile({ to, icon: Icon, title, value, hint, tone = "emerald", testid }) {
  const tones = {
    emerald: "text-emerald-400",
    cyan: "text-cyan-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    zinc: "text-zinc-100",
  };
  return (
    <Link
      to={to}
      data-testid={testid}
      className="group block border border-zinc-800 bg-zinc-900/50 hover:border-emerald-500/40 hover:bg-zinc-900 transition-colors p-5"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">{title}</div>
          <div className={`font-mono text-3xl ${tones[tone]}`}>{value}</div>
          {hint && <div className="text-xs text-zinc-500 mt-1">{hint}</div>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Icon className={`w-5 h-5 ${tones[tone]}`} strokeWidth={1.75} />
          <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
        </div>
      </div>
    </Link>
  );
}

export default function Overview() {
  const { stats } = useOutletContext();
  const { resume, setResume } = useResume();

  return (
    <div className="space-y-8" data-testid="overview-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-zinc-400 mt-1">Your DevOps · SRE · Cloud Architect job pipeline at a glance.</p>
      </div>

      {/* Sources */}
      <section>
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3 font-mono">Sources</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Tile testid="tile-india" to="/jobs/india" icon={MapPin} title="India" value={stats.by_region.india} hint="Jobs located in India" tone="amber" />
          <Tile testid="tile-remote" to="/jobs/remote" icon={Globe} title="Remote (India OK)" value={stats.by_region.remote || 0} hint="Truly remote, accepts India" tone="cyan" />
        </div>
      </section>

      {/* Pipeline */}
      <section>
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3 font-mono">Pipeline</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Tile testid="tile-new" to="/jobs/new" icon={Eye} title="To Check" value={stats.by_status.new} hint="Not reviewed yet" tone="zinc" />
          <Tile testid="tile-reviewed" to="/jobs/reviewed" icon={CheckCircle2} title="Reviewed" value={stats.by_status.reviewed} hint="You've looked at these" tone="cyan" />
          <Tile testid="tile-applied" to="/jobs/applied" icon={Send} title="Applied" value={stats.by_status.applied} hint="Applications submitted" tone="emerald" />
        </div>
      </section>

      {/* Resume */}
      <section>
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3 font-mono flex items-center gap-2">
          <FileUp className="w-3.5 h-3.5" /> Resume
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ResumeUploader resume={resume} setResume={setResume} />
          <div className="border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="text-sm text-zinc-100 font-medium">How tailoring works</div>
            <ol className="mt-3 space-y-2 text-xs text-zinc-400 font-mono leading-relaxed list-decimal list-inside">
              <li>Upload your resume here (PDF or DOCX).</li>
              <li>Open any job from <span className="text-emerald-400">India</span> or <span className="text-emerald-400">Remote (India OK)</span>.</li>
              <li>Click <span className="text-zinc-100">Analyze &amp; Tailor</span> — get a match score, gaps, and a rewritten resume.</li>
              <li>Download the tailored resume as PDF or DOCX.</li>
            </ol>
            <div className="mt-4 text-[11px] text-zinc-500 font-mono">
              Tip: clicking a job auto-moves it to <span className="text-cyan-400">Reviewed</span>. Mark <span className="text-emerald-400">Applied</span> after submitting.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
