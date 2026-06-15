"""Tag jobs by cloud provider / tech keyword for category filters."""

import re

TAG_PATTERNS = {
    "aws": re.compile(r"\b(aws|amazon\s*web\s*services|ec2|s3|lambda|cloudwatch|cloudformation|eks|rds|dynamodb)\b", re.I),
    "azure": re.compile(r"\b(azure|microsoft\s*azure|aks|azure\s*devops)\b", re.I),
    "gcp": re.compile(r"\b(gcp|google\s*cloud|gke|bigquery)\b", re.I),
    "kubernetes": re.compile(r"\b(kubernetes|k8s|helm|openshift)\b", re.I),
    "terraform": re.compile(r"\b(terraform|terragrunt|opentofu|infrastructure[\- ]as[\- ]code|iac)\b", re.I),
    "docker": re.compile(r"\b(docker|containerd|podman)\b", re.I),
    "ci_cd": re.compile(r"\b(ci/cd|jenkins|gitlab\s*ci|github\s*actions|circleci|argocd|argo\s*cd)\b", re.I),
}


def detect_tags(title: str, description: str = "") -> list[str]:
    text = f"{title}\n{description}"
    return [tag for tag, rx in TAG_PATTERNS.items() if rx.search(text)]
