# Barangay Information System — Production Docker Deployment

This guide deploys BIMS on an Ubuntu VPS with Docker Compose, alongside another
application already running on the same server.

## 1. Architecture

Production URL: **https://bims-rabon-elyu.site** (no path prefix; users open the domain directly).

```
Internet ── :80 / :443 ──► Edge Nginx (already on the VPS, shared with the other app)
                             server_name bims-rabon-elyu.site
                             :80  → 301 to https://  (+ Let's Encrypt HTTP-01 challenge)
                             :443 → TLS (Let's Encrypt), HSTS, 105 MB body limit
                                    │
                                    ▼  127.0.0.1:8081 (loopback only)  — or barangay-nginx:80 on a shared Docker network
                             barangay-nginx :80  (app router, internal)
                              ├── /bims/*  ──► barangay-server :5001   (Express API, "/bims" prefix stripped)
                              └── /*       ──► barangay-client :3000   (Next.js, incl. /api/create-checkout-session)
                                                     │
                                           barangay-server ──► barangay-mongo :27017 (auth enabled)

Private Docker network: barangay-net
Named volumes:          barangay_mongo_data (database), barangay_backups (in-app backups)
```

`/bims` is not part of any page URL. It is only the path the browser uses for
same-origin API calls (`https://bims-rabon-elyu.site/bims/account/login`, ...),
which keeps the Express routes from colliding with Next.js pages and `/api/*`
routes. Because the frontend and API share one origin, browsers never need a
cross-origin request in production.

| Service           | Image                    | Internal port | Published to host |
|-------------------|--------------------------|---------------|-------------------|
| barangay-nginx    | nginx:1.27-alpine        | 80            | `127.0.0.1:8081` only (§6), or none |
| barangay-client   | barangay-client (built)  | 3000          | never             |
| barangay-server   | barangay-server (built)  | 5001          | never             |
| barangay-mongo    | mongo:7.0                | 27017         | never             |

`docker-compose.prod.yml` publishes **no host ports at all**. The edge
attachment is added by one of two small override files, chosen in §6:

| Override file                      | When 80/443 belong to          | What it does |
|------------------------------------|--------------------------------|--------------|
| `docker-compose.proxy.yml`         | Nginx installed on the host    | publishes barangay-nginx on `127.0.0.1:8081` (not reachable from the internet) |
| `docker-compose.proxy-network.yml` | an Nginx **container**         | joins barangay-nginx to that container's Docker network; no host port |

### Coexisting with your other MERN application

* Every BIMS container, network and volume is prefixed `barangay-` / `barangay_`
  and the Compose project is named `barangay`, so `docker compose` commands for
  BIMS never touch the other application's containers.
* BIMS uses ports 3000, 5001 and 27017 **inside** its own private network
  `barangay-net`. These are not host ports, so they cannot conflict with the
  other application, even if it uses the same numbers on the host or in its own
  containers.
* MongoDB is a separate container with its own volume and credentials. The two
  applications never share a database.
* Only one process on the VPS can own host ports 80/443. BIMS never binds them:
  it adds one `server_name bims-rabon-elyu.site` block to the Nginx that already
  owns them (§6). The other application's server blocks, certificate, ports and
  containers are not edited. Every name the BIMS block declares is prefixed
  `bims_` and none of its `listen` lines is `default_server`, so it cannot clash
  with the other site's configuration.

## 2. Requirements

* Ubuntu 22.04/24.04 with Docker Engine 24+ and the Compose plugin (`docker compose version`).
* The DNS `A` record for `bims-rabon-elyu.site` pointing to the VPS (§6.1).
* About 3 GB free disk for images. RAM limits in the compose file total about 3.4 GB maximum; idle usage is about 250 MB.

## 3. First deployment

Do §6.0 (inspect what owns ports 80/443) **before** step 2, because it decides
the `COMPOSE_FILE` line in `.env`.

