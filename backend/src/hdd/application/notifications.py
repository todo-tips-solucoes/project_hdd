"""NotificationService — resumos narrativos para o operador (Stories 4.4/4.5).

Constrói mensagens curtas e narrativas (não logs crus — `narrative > raw logs`) e as
envia pela porta `Notifier`. Notificações de gate **sempre** incluem o deep link do
painel: a aprovação acontece lá, no canal autenticado, nunca pelo WhatsApp.

A porta é injetada; este serviço não conhece o clihelper nem o transporte.
"""
from __future__ import annotations

from hdd.contracts.ports import Notifier


class NotificationService:
    def __init__(self, notifier: Notifier, panel_base_url: str) -> None:
        self._notifier = notifier
        self._base = panel_base_url.rstrip("/")

    def gate_link(self, gate_id: str) -> str:
        return f"{self._base}/gates/{gate_id}"

    async def gate_opened(self, gate_id: str, gate_type: str, reason: str) -> None:
        await self._notifier.notify(
            f"🚦 Gate pendente [{gate_type}]: {reason}\n"
            f"Aprove ou rejeite no painel → {self.gate_link(gate_id)}"
        )

    async def gate_resolved(
        self, gate_id: str, gate_type: str, approved: bool, actor: str
    ) -> None:
        verdict = "aprovado ✅" if approved else "rejeitado ⛔"
        await self._notifier.notify(
            f"Gate [{gate_type}] {verdict} por {actor}."
        )

    async def wave_milestone(self, wave_id: str, state: str) -> None:
        await self._notifier.notify(f"🌊 Onda {wave_id[:8]} → {state}.")
