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


def _strip_code_fences(text: str) -> str:
    """Remove ```json ... ``` or ``` ... ``` wrappers if the model added them."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _sanitize_control_chars(text: str) -> str:
    """
    Walk the JSON text and escape raw control characters (newline, tab, CR,
    and other unescaped control chars) that appear *inside* string values.
    Models sometimes emit literal newlines inside long multi-line fields
    like "tailored_resume" instead of the escaped "\\n", which breaks
    json.loads with errors like 'Invalid control character at: line X'.
    """
    out = []
    in_string = False
    escape_next = False

    for ch in text:
        if escape_next:
            out.append(ch)
            escape_next = False
            continue

        if ch == "\\":
            out.append(ch)
            escape_next = True
            continue

        if ch == '"':
            in_string = not in_string
            out.append(ch)
            continue

        if in_string:
            if ch == "\n":
                out.append("\\n")
                continue
            if ch == "\t":
                out.append("\\t")
                continue
            if ch == "\r":
                # drop bare carriage returns
                continue
            if ord(ch) < 0x20:
                # any other stray control character -> escape as unicode
                out.append("\\u%04x" % ord(ch))
                continue

        out.append(ch)

    return "".join(out)


def _extract_json(text: str) -> Dict[str, Any]:
    """
    Robustly parse a JSON object out of an LLM response.
    Tries, in order:
      1. Direct json.loads on the raw text.
      2. json.loads after stripping markdown code fences.
      3. json.loads after sanitizing control characters.
      4. Extracting the first {...} block and repeating steps 1-3 on it.
    """
    candidates = []

    raw = text
    candidates.append(raw)

    fenced = _strip_code_fences(raw)
    if fenced != raw:
        candidates.append(fenced)

    # Try the candidates as-is first
    for c in candidates:
        try:
            return json.loads(c)
        except Exception:
            pass

    # Try sanitized versions of the same candidates
    for c in candidates:
        try:
            return json.loads(_sanitize_control_chars(c))
        except Exception:
            pass

    # Fall back to extracting the first {...} block from the original text
    m = re.search(r"\{.*\}", fenced, re.DOTALL)
    if m:
        block = m.group(0)
        try:
            return json.loads(block)
        except Exception:
            pass
        try:
            return json.loads(_sanitize_control_chars(block))
        except Exception:
            pass

    raise ValueError("Model did not return valid JSON")


def analyze_with_openai(api_key: str, model: str, resume_text: str, job: Dict[str, Any]) -> Dict[str, Any]:
    import os
    from openai import OpenAI
    base_url = os.environ.get("LLM_BASE_URL") or None
    client = OpenAI(api_key=api_key, base_url=base_url)
    resp = client.chat.completions.create(
        model=model or "gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(resume_text, job["title"], job["company"], job["description"])},
        ],
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