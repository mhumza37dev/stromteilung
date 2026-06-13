# Stromteilung

Local green-energy marketplace — buyers and sellers trade electricity within a
500 m radius of their grid transformer. React + TypeScript + Vite frontend,
FastAPI + PostgreSQL/PostGIS backend.

## Stack

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, MapLibre GL |
| Backend  | FastAPI, SQLAlchemy (async), Alembic, asyncpg               |
| Database | PostgreSQL with the PostGIS extension                       |
| Maps     | MapLibre GL + OpenStreetMap tiles & Nominatim (no API key)  |

## Prerequisites

- **Node.js** ≥ 20 and npm
- **Python** ≥ 3.12
- **PostgreSQL** ≥ 14 with the **PostGIS** extension
- **[uv](https://docs.astral.sh/uv/)** for Python dependency management
  (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

---

## Backend setup

All backend commands run from the `backend/` directory.

```bash
cd backend
```

### 1. Install dependencies

```bash
uv sync                 # creates .venv and installs runtime + dev deps
```

### 2. Configure environment

```bash
cp .env.example .env
```

Then edit `.env` and set at minimum:

- `DATABASE_URL` — e.g. `postgresql+asyncpg://postgres:postgres@localhost:5432/stromteilung`
- `APP_SECRET_KEY` — generate one with `openssl rand -hex 32`
- `DATABASE_SSL=disable` — for local Postgres

### 3. Create the database (with PostGIS)

```bash
createdb stromteilung
psql -d stromteilung -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### 4. Run migrations

```bash
uv run alembic upgrade head
```

### 5. (Optional) Seed demo data

```bash
uv run python -m app.db.seed
```

Seeded accounts use the email pattern `<name>@stromteilung.de` with the shared
password `demo-pass-12345`.

### 6. Run the backend

```bash
uv run uvicorn app.main:app --reload --port 8000
```

The API is served under `http://localhost:8000/api/v1`.
Interactive docs: `http://localhost:8000/docs`.

---

## Frontend setup

All frontend commands run from the repository root.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

The root `.env` already points the frontend at the local backend:

```
VITE_API_URL=http://localhost:8000/api/v1
```

Adjust this if your backend runs elsewhere.

### 3. Run the dev server

```bash
npm run dev
```

The app is served at `http://localhost:5173` with hot module reload.

---

## Running the full stack

Open two terminals:

```bash
# Terminal 1 — backend
cd backend
uv run uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
npm run dev
```

Then visit **http://localhost:5173**.

---

## Useful commands

### Frontend (repo root)

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the Vite dev server (HMR)              |
| `npm run typecheck` | Type-check without emitting (`tsc -b`)       |
| `npm run lint`      | Run ESLint                                   |
| `npm run build`     | Production build to `dist/`                  |
| `npm run build:check` | Type-check then build                      |
| `npm run preview`   | Preview the production build locally         |

### Backend (`backend/`)

| Command                                       | Description                       |
| --------------------------------------------- | --------------------------------- |
| `uv run uvicorn app.main:app --reload`        | Start the API with auto-reload    |
| `uv run alembic upgrade head`                 | Apply all migrations              |
| `uv run alembic revision --autogenerate -m …` | Generate a new migration          |
| `uv run alembic downgrade -1`                 | Roll back the last migration      |
| `uv run python -m app.db.seed`                | Seed demo data                    |
| `uv run pytest`                               | Run the test suite                |
| `uv run ruff check .`                         | Lint the Python code              |
| `uv run mypy app`                             | Type-check the Python code        |
