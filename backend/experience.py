"""Extract years-of-experience from a job title + description."""

import re
from typing import Tuple, Optional

# Order matters — match the most specific patterns first.
_PATTERNS = [
    # "3-5 years", "3 to 5 years", "3 - 5 yrs"
    re.compile(r"(\d{1,2})\s*[-–to]+\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b", re.I),
    # "minimum 5 years", "min. 5 years"
    re.compile(r"(?:min(?:imum)?\.?|at\s*least)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b", re.I),
    # "5+ years", "5 + yrs"
    re.compile(r"(\d{1,2})\s*\+\s*(?:years?|yrs?)\b", re.I),
    # "5 years experience"
    re.compile(r"(\d{1,2})\s*(?:years?|yrs?)\s*(?:of\s*)?(?:exp|experience)\b", re.I),
    # Inside parentheses: "(4-8yrs)", "(7 to 11 years)"
    re.compile(r"\((\d{1,2})\s*[-–to]+\s*(\d{1,2})\s*(?:yrs?|years?)\)", re.I),
]

_SENIORITY_HINTS = [
    (re.compile(r"\bprincipal\b|\bstaff\b|\bdistinguished\b", re.I), (10, 15)),
    (re.compile(r"\blead\b|\barchitect\b", re.I), (8, 12)),
    (re.compile(r"\bsenior\b|\bsr\.?\b", re.I), (5, 9)),
    (re.compile(r"\bmid[\- ]?level\b", re.I), (3, 5)),
    (re.compile(r"\bjunior\b|\bjr\.?\b|\bentry[\- ]?level\b|\bgraduate\b|\bintern\b", re.I), (0, 2)),
]


def extract_experience(title: str, description: str = "") -> Tuple[Optional[int], Optional[int], Optional[str]]:
    """Return (min_years, max_years, display_text) or (None, None, None) when nothing found."""
    text = f"{title}\n{description}"

    for pat in _PATTERNS:
        m = pat.search(text)
        if not m:
            continue
        groups = m.groups()
        if len(groups) == 2 and groups[0] and groups[1]:
            lo, hi = int(groups[0]), int(groups[1])
            if lo > hi:
                lo, hi = hi, lo
            return lo, hi, f"{lo}-{hi} yrs"
        if len(groups) >= 1 and groups[0]:
            n = int(groups[0])
            return n, None, f"{n}+ yrs"

    # Fall back to seniority words in the title only
    for rx, (lo, hi) in _SENIORITY_HINTS:
        if rx.search(title):
            return lo, hi, f"{lo}-{hi} yrs"

    return None, None, None
