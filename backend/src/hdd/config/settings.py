"""Settings centrais. Secrets vêm de /run/secrets (Docker Swarm) ou env (R-15)."""
from __future__ import annotations

import functools
import os
from typing import Literal

from pydantic import field_validator
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
    # API key da Anthropic — usada pelo driver `api`; vem de /run/secrets em prod.
    anthropic_api_key: str = ""
    model: str | None = None
    log_level: str = "INFO"
    # Timeout (s) de cada invocação `claude -p`. O claude é um agente completo
    # (lê o repo, planeja, edita) — 120s é curto para ondas reais (achado da
    # Story 7.4). Configurável via HDD_CLAUDE_TIMEOUT_S.
    claude_timeout_s: int = 600

    # --- Epic 6: verificação automática no sandbox (Story 6.3) -------------
    # Suíte de testes do projeto rodada no sandbox endurecido; passa só se exit 0.
    verify_command: str = "pytest -q"
    sandbox_image: str = "hdd-sandbox:latest"
    # Rede do sandbox de verificação: "none" (deny-all) por padrão — testes não
    # devem precisar de egress; relaxar só via proxy allowlist se necessário.
    sandbox_network: str = "none"
    # Dir com fixtures privadas montado read-only em /oracle apenas no verify.
    # None → sem mount (retrocompatível). Env: HDD_ORACLE_DIR.
    oracle_dir: str | None = None
    # Comando de geração de artefatos derivados rodado no sandbox ANTES do verify.
    # Vazio → passo desligado. Env: HDD_CODEGEN_COMMAND.
    codegen_command: str = ""
    # Glob de testes de aceitação — gate que exige pelo menos um arquivo de teste
    # novo/modificado no workspace antes de prosseguir ao verify. Vazio → gate
    # desligado. Env: HDD_REQUIRE_TESTS_GLOB.
    require_tests_glob: str = ""

    # --- Epic 6: provisionamento de workspace da onda (Story 6.6) ----------
    # Repo-alvo clonado num dir efêmero por onda. Vazio → sem workspace (o
    # verify defere ao gate e o execute roda sem write, comportamento pré-6.6).
    repo_url: str = ""
    # Base para os workspaces efêmeros; vazio → diretório temporário do sistema.
    workspace_root: str = ""
    # Slug owner/name do repo-alvo — usado no merge via `gh --repo` (Story 6.8),
    # onde o resume na API não tem git no cwd. Vazio → sem merge real (dev).
    repo_slug: str = ""

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

    @field_validator("repo_slug")
    @classmethod
    def _validate_repo_slug(cls, v: str) -> str:
        if v:
            from hdd.domain.vcs import parse_repo_slug  # noqa: PLC0415

            parse_repo_slug(v)
        return v

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
