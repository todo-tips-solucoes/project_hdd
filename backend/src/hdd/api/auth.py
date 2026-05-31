"""Autenticação do painel — GitHub OAuth + sessão httpOnly (Story 4.1, RF-07).

Fail-closed: só logins na allowlist entram; allowlist vazia nega tudo. A sessão é
um cookie assinado httpOnly (SessionMiddleware). A aprovação de gates depende desta
sessão — é o canal confiável onde o segredo de aprovação não precisa trafegar.
"""
from __future__ import annotations

from typing import Any

from authlib.integrations.starlette_client import OAuth, OAuthError
from fastapi import APIRouter, Depends, HTTPException, Request, status
from starlette.responses import RedirectResponse, Response

from hdd.config import Settings, get_settings

from .deps import require_user
from .schemas import User

router = APIRouter(tags=["auth"])


def make_oauth(settings: Settings) -> OAuth:
    """Registra o cliente OAuth do GitHub (guardado em app.state.oauth)."""
    oauth = OAuth()
    oauth.register(
        name="github",
        client_id=settings.github_client_id,
        client_secret=settings.github_client_secret,
        access_token_url="https://github.com/login/oauth/access_token",
        authorize_url="https://github.com/login/oauth/authorize",
        api_base_url="https://api.github.com/",
        client_kwargs={"scope": "read:user"},
    )
    return oauth


@router.get("/auth/login")
async def login(request: Request) -> Response:
    settings = get_settings()
    if not settings.github_client_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "OAuth não configurado")
    redirect_uri = request.url_for("auth_callback")
    result: Response = await request.app.state.oauth.github.authorize_redirect(
        request, redirect_uri
    )
    return result


@router.get("/auth/callback", name="auth_callback")
async def callback(request: Request) -> Response:
    oauth = request.app.state.oauth
    try:
        token = await oauth.github.authorize_access_token(request)
    except OAuthError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "falha no OAuth") from None
    resp = await oauth.github.get("user", token=token)
    profile: dict[str, Any] = resp.json()
    login_name = str(profile.get("login") or "")
    if login_name.lower() not in get_settings().allowlist():
        request.session.pop("user", None)
        raise HTTPException(status.HTTP_403_FORBIDDEN, "login não autorizado")
    request.session["user"] = {
        "login": login_name,
        "name": profile.get("name"),
        "avatar_url": profile.get("avatar_url"),
    }
    return RedirectResponse(get_settings().panel_base_url)


@router.post("/auth/logout")
async def logout(request: Request) -> dict[str, str]:
    request.session.clear()
    return {"status": "ok"}


@router.get("/auth/me", response_model=User)
async def me(user: User = Depends(require_user)) -> User:
    return user
