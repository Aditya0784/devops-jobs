import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import AppLayout from "@/components/AppLayout";
import Overview from "@/pages/Overview";
import JobsPage from "@/pages/JobsPage";
import { ResumeProvider } from "@/lib/resumeContext";

function App() {
  return (
    <div className="App">
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "#09090b",
            border: "1px solid #27272a",
            color: "#f4f4f5",
            borderRadius: 0,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 13,
          },
        }}
      />
      <ResumeProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Overview />} />
              <Route path="/jobs/india" element={<JobsPage key="india" filterKey="region" filterValue="india" title="India MNCs" subtitle="Jobs located in India" />} />
              <Route path="/jobs/remote" element={<JobsPage key="remote" filterKey="region" filterValue="remote" title="Remote (India OK)" subtitle="Truly remote jobs that accept candidates from India" />} />
              <Route path="/jobs/new" element={<JobsPage key="new" filterKey="status" filterValue="new" title="To Check" subtitle="Newly scraped roles you haven't reviewed yet" />} />
              <Route path="/jobs/reviewed" element={<JobsPage key="reviewed" filterKey="status" filterValue="reviewed" title="Reviewed" subtitle="Roles you've opened and looked at" />} />
              <Route path="/jobs/applied" element={<JobsPage key="applied" filterKey="status" filterValue="applied" title="Applied" subtitle="Roles you've applied to" />} />
              <Route path="/jobs/linkedin" element={<JobsPage key="linkedin" filterKey="platform" filterValue="linkedin" title="LinkedIn (India)" subtitle="Best-effort scrape of LinkedIn India guest listings. May be rate-limited from server IP." />} />
              <Route path="/jobs/aws" element={<JobsPage key="aws" filterKey="tag" filterValue="aws" title="AWS / Cloud Jobs" subtitle="DevOps, SRE, and Architect roles that involve AWS — including Amazon's own openings" />} />
              <Route path="/jobs/kubernetes" element={<JobsPage key="kubernetes" filterKey="tag" filterValue="kubernetes" title="Kubernetes Jobs" subtitle="K8s / Helm / OpenShift roles" />} />
              <Route path="/jobs/terraform" element={<JobsPage key="terraform" filterKey="tag" filterValue="terraform" title="Terraform / IaC Jobs" subtitle="Infrastructure-as-Code roles" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ResumeProvider>
    </div>
  );
}

export default App;
