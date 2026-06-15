"""Determine whether a job location is eligible for an India-based applicant
(either physically in India, or a remote role that doesn't restrict country)."""

import re

INDIA_LOCATIONS = [
    "india", "mumbai", "bombay", "bengaluru", "bangalore", "delhi",
    "gurgaon", "gurugram", "hyderabad", "chennai", "kolkata", "calcutta",
    "pune", "noida", "ahmedabad", "jaipur", "kochi", "cochin",
    "trivandrum", "thiruvananthapuram", "indore", "chandigarh", "vapi",
    "navi mumbai", "thane", "vadodara", "surat", "nagpur", "coimbatore",
    "mysore", "mysuru", "vizag", "visakhapatnam", "lucknow",
]

REMOTE_WORDS = [
    "remote", "anywhere", "worldwide", "work from home", "wfh",
    "distributed", "telecommute",
]

# Regex with word boundaries — match country/city names cleanly without false positives
NON_INDIA_RX = re.compile(
    r"\b("
    # USA / North America
    r"usa|u\.s\.a?|us\s*only|us-only|us\s*remote|us\s*based|us\s*resident|"
    r"united\s*states|north\s*america|americas|canada|toronto|vancouver|montreal|"
    r"new\s*york|nyc|san\s*francisco|sfo|los\s*angeles|boston|seattle|austin|"
    r"chicago|denver|atlanta|miami|washington|houston|dallas|phoenix|philadelphia|"
    r"portland|san\s*diego|san\s*jose|"
    # UK / Europe
    r"uk\s*only|united\s*kingdom|emea|"
    r"london|manchester|edinburgh|dublin|ireland|"
    r"germany|berlin|munich|hamburg|frankfurt|"
    r"france|paris|lyon|marseille|"
    r"netherlands|amsterdam|rotterdam|"
    r"spain|madrid|barcelona|valencia|"
    r"italy|rome|milan|"
    r"sweden|stockholm|denmark|copenhagen|norway|oslo|"
    r"finland|helsinki|poland|warsaw|czech|prague|"
    r"austria|vienna|switzerland|zurich|geneva|"
    r"portugal|lisbon|greece|athens|belgium|brussels|"
    r"hungary|budapest|romania|bucharest|estonia|tallinn|ukraine|kyiv|"
    # APAC excl. India
    r"singapore|japan|tokyo|osaka|korea|seoul|"
    r"china|shanghai|beijing|hong\s*kong|taiwan|taipei|"
    r"malaysia|kuala\s*lumpur|philippines|manila|"
    r"indonesia|jakarta|vietnam|hanoi|thailand|bangkok|"
    r"australia|sydney|melbourne|brisbane|perth|"
    r"new\s*zealand|auckland|wellington|apac\s*\(excl|"
    # Americas (non-US)
    r"mexico|brazil|sao\s*paulo|rio|argentina|buenos\s*aires|"
    r"chile|santiago|colombia|bogota|peru|lima|costa\s*rica|latam|"
    # MEA
    r"uae|dubai|abu\s*dhabi|saudi|riyadh|qatar|doha|kuwait|bahrain|oman|muscat|"
    r"israel|tel\s*aviv|jerusalem|egypt|cairo|"
    r"south\s*africa|cape\s*town|johannesburg|kenya|nairobi|"
    r"nigeria|lagos|ghana|accra|morocco|casablanca|africa"
    r")\b",
    re.IGNORECASE,
)

# Standalone "US" token — needs special-case (re won't match "US" cleanly as word boundary
# because "US" is uppercase only — we already lowercase the string in matching)
US_TOKEN_RX = re.compile(r"\bus\b", re.IGNORECASE)


def is_india_eligible(location: str | None) -> bool:
    """Return True if a candidate based in India can realistically apply."""
    if not location:
        return True
    s = location.lower().strip()

    # 1. India location anywhere → always eligible
    if any(c in s for c in INDIA_LOCATIONS):
        return True

    is_remote = any(w in s for w in REMOTE_WORDS)
    has_non_india = bool(NON_INDIA_RX.search(s)) or bool(US_TOKEN_RX.search(s))

    # 2. Remote but pinned to a specific non-India country → not eligible
    if is_remote and has_non_india:
        return False

    # 3. Pure remote without country restriction → eligible
    if is_remote:
        return True

    # 4. Non-India country mentioned, no remote → not eligible
    if has_non_india:
        return False

    # 5. Ambiguous (e.g. "Multiple Locations") — for safety, drop unless clearly India
    return False
