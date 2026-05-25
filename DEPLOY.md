# Deploying Stromteilung

We run on **two free-tier providers** that share the same git source of truth:

| Layer | Provider | What it gives us |
|---|---|---|
| Frontend (Vite SPA) | **Vercel** (Hobby) | global CDN, instant first paint, automatic preview deploys |
| Backend (FastAPI) | **Render** (Free) | long-running container, release-phase migrations, generous logs |
| Database | **Aiven Postgres** (existing) | PostGIS, daily backups, EU region |

Both providers deploy from GitHub on every push to `main`. No CLI tools needed
locally — once connected, ship by pushing.

---

## One-time setup (~10 minutes)

### 1. Push the repo to GitHub

The initial commit already exists locally. We need to create the remote
repo and push.

**Option A — `gh` CLI (recommended, single command):**

```bash
brew install gh
gh auth login                    # GitHub OAuth flow
gh repo create stromteilung --private --source=. --push
```

**Option B — manual:**

1. Open https://github.com/new → name `stromteilung`, **Private**, no README/license.
2. Back in this terminal:
   ```bash
   git remote add origin https://github.com/<your-user>/stromteilung.git
   git branch -M main
   git push -u origin main
   ```

Verify:

```bash
git remote -v
# origin  https://github.com/<your-user>/stromteilung.git (fetch)
# origin  https://github.com/<your-user>/stromteilung.git (push)
```

### 2. Deploy the backend on Render

1. Sign up at https://render.com (free, no card required).
2. **New → Blueprint** → connect GitHub → pick the `stromteilung` repo.
3. Render parses `backend/render.yaml` and proposes one service:
   `stromteilung-api`. Click **Apply**.
4. While it builds the first time (~3 min), set the two secret env vars
   it left blank (Render UI → service → *Environment*):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | `postgresql+asyncpg://avnadmin:<aiven-pwd>@pg-1bff1652-khizrumahmed-6b58.f.aivencloud.com:14569/defaultdb` |
   | `APP_CORS_ORIGINS` | *(leave blank for now; we'll fill it once the Vercel URL exists)* |

5. Wait for the deploy to finish. Render runs `alembic upgrade head` as the
   pre-deploy step, so the schema is in place automatically.

6. Capture the live URL (top of the service page), e.g.
   `https://stromteilung-api.onrender.com`. Save it — we need it for the
   frontend env var.

7. Smoke test:
   ```bash
   curl https://stromteilung-api.onrender.com/health
   # → {"status":"ok"}
   curl https://stromteilung-api.onrender.com/ready
   # → {"status":"ready"}
   ```

### 3. Deploy the frontend on Vercel

1. Sign up at https://vercel.com (free, no card; "Continue with GitHub").
2. **Add New… → Project** → import the `stromteilung` repo.
3. Vercel auto-detects Vite from `vercel.json` + `package.json`. Don't touch
   the build settings.
4. Under **Environment Variables**, add:

   | Name | Value | Environment |
   |---|---|---|
   | `VITE_API_URL` | `https://stromteilung-api.onrender.com/api/v1` | Production, Preview, Development |

   (Substitute the live Render URL captured in step 2.6.)

5. Click **Deploy**. First build takes ~90 s.

6. Capture the production URL (e.g. `https://stromteilung.vercel.app`).

### 4. Close the CORS loop

Back on Render → `stromteilung-api` → *Environment*:

| Key | Value |
|---|---|
| `APP_CORS_ORIGINS` | `https://stromteilung.vercel.app` (the Vercel URL from step 3.6) |

Save → Render restarts the service automatically (~30 s).

### 5. Seed demo data (one-off, optional)

In the Render dashboard for `stromteilung-api` → **Shell** tab:

```bash
python -m app.db.seed
```

### 6. Full smoke test

```bash
# Auth round-trip
curl -X POST https://stromteilung-api.onrender.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"anon-buyer-00@stromteilung.de","password":"demo-pass-12345"}'
# → { "user": ..., "tokens": ... }

# Open the frontend
open https://stromteilung.vercel.app
```

Log in with the seeded credentials above; the buyer dashboard should
populate from the live Render backend within ~500 ms (after the cold start).

---

## Ongoing deploys

```bash
git push origin main
```

That's it. Both Vercel and Render watch the `main` branch and deploy on every
push. **Backend deploys automatically run `alembic upgrade head`** before
flipping traffic, so migrations don't need a separate command.

Preview deploys: every PR opened on GitHub gets a Vercel preview URL — useful
for sharing in-progress UI changes without touching production.

---

## Operational basics

### Logs

- **Vercel** → project → *Deployments → <latest> → Logs* (or `vercel logs` if you install the CLI later).
- **Render** → service → *Logs* tab (live stream).

### Rolling back

- **Vercel** → *Deployments* → previous deploy → **Promote to Production**.
- **Render** → service → **Manual Deploy → Deploy specific commit**, pick the prior SHA.

### Scaling up beyond free tiers

| Symptom | Fix | Cost |
|---|---|---|
| Backend cold-start hurts UX (~30 s wake from idle) | Render → **Settings → Instance Type → Starter** | $7/mo (no sleep) |
| Frontend traffic surges | Vercel Hobby covers 100 GB/mo bandwidth; **Pro** if you outgrow | $20/mo |
| DB hot | Aiven plan upgrade | varies |

---

## Files in this repo that drive the deploys

```
backend/render.yaml      ← Render Blueprint: service config, env vars, preDeployCommand
backend/Dockerfile       ← used by Render (`runtime: docker`)
backend/.dockerignore
vercel.json              ← Vercel project config: framework, SPA rewrites, cache + security headers
```

The Heroku-specific files (`heroku.yml`, `nginx.conf.template`,
`nginx-entrypoint.sh`) are kept in the repo — harmless, and they let us
swap deploy targets later without rebuilding from scratch.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Frontend loads but every API call returns CORS error | `APP_CORS_ORIGINS` doesn't match the exact Vercel URL (with `https://`, no trailing `/`) | Update on Render, save, wait ~30 s for restart |
| Backend deploy hangs at `alembic upgrade head` | DATABASE_URL is wrong or Aiven is rejecting | Render shell → `alembic current`; check Aiven console |
| First backend request after idle takes 30 s | Free-tier cold start | Bump to Starter ($7/mo) or accept the wait |
| `relation "users" does not exist` | Migration didn't run / wrong DB | Render shell → `alembic upgrade head` manually |
| Vercel build fails on `npm ci` | Stale `package-lock.json` | `npm install && git commit` |
| Frontend shows `Failed to fetch` | `VITE_API_URL` baked at build time was wrong | Vercel → env vars → fix → **Redeploy** (build args only refresh on rebuild) |

---

## Reminders

- 🔑 **Rotate the Aiven DB password** in the Aiven console — the previous one was visible in chat history. After rotating, paste the new connection string into Render's `DATABASE_URL`.
- 🔑 **`APP_SECRET_KEY` is auto-generated by Render** (`generateValue: true` in `render.yaml`). Treat it like any other production secret.
