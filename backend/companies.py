"""
Curated list of companies for AdityaJobTool.
Each company is tagged with region:
  - "india":   India HQ or India-first companies
  - "global":  Global companies (most do hire remote / have India offices)
"""

# Greenhouse-hosted boards: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
GREENHOUSE_COMPANIES = [
    # India-based / India-first
    {"slug": "razorpay", "name": "Razorpay", "region": "india"},
    {"slug": "swiggy", "name": "Swiggy", "region": "india"},
    {"slug": "cred", "name": "CRED", "region": "india"},
    {"slug": "groww", "name": "Groww", "region": "india"},
    {"slug": "meesho", "name": "Meesho", "region": "india"},
    {"slug": "postman", "name": "Postman", "region": "india"},
    {"slug": "freshworks", "name": "Freshworks", "region": "india"},
    {"slug": "zomato", "name": "Zomato", "region": "india"},
    {"slug": "phonepe", "name": "PhonePe", "region": "india"},
    {"slug": "browserstack", "name": "BrowserStack", "region": "india"},
    # Speculative — silently skipped if 404
    {"slug": "urbancompany", "name": "Urban Company", "region": "india"},
    {"slug": "dunzo", "name": "Dunzo", "region": "india"},
    {"slug": "slice", "name": "Slice", "region": "india"},
    {"slug": "sharechat", "name": "ShareChat", "region": "india"},
    {"slug": "jupiter", "name": "Jupiter", "region": "india"},
    {"slug": "plum", "name": "Plum", "region": "india"},
    {"slug": "ola", "name": "Ola", "region": "india"},
    {"slug": "oyo", "name": "OYO", "region": "india"},
    {"slug": "ixigo", "name": "ixigo", "region": "india"},
    {"slug": "makemytrip", "name": "MakeMyTrip", "region": "india"},
    {"slug": "paytm", "name": "Paytm", "region": "india"},
    {"slug": "rapido", "name": "Rapido", "region": "india"},
    {"slug": "zepto", "name": "Zepto", "region": "india"},
    {"slug": "khatabook", "name": "Khatabook", "region": "india"},
    {"slug": "dream11", "name": "Dream11", "region": "india"},
    {"slug": "navi", "name": "Navi", "region": "india"},
    {"slug": "acko", "name": "Acko", "region": "india"},
    {"slug": "uniphore", "name": "Uniphore", "region": "india"},
    {"slug": "chargebee", "name": "Chargebee", "region": "india"},
    {"slug": "darwinbox", "name": "Darwinbox", "region": "india"},

    # Global companies (many hire remote or have India offices)
    {"slug": "airbnb", "name": "Airbnb", "region": "global"},
    {"slug": "stripe", "name": "Stripe", "region": "global"},
    {"slug": "doordash", "name": "DoorDash", "region": "global"},
    {"slug": "coinbase", "name": "Coinbase", "region": "global"},
    {"slug": "robinhood", "name": "Robinhood", "region": "global"},
    {"slug": "instacart", "name": "Instacart", "region": "global"},
    {"slug": "discord", "name": "Discord", "region": "global"},
    {"slug": "reddit", "name": "Reddit", "region": "global"},
    {"slug": "dropbox", "name": "Dropbox", "region": "global"},
    {"slug": "pinterest", "name": "Pinterest", "region": "global"},
    {"slug": "snowflake", "name": "Snowflake", "region": "global"},
    {"slug": "databricks", "name": "Databricks", "region": "global"},
    {"slug": "hashicorp", "name": "HashiCorp", "region": "global"},
    {"slug": "cloudflare", "name": "Cloudflare", "region": "global"},
    {"slug": "gitlab", "name": "GitLab", "region": "global"},
    {"slug": "elastic", "name": "Elastic", "region": "global"},
    {"slug": "twilio", "name": "Twilio", "region": "global"},
    {"slug": "okta", "name": "Okta", "region": "global"},
    {"slug": "atlassian", "name": "Atlassian", "region": "global"},
    {"slug": "shopify", "name": "Shopify", "region": "global"},
    {"slug": "lyft", "name": "Lyft", "region": "global"},
    {"slug": "asana", "name": "Asana", "region": "global"},
    {"slug": "figma", "name": "Figma", "region": "global"},
    {"slug": "rippling", "name": "Rippling", "region": "global"},
    {"slug": "anthropic", "name": "Anthropic", "region": "global"},
    {"slug": "openai", "name": "OpenAI", "region": "global"},
    {"slug": "uber", "name": "Uber", "region": "global"},
]

# Lever-hosted boards: https://api.lever.co/v0/postings/{slug}
LEVER_COMPANIES = [
    {"slug": "netflix", "name": "Netflix", "region": "global"},
    {"slug": "palantir", "name": "Palantir", "region": "global"},
    {"slug": "kpmg", "name": "KPMG", "region": "global"},
    {"slug": "plaid", "name": "Plaid", "region": "global"},
    {"slug": "ramp", "name": "Ramp", "region": "global"},
    {"slug": "scale", "name": "Scale AI", "region": "global"},
    {"slug": "mistral", "name": "Mistral AI", "region": "global"},
    {"slug": "writer", "name": "Writer", "region": "global"},
    {"slug": "replit", "name": "Replit", "region": "global"},
    {"slug": "leetcode", "name": "LeetCode", "region": "global"},
    {"slug": "udaan", "name": "Udaan", "region": "india"},
    {"slug": "zoominfo", "name": "ZoomInfo", "region": "global"},
]

ALL_COMPANIES = (
    [{**c, "platform": "greenhouse"} for c in GREENHOUSE_COMPANIES]
    + [{**c, "platform": "lever"} for c in LEVER_COMPANIES]
)

ROLE_KEYWORDS = {
    "devops": [
        "devops", "dev ops", "dev-ops",
        "platform engineer", "platform engineering",
        "infrastructure engineer", "infra engineer",
        "build engineer", "release engineer",
    ],
    "sre": [
        "site reliability",
        "site-reliability",
        " sre ",
        "sre,",
        "sre/",
        "(sre)",
        "reliability engineer",
        "production engineer",
    ],
    "cloud_architect": [
        "cloud architect",
        "cloud solutions architect",
        "cloud infrastructure architect",
        "principal cloud",
        "aws architect", "azure architect", "gcp architect",
        "cloud engineer",
        "aws engineer", "azure engineer", "gcp engineer",
        "kubernetes engineer",
    ],
}


def classify_role(title: str) -> str | None:
    """Return 'devops' | 'sre' | 'cloud_architect' or None."""
    t = f" {title.lower()} "
    for role, kws in ROLE_KEYWORDS.items():
        for kw in kws:
            if kw in t:
                return role
    return None
