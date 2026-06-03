"""create_app — monta a aplicação FastAPI do painel (Epic 4).

Composição de entrypoint: middleware de sessão (httpOnly) + CORS, registro do
cliente OAuth e montagem dos routers. Sem estado global mutável além de
`app.state.oauth` (cliente OAuth registrado a partir de Settings).
"""
from __future__ import annotations

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from hdd.config import get_settings

from . import auth
from .routers import events, features, gates, harness, health, waves, webhooks


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="HDD Painel API", version="0.1.0")

    # Sessão assinada httpOnly (Story 4.1) — base do canal autenticado.
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        https_only=False,
        same_site="lax",
    )
    # CORS para o painel Next.js (credenciais → origens explícitas, nunca "*").
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_list(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.oauth = auth.make_oauth(settings)

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(features.router, prefix="/api")
    app.include_router(waves.router, prefix="/api")
    app.include_router(harness.router, prefix="/api")
    app.include_router(events.router, prefix="/api")
    app.include_router(gates.router, prefix="/api")
    app.include_router(webhooks.router, prefix="/webhooks")

    return app


app = create_app()
