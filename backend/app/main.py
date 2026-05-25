"""
FastAPI application factory.

Boots the app in this order so every later layer can rely on the previous one:

1. Configure logging (so even import-time issues are JSON-formatted).
2. Build the FastAPI instance with metadata that powers `/docs` + `/redoc`.
3. Register middleware (request-id last so it wraps everything).
4. Register exception handlers (single shape for every business error).
5. Mount routers under `/api/v1`.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.controllers import auth as auth_controller
from app.controllers import health as health_controller
from app.controllers import inquiries as inquiries_controller
from app.controllers import listings as listings_controller
from app.controllers import ratings as ratings_controller
from app.controllers import sellers as sellers_controller
from app.controllers import transformers as transformers_controller
from app.controllers import users as users_controller
from app.core.config import settings
from app.core.exceptions import AppError, app_error_handler
from app.core.logging import configure_logging, get_logger
from app.middleware.request_id import RequestIdMiddleware

API_V1 = "/api/v1"


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Startup / shutdown hooks. Engine disposal lives here in M3+."""
    configure_logging()
    log = get_logger(__name__)
    log.info("app.startup", env=settings.app_env, debug=settings.app_debug)
    try:
        yield
    finally:
        log.info("app.shutdown")


def create_app() -> FastAPI:
    """Application factory — used by Uvicorn and by tests."""
    app = FastAPI(
        title="Stromteilung API",
        description=(
            "Backend for the **Stromteilung** local green-energy marketplace.\n\n"
            "Auth uses short-lived JWTs (access) + opaque, rotating refresh tokens.\n"
            "Partner/widget access uses API keys (M5).\n"
        ),
        version="0.1.0",
        lifespan=lifespan,
        # Swagger / ReDoc paths — kept off the API prefix so they're easy to remember.
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # --- CORS — the only middleware Uvicorn needs to see *first* ----------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    # --- Request correlation + access log ---------------------------------
    app.add_middleware(RequestIdMiddleware)

    # --- Error handling ---------------------------------------------------
    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]

    # --- Routers ----------------------------------------------------------
    app.include_router(health_controller.router)                  # root-level probes
    app.include_router(auth_controller.router,         prefix=API_V1)
    app.include_router(users_controller.router,        prefix=API_V1)
    app.include_router(transformers_controller.router, prefix=API_V1)
    app.include_router(listings_controller.router,     prefix=API_V1)
    app.include_router(sellers_controller.router,      prefix=API_V1)
    app.include_router(inquiries_controller.router,    prefix=API_V1)
    app.include_router(ratings_controller.router,      prefix=API_V1)

    return app


# Uvicorn entrypoint: `uvicorn app.main:app --reload`
app = create_app()
