import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS, ENABLE_SCHEDULER
from app.services.artifact_loader import load_artifacts_once
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.limiter import limiter
from app.routers import (
    health,
    location,
    forecast,
    advisory,
    voice,
    risk_map,
    outlook,
    auth
)
from app.services.scheduler import start_scheduler, shutdown_scheduler

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("varsha_setu.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Loads and validates all ML model pickles, threshold cutoffs,
    taluks CSVs, and risk map ONCE at startup.
    Fails fast with explicit error if any artifact is missing.
    """
    logger.info("Initializing Varsha Setu (SIH 26086) ML Serving Layer...")
    try:
        bundle = load_artifacts_once()
        logger.info(
            "Startup verification complete. Serving %d taluks and %d model targets.",
            len(bundle.taluks_df),
            len(bundle.models)
        )
        if ENABLE_SCHEDULER:
            start_scheduler()
            logger.info("APScheduler initialized (ENABLE_SCHEDULER=True).")
        else:
            logger.info("APScheduler disabled (ENABLE_SCHEDULER=False). Dedicated worker or cron should trigger pipeline.")
    except Exception as e:
        logger.critical("Fatal error loading artifacts at startup: %s", e, exc_info=True)
        raise e

    yield
    if ENABLE_SCHEDULER:
        shutdown_scheduler()
    logger.info("Shutting down Varsha Setu Serving Layer.")

app = FastAPI(
    title="Varsha Setu — Hyperlocal Monsoon AI API (SIH 26086)",
    description=(
        "Production REST serving layer for Karnataka Hyperlocal Monsoon Onset & Break Prediction. "
        "Wraps pre-trained 0.60 XGB + 0.40 RF dual-model ensembles across 13 forward targets, "
        "planetary teleconnections (ENSO/IOD/MJO), Open-Meteo precipitation, and bilingual soil advisories."
    ),
    version="1.0.0",
    lifespan=lifespan
)

# Attach rate limiter to app state and register 429 handler
def rate_limit_handler(request, exc: RateLimitExceeded):
    response = _rate_limit_exceeded_handler(request, exc)
    if "retry-after" not in [h.lower() for h in response.headers.keys()]:
        response.headers["Retry-After"] = "60"
    return response

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

# Enable CORS for frontend clients (Vite, Lovable, React, Streamlit)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Router Modules
app.include_router(health.router)
app.include_router(location.router)
app.include_router(forecast.router)
app.include_router(advisory.router)
app.include_router(voice.router)
app.include_router(risk_map.router)
app.include_router(outlook.router)
app.include_router(auth.router)

@app.get("/", tags=["Root"])
def root():
    return {
        "project": "Varsha Setu — SIH 26086",
        "description": "Karnataka Hyperlocal Monsoon Onset & Break Prediction Serving Layer",
        "docs_url": "/docs",
        "health_url": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    from app.config import HOST, PORT
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)