```bash
# 1. Get the code
cd /opt
sudo git clone <your-repository-url> barangay
sudo chown -R $USER:$USER /opt/barangay
cd /opt/barangay

# 2. Compose variables. Root ".env" is read automatically by Compose.
#    PUBLIC_URL is already https://bims-rabon-elyu.site; keep COMPOSE_FILE as decided in §6.0.
cp .env.production.example .env
chmod 600 .env
openssl rand -hex 24   # run once per password, paste into MONGO_ROOT_PASSWORD and MONGO_APP_PASSWORD
nano .env              # replace every <placeholder>

# 3. Backend secrets (JWT, Cloudinary, SMTP, SMS, Gemini, PayMongo)
cp backend/.env.production.example backend/.env.production
chmod 600 backend/.env.production
openssl rand -hex 48   # paste into JWT_SECRET
nano backend/.env.production

# 4. Validate, build, start
docker compose config --quiet && echo "config OK"
docker compose build
docker compose up -d
docker compose ps        # all four should become "healthy"

# 5. Smoke test (nothing is public yet)
docker exec barangay-nginx wget -qO- http://127.0.0.1/bims/health    # {"status":"ok","database":"connected",...}
curl -s http://127.0.0.1:8081/bims/health                            # host-Nginx mode only

# 6. Create the first super admin (reads SUPER_ADMIN_* from backend/.env.production)
docker compose exec barangay-server node dist/scripts/createSuperAdmin.js
# Optional: the default secretary (reads SECRETARY_*)
docker compose exec barangay-server node dist/scripts/createSecretary.js
```

After step 6, remove `SUPER_ADMIN_PASSWORD` and `SECRETARY_PASSWORD` from
`backend/.env.production` and run `docker compose up -d`
so the passwords no longer sit in the container environment.

Then publish the site on https://bims-rabon-elyu.site by following §6.1–§6.6.

### Where the environment files live

| File (on the VPS)            | Read by                                  | Contains |
|------------------------------|------------------------------------------|----------|
| `/opt/barangay/.env`         | Docker Compose (variable substitution)   | `PUBLIC_URL`, `COMPOSE_FILE`, MongoDB root/app credentials, `PAYMONGO_SECRET_KEY` for the frontend |
| `/opt/barangay/backend/.env.production` | `barangay-server` container    | All backend secrets |

Both are git-ignored and must never be committed. See the two `*.example` files
for every variable.

Domain-related values, all derived from the single `PUBLIC_URL` in `.env`:

| Variable | Production value | Where it ends up |
|----------|------------------|------------------|
| `PUBLIC_URL` | `https://bims-rabon-elyu.site` | source of the two rows below |
| `NEXT_PUBLIC_BASE_URL_LIVE` | `https://bims-rabon-elyu.site` | frontend build arg: PayMongo success/cancel URLs |
| `CORS_ORIGINS` | `https://bims-rabon-elyu.site` | backend allow-list (exact match, never `*`) |
| `NEXT_PUBLIC_BACKEND_URL_LIVE` | `/bims` (fixed in compose) | browser API base path, same origin |
| `BACKEND_INTERNAL_URL` | `http://barangay-server:5001` (fixed) | server-side only (Next.js `/api/*`) |

`NEXT_PUBLIC_*` values are embedded in browser JavaScript, so they hold only
public URLs. `PAYMONGO_SECRET_KEY`, `JWT_SECRET` and the Mongo passwords are
never `NEXT_PUBLIC_*`.

`PUBLIC_URL` is **build-time** for the frontend. After changing it, rebuild
with `docker compose up -d --build`.

## 4. Day-to-day operations

```bash
cd /opt/barangay

docker compose ps                 # status + health
docker compose logs -f            # all logs
docker compose logs -f barangay-server

# Deploy new code
git pull
docker compose up -d --build

docker compose restart            # restart everything
docker compose down               # stop (data is kept)
docker compose up -d              # start again
```

