"""Story 2.4 — capability broker (classificação determinística)."""
from __future__ import annotations

import pytest

from hdd.application.broker import CapabilityBroker
from hdd.domain.capability import GateRequired, GateType, ProposedAction, classify


def _c(cmd: str, workspace: str = "/workspace"):
    return classify(ProposedAction(command=cmd, workspace=workspace))


@pytest.mark.parametrize(
    "cmd,gate",
    [
        ("rm -rf /etc/passwd", GateType.DESTRUCTIVE_DATA),
        ("rm -rf ../other", GateType.DESTRUCTIVE_DATA),
        ("psql -c 'DROP TABLE users'", GateType.DESTRUCTIVE_DATA),
        ("psql -c 'DELETE FROM users'", GateType.DESTRUCTIVE_DATA),
        ("git push --force origin feature", GateType.MERGE_DEPLOY),
        ("git push origin main", GateType.MERGE_DEPLOY),
        ("gh secret set TOKEN", GateType.SPEND_CREDENTIALS),
        ("iptables -F", GateType.INFRA),
    ],
)
def test_acoes_destrutivas_exigem_gate(cmd, gate):
    d = _c(cmd)
    assert d.allowed is False
    assert d.gate == gate


@pytest.mark.parametrize(
    "cmd",
    [
        "rm -rf ./build",                       # dentro do workspace
        "pytest -q",
        "git push origin feature/x",            # branch não protegida
        "psql -c 'DELETE FROM cache WHERE ttl < now()'",  # tem WHERE
        "ruff check .",
        "echo ok",
    ],
)
def test_acoes_benignas_passam(cmd):
    assert _c(cmd).allowed is True


def test_broker_authorize_levanta_gate_required():
    broker = CapabilityBroker()
    with pytest.raises(GateRequired) as exc:
        broker.authorize(ProposedAction(command="rm -rf /"))
    assert exc.value.gate == GateType.DESTRUCTIVE_DATA


def test_broker_authorize_permite_benigno():
    broker = CapabilityBroker()
    broker.authorize(ProposedAction(command="pytest"))  # não levanta
