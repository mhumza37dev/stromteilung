"""
Application configuration.

Settings are loaded once at startup from environment variables / `.env`, then
imported as a singleton (`settings`). Failing fast on missing required values is
intentional — we'd rather crash on boot than serve broken requests.
"""
from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Top-level config — every env var the app reads is declared here."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ----------------------------------------------------------------
    app_env: Literal["development", "staging", "production"] = "development"
    app_debug: bool = False
    app_name: str = "stromteilung-backend"
    app_secret_key: SecretStr = Field(..., min_length=16)
    app_cors_origins: str = "http://localhost:5173"

    # --- Database -----------------------------------------------------------
    database_url: str
    database_ssl: Literal["disable", "prefer", "require", "verify-ca", "verify-full"] = "require"
    database_pool_size: int = 10
    database_max_overflow: int = 5
    database_echo: bool = False

    # --- Auth ---------------------------------------------------------------
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_seconds: int = 60 * 15
    jwt_refresh_ttl_seconds: int = 60 * 60 * 24 * 30

    # --- Logging ------------------------------------------------------------
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_json: bool = True

    # ------------------------------------------------------------------------

    @field_validator("database_url")
    @classmethod
    def _ensure_asyncpg_driver(cls, v: str) -> str:
        """asyncpg is required for our async SQLAlchemy engine."""
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://") and "+asyncpg" not in v:
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        """Split the comma-separated env var into a clean list."""
        return [o.strip() for o in self.app_cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor — single instance per process."""
    return Settings()  # type: ignore[call-arg]


# Convenience singleton for direct imports.
settings = get_settings()
