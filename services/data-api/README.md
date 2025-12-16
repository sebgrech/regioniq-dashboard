# RegionIQ Data API (FastAPI)

FastAPI service implementing an Observation-first, PxWeb-inspired data contract.

## Run (local)

Set env:
- `SUPABASE_URL`
- `SUPABASE_JWKS_URL` (optional; defaults to `${SUPABASE_URL}/auth/v1/certs`)
- `SUPABASE_ANON_KEY` (only needed if using Supabase HTTP APIs; prefer direct Postgres later)

Then:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Endpoints (v1)
- `GET /api/v1/schema`
- `POST /api/v1/observations/query`


