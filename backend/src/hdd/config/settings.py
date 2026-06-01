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

    # --- Epic 6: verificação automática no sandbox (Story 6.3) -------------
    # Suíte de testes do projeto rodada no sandbox endurecido; passa só se exit 0.
    verify_command: str = "pytest -q"
    sandbox_image: str = "hdd-sandbox:latest"
    # Rede do sandbox de verificação: "none" (deny-all) por padrão — testes não
    # devem precisar de egress; relaxar só via proxy allowlist se necessário.
    sandbox_network: str = "none"

    # --- Epic 6: provisionamento de workspace da onda (Story 6.6) ----------
    # Repo-alvo clonado num dir efêmero por onda. Vazio → sem workspace (o
    # verify defere ao gate e o execute roda sem write, comportamento pré-6.6).
    repo_url: str = ""
    # Base para os workspaces efêmeros; vazio → diretório temporário do sistema.
    workspace_root: str = ""

    # --- Epic 4: Painel Web (RF-07) ---------------------------------------
    # OAuth GitHub: aprovação de gates acontece NO painel autenticado.
    github_client_id: str = ""
    github_client_secret: str = ""
    # Allowlist de logins GitHub autorizados (CSV). Vazio = nega tudo (fail-closed).
    github_allowlist: str = ""
    # Segredo de assinatura do cookie de sessão (httpOnly). Trocar em produção.
    session_secret: str = "dev-insecure-session-secret-change-me"
    # URL base do painel — usada nos deep links de gate (RF-08, Story 4.5).
    panel_base_url: str = "http://localhost:3000"
    # Origens permitidas no CORS (CSV) — o painel Next.js em dev.
    cors_origins: str = "http://localhost:3000"

    # --- Epic 4: Canal WhatsApp (RF-08) -----------------------------------
    # clihelper (camada outbound proprietária sobre a Meta Cloud API).
    clihelper_base_url: str = ""
    clihelper_token: str = ""
    # Leaky-bucket do notifier: intervalo mínimo entre envios (≤1 req/s).
    notifier_min_interval_s: float = 1.0
    # Webhook inbound (n8n) — segredo HMAC (X-Hub-Signature-256).
    webhook_hmac_secret: str = ""

    def allowlist(self) -> frozenset[str]:
        """Logins GitHub autorizados, normalizados (lowercase, sem vazios)."""
        return frozenset(
            x.strip().lower() for x in self.github_allowlist.split(",") if x.strip()
        )

    def cors_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]


@functools.lru_cache
def get_settings() -> Settings:
    # Em produção (Docker Swarm) os secrets vêm de /run/secrets; em dev, do env.
    if os.path.isdir(_SECRETS_DIR):
        return Settings(_secrets_dir=_SECRETS_DIR)  # type: ignore[call-arg]
    return Settings()
