"""Entrypoint HTTP (FastAPI) — painel: OAuth, SSE, gates, webhook (Epic 4)."""

from .app import create_app

__all__ = ["create_app"]
