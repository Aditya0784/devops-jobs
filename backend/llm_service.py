"""LLM service using user-provided OpenAI or Gemini API key."""

import json
import re
from typing import Dict, Any


SYSTEM_PROMPT = """You are an expert technical resume reviewer specializing in DevOps, SRE, and Cloud Architecture roles.
You will be given a candidate's resume text and a specific job description.

Return ONLY a JSON object (no markdown, no commentary) with this exact schema:
{
  "match_score": <integer 0-100>,
  "summary": "<2-3 sentence overall fit summary>",
  "matched_skills": ["skill1", "skill2", ...],
  "missing_skills": ["skill1", "skill2", ...],
  "keywords_to_add": ["keyword1", ...],
  "suggestions": [
    {"section": "Summary|Experience|Skills|Projects|Education", "action": "add|edit|remove|emphasize", "detail": "specific actionable advice"}
  ],
  "tailored_resume": "<a complete, ATS-friendly rewritten resume in plain text, preserving the candidate's real experience but reorganized and rephrased to maximize alignment with the job. Use clear section headings (SUMMARY, SKILLS, EXPERIENCE, PROJECTS, EDUCATION, CERTIFICATIONS).>"
}

Rules:
- NEVER fabricate experience or employers. Only emphasize, rephrase, or reorder existing content.
- Keep tailored_resume between 400-900 words.
- match_score must reflect honest alignment.
"""


def _build_user_prompt(resume_text: str, job_title: str, company: str, job_description: str) -> str:
    return (
        f"JOB TITLE: {job_title}\n"
        f"COMPANY: {company}\n\n"
        f"JOB DESCRIPTION:\n{job_description}\n\n"
        f"---\n\nCANDIDATE RESUME:\n{resume_text}\n"
    )


def _extract_json(text: str) -> Dict[str, Any]:
    # Try direct JSON first; otherwise extract the first {...} block.
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        return json.loads(m.group(0))
    raise ValueError("Model did not return valid JSON")


def analyze_with_openai(api_key: str, model: str, resume_text: str, job: Dict[str, Any]) -> Dict[str, Any]:
    from openai import OpenAI
    client = OpenAI(
    api_key=api_key,
    base_url="https://api.groq.com/openai/v1"
)
    resp = client.chat.completions.create(
        model=model or "gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(resume_text, job["title"], job["company"], job["description"])},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    content = resp.choices[0].message.content or "{}"
    return _extract_json(content)


def analyze_with_gemini(api_key: str, model: str, resume_text: str, job: Dict[str, Any]) -> Dict[str, Any]:
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    gm = genai.GenerativeModel(
        model_name=model or "gemini-1.5-flash",
        system_instruction=SYSTEM_PROMPT,
        generation_config={"response_mime_type": "application/json", "temperature": 0.3},
    )
    user = _build_user_prompt(resume_text, job["title"], job["company"], job["description"])
    resp = gm.generate_content(user)
    return _extract_json(resp.text)


def analyze(provider: str, api_key: str, model: str, resume_text: str, job: Dict[str, Any]) -> Dict[str, Any]:
    provider = (provider or "openai").lower()
    if provider == "openai":
        return analyze_with_openai(api_key, model, resume_text, job)
    if provider == "gemini":
        return analyze_with_gemini(api_key, model, resume_text, job)
    raise ValueError(f"Unknown provider: {provider}")
