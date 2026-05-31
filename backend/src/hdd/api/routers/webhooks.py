"""Webhook inbound do n8n (Story 4.5, NFR-SEG).

n8n é a fronteira de confiança upstream (apenas inbound). Drop-at-ingress:
1) HMAC-SHA256 do corpo bruto (fail-closed);
2) idempotency key (header ou message_id) deduplicada;
3) schema mínimo (campos extras descartados);
4) conteúdo tratado como NÃO-CONFIÁVEL — o endpoint apenas reconhece, nunca executa.
A aprovação de gates não acontece aqui: notificações levam deep link para o painel.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import ValidationError

from hdd.adapters.db.webhook_inbox import WebhookInbox
from hdd.config import get_settings

from ..deps import get_webhook_inbox
from ..schemas import InboundMessage, WebhookAck
from ..security import verify_signature

router = APIRouter(tags=["webhooks"])


@router.post("/n8n", response_model=WebhookAck)
async def n8n(
    request: Request,
    inbox: WebhookInbox = Depends(get_webhook_inbox),
) -> WebhookAck:
    raw = await request.body()
    sig = request.headers.get("x-hub-signature-256", "")
    if not verify_signature(raw, sig, get_settings().webhook_hmac_secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "assinatura inválida")

    try:
        msg = InboundMessage.model_validate_json(raw)
    except ValidationError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "payload inválido") from None

    idk = request.headers.get("idempotency-key") or msg.message_id
    if not idk:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "idempotency key ausente")

    if await inbox.seen(idk, "n8n"):
        return WebhookAck(status="duplicate")

    # Conteúdo é não-confiável: apenas reconhecemos o recebimento.
    return WebhookAck(status="accepted")
