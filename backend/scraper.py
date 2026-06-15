"""Scrape jobs from Greenhouse + Lever public APIs (no auth, free, reliable)."""

import asyncio
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Any
from companies import classify_role, ALL_COMPANIES
from experience import extract_experience
from tags import detect_tags
from eligibility import is_india_eligible

TIMEOUT = httpx.Timeout(15.0)


def _strip_html(text: str) -> str:
    if not text:
        return ""
    return BeautifulSoup(text, "lxml").get_text(separator="\n").strip()


async def fetch_greenhouse(client, slug, company, region):
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
    try:
        r = await client.get(url, timeout=TIMEOUT)
        if r.status_code != 200:
            return []
        data = r.json()
    except Exception:
        return []
    jobs = []
    for j in data.get("jobs", []):
        title = j.get("title", "")
        role = classify_role(title)
        if not role:
            continue
        location = (j.get("location") or {}).get("name", "Remote")
        desc = _strip_html(j.get("content", ""))
        ymin, ymax, ytext = extract_experience(title, desc)
        jobs.append({
            "company": company,
            "platform": "greenhouse",
            "region": region,
            "title": title,
            "role_type": role,
            "location": location,
            "url": j.get("absolute_url", ""),
            "description": desc[:6000],
            "external_id": str(j.get("id")),
            "years_min": ymin,
            "years_max": ymax,
            "experience_text": ytext,
            "tags": detect_tags(title, desc),
        })
    return jobs


async def fetch_lever(client, slug, company, region):
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    try:
        r = await client.get(url, timeout=TIMEOUT)
        if r.status_code != 200:
            return []
        data = r.json()
    except Exception:
        return []
    jobs = []
    for j in data:
        title = j.get("text", "")
        role = classify_role(title)
        if not role:
            continue
        categories = j.get("categories") or {}
        location = categories.get("location", "Remote")
        parts = [_strip_html(j.get("descriptionPlain") or j.get("description", ""))]
        for lst in j.get("lists", []):
            parts.append(lst.get("text", ""))
            parts.append(_strip_html(lst.get("content", "")))
        parts.append(_strip_html(j.get("additionalPlain") or j.get("additional", "")))
        desc = "\n\n".join([p for p in parts if p]).strip()
        ymin, ymax, ytext = extract_experience(title, desc)
        jobs.append({
            "company": company,
            "platform": "lever",
            "region": region,
            "title": title,
            "role_type": role,
            "location": location,
            "url": j.get("hostedUrl", ""),
            "description": desc[:6000],
            "external_id": j.get("id", ""),
            "years_min": ymin,
            "years_max": ymax,
            "experience_text": ytext,
            "tags": detect_tags(title, desc),
        })
    return jobs


async def fetch_remotive(client) -> List[Dict[str, Any]]:
    """Remotive — free public API for remote jobs worldwide (many India-friendly)."""
    url = "https://remotive.com/api/remote-jobs"
    try:
        r = await client.get(url, timeout=TIMEOUT)
        if r.status_code != 200:
            return []
        data = r.json()
    except Exception:
        return []
    jobs = []
    for j in data.get("jobs", []):
        title = j.get("title", "")
        role = classify_role(title)
        if not role:
            continue
        desc = _strip_html(j.get("description", ""))
        ymin, ymax, ytext = extract_experience(title, desc)
        jobs.append({
            "company": j.get("company_name", "Remotive"),
            "platform": "remotive",
            "region": "global",
            "title": title,
            "role_type": role,
            "location": j.get("candidate_required_location") or "Remote",
            "url": j.get("url", ""),
            "description": desc[:6000],
            "external_id": str(j.get("id", "")),
            "years_min": ymin,
            "years_max": ymax,
            "experience_text": ytext,
            "tags": detect_tags(title, desc),
        })
    return jobs


async def fetch_arbeitnow(client) -> List[Dict[str, Any]]:
    """Arbeitnow — free public job board API."""
    url = "https://www.arbeitnow.com/api/job-board-api"
    try:
        r = await client.get(url, timeout=TIMEOUT)
        if r.status_code != 200:
            return []
        data = r.json()
    except Exception:
        return []
    jobs = []
    for j in data.get("data", []):
        title = j.get("title", "")
        role = classify_role(title)
        if not role:
            continue
        desc = _strip_html(j.get("description", ""))
        ymin, ymax, ytext = extract_experience(title, desc)
        jobs.append({
            "company": j.get("company_name", "Arbeitnow"),
            "platform": "arbeitnow",
            "region": "global",
            "title": title,
            "role_type": role,
            "location": j.get("location") or "Remote",
            "url": j.get("url", ""),
            "description": desc[:6000],
            "external_id": j.get("slug", "") or str(hash(title + j.get("company_name", ""))),
            "years_min": ymin,
            "years_max": ymax,
            "experience_text": ytext,
            "tags": detect_tags(title, desc),
        })
    return jobs


