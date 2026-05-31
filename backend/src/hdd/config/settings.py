"""Settings centrais. Secrets vêm de /run/secrets (Docker Swarm) ou env (R-15)."""
from __future__ import annotations

import functools
import os
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

_SECRETS_DIR = "/run/secrets"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="HDD_",
        env_file=".env",
        extra="ignore",
    )

    pg_dsn: str = "postgresql://hdd:hdd_dev@localhost:5433/hdd"
    # RF-12: driver de provider trocável por config (subscription ↔ api).
    llm_driver: Literal["subscription", "api"] = "subscription"
    model: str | None = None
    log_level: str = "INFO"


@functools.lru_cache
def get_settings() -> Settings:
    # Em produção (Docker Swarm) os secrets vêm de /run/secrets; em dev, do env.
    if os.path.isdir(_SECRETS_DIR):
        return Settings(_secrets_dir=_SECRETS_DIR)  # type: ignore[call-arg]
    return Settings()
