# Resume Tailor — Deployment Guide (Oracle Free Tier VM)

A full free-tier deployment using GitHub Actions → Docker Hub → Oracle Cloud Always-Free VM.

## Architecture
```
GitHub push (main)  →  GitHub Actions
                          ├─ build backend image  → push to Docker Hub
                          ├─ build frontend image → push to Docker Hub
                          └─ SSH → Oracle VM → `docker compose pull && up -d`
```
The Oracle VM never builds anything — it only pulls and runs.

---
## 1. Oracle Cloud Free VM (one-time setup)
1. Create a **VM.Standard.A1.Flex** (ARM, Always Free) instance, Ubuntu 22.04.
2. Open ports 80 (and optionally 443) in the VCN Security List + inside the VM:
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo netfilter-persistent save
   ```
3. Install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   newgrp docker
   ```
4. Create the deploy folder & copy `docker-compose.yml`:
   ```bash
   mkdir -p ~/resume-tailor && cd ~/resume-tailor
   # upload docker-compose.yml from this repo (scp, git clone, or paste)
   ```

## 2. Docker Hub (free)
- Create repos: `resume-tailor-backend` and `resume-tailor-frontend`.
- Generate an Access Token (Account Settings → Security).

## 3. GitHub Secrets (Settings → Secrets and variables → Actions)
| Secret                | Description                                            |
|-----------------------|--------------------------------------------------------|
| `DOCKERHUB_USERNAME`  | Your Docker Hub username                               |
| `DOCKERHUB_TOKEN`     | Docker Hub access token                                |
| `PUBLIC_BACKEND_URL`  | Public URL the browser hits (e.g. `http://<VM-IP>`)    |
| `ORACLE_VM_HOST`      | VM public IP                                           |
| `ORACLE_VM_USER`      | SSH user (usually `ubuntu`)                            |
| `ORACLE_VM_SSH_KEY`   | Private key contents (paste full key incl. headers)    |
| `ORACLE_VM_PORT`      | SSH port (optional, defaults to 22)                    |

## 4. Push to deploy
```bash
git push origin main
```
The workflow at `.github/workflows/deploy.yml` will:
1. Build both Docker images.
2. Push them to Docker Hub with tags `latest` and the commit SHA.
3. SSH into the VM and run `docker compose pull && docker compose up -d`.

## 5. Verify
```bash
ssh ubuntu@<VM-IP>
docker compose -f ~/resume-tailor/docker-compose.yml ps
curl http://<VM-IP>/api/
```

## Local dev
```bash
# backend
cd backend && uvicorn server:app --reload --port 8001
# frontend
cd frontend && yarn && yarn start
```

## Free-tier cost
- Oracle Always-Free VM: **$0**
- Docker Hub public images: **$0**
- GitHub Actions on public repo: **$0** (2000 min/mo on private)
- LLM cost: pay-as-you-go to **your** OpenAI / Gemini key
