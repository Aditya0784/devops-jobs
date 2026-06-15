import { useState } from "react";
import { Upload, FileText, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { apiUploadResume } from "@/lib/api";

export default function ResumeUploader({ resume, setResume }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handle = async (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      toast.error("Only .pdf or .docx files supported");
      return;
    }
    setUploading(true);
    try {
      const data = await apiUploadResume(file);
      setResume({ id: data.id, filename: data.filename, chars: data.chars, preview: data.preview });
      toast.success(`Parsed ${data.chars} chars from ${data.filename}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Resume</div>
      {!resume ? (
        <label
          data-testid="resume-dropzone"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handle(e.dataTransfer.files?.[0]);
          }}
          className={`block border border-dashed p-6 cursor-pointer transition-colors ${
            dragOver ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-700 hover:border-emerald-500/50"
          }`}
        >
          <input
            data-testid="resume-file-input"
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => handle(e.target.files?.[0])}
            disabled={uploading}
          />
          <div className="flex flex-col items-center gap-2 text-center">
            <Upload className={`w-7 h-7 ${uploading ? "animate-pulse text-emerald-400" : "text-zinc-500"}`} />
            <div className="font-mono text-sm text-zinc-300">
              {uploading ? "Parsing..." : "Drop resume here"}
            </div>
            <div className="font-mono text-xs text-zinc-500">.pdf or .docx — max 10MB</div>
          </div>
        </label>
      ) : (
        <div className="space-y-3" data-testid="resume-loaded">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-emerald-400 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm text-zinc-100 truncate">{resume.filename}</div>
              <div className="font-mono text-xs text-zinc-500 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                {resume.chars} chars parsed
              </div>
            </div>
            <button
              data-testid="remove-resume-btn"
              onClick={() => setResume(null)}
              className="text-zinc-500 hover:text-rose-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <pre className="text-[11px] text-zinc-500 font-mono bg-zinc-950 border border-zinc-800 p-2 max-h-24 overflow-hidden whitespace-pre-wrap">
            {resume.preview}…
          </pre>
        </div>
      )}
    </div>
  );
}
