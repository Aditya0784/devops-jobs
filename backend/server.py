"""FastAPI backend: AdityaJobTool — Resume Tailor + Auto Job Scraper for DevOps/SRE/Cloud Architect roles."""

import os
import uuid
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pathlib import Path
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict

from companies import ALL_COMPANIES
from scraper import scrape_all
from resume_parser import parse_resume
from llm_service import analyze
from resume_generator import to_pdf, to_docx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("aditya-job-tool")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL", "gemini-1.5-flash")

# Scrape schedule — daily at specified IST times (default: 08:00 and 20:00)
IST = ZoneInfo("Asia/Kolkata")
SCRAPE_TIMES = []
for s in os.environ.get("SCRAPE_TIMES_IST", "08:00,20:00").split(","):
    s = s.strip()
    if not s:
        continue
    hh, mm = s.split(":")
    SCRAPE_TIMES.append((int(hh), int(mm)))
if not SCRAPE_TIMES:
    SCRAPE_TIMES = [(8, 0), (20, 0)]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class Job(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company: str
    platform: str
    region: str  # india | global
    title: str
    role_type: str  # devops | sre | cloud_architect
    location: str
    url: str
    description: str
    external_id: str
    status: str = "new"  # new | reviewed | applied | ignored
    years_min: Optional[int] = None
    years_max: Optional[int] = None
    experience_text: Optional[str] = None
    tags: List[str] = []
    scraped_at: str = Field(default_factory=now_iso)


class ResumeDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    text: str
    uploaded_at: str = Field(default_factory=now_iso)


class AnalysisRequest(BaseModel):
    resume_id: str
    job_id: str


class AnalysisResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    resume_id: str
    job_id: str
    job_title: str
    company: str
    match_score: int
    summary: str
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    keywords_to_add: List[str] = []
    suggestions: List[dict] = []
    tailored_resume: str
    created_at: str = Field(default_factory=now_iso)


class TailoredDownloadRequest(BaseModel):
    analysis_id: str
    format: str  # pdf | docx


class JobStatusUpdate(BaseModel):
    status: str  # new | reviewed | applied


VALID_STATUSES = {"new", "reviewed", "applied", "ignored"}


# ---------- Scrape job (shared) ----------
async def run_scrape(slugs: Optional[List[str]] = None) -> int:
    raw = await scrape_all(slugs)
    # Build a status map from existing user actions, keyed by stable url
    existing = {}
    async for s in db.job_statuses.find({}, {"_id": 0}):
        existing[s["url"]] = s["status"]
    await db.jobs.delete_many({})
    if raw:
        docs = []
        for r in raw:
            job = Job(**r)
            if job.url in existing:
                job.status = existing[job.url]
            docs.append(job.model_dump())
        await db.jobs.insert_many(docs)
    await db.meta.update_one(
        {"_id": "scrape_status"},
        {"$set": {"_id": "scrape_status", "last_run": now_iso(), "count": len(raw)}},
        upsert=True,
    )
    logger.info(f"[scrape] saved {len(raw)} jobs")
    return len(raw)


# ---------- Background scheduler ----------
def _seconds_until_next_run() -> tuple[float, datetime]:
    now = datetime.now(IST)
    candidates = []
    for hh, mm in SCRAPE_TIMES:
        t = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
        if t <= now:
            t += timedelta(days=1)
        candidates.append(t)
    next_run = min(candidates)
    return (next_run - now).total_seconds(), next_run


async def scheduler_loop():
    # First run shortly after boot so the app isn't empty
    await asyncio.sleep(2)
    try:
        await run_scrape()
    except Exception as e:
        logger.exception(f"Boot scrape failed: {e}")
    while True:
        sleep_sec, next_run = _seconds_until_next_run()
        logger.info(f"[scheduler] next scrape at {next_run.isoformat()} (in {sleep_sec/60:.1f} min)")
        try:
            await asyncio.sleep(sleep_sec)
        except asyncio.CancelledError:
            break
        try:
            await run_scrape()
        except Exception as e:
            logger.exception(f"Scheduled scrape failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(scheduler_loop())
    logger.info(f"Started background scraper (times IST = {SCRAPE_TIMES})")
    try:
        yield
    finally:
        task.cancel()
        client.close()


app = FastAPI(title="AdityaJobTool API", lifespan=lifespan)
api = APIRouter(prefix="/api")


# ---------- Routes ----------
@api.get("/")
async def root():
    meta = await db.meta.find_one({"_id": "scrape_status"})
    sleep_sec, next_run = _seconds_until_next_run()
    return {
        "app": "AdityaJobTool",
        "status": "ok",
        "ts": now_iso(),
        "scrape_times_ist": [f"{h:02d}:{m:02d}" for h, m in SCRAPE_TIMES],
        "next_scrape": next_run.astimezone(timezone.utc).isoformat(),
        "last_scrape": meta.get("last_run") if meta else None,
        "last_scrape_count": meta.get("count") if meta else 0,
        "llm_ready": bool(LLM_API_KEY) and LLM_API_KEY != "PASTE_YOUR_GEMINI_KEY_HERE",
        "adzuna_ready": bool(os.environ.get("ADZUNA_APP_ID", "")) and not os.environ.get("ADZUNA_APP_ID", "").startswith("PASTE_"),
    }


@api.get("/companies")
async def list_companies():
    return {"companies": ALL_COMPANIES, "count": len(ALL_COMPANIES)}


@api.post("/scrape")
async def scrape_jobs(payload: dict | None = None):
    selected = (payload or {}).get("slugs") if payload else None
    count = await run_scrape(selected)
    return {"count": count}


@api.get("/jobs")
async def list_jobs(
    role: Optional[str] = None,
    company: Optional[str] = None,
    q: Optional[str] = None,
    status: Optional[str] = None,
    region: Optional[str] = None,
    tag: Optional[str] = None,
    platform: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    query = {}
    if role and role != "all":
        query["role_type"] = role
    if company:
        query["company"] = company
    if status and status != "all":
        query["status"] = status
    else:
        # By default, exclude ignored jobs unless explicitly requested
        query["status"] = {"$ne": "ignored"}
    if region and region != "all":
        query["region"] = region
    if tag:
        query["tags"] = tag
    if platform:
        query["platform"] = platform
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"location": {"$regex": q, "$options": "i"}},
        ]
    total = await db.jobs.count_documents(query)
    cursor = (
        db.jobs.find(query, {"_id": 0})
        .sort("scraped_at", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    items = await cursor.to_list(page_size)
    return {
        "count": len(items),
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total else 1,
        "jobs": items,
    }


@api.get("/jobs/facets")
async def jobs_facets(
    role: Optional[str] = None,
    region: Optional[str] = None,
    status: Optional[str] = None,
    tag: Optional[str] = None,
):
    """Return the list of companies (and their counts) within the current filter scope."""
    match = {}
    if role and role != "all":
        match["role_type"] = role
    if region and region != "all":
        match["region"] = region
    if status and status != "all":
        match["status"] = status
    if tag:
        match["tags"] = tag
    pipeline = [
        {"$match": match} if match else {"$match": {}},
        {"$group": {"_id": "$company", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
    ]
    companies = []
    async for row in db.jobs.aggregate(pipeline):
        if row["_id"]:
            companies.append({"name": row["_id"], "count": row["n"]})
    return {"companies": companies}


@api.get("/jobs/stats")
async def jobs_stats():
    out = {
        "by_status": {"new": 0, "reviewed": 0, "applied": 0, "ignored": 0},
        "by_region": {"india": 0, "remote": 0},
        "by_role": {"devops": 0, "sre": 0, "cloud_architect": 0},
        "by_tag": {"aws": 0, "azure": 0, "gcp": 0, "kubernetes": 0, "terraform": 0, "docker": 0, "ci_cd": 0},
        "by_platform": {},
        "total": 0,
    }
    async for row in db.jobs.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}]):
        if row["_id"] in out["by_status"]:
            out["by_status"][row["_id"]] = row["n"]
    async for row in db.jobs.aggregate([{"$group": {"_id": "$region", "n": {"$sum": 1}}}]):
        if row["_id"] in out["by_region"]:
            out["by_region"][row["_id"]] = row["n"]
    async for row in db.jobs.aggregate([{"$group": {"_id": "$role_type", "n": {"$sum": 1}}}]):
        if row["_id"] in out["by_role"]:
            out["by_role"][row["_id"]] = row["n"]
    async for row in db.jobs.aggregate([
        {"$unwind": {"path": "$tags", "preserveNullAndEmptyArrays": False}},
        {"$group": {"_id": "$tags", "n": {"$sum": 1}}},
    ]):
        if row["_id"] in out["by_tag"]:
            out["by_tag"][row["_id"]] = row["n"]
    async for row in db.jobs.aggregate([{"$group": {"_id": "$platform", "n": {"$sum": 1}}}]):
        if row["_id"]:
            out["by_platform"][row["_id"]] = row["n"]
    out["total"] = sum(out["by_status"].values())
    return out


@api.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@api.patch("/jobs/{job_id}/status")
async def update_job_status(job_id: str, payload: JobStatusUpdate):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(400, f"status must be one of {sorted(VALID_STATUSES)}")
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found")
    ts = now_iso()
    await db.jobs.update_one({"id": job_id}, {"$set": {"status": payload.status}})
    # Persist across scrape refreshes, keyed by job url
    await db.job_statuses.update_one(
        {"url": job["url"]},
        {"$set": {"url": job["url"], "status": payload.status, "updated_at": ts}},
        upsert=True,
    )
    return {"id": job_id, "status": payload.status, "updated_at": ts}


@api.post("/resume/upload")
async def upload_resume(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (>10MB)")
    try:
        text = parse_resume(content, file.filename or "")
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not text.strip():
        raise HTTPException(400, "Could not extract text from the file")
    doc = ResumeDoc(filename=file.filename or "resume", text=text)
    await db.resumes.insert_one(doc.model_dump())
    return {"id": doc.id, "filename": doc.filename, "chars": len(text), "preview": text[:400]}


@api.get("/resume/{resume_id}")
async def get_resume(resume_id: str):
    doc = await db.resumes.find_one({"id": resume_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Resume not found")
    return doc


@api.post("/analyze")
async def analyze_resume(req: AnalysisRequest):
    if not LLM_API_KEY or LLM_API_KEY == "PASTE_YOUR_GEMINI_KEY_HERE":
        raise HTTPException(503, "Server LLM key is not configured. Set LLM_API_KEY in backend/.env")
    resume = await db.resumes.find_one({"id": req.resume_id}, {"_id": 0})
    if not resume:
        raise HTTPException(404, "Resume not found")
    job = await db.jobs.find_one({"id": req.job_id}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found")

    try:
        result = analyze(LLM_PROVIDER, LLM_API_KEY, LLM_MODEL, resume["text"], job)
    except Exception as e:
        logger.exception("LLM analysis failed")
        safe = str(e).replace(LLM_API_KEY, "***") if LLM_API_KEY else str(e)
        raise HTTPException(502, f"LLM call failed: {safe[:300]}")

    ar = AnalysisResult(
        resume_id=req.resume_id,
        job_id=req.job_id,
        job_title=job["title"],
        company=job["company"],
        match_score=int(result.get("match_score") or 0),
        summary=result.get("summary", ""),
        matched_skills=result.get("matched_skills", []) or [],
        missing_skills=result.get("missing_skills", []) or [],
        keywords_to_add=result.get("keywords_to_add", []) or [],
        suggestions=result.get("suggestions", []) or [],
        tailored_resume=result.get("tailored_resume", ""),
    )
    await db.analyses.insert_one(ar.model_dump())
    return ar.model_dump()


@api.get("/analyses")
async def list_analyses():
    cur = db.analyses.find({}, {"_id": 0}).sort("created_at", -1).limit(50)
    return {"items": await cur.to_list(50)}


@api.post("/download")
async def download_tailored(req: TailoredDownloadRequest):
    ar = await db.analyses.find_one({"id": req.analysis_id}, {"_id": 0})
    if not ar:
        raise HTTPException(404, "Analysis not found")
    text = ar.get("tailored_resume", "")
    if not text.strip():
        raise HTTPException(400, "No tailored resume content")
    if req.format == "pdf":
        data = to_pdf(text)
        return Response(
            content=data, media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="tailored_resume_{req.analysis_id[:8]}.pdf"'},
        )
    if req.format == "docx":
        data = to_docx(text)
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="tailored_resume_{req.analysis_id[:8]}.docx"'},
        )
    raise HTTPException(400, "format must be pdf or docx")


import hashlib, secrets, json

# ---------------------------------------------------------------------------
# Auth — multi-user login
# Users defined in .env as JSON: USERS='[{"username":"aditya","password":"mypass123"},{"username":"rahul","password":"pass456"}]'
# ---------------------------------------------------------------------------
USERS_RAW = os.environ.get("USERS", "[]")
try:
    USERS_LIST = json.loads(USERS_RAW)
except Exception:
    USERS_LIST = []

# Active sessions: token -> username
_sessions: dict = {}

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    username: str

@api.post("/auth/login")
async def auth_login(req: LoginRequest):
    for u in USERS_LIST:
        if u.get("username") == req.username and u.get("password") == req.password:
            token = secrets.token_hex(32)
            _sessions[token] = req.username
            return LoginResponse(token=token, username=req.username)
    raise HTTPException(401, "Invalid username or password")

@api.post("/auth/logout")
async def auth_logout(token: str):
    _sessions.pop(token, None)
    return {"ok": True}

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