async def fetch_amazon_jobs(client) -> List[Dict[str, Any]]:
    """Amazon.jobs — official Amazon/AWS careers JSON endpoint, no API key required."""
    base = "https://www.amazon.jobs/en/search.json"
    queries = [
        "devops engineer",
        "site reliability engineer",
        "cloud engineer",
        "aws cloud",
        "platform engineer",
        "cloud architect",
    ]
    out = []
    seen_ids = set()
    for qry in queries:
        params = {"base_query": qry, "result_limit": 100, "sort": "recent"}
        try:
            r = await client.get(base, params=params, timeout=TIMEOUT)
            if r.status_code != 200:
                continue
            data = r.json()
        except Exception:
            continue
        for j in data.get("jobs", []):
            jid = j.get("id_icims") or j.get("id")
            if not jid or jid in seen_ids:
                continue
            seen_ids.add(jid)
            title = j.get("title", "")
            role = classify_role(title)
            if not role:
                continue
            desc_parts = [
                j.get("description_short") or "",
                _strip_html(j.get("description") or ""),
                _strip_html(j.get("basic_qualifications") or ""),
                _strip_html(j.get("preferred_qualifications") or ""),
            ]
            desc = "\n\n".join([p for p in desc_parts if p]).strip()
            location = j.get("normalized_location") or j.get("location") or "Multiple"
            url = "https://www.amazon.jobs" + j.get("job_path", "")
            region = "india" if "india" in (location or "").lower() else "global"
            ymin, ymax, ytext = extract_experience(title, desc)
            out.append({
                "company": "Amazon / AWS",
                "platform": "amazon",
                "region": region,
                "title": title,
                "role_type": role,
                "location": location,
                "url": url,
                "description": desc[:6000],
                "external_id": str(jid),
                "years_min": ymin,
                "years_max": ymax,
                "experience_text": ytext,
                "tags": detect_tags(title, desc) + (["aws"] if "aws" not in detect_tags(title, desc) else []),
            })
    return out


async def fetch_adzuna(client) -> List[Dict[str, Any]]:
    """Adzuna India — aggregates LinkedIn / Naukri / Indeed India / Monster / company sites.
    Free 250 calls/day. Needs ADZUNA_APP_ID + ADZUNA_APP_KEY env vars."""
    import os
    app_id = os.environ.get("ADZUNA_APP_ID", "")
    app_key = os.environ.get("ADZUNA_APP_KEY", "")
    if not app_id or not app_key or app_id.startswith("PASTE_"):
        return []

    queries = [
        "devops engineer", "site reliability engineer", "cloud architect",
        "aws devops", "platform engineer", "kubernetes engineer",
        "cloud devops", "infrastructure engineer",
    ]
    out: List[Dict[str, Any]] = []
    seen = set()
    for q in queries:
        for page in (1, 2):  # 2 pages × 50 = up to 100 per query
            url = f"https://api.adzuna.com/v1/api/jobs/in/search/{page}"
            params = {
                "app_id": app_id,
                "app_key": app_key,
                "what": q,
                "results_per_page": 50,
                "content-type": "application/json",
            }
            try:
                r = await client.get(url, params=params, timeout=TIMEOUT)
                if r.status_code != 200:
                    break
                data = r.json()
            except Exception:
                break
            results = data.get("results", [])
            if not results:
                break
            for j in results:
                jid = str(j.get("id", ""))
                if not jid or jid in seen:
                    continue
                seen.add(jid)
                title = j.get("title", "").strip()
                role = classify_role(title)
                if not role:
                    continue
                desc = j.get("description", "") or ""
                company = (j.get("company") or {}).get("display_name", "Adzuna")
                location = (j.get("location") or {}).get("display_name", "India")
                ymin, ymax, ytext = extract_experience(title, desc)
                out.append({
                    "company": company,
                    "platform": "adzuna",
                    "region": "india",
                    "title": title,
                    "role_type": role,
                    "location": location,
                    "url": j.get("redirect_url", ""),
                    "description": desc[:6000],
                    "external_id": jid,
                    "years_min": ymin,
                    "years_max": ymax,
                    "experience_text": ytext,
                    "tags": detect_tags(title, desc),
                })
    return out


