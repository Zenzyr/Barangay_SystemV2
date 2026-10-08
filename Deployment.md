# BIMS Production Deployment Guide

Barangay Information Management System (BIMS): Next.js frontend, Express/TypeScript backend, MongoDB 7, deployed with Docker Compose on an Ubuntu VPS.

This document is the single source of truth for deploying, updating, operating, backing up, troubleshooting and rolling back BIMS in production. It replaces `DOCKER.md` for day-to-day use. Every file, service name, port and variable below was checked against this repository.

---

## Table of Contents

1. [Conventions Used in This Guide](#1-conventions-used-in-this-guide)
2. [Deployment Architecture](#2-deployment-architecture)
3. [VPS Requirements](#3-vps-requirements)
4. [VPS Initial Setup](#4-vps-initial-setup)
5. [Domain and DNS](#5-domain-and-dns)
6. [Get the Code onto the VPS](#6-get-the-code-onto-the-vps)
7. [Production Environment Variables](#7-production-environment-variables)
8. [Docker Production Deployment](#8-docker-production-deployment)
9. [MongoDB Production Security](#9-mongodb-production-security)
10. [Nginx / Reverse Proxy](#10-nginx--reverse-proxy)
11. [SSL / HTTPS](#11-ssl--https)
12. [CORS / Authentication Configuration](#12-cors--authentication-configuration)
13. [File Uploads / Cloudinary](#13-file-uploads--cloudinary)
14. [Payments (PayMongo)](#14-payments-paymongo)
15. [Initial Production Startup (Step by Step)](#15-initial-production-startup-step-by-step)
16. [Database Backups](#16-database-backups)
17. [Updating Production](#17-updating-production)
18. [Low-Downtime Updates](#18-low-downtime-updates)
19. [Logging and Monitoring](#19-logging-and-monitoring)
20. [Troubleshooting](#20-troubleshooting)
21. [Rollback Procedure](#21-rollback-procedure)
22. [Security Checklist](#22-security-checklist)
23. [Production Checklist](#23-production-checklist)
24. [Command Reference](#24-command-reference)
25. [Safety Rules](#25-safety-rules)

---

## 1. Conventions Used in This Guide

### Where a command runs

Every command block is labelled:

- **LOCAL**: your development machine (where you write code and push to GitHub).
- **VPS**: the production Ubuntu server, over SSH.
- **ANY**: any machine with internet access (useful for checking the site from outside).

### Placeholders

Replace these with your real values. Never paste real secrets into this file or into Git.

| Placeholder | Meaning | Example |
|---|---|---|
| `<DOMAIN>` | The production domain, without `https://` | `bims-rabon-elyu.site` |
| `<VPS_IP>` | The VPS public IPv4 address | `203.0.113.10` |
| `<DEPLOY_USER>` | The non-root Linux user that runs the deployment | `deploy` |
| `<REPOSITORY_URL>` | The Git URL of this repository | `git@github.com:Zenzyr/Barangay_SystemV2.git` |
| `<DEPLOY_BRANCH>` | The Git branch deployed to production | see §6.1 |
| `<ADMIN_EMAIL>` | Email address for Let's Encrypt notices | `admin@example.com` |

The domain committed in this repository's Nginx files is `bims-rabon-elyu.site`. If `<DOMAIN>` is different, §10 and §11 show how to substitute it.

Many VPS commands use a shell variable so you only type the domain once per SSH session:

**VPS**
```bash
export DOMAIN=<DOMAIN>
```

### Project location on the VPS

The project always lives at `/opt/barangay`. All `docker compose` commands must be run from that directory, because the root `.env` file there selects which Compose files are used (`COMPOSE_FILE`, see §7.2).

---

## 2. Deployment Architecture

### 2.1 Diagram

```
Browser
   │  https://<DOMAIN>
   ▼
DNS  A record  <DOMAIN> → <VPS_IP>
   │
   ▼
Ubuntu VPS ─ UFW firewall: only 22, 80, 443 open
   │
   ▼
Edge Nginx (installed on the host, owns ports 80/443)
   │  TLS termination (Let's Encrypt), HTTP→HTTPS redirect, HSTS, 105 MB body limit
   │  config: deploy/nginx/edge/bims-rabon-elyu.site.conf
   │
   ▼  http://127.0.0.1:8081  (loopback only, not reachable from the internet)
┌──────────────────── Docker network: barangay-net ────────────────────┐
│                                                                      │
│  barangay-nginx   (nginx:1.27-alpine, port 80)                       │
│     config: deploy/nginx/barangay.conf                               │
│     ├── /bims/*  → barangay-server:5001   ("/bims" prefix removed)   │
│     └── /*       → barangay-client:3000                              │
│                                                                      │
│  barangay-client  (Next.js standalone, port 3000)                    │
│     └── /api/create-checkout-session → api.paymongo.com              │
│                                      → barangay-server:5001          │
│                                                                      │
│  barangay-server  (Express API, port 5001)                           │
│     ├── → barangay-mongo:27017                                       │
│     └── → Cloudinary, SMTP, IPROG SMS, Gemini, OCR.space, PayMongo   │
│                                                                      │
│  barangay-mongo   (mongo:7.0, port 27017, authentication enabled)    │
│     └── volume barangay_mongo_data                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Services

All four services are defined in `docker-compose.prod.yml` (Compose project name `barangay`).

| Service / container | Image | Internal port | Published on host | Role |
|---|---|---|---|---|
| `barangay-nginx` | `nginx:1.27-alpine` | 80 | `127.0.0.1:8081` only (via `docker-compose.proxy.yml`) | Internal router between frontend and API |
| `barangay-client` | `barangay-client:latest` (built from `frontend/Dockerfile`) | 3000 | never | Next.js UI and the PayMongo checkout API route |
| `barangay-server` | `barangay-server:latest` (built from `backend/Dockerfile`) | 5001 | never | Express REST API, LibreOffice DOCX→PDF conversion |
| `barangay-mongo` | `mongo:7.0` | 27017 | never | Database |

### 2.3 Who handles what

- **HTTP/HTTPS from the internet**: the host Nginx (the "edge"). It is the only process listening on public ports 80 and 443. It terminates TLS and forwards plain HTTP to `127.0.0.1:8081`.
- **Routing inside the app**: `barangay-nginx`. Requests to `/bims/...` go to the API with the `/bims` prefix stripped, so `https://<DOMAIN>/bims/account/login` reaches the Express route `/account/login`. Everything else goes to Next.js.
- **How the browser talks to the API**: same origin. The frontend is built with `NEXT_PUBLIC_BACKEND_URL_LIVE=/bims`, so the browser calls `https://<DOMAIN>/bims/...`. There are no cross-origin API calls in production.
- **How containers talk to each other**: by service name on the private Docker network `barangay-net` (`barangay-server:5001`, `barangay-mongo:27017`, `barangay-client:3000`). Docker's embedded DNS resolves these names.
- **Server-side Next.js code** (the PayMongo route) calls the API directly at `BACKEND_INTERNAL_URL=http://barangay-server:5001`, never through the public URL.

### 2.4 Ports

| Port | Bound to | Public? | Notes |
|---|---|---|---|
| 22 | host sshd | yes | SSH. Restrict to key authentication (§4.7). |
| 80 | host Nginx | yes | Only redirects to HTTPS and serves Let's Encrypt challenges. |
| 443 | host Nginx | yes | The website. |
| 8081 | `127.0.0.1` → `barangay-nginx:80` | **no** | Loopback only. Must never be opened in the firewall. |
| 3000, 5001, 27017 | inside `barangay-net` | **no** | Not published to the host at all. |

`docker-compose.prod.yml` publishes no host ports. The single loopback port comes from `docker-compose.proxy.yml`. MongoDB is **not** publicly exposed in this project, and it must stay that way (§9).

### 2.5 Alternative: another proxy container already owns 80/443

If the VPS already runs another application whose **Nginx container** publishes 80/443, BIMS can join that container's Docker network instead of using `127.0.0.1:8081`. The repository supports this with `docker-compose.proxy-network.yml` and `deploy/nginx/edge/bims-rabon-elyu.site.docker-proxy.conf`. This guide assumes a fresh VPS with Nginx installed on the host (the default). See §10.5 for the alternative.

---

## 3. VPS Requirements

| Item | Requirement |
|---|---|
| OS | Ubuntu 22.04 LTS or 24.04 LTS (64-bit, x86_64 or arm64) |
| CPU | 2 vCPU minimum. The first build compiles Next.js and installs LibreOffice. |
| RAM | 4 GB recommended. 2 GB works only with swap (§4.4). The Compose memory limits add up to about 3.4 GB (Mongo 1 GB, server 1.5 GB, client 768 MB, nginx 128 MB); idle usage is much lower. |
| Disk | 25 GB or more free. The server image includes LibreOffice (about 1 GB), plus build cache, logs, database and backups. |
| Docker | Docker Engine 24 or newer with the Buildx plugin (the Dockerfiles use BuildKit syntax) |
| Compose | Docker Compose plugin v2 or newer, used as `docker compose` (not the old `docker-compose`) |
| Git | Any recent version |
| Nginx | Ubuntu's `nginx` package (edge reverse proxy) |
| Certbot | Ubuntu's `certbot` package (Let's Encrypt certificates) |

### Check the current state

**VPS**
```bash
lsb_release -a
uname -a
nproc
free -h
df -h
docker --version
docker compose version
git --version
nginx -v
certbot --version
```

Anything reported as "command not found" is installed in §4.

---

## 4. VPS Initial Setup

### 4.1 Connect

**LOCAL**
```bash
ssh root@<VPS_IP>
```

If your provider gave you a non-root sudo user instead, use that user.

### 4.2 Create a deployment user

Do not run the application as `root`.

**VPS (as root)**
```bash
adduser <DEPLOY_USER>
usermod -aG sudo <DEPLOY_USER>
mkdir -p /home/<DEPLOY_USER>/.ssh
cp ~/.ssh/authorized_keys /home/<DEPLOY_USER>/.ssh/authorized_keys
chown -R <DEPLOY_USER>:<DEPLOY_USER> /home/<DEPLOY_USER>/.ssh
chmod 700 /home/<DEPLOY_USER>/.ssh
chmod 600 /home/<DEPLOY_USER>/.ssh/authorized_keys
```

If `/root/.ssh/authorized_keys` does not exist (you logged in with a password), first add your public key from your local machine:

**LOCAL**
```bash
ssh-keygen -t ed25519 -C "<ADMIN_EMAIL>"
ssh-copy-id <DEPLOY_USER>@<VPS_IP>
```

Open a **new** terminal and confirm you can log in as the new user before continuing:

**LOCAL**
```bash
ssh <DEPLOY_USER>@<VPS_IP>
```

From here on, all VPS commands are run as `<DEPLOY_USER>`.

### 4.3 Update Ubuntu

**VPS**
```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg git ufw nginx certbot dnsutils netcat-openbsd
sudo timedatectl set-timezone Asia/Manila
```

The containers already run in `Asia/Manila` (set in the Dockerfiles). Setting the host timezone too makes host logs and cron times match.

If `apt-get upgrade` installed a new kernel, reboot (`sudo reboot`) and reconnect.

### 4.4 Add swap (required on 2 GB VPS, recommended everywhere)

**VPS**
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

Skip this if `free -h` already shows swap.

### 4.5 Install Docker Engine and the Compose plugin

These are Docker's official Ubuntu repository steps.

**VPS**
```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker <DEPLOY_USER>
```

Log out and back in so the `docker` group applies, then verify:

**VPS**
```bash
docker --version
docker compose version
docker run --rm hello-world
```

Membership in the `docker` group is equivalent to root access. Only trusted administrators should be in it.

### 4.6 Firewall

Open only SSH, HTTP and HTTPS.

**VPS**
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Do **not** open 8081, 3000, 5001 or 27017.

Important Docker detail: ports that Docker publishes on `0.0.0.0` bypass UFW. This project is safe because the only published port is bound to `127.0.0.1` (`docker-compose.proxy.yml`). Never change that binding to `"8081:80"` or add `ports:` to `barangay-mongo`, `barangay-server` or `barangay-client`; UFW would not protect them.

### 4.7 Secure SSH

Only do this after confirming that key login as `<DEPLOY_USER>` works (§4.2). Keep your current session open while testing.

**VPS**
```bash
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' | sudo tee /etc/ssh/sshd_config.d/99-bims-hardening.conf
sudo sshd -t
sudo systemctl reload ssh
```

From a **new** local terminal, confirm `ssh <DEPLOY_USER>@<VPS_IP>` still works before closing the old session.

Optional but recommended:

**VPS**
```bash
sudo apt-get install -y fail2ban unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 4.8 Why MongoDB must stay private

MongoDB holds every resident record, account, password hash, payment record and audit log. Internet-facing MongoDB instances are scanned continuously and attacked within minutes (credential brute force, ransom wipes, exploitation of unpatched versions). In this architecture only `barangay-server` needs the database, and it reaches it over the private Docker network. There is no reason to publish port 27017. Administration is done through `docker compose exec` or an SSH tunnel (§9.5).

---

## 5. Domain and DNS

### 5.1 Records

At your DNS provider, create:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` (the bare `<DOMAIN>`) | `<VPS_IP>` | 300 at first, 3600 once stable |

Optional, only if you want `www.<DOMAIN>` to work (§10.6):

| Type | Name | Value |
|---|---|---|
| CNAME | `www` | `<DOMAIN>.` |

Also:

- Remove registrar parking records, URL forwarding and old `A` records for the same name.
- Do **not** add an `AAAA` (IPv6) record unless the VPS has a working public IPv6 that reaches this Nginx. Let's Encrypt tries IPv6 first, and a wrong `AAAA` record makes certificate issuance fail.
- If a `CAA` record exists, it must allow `letsencrypt.org`.

### 5.2 Verify

**VPS**
```bash
curl -4 -s https://ifconfig.me; echo
```

This prints the VPS public IP (`<VPS_IP>`).

**ANY**
```bash
dig +short <DOMAIN> A
dig +short <DOMAIN> AAAA
dig +short @1.1.1.1 <DOMAIN> A
dig +short @8.8.8.8 <DOMAIN> A
```

All `A` lookups must print `<VPS_IP>`, and the `AAAA` lookup should print nothing (unless you configured IPv6 on purpose). Propagation usually takes minutes, sometimes up to the old TTL.

Once Nginx is installed (it is, from §4.3), this should reach the VPS:

**ANY**
```bash
curl -I http://<DOMAIN>
```

Before §10 it shows the Ubuntu default Nginx page (`HTTP/1.1 200 OK`, `Server: nginx`). After §10 it returns a 503 or a 301.

---

## 6. Get the Code onto the VPS

### 6.1 Choose the branch to deploy

The production Docker files (`docker-compose.prod.yml`, `docker-compose.proxy.yml`, `docker-compose.proxy-network.yml`, `deploy/`, both `Dockerfile`s, the `.env.production.example` files) exist on the **`development`** branch. At the time this guide was written they were **not** on `main`.

Choose one:

- **Recommended**: merge `development` into `main` and deploy `main`, so production always runs reviewed code.
- Or deploy `development` directly.

Use the chosen name wherever this guide says `<DEPLOY_BRANCH>`.

The VPS builds from Git, not from your working copy. Anything you want in production must be committed and pushed first:

**LOCAL**
```bash
git status
git add <files>
git commit -m "<message>"
git push origin <DEPLOY_BRANCH>
```

Never commit `.env`, `backend/.env.production` or any other real environment file. The root `.gitignore` already ignores `.env` and `.env.*` (except the `*.example` files).

### 6.2 Give the VPS read access to the repository

If the repository is public, skip to §6.3 and use the HTTPS URL `https://github.com/Zenzyr/Barangay_SystemV2.git`.

If it is private, use a read-only **deploy key** (it can only read this one repository):

**VPS**
```bash
ssh-keygen -t ed25519 -f ~/.ssh/bims_deploy_key -N "" -C "bims-vps-deploy"
cat ~/.ssh/bims_deploy_key.pub
printf 'Host github.com\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/bims_deploy_key\n  IdentitiesOnly yes\n' >> ~/.ssh/config
chmod 600 ~/.ssh/config
```

In GitHub: repository → **Settings → Deploy keys → Add deploy key**, paste the printed public key, leave **Allow write access unchecked**, save. Then test:

**VPS**
```bash
ssh -T git@github.com
```

It should greet you with the repository name and say shell access is not provided.

Do not put personal access tokens in the clone URL; they would be stored in plain text in `.git/config`.

### 6.3 Clone

**VPS**
```bash
sudo mkdir -p /opt/barangay
sudo chown <DEPLOY_USER>:<DEPLOY_USER> /opt/barangay
git clone --branch <DEPLOY_BRANCH> <REPOSITORY_URL> /opt/barangay
cd /opt/barangay
git log --oneline -1
ls docker-compose.prod.yml docker-compose.proxy.yml deploy/nginx/barangay.conf deploy/mongo/backup.sh
```

If the `ls` reports a missing file, you cloned a branch without the Docker files (§6.1).

### 6.4 Pulling updates later

Always pull with fast-forward only, so a diverged branch fails loudly instead of creating a merge commit on the server:

**VPS**
```bash
cd /opt/barangay
git fetch origin
git status
git pull --ff-only origin <DEPLOY_BRANCH>
```

Never edit tracked files directly on the VPS. If `git status` shows local modifications, find out why before pulling. The only files that should differ from Git are the ignored `.env` and `backend/.env.production`.

---

## 7. Production Environment Variables

Production uses **two** environment files on the VPS. Both are git-ignored and must be `chmod 600`.

| File on the VPS | Template in the repo | Read by | Purpose |
|---|---|---|---|
| `/opt/barangay/.env` | `.env.production.example` | Docker Compose itself | Public URL, Compose file selection, MongoDB credentials, PayMongo key for the frontend container |
| `/opt/barangay/backend/.env.production` | `backend/.env.production.example` | `barangay-server` container (`env_file`) | All backend secrets and API keys |

The development files `backend/.env` and `frontend/.env` are **not** used by the containers. The backend image does not contain them (`backend/Dockerfile.dockerignore`), and the frontend build ignores them (`frontend/.dockerignore`).

There is no separate frontend environment file in production. The frontend's values are passed as build arguments by `docker-compose.prod.yml` (§7.4).

### 7.1 Generating secrets

**VPS**
```bash
openssl rand -hex 48
openssl rand -hex 24
```

- Use `openssl rand -hex 48` (96 hex characters) for `JWT_SECRET`.
- Use `openssl rand -hex 24` (48 hex characters) for each MongoDB password.
- MongoDB passwords must contain only letters and digits, because they are embedded in the connection URI `mongodb://user:password@...`. Hex output is always safe.
- Generate each secret separately. Never reuse a value from development.

### 7.2 Root `.env` (Docker Compose)

**VPS**
```bash
cd /opt/barangay
cp .env.production.example .env
chmod 600 .env
nano .env
```

| Variable | Required | Production value | What it does |
|---|---|---|---|
| `PUBLIC_URL` | yes | `https://<DOMAIN>` (no trailing slash) | Becomes the backend `CORS_ORIGINS` and the frontend build arg `NEXT_PUBLIC_BASE_URL_LIVE` (PayMongo return URLs). **Build-time** for the frontend. |
| `MONGO_ROOT_USERNAME` | yes | e.g. `barangay_root` | MongoDB root user, created on first start of an empty volume. Used only for backups and administration. |
| `MONGO_ROOT_PASSWORD` | yes | `<GENERATED_HEX_PASSWORD>` | Root password. |
| `MONGO_APP_DATABASE` | no | `bims` (default) | Application database name. |
| `MONGO_APP_USERNAME` | yes | e.g. `barangay_app` | Least-privilege user (`readWrite` on the app database only), created by `deploy/mongo/init/01-create-app-user.js`. |
| `MONGO_APP_PASSWORD` | yes | `<GENERATED_HEX_PASSWORD>` | App user password, different from the root password. |
| `PAYMONGO_SECRET_KEY` | for online payments | `<PAYMONGO_SECRET_KEY>` | Used by the Next.js route `/api/create-checkout-session` inside `barangay-client`. |
| `COMPOSE_FILE` | yes | `docker-compose.prod.yml:docker-compose.proxy.yml` | Makes plain `docker compose` load the production file plus the `127.0.0.1:8081` binding. |
| `BIMS_HTTP_PORT` | no | `8081` (default) | Loopback port for `barangay-nginx`. Change only if 8081 is taken, and change the edge Nginx `server 127.0.0.1:8081;` line to match. |
| `PROXY_NETWORK` | only for §10.5 | name of the proxy container's network | Used only by `docker-compose.proxy-network.yml`. |

Resulting file (values are placeholders):

```env
PUBLIC_URL=https://<DOMAIN>

MONGO_ROOT_USERNAME=barangay_root
MONGO_ROOT_PASSWORD=<GENERATED_HEX_PASSWORD_1>

MONGO_APP_DATABASE=bims
MONGO_APP_USERNAME=barangay_app
MONGO_APP_PASSWORD=<GENERATED_HEX_PASSWORD_2>

PAYMONGO_SECRET_KEY=<PAYMONGO_SECRET_KEY>

COMPOSE_FILE=docker-compose.prod.yml:docker-compose.proxy.yml
BIMS_HTTP_PORT=8081
```

The MongoDB users are created **only the first time** the container starts with an empty `barangay_mongo_data` volume. Changing `MONGO_*` values later does not change the users inside the database (see §20.4).

### 7.3 `backend/.env.production` (API container)

**VPS**
```bash
cd /opt/barangay
cp backend/.env.production.example backend/.env.production
chmod 600 backend/.env.production
nano backend/.env.production
```

Do **not** set `MONGODB_URI`, `CORS_ORIGINS`, `NODE_ENV` or `PORT` here. `docker-compose.prod.yml` sets them and its values take precedence:

- `NODE_ENV=production`, `PORT=5001`
- `MONGODB_URI=mongodb://<MONGO_APP_USERNAME>:<MONGO_APP_PASSWORD>@barangay-mongo:27017/<MONGO_APP_DATABASE>?authSource=<MONGO_APP_DATABASE>`
- `CORS_ORIGINS=<PUBLIC_URL>`

Also do not override `TZ`, `DOCX_PDF_CONVERTER`, `SOFFICE_PATH`, `TEMPLATE_DOCS_DIR` or `TEMPLATE_ASSETS_DIR`; `backend/Dockerfile` sets them correctly for the container (`Asia/Manila`, LibreOffice at `/usr/bin/soffice`, templates under `/app/templates`).

#### Authentication

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | **yes** | At least 32 characters, otherwise the server refuses to start in production. Use `openssl rand -hex 48`. Changing it logs out every user. |

#### Cloudinary (ID photos, profile pictures, logos)

| Variable | Required | Notes |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | yes | From the Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | yes | |
| `CLOUDINARY_API_SECRET` | yes | Secret |

#### Email (SMTP)

| Variable | Required | Notes |
|---|---|---|
| `SMTP_HOST` | yes for email | e.g. your provider's SMTP host |
| `SMTP_PORT` | yes for email | `587` (STARTTLS) is the default in the template |
| `SMTP_USER` | yes for email | |
| `SMTP_PASS` | yes for email | Secret (for Gmail, an app password) |
| `SMTP_FROM` | yes for email | Sender address shown to users |

Email is used for verification, password reset and notifications. Many VPS providers block outbound port 25; port 587 is normally open.

#### SMS (IPROG)

| Variable | Required | Notes |
|---|---|---|
| `IPROG_API_TOKEN` | for SMS | Secret |
| `IPROG_SENDER_NAME` | for SMS | Approved sender name |

#### AI and OCR

| Variable | Required | Notes |
|---|---|---|
| `AI_PROVIDER` | no | `gemini` |
| `GEMINI_API_KEY` | for AI features | Main Gemini key. `GOOGLE_API_KEY` is also accepted as a fallback name by the code. |
| `GEMINI_MODEL` | no | Leave blank for the code default |
| `GEMINI_API_VERSION` | no | Leave blank for the code default |
| `ID_VERIFY_API_KEY`, `ID_VERIFY_MODEL` | no | ID verification; falls back to `GEMINI_API_KEY` when blank |
| `AI_ANALYTICS_API_KEY`, `AI_ANALYTICS_MODEL` | no | Analytics; falls back to `GEMINI_API_KEY` |
| `CHATBOT_API_KEY`, `CHATBOT_MODEL` | no | Chatbot; falls back to `GEMINI_API_KEY` |
| `OCR_SPACE_API_KEY` | for OCR | OCR.space key |

#### Payments

| Variable | Required | Notes |
|---|---|---|
| `PAYMONGO_SECRET_KEY` | for online payments | Same key as in the root `.env`. The backend uses it to verify checkout sessions with PayMongo (§14). |

#### Bootstrap accounts (used once)

| Variable | Required | Notes |
|---|---|---|
| `SUPER_ADMIN_EMAIL` | for first setup | Read by `dist/scripts/createSuperAdmin.js` |
| `SUPER_ADMIN_PASSWORD` | for first setup | At least 12 characters. Remove after first setup (§15, step 14). |
| `SUPER_ADMIN_NAME` | no | Defaults to `System Administrator` |
| `SECRETARY_EMAIL`, `SECRETARY_PASSWORD`, `SECRETARY_NAME` | optional | Read by `dist/scripts/createSecretary.js`. Remove the password after use. |

### 7.4 Frontend values (derived, nothing to edit)

`docker-compose.prod.yml` passes these to `frontend/Dockerfile` as build arguments:

| Variable | Production value | Visible to browser? | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL_LIVE` | `/bims` (fixed) | yes | Browser API base path, same origin |
| `NEXT_PUBLIC_BASE_URL_LIVE` | `${PUBLIC_URL}` | yes | PayMongo success/cancel return URLs |
| `BACKEND_INTERNAL_URL` | `http://barangay-server:5001` (fixed) | no | Server-side calls and the `/bims` rewrite in `next.config.ts` |
| `PAYMONGO_SECRET_KEY` | from root `.env` (runtime env) | no | Server-side only |

`NEXT_PUBLIC_*` values are compiled into the JavaScript sent to browsers, so they only ever contain public URLs. Because they are compiled in, **changing `PUBLIC_URL` requires rebuilding the frontend** (`docker compose up -d --build`).

### 7.5 Validate before starting

**VPS**
```bash
cd /opt/barangay
docker compose config --quiet && echo "compose config OK"
grep -c '<' .env backend/.env.production
ls -l .env backend/.env.production
```

- `config --quiet` fails with a clear message if a required variable is missing (for example `set MONGO_ROOT_USERNAME in .env`).
- The `grep -c '<'` count should be `0` for both files (no `<placeholder>` left). If a value legitimately contains `<`, check by eye instead.
- Both files must show `-rw-------`.

---

## 8. Docker Production Deployment

### 8.1 What each container does

| Container | Built from / image | Details |
|---|---|---|
| `barangay-mongo` | `mongo:7.0` | Runs `mongod --wiredTigerCacheSizeGB 0.5`. Root user from `MONGO_ROOT_*`. On first start of an empty volume, runs `deploy/mongo/init/01-create-app-user.js` to create the `readWrite` app user. |
| `barangay-server` | `backend/Dockerfile` (multi-stage, `node:22-bookworm-slim`) | Compiles TypeScript to `dist/`, installs production dependencies, LibreOffice Writer and fonts for DOCX→PDF. Copies `frontend/docs` and `frontend/public/assets/docx-templates` into `/app/templates`. Runs `node dist/index.js` as the unprivileged `node` user. |
| `barangay-client` | `frontend/Dockerfile` (multi-stage) | `next build` in `standalone` mode, then runs `node server.js` as `node` on port 3000. |
| `barangay-nginx` | `nginx:1.27-alpine` | Mounts `deploy/nginx/barangay.conf` read-only as its only site. |

### 8.2 Startup order and health checks

Compose starts the services in dependency order and waits for each health check:

1. `barangay-mongo` becomes **healthy** when `mongosh` can log in as the app user and `ping` succeeds (checked every 15 s, 40 s start period).
2. `barangay-server` starts only after Mongo is healthy. It is healthy when `GET /health` returns 200, which requires a working database ping.
3. `barangay-client` starts after the server is healthy. Healthy when `GET /` on port 3000 returns 200.
4. `barangay-nginx` starts after client and server are healthy. Healthy when `/nginx-health` returns `ok`.

A clean first start takes 1–3 minutes after the images are built.

### 8.3 Restart policies, limits and logs

- All services use `restart: unless-stopped`: they come back after crashes and after a VPS reboot (Docker is enabled at boot in §4.5), but stay stopped if you stopped them with `docker compose stop`.
- `barangay-server` and `barangay-client` use `init: true` for correct signal handling. The server shuts down gracefully on `SIGTERM`.
- Memory limits: Mongo 1024 MB, server 1536 MB, client 768 MB, nginx 128 MB.
- Logs use the `json-file` driver, rotated at 10 MB × 3 files per container, so logs cannot fill the disk.

### 8.4 Network and volumes

| Name | Type | Contents | Survives `up --build`, `down`, reboot? |
|---|---|---|---|
| `barangay-net` | bridge network | Private network for the four containers | Recreated as needed |
| `barangay_mongo_data` | named volume → `/data/db` | **The entire database** | Yes. Deleted only by `docker compose down -v` or `docker volume rm`/`prune`. |
| `barangay_backups` | named volume → `/app/backups` in the server | In-app backups made from Settings → Backup | Yes, same rule |

Nothing else needs to persist: uploads go to Cloudinary (§13), and templates and images are part of the server image.

### 8.5 Build and start

**VPS**
```bash
cd /opt/barangay
docker compose build
docker compose up -d
docker compose ps
```

The first build takes several minutes (Next.js build, LibreOffice install). Run `docker compose ps` again until all four services show `(healthy)`.

### 8.6 Status and logs

**VPS**
```bash
cd /opt/barangay
docker compose ps
docker compose logs --tail=100
docker compose logs -f barangay-server
docker compose logs -f barangay-client
docker compose logs -f barangay-mongo
docker compose logs -f barangay-nginx
```

### 8.7 Inspect an individual container

**VPS**
```bash
docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}} restarts={{.RestartCount}}' barangay-server
docker inspect --format '{{json .State.Health}}' barangay-server
docker compose exec barangay-server sh
docker compose exec barangay-nginx wget -qO- http://127.0.0.1/bims/health
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' --filter name=barangay-
```

`/bims/health` returns `{"status":"ok","database":"connected","uptime":...}` when the API and database are fine.

---

## 9. MongoDB Production Security

### 9.1 Current configuration (verified)

| Item | Value |
|---|---|
| Container | `barangay-mongo` (`mongo:7.0`) |
| Database | `MONGO_APP_DATABASE`, default `bims` |
| Authentication | Enabled (root user set via `MONGO_INITDB_ROOT_*`) |
| App user | `MONGO_APP_USERNAME`, role `readWrite` on the app database only, `authSource` = app database |
| Volume | `barangay_mongo_data` → `/data/db` |
| Network | `barangay-net` only |
| Host port mapping | **None.** `docker-compose.prod.yml` has no `ports:` for Mongo. |

This is the correct, secure setup. Do not add:

```yaml
ports:
  - "27017:27017"
```

It is not needed (only `barangay-server` talks to Mongo, over the Docker network), and Docker-published ports bypass UFW (§4.6), so it would expose the database to the internet.

### 9.2 Verify that MongoDB is not exposed

**VPS**
```bash
sudo ss -tulpn | grep -E ':(27017|5001|3000|8081)\b'
docker ps --format '{{.Names}}: {{.Ports}}' --filter name=barangay-
```

Expected:

- `ss` shows only `127.0.0.1:8081` (owned by `docker-proxy`). Nothing on 27017, 5001 or 3000.
- `docker ps` shows `barangay-nginx: 127.0.0.1:8081->80/tcp` and plain `27017/tcp`, `5001/tcp`, `3000/tcp` (no `->`) for the others.

From outside the VPS, every one of these must fail or time out:

**LOCAL**
```bash
for p in 3000 5001 8081 27017; do nc -zv -w5 <VPS_IP> $p; done
```

### 9.3 Credentials

- The application connects as the least-privilege app user, never as root.
- The root user is used only by `deploy/mongo/backup.sh` and for manual administration. Its password is read from the container's environment, so it never appears in your shell history.
- Use different random hex passwords for root and app (§7.1).

### 9.4 Administration from the VPS (recommended)

Open a `mongosh` shell as root without typing the password:

**VPS**
```bash
cd /opt/barangay
docker compose exec barangay-mongo sh -c 'mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$MONGO_APP_DATABASE"'
```

The single quotes matter: the variables are expanded inside the container, where the credentials already exist.

Useful checks inside `mongosh`:

```javascript
db.getCollectionNames()
db.accounts.countDocuments()
db.getUsers()
```

### 9.5 MongoDB Compass through an SSH tunnel

Never open 27017 for Compass. Tunnel through SSH instead. Because Mongo has no host port, the tunnel targets the container's address on `barangay-net`.

Get the container IP (it can change when the container is recreated, so look it up each time):

**VPS**
```bash
docker inspect -f '{{(index .NetworkSettings.Networks "barangay-net").IPAddress}}' barangay-mongo
```

Open the tunnel and leave it running:

**LOCAL**
```bash
ssh -N -L 27018:<MONGO_CONTAINER_IP>:27017 <DEPLOY_USER>@<VPS_IP>
```

In Compass, connect to:

```
mongodb://<MONGO_APP_USERNAME>:<MONGO_APP_PASSWORD>@127.0.0.1:27018/bims?authSource=bims&directConnection=true
```

Use the app user for everyday browsing; use root (`authSource=admin`) only when necessary. Close the tunnel (Ctrl+C) when done. Treat Compass edits on production as dangerous: take a backup first (§16).

### 9.6 Backup strategy

See §16. In short: daily `deploy/mongo/backup.sh` via cron into `~/barangay-backups`, 14-day retention by default, plus regular off-server copies.

---

## 10. Nginx / Reverse Proxy

There are two Nginx layers, both already in the repository.

### 10.1 Inner router: `barangay-nginx` (`deploy/nginx/barangay.conf`)

Runs as a container; you normally never edit it. What it does:

- `location /bims/` → `http://barangay-server:5001/` (prefix stripped), 180 s read/send timeout for long operations such as DOCX→PDF conversion and backups.
- `location /_next/static/` → `barangay-client` (static assets).
- `location /` → `barangay-client`, with WebSocket `Upgrade` headers passed through.
- `location = /nginx-health` → health check.
- `client_max_body_size 105m` (100 MB backup uploads plus multipart overhead).
- Trusts `X-Forwarded-For` only from loopback and private addresses (the edge), so the API sees the real client IP (`app.set('trust proxy', 1)` in `backend/index.ts`; used by login rate limiting).
- gzip and basic security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).

### 10.2 Edge proxy on the host (`deploy/nginx/edge/`)

| File | Purpose |
|---|---|
| `bims-rabon-elyu.site.http.conf` | Bootstrap: HTTP only, serves Let's Encrypt challenges from `/var/www/certbot`, answers everything else with 503 |
| `bims-rabon-elyu.site.conf` | Final: HTTP→HTTPS 301, TLS 1.2/1.3, HSTS, proxy to `127.0.0.1:8081`, 105 MB bodies, 180 s timeouts, WebSocket headers, `proxy_request_buffering off` |
| `bims-rabon-elyu.site.docker-proxy.conf` | Same as the final file, for a proxy **container** (§10.5) |

These files contain the domain `bims-rabon-elyu.site`. The commands below substitute `$DOMAIN` while copying, so they work for any domain. If `<DOMAIN>` is `bims-rabon-elyu.site`, the substitution changes nothing.

### 10.3 Install the bootstrap (HTTP) configuration

The application containers must be running first (§8.5).

**VPS**
```bash
export DOMAIN=<DOMAIN>
cd /opt/barangay
curl -s http://127.0.0.1:8081/bims/health; echo
sudo mkdir -p /var/www/certbot
sed "s/bims-rabon-elyu\.site/$DOMAIN/g" deploy/nginx/edge/bims-rabon-elyu.site.http.conf | sudo tee /etc/nginx/sites-available/$DOMAIN.conf > /dev/null
sudo ln -sf /etc/nginx/sites-available/$DOMAIN.conf /etc/nginx/sites-enabled/$DOMAIN.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
curl -si http://$DOMAIN/ | head -1
```

- The health check must print `"database":"connected"` before you continue.
- Removing `sites-enabled/default` disables Ubuntu's placeholder page. Skip that line if another site on this VPS relies on it.
- The final `curl` prints `HTTP/1.1 503` ("HTTPS is being set up"). That is expected at this stage.
- Only reload Nginx if `nginx -t` passes.

### 10.4 Switch to the final HTTPS configuration

This is done in §11.2, after the certificate exists, because the final file references the certificate paths.

### 10.5 Alternative: the proxy is a container

Only if another application's Nginx **container** already publishes 80/443:

**VPS**
```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
P=<PROXY_CONTAINER_NAME>
docker inspect $P --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'
docker inspect $P --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
```

Then in `/opt/barangay/.env`:

```env
COMPOSE_FILE=docker-compose.prod.yml:docker-compose.proxy-network.yml
PROXY_NETWORK=<NETWORK_NAME_FROM_FIRST_INSPECT>
```

Run `docker compose up -d`, then install the bootstrap and final configs into the host directory mounted at the container's `/etc/nginx/conf.d`, using `deploy/nginx/edge/bims-rabon-elyu.site.docker-proxy.conf` as the final file (it proxies to `barangay-nginx:80`), and reload with `docker exec $P nginx -t && docker exec $P nginx -s reload`. Run certbot with the host paths of that container's webroot and Let's Encrypt mounts. If the proxy container does not mount a webroot and `/etc/letsencrypt`, stop: adding them means changing the other application's setup.

### 10.6 Optional: `www.<DOMAIN>`

The repository's edge configs do not include `www`. To support it:

1. Add the `www` CNAME (§5.1) and wait for it to resolve.
2. Issue the certificate for both names (§11.1, add `-d www.$DOMAIN`).
3. Add this redirect-only server block to `/etc/nginx/sites-available/$DOMAIN.conf`, replacing `<DOMAIN>`:

```nginx
server {
    listen 80;
    listen [::]:80;
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.<DOMAIN>;
    server_tokens off;

    ssl_certificate     /etc/letsencrypt/live/<DOMAIN>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<DOMAIN>/privkey.pem;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type text/plain;
    }

    location / {
        return 301 https://<DOMAIN>$request_uri;
    }
}
```

4. `sudo nginx -t && sudo systemctl reload nginx`.

`www` only redirects to the bare domain, so `PUBLIC_URL` and CORS stay unchanged.

---

## 11. SSL / HTTPS

Let's Encrypt certificates via Certbot's **webroot** method. Certbot only writes certificate files; it never edits the Nginx configuration.

### 11.1 Issue the certificate

Prerequisites: DNS resolves to the VPS (§5.2), ports 80/443 are open (§4.6), the bootstrap config is active (§10.3).

**VPS**
```bash
export DOMAIN=<DOMAIN>
sudo certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --dry-run
sudo certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --email <ADMIN_EMAIL> --agree-tos --no-eff-email
sudo ls /etc/letsencrypt/live/$DOMAIN/
```

The dry run uses Let's Encrypt staging (no rate limits). Only run the real command once it succeeds. The `ls` must show `fullchain.pem` and `privkey.pem`.

### 11.2 Enable the HTTPS configuration

**VPS**
```bash
export DOMAIN=<DOMAIN>
cd /opt/barangay
sed "s/bims-rabon-elyu\.site/$DOMAIN/g" deploy/nginx/edge/bims-rabon-elyu.site.conf | sudo tee /etc/nginx/sites-available/$DOMAIN.conf > /dev/null
sudo nginx -t && sudo systemctl reload nginx
```

This activates the HTTP→HTTPS redirect, TLS 1.2/1.3, HSTS (`max-age=31536000`) and the proxy to `127.0.0.1:8081`.

### 11.3 Automatic renewal

Ubuntu's certbot package installs a systemd timer that renews certificates automatically. Add a hook so Nginx reloads after each renewal:

**VPS**
```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

### 11.4 Verify renewal

**VPS**
```bash
sudo certbot renew --dry-run --cert-name $DOMAIN
systemctl list-timers | grep -i certbot
sudo certbot certificates
```

The dry run must end with "Congratulations, all simulated renewals succeeded". `certbot certificates` shows the expiry date (renewal happens about 30 days before).

### 11.5 Verify HTTPS from outside

**ANY**
```bash
curl -sI http://<DOMAIN>/ | grep -iE '^HTTP|^location'
curl -sI https://<DOMAIN>/ | grep -iE '^HTTP|strict-transport'
curl -s https://<DOMAIN>/bims/health; echo
echo | openssl s_client -connect <DOMAIN>:443 -servername <DOMAIN> 2>/dev/null | openssl x509 -noout -subject -issuer -dates
```

Expected: `301` to `https://<DOMAIN>/`, then `200` with a `strict-transport-security` header, `"database":"connected"`, and a certificate for `<DOMAIN>` issued by Let's Encrypt.

---

## 12. CORS / Authentication Configuration

### 12.1 How authentication works in this project

- Login (`POST /bims/account/login`) returns a JWT signed with `JWT_SECRET`, valid for **3 days**.
- The frontend stores the token in `localStorage` and sends it on every API request as `Authorization: Bearer <token>` (`frontend/app/utils/axios.ts`).
- The API validates it in `backend/middleware/auth.ts`.
- **No cookies are used for authentication.** There are no `Secure`, `SameSite` or cookie-domain settings to configure.

Consequences for production:

- `JWT_SECRET` must be strong and stable. Rotating it immediately logs out every user.
- HTTPS is mandatory, because the bearer token travels in a request header and would otherwise be readable on the network.
- Because the token is in `localStorage`, any XSS bug could steal it. Keep dependencies updated and never inject untrusted HTML.

### 12.2 CORS

- `backend/index.ts` allows only the exact origins in `CORS_ORIGINS` (comma-separated, trailing slashes and case ignored), with `credentials: true`. Unknown origins get no `Access-Control-Allow-*` headers.
- In production `CORS_ORIGINS` is set to `PUBLIC_URL`, i.e. exactly `https://<DOMAIN>`. Never use `*`.
- The BIMS pages call the API on the same origin (`/bims/...`), so CORS is not even exercised by normal use. It only matters for other origins, which are blocked.

Verify:

**ANY**
```bash
curl -s -o /dev/null -D - -X OPTIONS https://<DOMAIN>/bims/account/login -H 'Origin: https://<DOMAIN>' -H 'Access-Control-Request-Method: POST' | grep -i '^access-control-allow-origin'
curl -s -o /dev/null -D - -X OPTIONS https://<DOMAIN>/bims/account/login -H 'Origin: https://evil.example' -H 'Access-Control-Request-Method: POST' | grep -i '^access-control-allow-origin'
```

The first prints `access-control-allow-origin: https://<DOMAIN>`. The second prints nothing.

### 12.3 How the domain affects auth and the app

- `PUBLIC_URL` must be exactly the URL users type (`https://<DOMAIN>`, no trailing slash, no `www` unless that is the canonical name).
- Tokens are stored per origin by the browser. Moving to a new domain means users log in again.
- After changing `PUBLIC_URL`, rebuild so the frontend picks it up: `docker compose up -d --build`.

---

## 13. File Uploads / Cloudinary

### 13.1 Upload flow

1. The browser uploads to the API (`multipart/form-data`).
2. `multer` (`backend/utils/upload.ts`) writes the file temporarily to `/app/uploads` inside `barangay-server`.
3. Images (ID photos, profile pictures, logos) are uploaded to **Cloudinary**, the Cloudinary URL is saved in MongoDB, and the temporary local file is deleted.
4. DOCX files used by Document Templates are processed in memory or in temporary files and stored in MongoDB, not on disk.

### 13.2 What is stored where

| Data | Location | Persistent volume needed? |
|---|---|---|
| ID photos, profile pictures, logos | Cloudinary | No (external) |
| Temporary uploads | `/app/uploads` in the container | No, it is only a staging area |
| Document template DOCX packages | MongoDB (`barangay_mongo_data`) | Already persistent |
| Template images and the bundled DOCX originals | Baked into the `barangay-server` image (`/app/templates`) | No, they ship with the code |
| In-app backups (Settings → Backup) | `/app/backups` → volume `barangay_backups` | Yes, already configured |

The container filesystem is discarded whenever a container is recreated, so nothing important is kept there.

### 13.3 Size limits

| Limit | Value | Where |
|---|---|---|
| Normal uploads | 10 MB per file | `backend/utils/upload.ts` |
| Backup file upload | 100 MB | `backend/index.ts` error handler / backup route |
| JSON request bodies | 3 MB | `express.json({ limit: "3mb" })` |
| Edge and inner Nginx body size | 105 MB | `client_max_body_size 105m` in both configs |

A request larger than 105 MB is rejected by Nginx with `413`. Files above 10 MB are rejected by the API with a 400 message.

### 13.4 Production configuration

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in `backend/.env.production`, then recreate the server (`docker compose up -d --force-recreate barangay-server`). Test by registering a resident with ID photos or changing a profile picture, and confirm the image URL points to `res.cloudinary.com`.

---

## 14. Payments (PayMongo)

### 14.1 How payments work in this project

There is **no PayMongo webhook endpoint** in this codebase, so there is no webhook URL to register and no webhook signing secret. Payment status is confirmed by actively asking PayMongo:

1. The resident clicks Pay. The browser calls the Next.js route `POST https://<DOMAIN>/api/create-checkout-session` (in `barangay-client`).
2. That route fetches the document request from the API (`BACKEND_INTERNAL_URL`), charges the **stored** price (the client-sent amount is ignored), creates a PayMongo checkout session (GCash) with `PAYMONGO_SECRET_KEY`, and saves the session ID via `POST /document-request/:id/session`.
3. PayMongo redirects the resident back to `https://<DOMAIN>/payment/success?...` (or `/pages/resident/myDocuments` on cancel). These URLs come from `NEXT_PUBLIC_BASE_URL_LIVE` = `PUBLIC_URL`.
4. The success page calls `POST /bims/document-request/:id/payment/online`. The API retrieves the checkout session from PayMongo with its own `PAYMONGO_SECRET_KEY` and marks the request paid only if the payment intent `succeeded`.

### 14.2 Requirements

- `PAYMONGO_SECRET_KEY` in **both** `/opt/barangay/.env` (frontend container) and `backend/.env.production` (API). Use the live key (`sk_live_...`) in production and the test key only for testing.
- HTTPS must work, because PayMongo redirects the resident to `https://<DOMAIN>/payment/success`.
- `PUBLIC_URL` must be correct **at build time**, otherwise the return URLs point to the wrong host.

### 14.3 Test

**ANY**
```bash
curl -s -X POST https://<DOMAIN>/api/create-checkout-session -H 'Content-Type: application/json' -d '{}'; echo
```

A JSON error about invalid sender or document id proves the route is reachable. Then, in a browser, create a document request as a resident, pay with a test key first, and confirm the request shows as paid.

### 14.4 Restarts and limitations

- Because nothing is pushed by PayMongo, a container restart cannot "lose" a webhook. A checkout started before a restart can still be verified afterwards, because the session ID is stored in MongoDB.
- Limitation: if a resident pays but closes the browser before reaching `/payment/success`, the request is not automatically marked paid. Staff can verify it through the Treasurer payment-verification pages or record the payment manually.

---

## 15. Initial Production Startup (Step by Step)

Follow in order. Each step links to the detailed section.

**Step 1. Prepare the VPS** (§4)

Create the deploy user, update Ubuntu, add swap, install Docker, Git, Nginx, Certbot, enable the firewall, harden SSH.

**Step 2. Configure DNS** (§5)

Create the `A` record and wait until `dig +short <DOMAIN> A` returns `<VPS_IP>`.

**Step 3. Push the code** (§6.1)

**LOCAL**
```bash
git push origin <DEPLOY_BRANCH>
```

**Step 4. Clone the repository** (§6.2–6.3)

**VPS**
```bash
sudo mkdir -p /opt/barangay
sudo chown <DEPLOY_USER>:<DEPLOY_USER> /opt/barangay
git clone --branch <DEPLOY_BRANCH> <REPOSITORY_URL> /opt/barangay
cd /opt/barangay
```

**Step 5. Create the root `.env`** (§7.2)

**VPS**
```bash
cd /opt/barangay
cp .env.production.example .env
chmod 600 .env
openssl rand -hex 24
openssl rand -hex 24
nano .env
```

Paste the two generated values into `MONGO_ROOT_PASSWORD` and `MONGO_APP_PASSWORD`, set `PUBLIC_URL=https://<DOMAIN>` and `PAYMONGO_SECRET_KEY`, keep `COMPOSE_FILE=docker-compose.prod.yml:docker-compose.proxy.yml`.

**Step 6. Create `backend/.env.production`** (§7.3)

**VPS**
```bash
cd /opt/barangay
cp backend/.env.production.example backend/.env.production
chmod 600 backend/.env.production
openssl rand -hex 48
nano backend/.env.production
```

Set `JWT_SECRET` to the generated value and fill in Cloudinary, SMTP, IPROG, Gemini, OCR.space, PayMongo and the `SUPER_ADMIN_*` bootstrap values.

**Step 7. Validate the configuration** (§7.5)

**VPS**
```bash
cd /opt/barangay
docker compose config --quiet && echo "compose config OK"
```

**Step 8. Build the images** (§8.5)

**VPS**
```bash
cd /opt/barangay
docker compose build
```

**Step 9. Start the containers**

**VPS**
```bash
cd /opt/barangay
docker compose up -d
docker compose ps
```

Repeat `docker compose ps` until all four services are `(healthy)`.

**Step 10. Verify the containers and the database**

**VPS**
```bash
cd /opt/barangay
curl -s http://127.0.0.1:8081/bims/health; echo
docker compose logs --tail=30 barangay-server
sudo ss -tulpn | grep -E ':(27017|5001|3000|8081)\b'
```

Expect `"database":"connected"`, the log line `Connected to MongoDB`, and only `127.0.0.1:8081` in the `ss` output.

**Step 11. Configure Nginx (HTTP bootstrap)** (§10.3)

**VPS**
```bash
export DOMAIN=<DOMAIN>
cd /opt/barangay
sudo mkdir -p /var/www/certbot
sed "s/bims-rabon-elyu\.site/$DOMAIN/g" deploy/nginx/edge/bims-rabon-elyu.site.http.conf | sudo tee /etc/nginx/sites-available/$DOMAIN.conf > /dev/null
sudo ln -sf /etc/nginx/sites-available/$DOMAIN.conf /etc/nginx/sites-enabled/$DOMAIN.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**Step 12. Configure SSL** (§11)

**VPS**
```bash
export DOMAIN=<DOMAIN>
cd /opt/barangay
sudo certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --dry-run
sudo certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --email <ADMIN_EMAIL> --agree-tos --no-eff-email
sed "s/bims-rabon-elyu\.site/$DOMAIN/g" deploy/nginx/edge/bims-rabon-elyu.site.conf | sudo tee /etc/nginx/sites-available/$DOMAIN.conf > /dev/null
sudo nginx -t && sudo systemctl reload nginx
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo certbot renew --dry-run --cert-name $DOMAIN
```

**Step 13. Create the first accounts**

**VPS**
```bash
cd /opt/barangay
docker compose exec barangay-server node dist/scripts/createSuperAdmin.js
docker compose exec barangay-server node dist/scripts/createSecretary.js
```

The second command is optional (default secretary from `SECRETARY_*`).

**Step 14. Remove bootstrap passwords**

Delete the values of `SUPER_ADMIN_PASSWORD` and `SECRETARY_PASSWORD` in `backend/.env.production`, then:

**VPS**
```bash
cd /opt/barangay
nano backend/.env.production
docker compose up -d --force-recreate barangay-server
```

**Step 15. Seed the default document templates**

**VPS**
```bash
cd /opt/barangay
docker compose exec barangay-server node dist/scripts/seedDocumentTemplates.js
```

This is idempotent: it only creates missing templates and never overwrites edited ones. The same action is available as **Seed Defaults** under Secretary → Document Templates.

**Step 16. Test from outside** (§11.5, §12.2)

**ANY**
```bash
curl -sI http://<DOMAIN>/ | grep -iE '^HTTP|^location'
curl -sI https://<DOMAIN>/ | grep -iE '^HTTP|strict-transport'
curl -s https://<DOMAIN>/bims/health; echo
curl -s -X POST https://<DOMAIN>/api/create-checkout-session -H 'Content-Type: application/json' -d '{}'; echo
```

**LOCAL**
```bash
for p in 3000 5001 8081 27017; do nc -zv -w5 <VPS_IP> $p; done
```

**Step 17. Test in a browser** at `https://<DOMAIN>`

- [ ] Homepage loads over HTTPS with a valid padlock.
- [ ] Log in as the super admin; open a protected page; log out and back in.
- [ ] Register a resident account (ID photos upload to Cloudinary; verification email arrives).
- [ ] Create a document request as a resident.
- [ ] As secretary, open Document Templates, preview a template, generate a PDF for a request.
- [ ] Start a PayMongo checkout (test key first): it opens `checkout.paymongo.com` and returns to `https://<DOMAIN>/payment/success`; the request shows as paid.
- [ ] As super admin, create a backup in Settings → Backup.

**Step 18. Take the first database backup and schedule daily backups** (§16)

**VPS**
```bash
cd /opt/barangay
./deploy/mongo/backup.sh
```

---

## 16. Database Backups

### 16.1 Manual backup

The repository's script `deploy/mongo/backup.sh` runs `mongodump` inside `barangay-mongo` with the root credentials already in that container, writes a gzip archive **outside** the container, verifies it, and applies retention.

**VPS**
```bash
cd /opt/barangay
./deploy/mongo/backup.sh
ls -lh ~/barangay-backups/
```

- Output: `~/barangay-backups/bims-YYYYMMDD-HHMMSS.archive.gz` (directory mode 700, file mode 600).
- Custom location and retention: `BACKUP_DIR=/srv/bims-backups KEEP_DAYS=30 ./deploy/mongo/backup.sh`.
- **Retention warning:** the script deletes `bims-*.archive.gz` files older than `KEEP_DAYS` (default 14) in `BACKUP_DIR`. Do not point `BACKUP_DIR` at a directory where you keep long-term archives you want to keep.

Because backups are written to the host filesystem, they are not affected by recreating or removing containers or volumes.

### 16.2 Scheduled daily backups

**VPS**
```bash
mkdir -p ~/barangay-backups
crontab -e
```

Add this line (daily at 02:30):

```
30 2 * * * /opt/barangay/deploy/mongo/backup.sh >> $HOME/barangay-backups/backup.log 2>&1
```

Check that it ran the next day:

**VPS**
```bash
tail -n 5 ~/barangay-backups/backup.log
ls -lh ~/barangay-backups/ | tail -n 5
```

### 16.3 Off-server copies

A backup on the same disk does not survive losing the VPS. Pull backups to another machine regularly (weekly at minimum):

**LOCAL**
```bash
mkdir -p ~/bims-offsite-backups
rsync -avz <DEPLOY_USER>@<VPS_IP>:barangay-backups/ ~/bims-offsite-backups/
```

Or use `rclone` to an object-storage bucket. Backups contain personal data; store them encrypted and with restricted access.

Recommended strategy:

| Frequency | Kept where | Retention |
|---|---|---|
| Daily | VPS `~/barangay-backups` | 14 days (script default) |
| Weekly | Off-server | 8–12 weeks |
| Monthly | Off-server | 12 months |
| Before every risky change | VPS and off-server | Until the change is confirmed good |

### 16.4 Verify a backup (non-destructive)

Restores into a scratch database `restore_verify`, compares counts with the live database, then drops only the scratch database.

**VPS**
```bash
cd /opt/barangay
F=~/barangay-backups/bims-YYYYMMDD-HHMMSS.archive.gz
docker exec -i barangay-mongo sh -c 'mongorestore --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --nsFrom "$MONGO_APP_DATABASE.*" --nsTo "restore_verify.*"' < "$F"
docker exec barangay-mongo sh -c 'mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "const a=db.getSiblingDB(\"$MONGO_APP_DATABASE\"),b=db.getSiblingDB(\"restore_verify\"); print(\"collections \"+a.getCollectionNames().length+\"/\"+b.getCollectionNames().length+\", accounts \"+a.accounts.countDocuments()+\"/\"+b.accounts.countDocuments()); b.dropDatabase()"'
```

### 16.5 Restore a backup (DESTRUCTIVE)

> **Warning:** `--drop` replaces each collection in the live database with the contents of the backup. Everything written since that backup is lost. Always take a fresh backup immediately before restoring.

**VPS**
```bash
cd /opt/barangay
./deploy/mongo/backup.sh
F=~/barangay-backups/bims-YYYYMMDD-HHMMSS.archive.gz
gzip -t "$F" && echo "archive OK"
docker compose stop barangay-client barangay-server
docker exec -i barangay-mongo sh -c 'mongorestore -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --nsInclude "$MONGO_APP_DATABASE.*" --drop' < "$F"
docker compose start barangay-server barangay-client
docker compose ps
curl -s http://127.0.0.1:8081/bims/health; echo
```

Set `F` to the backup you want to restore, **not** the one just created. Stopping the API first prevents writes during the restore.

### 16.6 In-app backups

Super admins can also create and restore backups from **Settings → Backup**. These are stored in the `barangay_backups` Docker volume on the same disk. They are convenient, but they do not replace `backup.sh` plus off-server copies.

---

## 17. Updating Production

### 17.1 Standard update

**LOCAL**
```bash
git push origin <DEPLOY_BRANCH>
```

**VPS**
```bash
cd /opt/barangay
./deploy/mongo/backup.sh
docker tag barangay-server:latest barangay-server:previous
docker tag barangay-client:latest barangay-client:previous
git rev-parse --short HEAD | tee ~/bims-last-deployed-commit
git pull --ff-only origin <DEPLOY_BRANCH>
docker compose build
docker compose up -d
docker compose ps
curl -s http://127.0.0.1:8081/bims/health; echo
```

- The backup and the `:previous` image tags make rollback fast (§21).
- `~/bims-last-deployed-commit` records the commit you are moving away from.
- `docker compose up -d` recreates only containers whose image or configuration changed. `barangay-mongo` is normally untouched.
- `docker compose up -d --build` is the one-command equivalent of `build` + `up -d`.

### 17.2 What an update affects

| Item | Affected by `git pull` + `build` + `up -d`? |
|---|---|
| MongoDB data (`barangay_mongo_data`) | **No.** Volumes are reused. |
| In-app backups (`barangay_backups`) | No |
| Backups in `~/barangay-backups` | No (host directory) |
| Uploaded images (Cloudinary) | No (external) |
| `.env`, `backend/.env.production` | No (git-ignored, not touched by `git pull`) |
| Application containers | Recreated with the new images |
| Logged-in users | Stay logged in (tokens are valid as long as `JWT_SECRET` is unchanged) |
| Database schema/data | Only if the new code changes or migrates data (§21.3) |

### 17.3 Changing configuration without new code

| You changed | Run |
|---|---|
| `backend/.env.production` | `docker compose up -d --force-recreate barangay-server` |
| `PAYMONGO_SECRET_KEY` in `.env` | `docker compose up -d --force-recreate barangay-client` |
| `PUBLIC_URL` in `.env` | `docker compose up -d --build` (frontend rebuild required) |
| `deploy/nginx/barangay.conf` (via `git pull`) | `docker compose up -d --force-recreate barangay-nginx` |
| Edge Nginx config | `sudo nginx -t && sudo systemctl reload nginx` |
| `MONGO_*` passwords | See §20.4. Recreating containers does **not** change existing database users. |

`docker compose restart` restarts processes but does not apply changed environment files; use `up -d --force-recreate` for that.

### 17.4 Commands that destroy data

> **`docker compose down -v` deletes the named volumes, including `barangay_mongo_data`. That permanently erases the production database.**
>
> Never use it as an update or restart command. The same applies to `docker volume rm barangay_mongo_data`, `docker volume prune` and `docker system prune --volumes`.

Safe alternatives:

- `docker compose down` (without `-v`): stops and removes containers and the network; **volumes and data are kept**.
- `docker compose stop` / `docker compose start`: stop and start without removing anything.

### 17.5 Running data scripts after an update

If a release requires a one-off script (for example a migration in `backend/scripts/`), take a backup first, then run its compiled version:

**VPS**
```bash
cd /opt/barangay
./deploy/mongo/backup.sh
docker compose exec barangay-server node dist/scripts/<SCRIPT_NAME>.js
```

Read the script source before running it on production.

---

## 18. Low-Downtime Updates

### 18.1 What this architecture can and cannot do

Each service runs as a single container with a fixed `container_name`, so true zero-downtime (blue/green or rolling) deployment is **not** possible without changing the architecture. What you can do is keep the interruption short:

- Building images does not affect running containers. Users are only affected during the recreate step.
- Recreating `barangay-server` interrupts the API until its health check passes (typically 10–40 seconds). During that window, API calls fail with `502`.
- `barangay-client` is recreated after the server becomes healthy, causing a similar short gap for page loads.
- `barangay-mongo` and `barangay-nginx` are not recreated unless their configuration changed, so the database keeps running throughout.

### 18.2 Safest update order

**VPS**
```bash
cd /opt/barangay
./deploy/mongo/backup.sh
docker tag barangay-server:latest barangay-server:previous
docker tag barangay-client:latest barangay-client:previous
git pull --ff-only origin <DEPLOY_BRANCH>
docker compose build
docker compose up -d --no-deps barangay-server
docker compose ps barangay-server
curl -s http://127.0.0.1:8081/bims/health; echo
docker compose up -d --no-deps barangay-client
docker compose ps
```

1. Back up and tag the current images.
2. Pull and **build first**, while the old containers keep serving users.
3. Recreate the API alone (`--no-deps` keeps Mongo untouched) and wait for `(healthy)` and a good health response.
4. Recreate the frontend.
5. If anything looks wrong, roll back immediately (§21.1).

Schedule updates outside office hours, since staff and residents will see a brief interruption.

---

## 19. Logging and Monitoring

### 19.1 Container logs

**VPS**
```bash
cd /opt/barangay
docker compose logs -f barangay-client
docker compose logs -f barangay-server
docker compose logs -f barangay-mongo
docker compose logs -f barangay-nginx
docker compose logs -f --tail=200
docker compose logs --since 1h barangay-server
```

Useful backend messages: `Connected to MongoDB`, `Server is listening on port 5001`, `[CONFIG] Refusing to start in production: ...`, `[SERVER ERROR]`, `[AUTH] JWT_SECRET is not configured`.

### 19.2 Nginx logs

Edge Nginx (host):

**VPS**
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

The inner `barangay-nginx` logs to the container output (`docker compose logs -f barangay-nginx`).

### 19.3 Resource usage

**VPS**
```bash
cd /opt/barangay
docker compose ps
docker stats --no-stream
docker system df
df -h
free -h
du -sh ~/barangay-backups
```

Watch for containers near their memory limits in `docker stats`, the root filesystem above 80% in `df -h`, and growing build cache in `docker system df`.

### 19.4 Safe disk cleanup

**VPS**
```bash
docker image prune -f
docker builder prune -f
```

These remove only dangling images and build cache. Keep the `:previous` tags until you are confident in the current release. Never add `--volumes` and never run `docker volume prune` (§17.4).

### 19.5 External uptime monitoring

Point an uptime monitor (any HTTP checker) at:

```
https://<DOMAIN>/bims/health
```

It returns `200` with `"database":"connected"` when healthy and `503` when the database is unreachable.

---

## 20. Troubleshooting

Always start with:

**VPS**
```bash
cd /opt/barangay
docker compose ps
docker compose logs --tail=100 <SERVICE>
```

### 20.1 Website does not load

| Check | Command | Expected |
|---|---|---|
| DNS | `dig +short <DOMAIN> A` (ANY) | `<VPS_IP>` |
| Firewall | `sudo ufw status` | 80 and 443 allowed |
| Edge Nginx running | `systemctl status nginx` | `active (running)` |
| Edge Nginx config | `sudo nginx -t` | `syntax is ok`, `test is successful` |
| Ports 80/443 | `sudo ss -tlnp \| grep -E ':(80\|443)\b'` | `nginx` |
| Containers | `docker compose ps` | four services `(healthy)` |
| App behind edge | `curl -s http://127.0.0.1:8081/bims/health` | `"database":"connected"` |
| Edge errors | `sudo tail -n 50 /var/log/nginx/error.log` | no `connect() failed` to `127.0.0.1:8081` |

- **502 Bad Gateway**: the edge cannot reach `127.0.0.1:8081`. The containers are down, still starting, or `BIMS_HTTP_PORT` and the edge `server 127.0.0.1:...;` line disagree.
- **503 "HTTPS is being set up"**: the bootstrap config is still active; finish §11.2.
- **Certificate warning**: the certificate does not match `<DOMAIN>`, or `$DOMAIN` was not substituted in the edge config.

### 20.2 Frontend loads but API calls fail

- `curl -s https://<DOMAIN>/bims/health`. If this fails while the homepage works, check `barangay-server` (`docker compose logs barangay-server`) and `barangay-nginx`.
- In the browser developer tools (Network tab), API requests must go to `https://<DOMAIN>/bims/...`. If they go to `localhost` or another host, the frontend was built with the wrong values: confirm `docker-compose.prod.yml` still passes `NEXT_PUBLIC_BACKEND_URL_LIVE: /bims`, then `docker compose up -d --build`.
- CORS errors in the console mean the page was opened on an origin different from `PUBLIC_URL` (for example `http://` or `www`). Use the exact `https://<DOMAIN>`.
- `413 Request Entity Too Large`: the body exceeded 105 MB (Nginx) or 3 MB JSON (API).
- `504` on long operations: an operation exceeded the 180 s proxy timeout.

### 20.3 Login does not work

- **`500 Server authentication is not configured`**: `JWT_SECRET` is empty in `backend/.env.production`. Set it, then `docker compose up -d --force-recreate barangay-server`.
- **Server will not start, log says `JWT_SECRET must be at least 32 characters`**: use `openssl rand -hex 48`.
- **Everyone was logged out**: `JWT_SECRET` changed, or the domain changed (tokens are stored per origin).
- **401 on every request after login**: check that requests carry an `Authorization: Bearer ...` header in the Network tab. Clear the site's `localStorage` and log in again.
- **Site served over plain HTTP**: always use `https://<DOMAIN>`; HTTP only redirects.
- **Too many attempts**: login is rate limited per client IP. If every user appears to come from the same IP, the `X-Forwarded-For` chain is broken; check that the edge config still sets `proxy_set_header X-Forwarded-For $remote_addr;`.

### 20.4 MongoDB connection fails

- `docker compose ps barangay-mongo` must be `(healthy)`. If unhealthy: `docker compose logs barangay-mongo`.
- `barangay-server` logs `Failed to connect to MongoDB: Authentication failed`: the app user's password in the database does not match `MONGO_APP_PASSWORD` in `.env`. This happens when `.env` was changed after the volume was first initialised. Users are created **only** on the first start of an empty volume. Fix it by changing the password inside Mongo to match `.env` (do **not** delete the volume):

**VPS**
```bash
cd /opt/barangay
docker compose exec barangay-mongo sh -c 'mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "db.getSiblingDB(\"$MONGO_APP_DATABASE\").changeUserPassword(\"$MONGO_APP_USERNAME\", \"$MONGO_APP_PASSWORD\")"'
docker compose up -d --force-recreate barangay-mongo barangay-server
```

  This works only if the root password still matches the database. If the root password was changed in `.env` too, put the original root password back temporarily.

- Passwords containing `@`, `:`, `/`, `%` or `?` break the URI. Use hex passwords.
- The hostname must be `barangay-mongo` (the service name). The URI is built by `docker-compose.prod.yml`; do not set `MONGODB_URI` yourself.
- Network check: `docker compose exec barangay-server node -e "require('net').connect(27017,'barangay-mongo').on('connect',()=>{console.log('reachable');process.exit(0)}).on('error',e=>{console.log(e.message);process.exit(1)})"`.

### 20.5 Uploads fail

- `docker compose logs barangay-server` around the time of the upload.
- `File is too large (max 10MB)` or a `413`: file limits (§13.3).
- Cloudinary errors (`Must supply api_key`, `Invalid signature`): wrong or missing `CLOUDINARY_*` values; fix them and `docker compose up -d --force-recreate barangay-server`.
- Allowed ID photo types are JPEG, PNG and WebP only.

### 20.6 Payment fails

There is no webhook to check (§14.1). Instead:

- `docker compose logs barangay-client | grep -i paymongo` for checkout creation errors (`PayMongo error: ...`).
- `docker compose logs barangay-server` for verification errors (`PAYMONGO_SECRET_KEY is not configured`, `Failed to verify payment with PayMongo`).
- `PAYMONGO_SECRET_KEY` must be set in both `.env` and `backend/.env.production`, and both must be the same mode (test or live).
- Redirect goes to the wrong host after paying: `PUBLIC_URL` was wrong at build time; fix it and `docker compose up -d --build`.
- Check the payment in the PayMongo dashboard (Payments / Checkout sessions).

### 20.7 Container keeps restarting or stays unhealthy

**VPS**
```bash
cd /opt/barangay
docker compose ps
docker compose logs --tail=200 <SERVICE>
docker inspect --format '{{json .State.Health}}' <CONTAINER_NAME>
docker inspect --format 'OOMKilled={{.State.OOMKilled}} ExitCode={{.State.ExitCode}}' <CONTAINER_NAME>
free -h
df -h
```

- **`[CONFIG] Refusing to start in production`**: missing `MONGODB_URI` or short `JWT_SECRET`.
- **`OOMKilled=true`** or exit code 137: out of memory. Add swap (§4.4) or a bigger VPS.
- **Dependent services never start**: they wait for upstream health checks (§8.2). Fix the first unhealthy service in the chain: mongo → server → client → nginx.
- **Disk full**: `df -h`, then §19.4 cleanup and old logs/backups.
- **Build fails with "killed" during `next build`**: not enough memory during build; add swap.

---

## 21. Rollback Procedure

### 21.1 Fast rollback (previous images)

Uses the `:previous` tags created during the update (§17.1). No rebuild needed.

**VPS**
```bash
cd /opt/barangay
docker tag barangay-server:previous barangay-server:latest
docker tag barangay-client:previous barangay-client:latest
docker compose up -d --no-build --force-recreate barangay-server barangay-client
docker compose ps
curl -s http://127.0.0.1:8081/bims/health; echo
```

Then bring the source code back in line with what is running, so the next build does not redeploy the bad version:

**VPS**
```bash
cd /opt/barangay
cat ~/bims-last-deployed-commit
git checkout <PREVIOUS_COMMIT>
```

### 21.2 Rollback by rebuilding a known-good commit

**VPS**
```bash
cd /opt/barangay
git log --oneline -15
git checkout <GOOD_COMMIT>
docker compose build
docker compose up -d
docker compose ps
```

The VPS is now on a detached commit. Fix the problem locally, push a new commit (or a revert) to `<DEPLOY_BRANCH>`, and return the VPS to the branch:

**LOCAL**
```bash
git revert <BAD_COMMIT>
git push origin <DEPLOY_BRANCH>
```

**VPS**
```bash
cd /opt/barangay
git checkout <DEPLOY_BRANCH>
git pull --ff-only origin <DEPLOY_BRANCH>
docker compose up -d --build
```

### 21.3 Application rollback is not database rollback

Rolling back the code does **not** undo changes the new version made to MongoDB.

- If the new version only added optional fields or new documents (the usual case with Mongoose), the old version normally keeps working.
- If the new version renamed fields, changed value formats, removed data or ran a migration script, the old code may misread or break on the changed data.
- Before any release that changes data structure or runs a script from `backend/scripts/`, take a backup (`./deploy/mongo/backup.sh`) and copy it off-server.
- If a database rollback is truly required, restore that backup (§16.5). Understand that everything written after the backup is lost, so record what happened in between (for example new requests and payments) before restoring.

---

## 22. Security Checklist

- [ ] SSH key authentication only; password login disabled (§4.7)
- [ ] Root SSH login disabled; daily work done as `<DEPLOY_USER>`
- [ ] Only trusted administrators in the `docker` and `sudo` groups
- [ ] UFW enabled; only 22, 80 and 443 allowed (§4.6)
- [ ] `barangay-nginx` published on `127.0.0.1` only; no `ports:` on mongo, server or client (§9.2)
- [ ] MongoDB not reachable from the internet (`nc -zv <VPS_IP> 27017` fails)
- [ ] MongoDB authentication enabled; app connects as the least-privilege app user
- [ ] Strong, unique, hex MongoDB root and app passwords
- [ ] `JWT_SECRET` from `openssl rand -hex 48`, never reused from development
- [ ] `.env` and `backend/.env.production` are `chmod 600` and git-ignored (`git status` never shows them)
- [ ] No secrets in `NEXT_PUBLIC_*` variables
- [ ] Bootstrap passwords (`SUPER_ADMIN_PASSWORD`, `SECRETARY_PASSWORD`) removed after first use
- [ ] HTTPS enabled; HTTP redirects to HTTPS; HSTS header present
- [ ] Certificate auto-renewal tested (`certbot renew --dry-run`)
- [ ] `CORS_ORIGINS` is exactly `https://<DOMAIN>` (set via `PUBLIC_URL`), never `*`
- [ ] `NODE_ENV=production` (set by Compose); no debug flags
- [ ] Application containers run as the unprivileged `node` user (built into both Dockerfiles)
- [ ] PayMongo live key used only in production; payments verified server-side with PayMongo
- [ ] Daily backups running; off-server copies taken; a restore has been tested (§16.4)
- [ ] Regular OS updates (`sudo apt-get update && sudo apt-get upgrade`, unattended-upgrades)
- [ ] Regular image updates: rebuild periodically with `docker compose build --pull` to pick up security fixes in `node`, `nginx` and `mongo` base images (§24)
- [ ] fail2ban (or equivalent) protecting SSH

---

## 23. Production Checklist

### VPS

- [ ] Ubuntu configured (updates, timezone, swap)
- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Firewall configured
- [ ] SSH secured

### DNS

- [ ] Domain points to VPS
- [ ] DNS verified

### Application

- [ ] Repository cloned to `/opt/barangay` on `<DEPLOY_BRANCH>`
- [ ] Production `.env` configured
- [ ] `backend/.env.production` configured
- [ ] Secrets configured
- [ ] Docker images built
- [ ] Containers running and healthy
- [ ] Super admin created; bootstrap passwords removed
- [ ] Default document templates seeded

### Database

- [ ] MongoDB running
- [ ] Authentication enabled
- [ ] MongoDB not publicly exposed
- [ ] Persistent volume configured (`barangay_mongo_data`)
- [ ] Backup created
- [ ] Daily backup cron configured
- [ ] Off-server backup copy made

### Nginx

- [ ] Reverse proxy configured
- [ ] API routing works (`/bims/health`)
- [ ] Frontend routing works

### SSL

- [ ] HTTPS enabled
- [ ] HTTP redirects to HTTPS
- [ ] Certificate renewal tested

### Application Testing

- [ ] Homepage works
- [ ] Login works
- [ ] Registration works
- [ ] API works
- [ ] Database works
- [ ] File uploads work
- [ ] Document generation (PDF) works
- [ ] Payments work
- [ ] Payment verification after checkout works (there are no webhooks in this project)

---

## 24. Command Reference

All VPS commands assume `cd /opt/barangay` first.

| Task | Command |
|---|---|
| **Status** | `docker compose ps` |
| **Health** | `curl -s http://127.0.0.1:8081/bims/health` |
| **Start** | `docker compose up -d` |
| **Stop (keeps data)** | `docker compose stop` |
| **Stop and remove containers (keeps data)** | `docker compose down` |
| **Restart all** | `docker compose restart` |
| **Restart one** | `docker compose restart barangay-server` |
| **Apply env file changes** | `docker compose up -d --force-recreate barangay-server` |
| **Rebuild and deploy** | `docker compose up -d --build` |
| **Rebuild with fresh base images** | `docker compose build --pull && docker compose up -d` |
| **Pull newer mongo/nginx images** | `docker compose pull barangay-mongo barangay-nginx && docker compose up -d` |
| **All logs** | `docker compose logs -f --tail=200` |
| **Server logs** | `docker compose logs -f barangay-server` |
| **Client logs** | `docker compose logs -f barangay-client` |
| **Mongo logs** | `docker compose logs -f barangay-mongo` |
| **Inner Nginx logs** | `docker compose logs -f barangay-nginx` |
| **Edge Nginx logs** | `sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log` |
| **Resources** | `docker stats --no-stream` and `docker system df` |
| **Update** | `./deploy/mongo/backup.sh && git pull --ff-only origin <DEPLOY_BRANCH> && docker compose up -d --build` |
| **Backup** | `./deploy/mongo/backup.sh` |
| **Restore (destructive)** | see §16.5 |
| **Mongo shell** | `docker compose exec barangay-mongo sh -c 'mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$MONGO_APP_DATABASE"'` |
| **Create super admin** | `docker compose exec barangay-server node dist/scripts/createSuperAdmin.js` |
| **Seed document templates** | `docker compose exec barangay-server node dist/scripts/seedDocumentTemplates.js` |
| **Nginx test and reload** | `sudo nginx -t && sudo systemctl reload nginx` |
| **SSL renewal test** | `sudo certbot renew --dry-run` |
| **SSL renew now** | `sudo certbot renew` |
| **Certificate status** | `sudo certbot certificates` |
| **Exposure check** | `sudo ss -tulpn \| grep -E ':(27017\|5001\|3000\|8081)\b'` |
| **Safe cleanup** | `docker image prune -f && docker builder prune -f` |

Never run: `docker compose down -v`, `docker volume prune`, `docker system prune --volumes`, `docker volume rm barangay_mongo_data`.

---

## 25. Safety Rules

1. Never expose secrets: not in Git, not in chat, not in screenshots, not in `NEXT_PUBLIC_*` variables.
2. Never publish MongoDB (or ports 3000, 5001, 8081) to the internet. Use `docker compose exec` or an SSH tunnel.
3. Never use `docker compose down -v` (or any volume prune/remove) as a deployment, update or restart command. It destroys the database.
4. Commands that can affect persistent data are marked in this guide: restores with `--drop`, volume removal, and data scripts. Read the warning before running them.
5. Never commit `.env` or `backend/.env.production`.
6. Always run `./deploy/mongo/backup.sh` before updates, restores, migrations or manual database edits.
7. Use placeholders in documentation and tickets; keep real values only in the two env files on the VPS.
8. Check whether a command is marked **LOCAL**, **VPS** or **ANY** before running it.
9. Run `docker compose` only from `/opt/barangay`, so the production `COMPOSE_FILE` setting applies.
10. Reload Nginx only after `sudo nginx -t` succeeds.
