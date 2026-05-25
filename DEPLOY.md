# Deploying Stromteilung to Heroku

Two separate Heroku apps — one per container:

| App slug (yours may differ) | What runs | Public URL |
|---|---|---|
| `stromteilung-api` | FastAPI / uvicorn | `https://stromteilung-api-xxxx.herokuapp.com` |
| `stromteilung-web` | Nginx serving the Vite bundle | `https://stromteilung-web-xxxx.herokuapp.com` |

The database stays on **Aiven Postgres** (already set up); we do not provision
Heroku Postgres.

---

## Prerequisites

```bash
# Heroku CLI (one-time)
brew tap heroku/brew && brew install heroku

# Login (opens a browser tab)
heroku login
heroku container:login   # auth Docker to Heroku's registry
```

Verify Docker can build locally first — saves cycles vs. discovering an error
inside Heroku's builder:

```bash
# From repo root
docker build -t stromteilung-web --build-arg VITE_API_URL=http://localhost:8000/api/v1 .

# From backend dir
cd backend && docker build -t stromteilung-api .
```

---

## One-time app setup

> Heroku slugs must be globally unique. Pick something like
> `stromteilung-api-<your-handle>` if `stromteilung-api` is taken.

```bash
# Backend
heroku create stromteilung-api --stack container

# Frontend
heroku create stromteilung-web --stack container

# Capture the assigned URLs — we'll plug them into each other's config.
API_URL=$(heroku info -a stromteilung-api  --json | python3 -c "import sys,json;print(json.load(sys.stdin)['app']['web_url'].rstrip('/'))")
WEB_URL=$(heroku info -a stromteilung-web --json | python3 -c "import sys,json;print(json.load(sys.stdin)['app']['web_url'].rstrip('/'))")

echo "API: $API_URL"
echo "WEB: $WEB_URL"
```

### Backend config

```bash
heroku config:set -a stromteilung-api \
  APP_ENV=production \
  APP_DEBUG=false \
  APP_SECRET_KEY="$(openssl rand -hex 32)" \
  APP_CORS_ORIGINS="$WEB_URL" \
  DATABASE_URL='postgresql+asyncpg://avnadmin:<aiven-password>@<aiven-host>:14569/defaultdb' \
  DATABASE_SSL=require \
  LOG_LEVEL=INFO \
  LOG_JSON=true
```

> **Rotate the Aiven password** in the Aiven console first; paste the new one
> into `DATABASE_URL` above. The previous one was visible in chat.

### Frontend has no runtime config

Vite inlines `VITE_API_URL` at build time, so the frontend container is
configuration-free. The URL lives in the build arg below.

---

## Deploy the backend

```bash
cd backend

# Build + push the image to Heroku's container registry, then release it.
heroku container:push web -a stromteilung-api
heroku container:release web -a stromteilung-api

# Run the initial migration (and every subsequent one). For repeat deploys,
# automate by switching to a heroku.yml-based deploy (see `heroku.yml`),
# which runs `alembic upgrade head` in the release phase automatically.
heroku run alembic upgrade head -a stromteilung-api

# Seed the demo data (one-off; skip for prod):
heroku run python -m app.db.seed -a stromteilung-api

# Tail logs while you smoke-test:
heroku logs --tail -a stromteilung-api &

# Verify
curl -i "$API_URL/health"
curl -i "$API_URL/ready"
curl -i "$API_URL/docs"          # Swagger UI
```

## Deploy the frontend

```bash
cd ..   # back to repo root

# Build with the live API URL baked in.
docker build \
  --platform=linux/amd64 \
  --build-arg VITE_API_URL="$API_URL/api/v1" \
  -t registry.heroku.com/stromteilung-web/web \
  .

docker push registry.heroku.com/stromteilung-web/web
heroku container:release web -a stromteilung-web

# Verify
curl -i "$WEB_URL"
open "$WEB_URL"
```

> The `--platform=linux/amd64` flag matters on Apple Silicon — Heroku dynos
> are x86_64. Without it the push succeeds but the container won't boot.

---

## Subsequent deploys

```bash
# Backend
(cd backend && heroku container:push web -a stromteilung-api \
            && heroku container:release web -a stromteilung-api \
            && heroku run alembic upgrade head -a stromteilung-api)

# Frontend
docker build --platform=linux/amd64 \
  --build-arg VITE_API_URL="https://stromteilung-api.herokuapp.com/api/v1" \
  -t registry.heroku.com/stromteilung-web/web . \
  && docker push registry.heroku.com/stromteilung-web/web \
  && heroku container:release web -a stromteilung-web
```

A two-line shell function makes this nicer:

```bash
deploy:api()  { (cd backend && heroku container:push web -a stromteilung-api && heroku container:release web -a stromteilung-api && heroku run alembic upgrade head -a stromteilung-api); }
deploy:web()  { docker build --platform=linux/amd64 --build-arg VITE_API_URL="https://stromteilung-api.herokuapp.com/api/v1" -t registry.heroku.com/stromteilung-web/web . && docker push registry.heroku.com/stromteilung-web/web && heroku container:release web -a stromteilung-web; }
```

---

## Operational basics

```bash
# Stream live logs
heroku logs --tail -a stromteilung-api
heroku logs --tail -a stromteilung-web

# One-off shell on a fresh dyno
heroku run bash -a stromteilung-api

# Restart all dynos (rolls one at a time)
heroku ps:restart -a stromteilung-api

# Scale up / down. Eco is $5/mo per dyno; Basic is $7. Both sleep when idle on Eco.
heroku ps:scale web=1:Basic -a stromteilung-api
heroku ps:scale web=1:Basic -a stromteilung-web

# Roll back to the previous release if a deploy goes sideways
heroku releases -a stromteilung-api
heroku rollback v<n> -a stromteilung-api
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `H10 App crashed` immediately after release | Container exited fast — usually wrong `$PORT` binding | Confirm uvicorn/nginx is reading `$PORT`; check `heroku logs --tail` |
| `exec format error` in logs | Pushed an arm64 image to an amd64 dyno (Apple Silicon trap) | Re-build with `--platform=linux/amd64` |
| Login works locally, fails on Heroku | `APP_CORS_ORIGINS` doesn't include the live frontend URL | `heroku config:set APP_CORS_ORIGINS="$WEB_URL" -a stromteilung-api` |
| `ProgrammingError: relation "users" does not exist` | Forgot to run migrations | `heroku run alembic upgrade head -a stromteilung-api` |
| `pg_hba.conf` / SSL errors against Aiven | `DATABASE_SSL` env var missing | `heroku config:set DATABASE_SSL=require -a stromteilung-api` |
| Frontend boot loop with `nginx: [emerg] ... is duplicate` | Old `/etc/nginx/conf.d/default.conf` left in the image | We delete it in the Dockerfile; confirm you're not running a stale local image |
| 404s on direct hits to e.g. `/buyer-dash` | SPA fallback missing | Already in `nginx.conf.template` via `try_files $uri /index.html` |

---

## What the files do

```
backend/
├── Dockerfile          ← multi-stage; uv install → slim runtime + tini
├── .dockerignore       ← keeps build context lean
└── heroku.yml          ← declarative deploy contract (if you switch to git push)

frontend (repo root)/
├── Dockerfile          ← multi-stage Node build → Nginx serve
├── .dockerignore
├── nginx.conf.template ← gzip, SPA fallback, immutable asset cache, security headers
├── nginx-entrypoint.sh ← envsubst only $PORT so $uri etc. survive
└── heroku.yml          ← reference (we use container:push for build-arg flexibility)
```
