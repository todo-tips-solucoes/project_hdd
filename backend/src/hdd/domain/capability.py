"""Capability broker — classificação DETERMINÍSTICA de ações destrutivas (R-1).

A fronteira de gate NÃO depende do juízo do LLM: regras explícitas decidem se uma
ação proposta exige aprovação humana (gates RF-03b 1–4), ANTES do efeito.

Isto é o coração do enforcement de segurança descoberto como não-negociável na
PoC (Story 1.1): o `claude -p` é um agente completo e pode propor efeitos
destrutivos sem malícia — aqui eles são barrados por construção.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum


class GateType(StrEnum):
    """Gates de alto impacto (RF-03b 1–4) impostos por regra."""

    MERGE_DEPLOY = "merge_deploy"          # RF-03b.1
    DESTRUCTIVE_DATA = "destructive_data"  # RF-03b.2
    SPEND_CREDENTIALS = "spend_credentials"  # RF-03b.3
    INFRA = "infra"                        # RF-03b.4


@dataclass(frozen=True)
class ProposedAction:
    """Uma ação que o agente quer executar (ex.: comando shell)."""

    command: str
    workspace: str = "/workspace"


@dataclass(frozen=True)
class BrokerDecision:
    allowed: bool
    gate: GateType | None
    reason: str


class GateRequired(Exception):
    """Levantada quando uma ação exige aprovação humana (suspende a onda)."""

    def __init__(self, gate: GateType, reason: str) -> None:
        self.gate = gate
        self.reason = reason
        super().__init__(f"gate {gate}: {reason}")


_DROP = re.compile(r"\b(drop\s+(table|database|schema)|truncate)\b", re.I)
_DELETE = re.compile(r"\bdelete\s+from\b", re.I)
_PUSH = re.compile(r"git\s+push", re.I)
_PROTECTED = re.compile(r"\b(main|master|production|prod)\b", re.I)
_CRED = re.compile(
    r"(gh\s+secret|secret\s+(set|rotate)|rotate.*(secret|key|token)|stripe|"
    r"\bpayment\b|\bcharge\b|aws\s+secretsmanager)",
    re.I,
)
_INFRA = re.compile(r"\b(iptables|ufw|cloudflare|route53|firewall|dns\b|nftables)\b", re.I)


def _rm_outside_workspace(command: str, workspace: str) -> bool:
    if not re.search(r"\brm\b", command, re.I):
        return False
    for tok in command.split()[1:]:
        if tok.startswith("-"):
            continue
        if ".." in tok or tok in ("/", "~", "$HOME"):
            return True
        if tok.startswith("/") and not tok.startswith(workspace):
            return True
    return False


def classify(action: ProposedAction) -> BrokerDecision:
    """Classifica uma ação. allowed=True → autonomia; senão exige o gate indicado."""
    cmd = action.command
    low = cmd.lower()

    if _rm_outside_workspace(cmd, action.workspace):
        return BrokerDecision(False, GateType.DESTRUCTIVE_DATA, "rm fora do workspace")
    if _DROP.search(low):
        return BrokerDecision(False, GateType.DESTRUCTIVE_DATA, "DROP/TRUNCATE de dados")
    if _DELETE.search(low) and "where" not in low:
        return BrokerDecision(False, GateType.DESTRUCTIVE_DATA, "DELETE sem WHERE (em massa)")
    if _PUSH.search(low) and ("--force" in low or re.search(r"\s-f\b", low)):
        return BrokerDecision(False, GateType.MERGE_DEPLOY, "git push --force")
    if _PUSH.search(low) and _PROTECTED.search(low):
        return BrokerDecision(False, GateType.MERGE_DEPLOY, "push em branch protegida")
    if _CRED.search(low):
        return BrokerDecision(False, GateType.SPEND_CREDENTIALS, "gasto/credenciais")
    if _INFRA.search(low):
        return BrokerDecision(False, GateType.INFRA, "infra sensível")

    return BrokerDecision(True, None, "ação benigna")
