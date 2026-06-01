"""Forja o cookie de sessão Starlette (dev) e grava em $WORK/cookie.txt.

Replica o SessionMiddleware: b64(json(session)) assinado por
itsdangerous.TimestampSigner com o session_secret de dev. require_user só exige
session["user"] presente — a allowlist é checada apenas no callback OAuth real.
"""
import base64
import json
import os
import pathlib

import itsdangerous

SECRET = os.environ.get("HDD_SESSION_SECRET", "dev-insecure-session-secret-change-me")
LOGIN = os.environ.get("HDD_DEV_LOGIN", "operador")
WORK = os.environ.get("WORK", "/tmp/hdd-run")

session = {"user": {"login": LOGIN, "name": LOGIN.capitalize(), "avatar_url": None}}
signer = itsdangerous.TimestampSigner(SECRET)
cookie = signer.sign(base64.b64encode(json.dumps(session).encode())).decode()

pathlib.Path(WORK).mkdir(parents=True, exist_ok=True)
pathlib.Path(WORK, "cookie.txt").write_text(cookie)
print(f"cookie escrito em {WORK}/cookie.txt (login={LOGIN}):", cookie[:40], "…")