async def fetch_linkedin_guest(client) -> List[Dict[str, Any]]:
    """LinkedIn public guest endpoint — best-effort, may be rate-limited from cloud IPs."""
    import os
    if os.environ.get("LINKEDIN_ENABLED", "true").lower() != "true":
        return []

    queries = [
        ("devops engineer", "India"),
        ("site reliability engineer", "India"),
        ("cloud architect", "India"),
        ("aws devops", "India"),
        ("kubernetes", "India"),
        ("platform engineer", "India"),
    ]
    base = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.linkedin.com/jobs/search/",
    }
    out: List[Dict[str, Any]] = []
    seen = set()
    for kw, loc in queries:
        for start in (0, 25):
            params = {"keywords": kw, "location": loc, "start": start, "f_TPR": "r604800"}
            try:
                r = await client.get(base, params=params, headers=headers, timeout=15.0)
                if r.status_code == 429 or r.status_code >= 400:
                    # Rate-limited or blocked — return whatever we have
                    return out
                soup = BeautifulSoup(r.text, "lxml")
            except Exception:
                continue
            cards = soup.select("li") or soup.select("div.base-card")
            if not cards:
                break
            for card in cards:
                title_el = card.select_one(".base-search-card__title")
                company_el = card.select_one(".base-search-card__subtitle")
                loc_el = card.select_one(".job-search-card__location")
                link_el = card.select_one("a.base-card__full-link") or card.select_one("a")
                if not (title_el and company_el and link_el):
                    continue
                title = title_el.get_text(strip=True)
                role = classify_role(title)
                if not role:
                    continue
                company = company_el.get_text(strip=True)
                location = loc_el.get_text(strip=True) if loc_el else "India"
                url = (link_el.get("href") or "").split("?")[0]
                if not url or url in seen:
                    continue
                seen.add(url)
                ymin, ymax, ytext = extract_experience(title, "")
                out.append({
                    "company": company,
                    "platform": "linkedin",
                    "region": "india",
                    "title": title,
                    "role_type": role,
                    "location": location,
                    "url": url,
                    "description": "",  # LinkedIn guest doesn't give us description
                    "external_id": url.split("/")[-1] or url,
                    "years_min": ymin,
                    "years_max": ymax,
                    "experience_text": ytext,
                    "tags": detect_tags(title, ""),
                })
    return out


async def scrape_all(selected_slugs: List[str] | None = None) -> List[Dict[str, Any]]:
    targets = ALL_COMPANIES
    if selected_slugs:
        sel = set(selected_slugs)
        targets = [c for c in ALL_COMPANIES if c["slug"] in sel]

    results: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(headers={"User-Agent": "AdityaJobTool/1.0"}) as client:
        tasks = []
        for c in targets:
            if c["platform"] == "greenhouse":
                tasks.append(fetch_greenhouse(client, c["slug"], c["name"], c["region"]))
            else:
                tasks.append(fetch_lever(client, c["slug"], c["name"], c["region"]))
        # Always-on free aggregators (only when no slug filter applied)
        if not selected_slugs:
            tasks.append(fetch_remotive(client))
            tasks.append(fetch_arbeitnow(client))
            tasks.append(fetch_amazon_jobs(client))
            tasks.append(fetch_adzuna(client))
            tasks.append(fetch_linkedin_guest(client))
        chunks = await asyncio.gather(*tasks, return_exceptions=True)
        for ch in chunks:
            if isinstance(ch, list):
                results.extend(ch)
    # Dedupe by URL (Remotive sometimes lists same role twice)
    seen = set()
    deduped = []
    for j in results:
        u = j.get("url") or (j.get("company", "") + "|" + j.get("title", ""))
        if u in seen:
            continue
        seen.add(u)
        deduped.append(j)

    # India-eligibility filter — keep ONLY India locations and truly remote (India-OK) roles
    from eligibility import INDIA_LOCATIONS, REMOTE_WORDS
    filtered = []
    for j in deduped:
        loc = j.get("location") or ""
        if not is_india_eligible(loc):
            continue
        s = loc.lower()
        if any(c in s for c in INDIA_LOCATIONS):
            j["region"] = "india"
        elif any(w in s for w in REMOTE_WORDS) and loc.strip():
            j["region"] = "remote"
        else:
            # No location info — fall back to original tag; otherwise treat as India
            j["region"] = j.get("region") if j.get("region") in ("india", "remote") else "india"
        filtered.append(j)
    return filtered
