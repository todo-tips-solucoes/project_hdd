"""Story 6.6 — provisionador de workspace: comandos git e cleanup (sem rede)."""
from __future__ import annotations

from pathlib import Path

from hdd.adapters.workspace import WorkspaceProvisioner


def test_provision_clona_raso_e_cria_branch_da_onda(tmp_path) -> None:
    calls: list[list[str]] = []
    prov = WorkspaceProvisioner(
        "https://example.test/repo.git", base_dir=str(tmp_path), runner=calls.append
    )
    path = prov.provision("W7")
    assert path == str(tmp_path / "hdd-wave-W7")
    assert calls[0] == ["git", "clone", "--depth", "1", "https://example.test/repo.git", path]
    assert calls[1] == ["git", "-C", path, "checkout", "-b", "hdd/wave-W7"]


def test_cleanup_remove_o_dir(tmp_path) -> None:
    d = tmp_path / "hdd-wave-x"
    d.mkdir()
    (d / "f.txt").write_text("conteúdo")
    WorkspaceProvisioner("u").cleanup(str(d))
    assert not d.exists()


def test_cleanup_idempotente_em_dir_inexistente(tmp_path) -> None:
    WorkspaceProvisioner("u").cleanup(str(tmp_path / "nao-existe"))  # não deve lançar
    assert not Path(tmp_path / "nao-existe").exists()