> **WARNING — never run `docker compose down -v`.**
> The `-v` flag deletes the named volumes, including `barangay_mongo_data`,
> which **permanently erases the database**. Plain `down` keeps all data.
> Likewise, never run `docker volume prune` or `docker system prune --volumes` on this VPS.

Container logs are rotated automatically (json-file, 10 MB × 3 files per container).

## 5. Persistent data

| Data                          | Where                                   | Survives rebuild/recreate |
|-------------------------------|-----------------------------------------|---------------------------|
| Database                      | volume `barangay_mongo_data`            | yes |
| In-app backups (Settings → Backup) | volume `barangay_backups`          | yes |
| ID photos, profile pictures, logos | Cloudinary (uploaded, then deleted locally) | yes (external) |
| DOCX templates and images     | baked into the `barangay-server` image  | yes (part of the code) |

The `uploads/` directory inside the server is only a temporary staging area
before Cloudinary, so it needs no volume.

## 6. Domain, reverse proxy and HTTPS — https://bims-rabon-elyu.site

Files used in this section (all in `deploy/nginx/edge/`):

| File | Purpose |
|------|---------|
| `bims-rabon-elyu.site.http.conf` | bootstrap: HTTP only, serves the Let's Encrypt challenge, everything else answers 503 |
| `bims-rabon-elyu.site.conf` | final config for an Nginx **on the host**: HTTP→HTTPS redirect, TLS, proxy to `127.0.0.1:8081` |
| `bims-rabon-elyu.site.docker-proxy.conf` | final config for an Nginx **container**: same, proxies to `barangay-nginx:80` |

What the final server block does: `server_name bims-rabon-elyu.site`, 301 from
HTTP to HTTPS, TLS 1.2/1.3 with the Let's Encrypt certificate, HSTS, forwards
`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`,
WebSocket upgrade headers, 105 MB request bodies (100 MB backup + multipart
overhead; larger requests get 413), 10 s connect / 180 s read and send timeouts,
and streams uploads straight through (`proxy_request_buffering off`).

### 6.0 Inspect the VPS first (read-only)

```bash
sudo ss -tlnp | grep -E ':(80|443|8081)\b'
docker ps --format 'table {{.Names}}\t{{.Ports}}'
systemctl is-active nginx 2>/dev/null
ls /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null
```

Pick the row that matches what owns **80/443**:

| Owner shown by `ss` | Mode | `.env` lines |
|---------------------|------|--------------|
| `nginx` (host process, `systemctl is-active nginx` → `active`) | **A: host Nginx** | `COMPOSE_FILE=docker-compose.prod.yml:docker-compose.proxy.yml` |
| nothing | **A**, after `sudo apt install -y nginx` (the other app does not use 80/443, so it is unaffected) | same as above |
| `docker-proxy` (a container publishes 80/443) | **B: proxy container** (§6.4) | `COMPOSE_FILE=docker-compose.prod.yml:docker-compose.proxy-network.yml` and `PROXY_NETWORK=<its network>` |
| `apache2`, `caddy`, `traefik`, ... | not covered; do not continue, the same server block has to be translated for that proxy | — |

Also confirm `127.0.0.1:8081` is free in mode A. If not, set `BIMS_HTTP_PORT`
to another free port in `.env` and change `server 127.0.0.1:8081;` in
`bims-rabon-elyu.site.conf` to match.

Nothing in this section edits the other application's server blocks,
certificate, containers or ports. BIMS only **adds** one server-block file to
the existing Nginx.

### 6.1 DNS

