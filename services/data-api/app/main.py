import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from time import perf_counter

from app.routes import schema as schema_routes
from app.routes import observations as observations_routes

# Environment and build metadata
ENV = os.environ.get("ENV", "development")
GIT_SHA = os.environ.get("GIT_SHA", "dev")
# ⚠️ FORECAST_VINTAGE is release-controlled: only update via env var on weekly publish
# Format: "2026-W03" (ISO week). Do NOT compute from dates or update on daily runs.
FORECAST_VINTAGE = os.environ.get("FORECAST_VINTAGE", "unreleased")

app = FastAPI(
    title="RegionIQ Data API",
    version="1.0.0",
    docs_url=None if ENV == "production" else "/docs",
    redoc_url=None if ENV == "production" else "/redoc",
    openapi_url=None if ENV == "production" else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",      # local dev
        "https://app.regioniq.io",    # Next.js app (primary UI)
        "https://regioniq.io",        # landing page
        "https://www.regioniq.io",    # www variant
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}


@app.get("/version")
def version():
    """Build/version info for debugging and reproducibility."""
    return {
        "service": "RegionIQ Data API",
        "api_version": "v1",
        "forecast_vintage": FORECAST_VINTAGE,
        "build": GIT_SHA,
        "env": ENV,
    }

app.include_router(schema_routes.router, prefix="/api/v1", tags=["schema"])
app.include_router(observations_routes.router, prefix="/api/v1", tags=["observations"])

@app.middleware("http")
async def request_logging_middleware(request, call_next):
    start = perf_counter()
    response = await call_next(request)
    ms = int((perf_counter() - start) * 1000)
    # Minimal v1 observability: method/path/status/latency. Extend with user_id + cost at route-level.
    print(
        f"{request.method} {request.url.path} {response.status_code} {ms}ms"
    )
    return response


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request, exc: StarletteHTTPException):
    # If we raised with a domain-shaped error payload, return it at the root (not under "detail").
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "HTTP_ERROR", "message": str(exc.detail), "details": {}}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "VALIDATION_ERROR", "message": "Invalid request payload.", "details": {"issues": exc.errors()}}},
    )


