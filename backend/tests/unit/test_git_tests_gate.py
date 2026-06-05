"""Testes unitários para make_git_tests_gate (runner de git injetável, sem git real)."""
from __future__ import annotations

from hdd.adapters.orchestrator.git_tests_gate import make_git_tests_gate
from hdd.config.settings import Settings


def _settings(glob: str) -> Settings:
    return Settings(require_tests_glob=glob)


def test_detecta_presenca_de_teste() -> None:
    verifier = make_git_tests_gate(
        _settings("tests/**/*.py"),
        git_runner=lambda ws: " M tests/unit/test_foo.py\n",
    )
    ok, fb = verifier("/workspace")
    assert ok
    assert fb == ""


def test_detecta_ausencia_de_teste() -> None:
    verifier = make_git_tests_gate(
        _settings("tests/**/*.py"),
        git_runner=lambda ws: " M src/hdd/feature.py\n",
    )
    ok, fb = verifier("/workspace")
    assert not ok
    assert "tests/**/*.py" in fb
    assert "aceitação" in fb


def test_sem_workspace_defere_sem_chamar_git() -> None:
    called = False

    def spy(ws: str) -> str:
        nonlocal called
        called = True
        return ""

    verifier = make_git_tests_gate(_settings("tests/**/*.py"), git_runner=spy)
    ok, fb = verifier("")
    assert ok
    assert fb == ""
    assert not called


def test_saida_vazia_nenhum_teste() -> None:
    verifier = make_git_tests_gate(
        _settings("tests/**/*.py"),
        git_runner=lambda ws: "",
    )
    ok, fb = verifier("/workspace")
    assert not ok
    assert "tests/**/*.py" in fb


def test_arquivo_de_teste_na_raiz() -> None:
    verifier = make_git_tests_gate(
        _settings("test_*.py"),
        git_runner=lambda ws: "A  test_novo.py\n?? test_outro.py\n",
    )
    ok, _ = verifier("/workspace")
    assert ok


def test_nenhum_match_entre_varios_arquivos() -> None:
    git_output = (
        " M src/app.py\n"
        " M README.md\n"
        "A  src/new_feature.py\n"
    )
    verifier = make_git_tests_gate(
        _settings("tests/*.py"),
        git_runner=lambda ws: git_output,
    )
    ok, _ = verifier("/workspace")
    assert not ok


def test_runner_recebe_workspace_correto() -> None:
    received: list[str] = []

    def capture(ws: str) -> str:
        received.append(ws)
        return " M tests/test_x.py\n"

    verifier = make_git_tests_gate(_settings("tests/*.py"), git_runner=capture)
    verifier("/my/workspace")
    assert received == ["/my/workspace"]
