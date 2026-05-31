"""Story 2.1 — FSMs de Sessão e Onda (domínio puro)."""
from __future__ import annotations

import pytest

from hdd.domain import session as ss
from hdd.domain import wave as wv
from hdd.domain.errors import DomainError


def test_sessao_transicoes_legais():
    ss.assert_transition(ss.SessionState.CREATED, ss.SessionState.RUNNING)
    ss.assert_transition(ss.SessionState.RUNNING, ss.SessionState.AWAITING_GATE)
    ss.assert_transition(ss.SessionState.AWAITING_GATE, ss.SessionState.RUNNING)
    ss.assert_transition(ss.SessionState.RUNNING, ss.SessionState.PAUSED_QUOTA)
    ss.assert_transition(ss.SessionState.PAUSED_QUOTA, ss.SessionState.RUNNING)


def test_sessao_transicao_ilegal_de_estado_terminal():
    with pytest.raises(DomainError):
        ss.assert_transition(ss.SessionState.DONE, ss.SessionState.RUNNING)


def test_sessao_pulo_invalido():
    with pytest.raises(DomainError):
        ss.assert_transition(ss.SessionState.CREATED, ss.SessionState.DONE)


def test_onda_loop_de_correcao_legal():
    wv.assert_transition(wv.WaveState.PLANNED, wv.WaveState.EXECUTING)
    wv.assert_transition(wv.WaveState.EXECUTING, wv.WaveState.VERIFYING)
    wv.assert_transition(wv.WaveState.VERIFYING, wv.WaveState.CORRECTING)
    wv.assert_transition(wv.WaveState.CORRECTING, wv.WaveState.EXECUTING)  # loop
    wv.assert_transition(wv.WaveState.VERIFYING, wv.WaveState.MERGED)


def test_onda_escalada_e_terminais():
    wv.assert_transition(wv.WaveState.CORRECTING, wv.WaveState.ESCALATED)
    with pytest.raises(DomainError):
        wv.assert_transition(wv.WaveState.MERGED, wv.WaveState.EXECUTING)
    with pytest.raises(DomainError):
        wv.assert_transition(wv.WaveState.PLANNED, wv.WaveState.MERGED)
