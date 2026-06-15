# Resume Tailor — Product Requirements (PRD)

## Original problem statement
> "Mujhe ek web app bnana hai jo mere liye company ke carer page se job ko scrap kare aur mein jab apana resume usko dalu dalu to uske hisab se wo change kare. Mein chahta hu job kewal DevOps Engineer, Site Reliability Engineer (SRE) and Cloud Architect ka nikale, aur mere resume ko analysis kare. Sab kuch free mein chahiye, Oracle VM pe deploy karenge CI/CD pipeline ke sath. Docker container ke sath build and push DockerHub pe ho, sirf pull ho VM pe."

## User decisions
- Companies: top tech + India-based MNCs (curated list)
- LLM: user provides their own OpenAI or Gemini API key
- Resume formats: PDF + DOCX (both)
- Output: tailoring suggestions **and** downloadable tailored resume
- CI/CD: GitHub Actions → Docker Hub → SSH → Oracle VM `docker compose pull`

## Architecture
- Backend: FastAPI (Python 3.11) with motor (MongoDB)
- Frontend: React 19 + Tailwind, terminal/retro-futurism dark theme
- DB: MongoDB
- Job sources: Greenhouse public API + Lever public API (no auth required, free, reliable)
- Resume parsing: pypdf + python-docx
- Resume gen: reportlab (PDF) + python-docx (DOCX)
- LLM: openai SDK or google-generativeai SDK (key supplied per request by user)
- Deploy: Docker images built in GH Actions, pushed to DockerHub, pulled by Oracle Always-Free VM

## Implemented (2026-02)
- /api/companies — curated list of 47 companies, each tagged with region (india|global)
- /api/scrape — fetches Greenhouse + Lever jobs, filters to DevOps/SRE/CloudArch
- /api/jobs?role=…&status=…&region=…&q=… — fully filterable
- /api/jobs/stats — by_status + by_region + by_role + total
- /api/jobs/{id}/status (PATCH) — mark new|reviewed|applied (persisted across re-scrapes)
- /api/resume/upload — accepts PDF/DOCX, parses text
- /api/analyze — LLM-driven analysis with server-side Gemini key
- /api/download — generates downloadable PDF or DOCX of tailored resume
- Multi-page app with sidebar: Overview, India MNCs, Global/Remote, To Check, Reviewed, Applied
- Auto-scrape background scheduler (every 30 min, configurable via env)
- Click-a-job auto-marks Reviewed; chip click to mark Applied
- LLM key stored only in backend/.env — invisible to the dashboard
- Dockerfiles + docker-compose + GitHub Actions deploy workflow (Oracle Free VM)

## P1 / Next
- Persist resumes/analyses per-user (currently single-user)
- Add Workday/Taleo/iCIMS scrapers for more India MNCs (TCS, Infosys, Wipro)
- LinkedIn-style "save job" + email digest
- Schedule daily scrape via cron

## Risks
- Some company slugs may not exist on Greenhouse/Lever; scraper silently skips
- LLM cost: paid by user via their own key (free tier on Gemini works)