At the registrar / DNS provider of `bims-rabon-elyu.site`:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<VPS_PUBLIC_IP>` | 300 (raise to 3600 once it works) |

Optional, only if you also want `www` (§6.7):

| Type | Name | Value |
|------|------|-------|
| CNAME | `www` | `bims-rabon-elyu.site.` |

* Remove any registrar "parking" `A`/`AAAA` records and URL-forwarding for the
  domain.
* Do **not** add an `AAAA` record unless the VPS really has a public IPv6 that
  reaches this Nginx. Let's Encrypt prefers IPv6, so a wrong `AAAA` record makes
  certificate issuance fail.
* If a `CAA` record exists, it must allow `letsencrypt.org`.

Find the VPS IP and check the record (on the VPS):

```bash
curl -4 -s https://ifconfig.me; echo            # the VPS public IPv4
getent ahostsv4 bims-rabon-elyu.site | head -1  # must print the same IP
```

Continue only when both print the same address.

### 6.2 Mode A — start BIMS behind the host Nginx (HTTP bootstrap)

```bash
cd /opt/barangay
docker compose up -d --build                  # COMPOSE_FILE adds the 127.0.0.1:8081 binding
docker compose ps                             # four services "healthy"
curl -s http://127.0.0.1:8081/bims/health     # {"status":"ok","database":"connected",...}

sudo mkdir -p /var/www/certbot
sudo cp deploy/nginx/edge/bims-rabon-elyu.site.http.conf /etc/nginx/sites-available/bims-rabon-elyu.site.conf
sudo ln -s /etc/nginx/sites-available/bims-rabon-elyu.site.conf /etc/nginx/sites-enabled/bims-rabon-elyu.site.conf
sudo nginx -t && sudo systemctl reload nginx

curl -si http://bims-rabon-elyu.site/ | head -1   # HTTP/1.1 503 ("HTTPS is being set up")
```

If the VPS Nginx has no `sites-enabled` directory (check
`grep include /etc/nginx/nginx.conf`), copy the file to
`/etc/nginx/conf.d/bims-rabon-elyu.site.conf` instead and skip the `ln`.

Only `nginx -t` passing is allowed to lead to a reload. If it fails, nothing
has changed for the other application; fix the BIMS file or remove it.

The application itself is never served over plain HTTP, so no `http://` origin
ever needs to be added to CORS (§6.8).

### 6.3 Mode A — obtain the Let's Encrypt certificate and enable HTTPS

```bash
command -v certbot || sudo apt install -y certbot   # reuse an existing certbot (apt or snap) if present

# Rehearse against the staging CA (no rate limits), then issue for real
sudo certbot certonly --webroot -w /var/www/certbot -d bims-rabon-elyu.site --dry-run
sudo certbot certonly --webroot -w /var/www/certbot -d bims-rabon-elyu.site \
  --email <your-email> --agree-tos --no-eff-email

sudo ls /etc/letsencrypt/live/bims-rabon-elyu.site/   # fullchain.pem privkey.pem ...

# Switch to the HTTPS config
sudo cp deploy/nginx/edge/bims-rabon-elyu.site.conf /etc/nginx/sites-available/bims-rabon-elyu.site.conf
sudo nginx -t && sudo systemctl reload nginx

# Reload Nginx after each renewal (graceful; harmless for the other site)
printf '#!/bin/sh\nsystemctl reload nginx\n' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# Test renewal
sudo certbot renew --dry-run --cert-name bims-rabon-elyu.site
systemctl list-timers | grep -i certbot                # the automatic renewal timer
```

`certonly --webroot` only creates the certificate files. It never edits Nginx
configuration, so the other application's server blocks and certificate are
left as they are. If `/etc/letsencrypt/renewal-hooks/deploy/` already contains
a hook that reloads Nginx, skip creating the second one.

Firewall: if `sudo ufw status` is active, ports 80 and 443 must be allowed
(they normally already are for the other app). Do **not** open 8081, 3000,
5001 or 27017.

### 6.4 Mode B — the proxy is a container

```bash
P=<proxy-container-name>          # from "docker ps": the container that publishes 80/443
docker inspect $P --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'      # its networks
docker inspect $P --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'        # its mounts
```

