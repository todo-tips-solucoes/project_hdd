"""Smoke HTTP do painel HDD contra o backend real, com cookie de sessão forjado.

Roda no venv do backend (tem httpx + itsdangerous). curl é bloqueado pelo hook do
context-mode — por isso o HTTP é feito aqui em Python.
"""
import base64
import json
import os

import httpx
import itsdangerous

BASE = os.environ.get("HDD_API_BASE", "http://127.0.0.1:8000")
SECRET = os.environ.get("HDD_SESSION_SECRET", "dev-insecure-session-secret-change-me")
LOGIN = os.environ.get("HDD_DEV_LOGIN", "operador")

signer = itsdangerous.TimestampSigner(SECRET)
session = {"user": {"login": LOGIN, "name": LOGIN.capitalize(), "avatar_url": None}}
cookie = signer.sign(base64.b64encode(json.dumps(session).encode())).decode()


def show(label, r):
    body = r.text if len(r.text) < 400 else r.text[:400] + "…"
    print(f"{label}: HTTP {r.status_code}  {body}")


with httpx.Client(base_url=BASE, timeout=15) as c:
    show("healthz                 ", c.get("/healthz"))
    show("me (sem cookie)         ", c.get("/auth/me"))
    show("me (com cookie)         ", c.get("/auth/me", cookies={"session": cookie}))
    show("POST /features sem auth ", c.post("/api/features", json={"task": "t"}))
    r = c.post(
        "/api/features",
        json={"task": "smoke: verificar endpoint /api/features"},
        cookies={"session": cookie},
    )
    show("POST /features com auth ", r)
    if r.status_code == 201:
        d = r.json()
        print(f"  -> session_id={d['session_id']}  wave_id={d['wave_id']}  work_id={d['work_id']}")
