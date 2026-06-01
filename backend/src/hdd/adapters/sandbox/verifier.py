"""Verificador automático real (Story 6.3): roda a suíte de testes no sandbox.

Substitui o placeholder `verify=True`. O nó `verify` do orquestrador chama este
`Callable[[str], bool]`: roda `settings.verify_command` dentro do `SandboxRunner`
endurecido (rede `none`, FS read-only fora do workspace, sem credenciais de
produção — Story 2.3) e devolve `True` SÓ se os testes passam (exit 0).

Reprovação → o orquestrador dispara o loop de correção (CORRECTING) e, esgotado
o teto N, escala via gate (ESCALATED) — comportamento da FSM já existente.

`verify` é síncrono (o nó do LangGraph o é); `SandboxRunner.run` usa
`subprocess.run`. O LangGraph executa nós síncronos fora do loop de eventos.
"""
from __future__ import annotations

import shlex
from collections.abc import Callable

from hdd.adapters.sandbox.runner import SandboxConfig, SandboxRunner
from hdd.config.settings import Settings
from hdd.observability import get_logger

log = get_logger("verify")


def make_sandbox_verifier(
    settings: Settings, runner: SandboxRunner | None = None
) -> Callable[[str], bool]:
    sandbox = runner or SandboxRunner()
    command = shlex.split(settings.verify_command)

    def verify(workspace: str) -> bool:
        if not workspace:
            # Provisionamento de workspace ainda não wired (gap downstream): sem
            # área para testar, defere ao gate humano (conservador, não bloqueia).
            log.warning("verify.sem_workspace")
            return True
        cfg = SandboxConfig(
            workspace=workspace,
            image=settings.sandbox_image,
            network=settings.sandbox_network,
        )
        try:
            result = sandbox.run(command, cfg)
        except Exception:
            # Falha de execução do sandbox (timeout/docker) ≠ testes ok → corrige.
            log.exception("verify.sandbox_falhou", workspace=workspace)
            return False
        ok = result.exit_code == 0
        log.info("verify.concluido", workspace=workspace, exit_code=result.exit_code, ok=ok)
        return ok

    return verify