You need three host directories that the proxy container already mounts: its
Nginx config directory (e.g. `-> /etc/nginx/conf.d`), its Let's Encrypt
directory (`-> /etc/letsencrypt`) and an ACME webroot (`-> /var/www/certbot`
or similar). If the webroot or Let's Encrypt mounts do not exist, **stop**:
adding them means changing the other application's compose file, which should
be a deliberate decision.

```bash
cd /opt/barangay
# .env: COMPOSE_FILE=docker-compose.prod.yml:docker-compose.proxy-network.yml
#       PROXY_NETWORK=<network name from the first inspect>
docker compose up -d --build
docker exec $P wget -qO- http://barangay-nginx/bims/health   # or curl -s, depending on the image

CONF=<host dir mounted at /etc/nginx/conf.d>
sudo cp -a "$CONF" "$CONF.bak-$(date +%F)"
sudo cp deploy/nginx/edge/bims-rabon-elyu.site.http.conf "$CONF/bims-rabon-elyu.site.conf"
docker exec $P nginx -t && docker exec $P nginx -s reload

# Certificate: same certbot commands as §6.3, with the HOST paths of the mounts
#   -w <host webroot dir>   and, if the Let's Encrypt mount is not /etc/letsencrypt,
#   --config-dir <host letsencrypt dir>
sudo cp deploy/nginx/edge/bims-rabon-elyu.site.docker-proxy.conf "$CONF/bims-rabon-elyu.site.conf"
docker exec $P nginx -t && docker exec $P nginx -s reload
```

In `bims-rabon-elyu.site.docker-proxy.conf`, adjust `root /var/www/certbot` and
the `/etc/letsencrypt/...` paths if the container mounts them elsewhere. The
renewal hook is `docker exec <proxy-container-name> nginx -s reload`. If the
other application renews its certificates with a certbot container sharing the
same Let's Encrypt directory, that container will also renew this certificate.

This variant resolves `barangay-nginx` per request, so the shared proxy still
starts and reloads while BIMS is stopped (BIMS answers 502, the other site is
unaffected).

### 6.5 Running both applications

* The edge Nginx owns 80/443 and routes by `server_name`: the other domain to
  the other app, `bims-rabon-elyu.site` to `127.0.0.1:8081` (or `barangay-nginx:80`).
* Each domain has its own Let's Encrypt certificate; renewing one does not touch the other.
* Rollback for BIMS only, leaving the edge exactly as it was before:
  `sudo rm /etc/nginx/sites-enabled/bims-rabon-elyu.site.conf && sudo nginx -t && sudo systemctl reload nginx`.

### 6.6 Verify production

From any machine:

```bash
curl -sI http://bims-rabon-elyu.site/pages/login | grep -iE '^HTTP|^location'   # 301 → https://bims-rabon-elyu.site/pages/login
curl -sI https://bims-rabon-elyu.site/ | grep -iE '^HTTP|strict-transport'      # 200 + HSTS
curl -s  https://bims-rabon-elyu.site/bims/health                               # "database":"connected"
echo | openssl s_client -connect bims-rabon-elyu.site:443 -servername bims-rabon-elyu.site 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates                                 # CN=bims-rabon-elyu.site, issuer Let's Encrypt

# Next.js /api route reachable (400 = the route ran and rejected the empty body)
curl -s -X POST https://bims-rabon-elyu.site/api/create-checkout-session -H 'Content-Type: application/json' -d '{}'

# CORS: the first prints the origin back, the second prints nothing
curl -s -o /dev/null -D - -X OPTIONS https://bims-rabon-elyu.site/bims/account/login \
  -H 'Origin: https://bims-rabon-elyu.site' -H 'Access-Control-Request-Method: POST' | grep -i '^access-control-allow-origin'
curl -s -o /dev/null -D - -X OPTIONS https://bims-rabon-elyu.site/bims/account/login \
  -H 'Origin: https://evil.example' -H 'Access-Control-Request-Method: POST' | grep -i '^access-control-allow-origin'

# Not exposed (run from a machine that is NOT the VPS; every line must fail/time out)
for p in 3000 5001 8081 27017; do nc -zv -w5 <VPS_PUBLIC_IP> $p; done
```

