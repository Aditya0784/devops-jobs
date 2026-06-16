import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}`;

const http = axios.create({ baseURL: API });

export const apiStatus = () => http.get("/").then((r) => r.data);
export const apiListCompanies = () => http.get("/companies").then((r) => r.data);
export const apiScrape = (slugs) => http.post("/scrape", { slugs }).then((r) => r.data);
export const apiListJobs = (params) => http.get("/jobs", { params }).then((r) => r.data);
export const apiJobFacets = (params) => http.get("/jobs/facets", { params }).then((r) => r.data);
export const apiJobsStats = () => http.get("/jobs/stats").then((r) => r.data);
export const apiGetJob = (id) => http.get(`/jobs/${id}`).then((r) => r.data);
export const apiSetJobStatus = (id, status) =>
  http.patch(`/jobs/${id}/status`, { status }).then((r) => r.data);
export const apiUploadResume = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return http
    .post("/resume/upload", fd, { headers: { "Content-Type": "multipart/form-data" } })
    .then((r) => r.data);
};
export const apiAnalyze = (body) => http.post("/analyze", body).then((r) => r.data);
export const apiDownload = (analysis_id, format) =>
  http.post("/download", { analysis_id, format }, { responseType: "blob" });

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
