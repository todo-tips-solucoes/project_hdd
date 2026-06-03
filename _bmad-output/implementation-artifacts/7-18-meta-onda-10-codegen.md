# Story 7.18: Meta-onda 10 (Fase 2) — passo de codegen no loop (endereça F9)

Status: done (2026-06-03) — entregue via PR #37 (`b8ed9d8`).

> Correção de raiz do **F9** (Meta-onda 9): o agente regenerava o `openapi.json` à mão → drift
> inconvergível. Agora artefatos derivados são **regenerados pelo sistema** dentro do loop: um passo
> de codegen roda no sandbox antes do verify e persiste a árvore canônica até o commit.

## Story

As a HDD (loop autônomo),
I want regenerar artefatos derivados (contrato OpenAPI, tipos, formatadores) por um comando
configurável antes do verify,
so that o contrato versionado fique canônico por construção e o agente não precise (nem consiga
estragar) o `openapi.json` editando-o à mão.

## Acceptance Criteria

1. `Settings.codegen_command: str = ""` (env `HDD_CODEGEN_COMMAND`; vazio → passo desligado).
2. `make_sandbox_codegen(settings, runner=None) -> Verifier` espelha `make_sandbox_verifier`: roda
   `codegen_command` no `SandboxRunner` sobre o workspace; `(True,"")` se exit 0, senão `(False, saída)`;
   sem workspace → defere `(True,"")`.
3. `WaveOrchestrator` ganha `codegen: Verifier | None = None`; `_verify_node` roda codegen **antes** do
   verify; `(False, fb)` → `CORRECTING` + `verify_feedback=fb` (não chama verify, sem merge); `(True,_)`
   ou `None` → fluxo normal.
4. `factory.open_orchestrator` injeta o codegen quando `codegen_command` está setado.
5. DoD verde (ruff, mypy --strict, import-linter, pytest) + oracle de aceitação; CI 6/6 verde; sem `--admin`.

## Execução

- Onda `019e8f6e-b7ed`: **awaiting_gate one-shot** (`->execute=1`, `n_corr=0`, verify DoD+oracle exit 0).
  Primeira meta-onda full-autônoma de feature de orquestrador — **sem fix manual no gate**.
- verify = DoD + **oracle** (sem drift: a onda não toca a API → sem `openapi.json` → sem o problema da
  onda 9). Oracle (`/var/lib/hdd-oracles/codegen`) dirige o `WaveOrchestrator` com fakes (offline),
  validado RED (main, 2 failed) / GREEN (referência, 3 passed) antes de enfileirar.
- Gate: código idiomático aprovado; CI 6/6 verde → merged `--squash` sem `--admin` → `b8ed9d8`.
- **Pós-merge (F5):** `hdd-worker:latest` rebuildado com o codegen. Ativação para ondas futuras: setar
  `HDD_CODEGEN_COMMAND` no override de compose. Deploy de prod = passo separado (PC-2, fora de escopo).

## Tasks / Subtasks

- [x] Oracle de aceitação (`test_oracle_codegen.py`), validado RED/GREEN.
- [x] `compose.meta.onda10.yaml` (verify = DoD + oracle); pré-flight verde; stack dev isolado.
- [x] Onda in-container (PR + gate). One-shot, sem correções.
- [x] Gate: revisão do código + CI 6/6 verde; merge sem `--admin` → `b8ed9d8`.
- [x] Rebuild `hdd-worker` (F5). Registro em `docs/dogfood-meta.md` + esta story. Stack dev descido.

## Entregue

`config/settings.py` (`codegen_command`), `adapters/sandbox/verifier.py` (`make_sandbox_codegen`),
`adapters/orchestrator/wave.py` (param `codegen` + `_verify_node`), `adapters/orchestrator/factory.py`
(wiring), `tests/unit/test_orchestrator.py`, `tests/unit/test_verifier.py`.

**F9 ENDEREÇADO** — regeneração de artefatos derivados é responsabilidade do sistema; prova viva = a
próxima onda que mude a API.