On the VPS:

```bash
docker ps --format '{{.Names}}: {{.Ports}}' | grep barangay-
# barangay-nginx: 127.0.0.1:8081->80/tcp   (mode B: 80/tcp)
# barangay-client: 3000/tcp   barangay-server: 5001/tcp   barangay-mongo: 27017/tcp   (internal only, no "->")
curl -sI https://<other-app-domain>/ | head -1    # the other application still answers
```

In a browser at https://bims-rabon-elyu.site: log in, open a protected page,
create a document request, upload a file (e.g. Document Templates → convert a
DOCX), as super admin create, download and restore a backup (Settings →
Backup), and start a PayMongo checkout: it must open `checkout.paymongo.com`
and return to `https://bims-rabon-elyu.site/payment/success`.

### 6.7 Optional: www.bims-rabon-elyu.site

Not required. To support it: add the `www` CNAME (§6.1), issue the certificate
with both names (`-d bims-rabon-elyu.site -d www.bims-rabon-elyu.site`; certbot
asks to expand the existing certificate), and uncomment the two `www` server
blocks at the end of `bims-rabon-elyu.site.conf`. `www` only redirects to
`https://bims-rabon-elyu.site`, so CORS needs no change.

### 6.8 CORS

`CORS_ORIGINS` is set from `PUBLIC_URL`, so production allows exactly
`https://bims-rabon-elyu.site` (exact match, credentials allowed, no `*`).
Other origins get no `Access-Control-Allow-*` headers and the browser blocks
them.

Because the browser calls the API on the same origin (`/bims/...`), CORS is not
even exercised by the BIMS pages themselves. During setup the app is never
served over `http://`, so **no temporary HTTP origin is needed**. If you ever do
serve it over HTTP temporarily, set
`CORS_ORIGINS: http://bims-rabon-elyu.site,https://bims-rabon-elyu.site` in
`docker-compose.prod.yml`, then put back `${PUBLIC_URL...}` and run
`docker compose up -d` once HTTPS works.

### 6.9 Real client IP

The edge sends `X-Forwarded-For: <client IP>`. `barangay-nginx` trusts it only
from loopback/private addresses (the edge), and Express trusts exactly one
proxy hop, so `req.ip` (used by login rate-limiting) is the real client IP.

## 7. Backups and recovery

### Create a backup

```bash
cd /opt/barangay
./deploy/mongo/backup.sh                      # writes ~/barangay-backups/bims-YYYYMMDD-HHMMSS.archive.gz
BACKUP_DIR=/srv/backups KEEP_DAYS=30 ./deploy/mongo/backup.sh   # custom location/retention
```

The script runs `mongodump` inside `barangay-mongo` using the credentials that
are already in the container, so no password appears on the command line. It
checks the archive's integrity and deletes backups older than `KEEP_DAYS`
(default 14).

Daily backups at 02:30 (`crontab -e`):

```
30 2 * * * /opt/barangay/deploy/mongo/backup.sh >> $HOME/barangay-backups/backup.log 2>&1
```

Copy backups off the VPS regularly (for example with `scp` or `rclone`). A
backup stored only on the same disk does not protect against losing the server.

### Verify a backup (non-destructive)

Restore into a scratch database, compare, then drop the scratch database:

```bash
F=~/barangay-backups/bims-YYYYMMDD-HHMMSS.archive.gz
docker exec -i barangay-mongo sh -c 'mongorestore --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --nsFrom "$MONGO_APP_DATABASE.*" --nsTo "restore_verify.*"' < "$F"
docker exec barangay-mongo sh -c 'mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "const a=db.getSiblingDB(\"$MONGO_APP_DATABASE\"),b=db.getSiblingDB(\"restore_verify\"); print(\"collections \"+a.getCollectionNames().length+\"/\"+b.getCollectionNames().length+\", accounts \"+a.accounts.countDocuments()+\"/\"+b.accounts.countDocuments()); b.dropDatabase()"'
```

### Restore a backup

Take a fresh backup first. Then:

```bash
docker compose stop barangay-client barangay-server
docker exec -i barangay-mongo sh -c 'mongorestore -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --nsInclude "$MONGO_APP_DATABASE.*" --drop' < "$F"
docker compose start barangay-server barangay-client
```

`--drop` replaces each restored collection with the backup's contents. Omit it
to merge instead of replace.

### Migrating the existing data from MongoDB Atlas (one-time, non-destructive)

Atlas is only read from. Nothing on Atlas is changed.

```bash
cd /opt/barangay
read -rs ATLAS_URI    # paste the Atlas connection string (mongodb+srv://...), press Enter; not saved in shell history
docker exec -e ATLAS_URI="$ATLAS_URI" barangay-mongo sh -c 'mongodump --uri "$ATLAS_URI" --db bims --archive --gzip' > ~/atlas-bims.archive.gz
unset ATLAS_URI
gzip -t ~/atlas-bims.archive.gz && echo "archive OK"

# Import into the Docker database (it should be empty or freshly backed up first)
docker compose stop barangay-client barangay-server
docker exec -i barangay-mongo sh -c 'mongorestore -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --nsInclude "bims.*" --nsFrom "bims.*" --nsTo "$MONGO_APP_DATABASE.*"' < ~/atlas-bims.archive.gz
docker compose start barangay-server barangay-client
```

The Atlas database is named `bims`, which is also the default `MONGO_APP_DATABASE`.

## 8. Troubleshooting

* **A container stays `unhealthy`**: `docker compose logs <service>`.
  The server refuses to start in production if `JWT_SECRET` is shorter than 32
  characters or `MONGODB_URI` is missing; the log says which one.
* **Changed MongoDB passwords in `.env` but authentication now fails**: the Mongo
  users are created only on the first start of an empty `barangay_mongo_data`
  volume. Change the password inside Mongo (`db.changeUserPassword`) to match;
  do not delete the volume.
* **Use letters and digits only for the Mongo passwords.** They are embedded in a
  connection URI, and `openssl rand -hex 24` output is safe.
* **Containers cannot reach each other (timeouts to `barangay-mongo`)**: on some
  hosts with leftover `iptables-legacy` rules, Docker bridge traffic is dropped.
  Check with `sudo iptables-legacy -S FORWARD`. A `-P FORWARD DROP` policy that
  only allows `docker0` is the symptom; restarting Docker
  (`sudo systemctl restart docker`) after removing the stale legacy rules fixes it.
  This was observed in the GitHub Codespace used for testing, not on a standard
  Ubuntu VPS.
* **`certbot` fails with "NXDOMAIN", "no valid A records" or "Timeout during connect"**:
  the `A` record is missing or still propagating (§6.1), an old `AAAA` record
  points elsewhere, or port 80 is blocked by a firewall. `curl -si
  http://bims-rabon-elyu.site/.well-known/acme-challenge/x` from outside must
  return a 404 from this Nginx, not a timeout.
* **https://bims-rabon-elyu.site answers 502**: the edge cannot reach BIMS.
  Check `docker compose ps` and `curl -s http://127.0.0.1:8081/bims/health`
  (mode A), or that `barangay-nginx` is on `PROXY_NETWORK` (mode B).
* **DOCX → PDF**: the server image converts with LibreOffice
  (`DOCX_PDF_CONVERTER=libreoffice`). If a conversion fails, the frontend falls
  back to its built-in PDF renderer.
