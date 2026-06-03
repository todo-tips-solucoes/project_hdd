# Story 7.9: Meta-onda 1 (Fase 2) — verify com oracle oculto (testes não visíveis ao execute)

Status: blocked

> **Bloqueada pela Story 7.8** (meta-sandbox + worker in-container). Renumerada de 7.8 → 7.9:
> a análise de 2026-06-03 mostrou que dirigir qualquer meta-onda no `projeto_hdd` exige
> primeiro um sandbox capaz de rodar a suíte do backend (ver Debug Log). O pré-requisito
> virou a Story 7.8.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operador,
I want a **primeira meta-onda** do meta-dogfood: o HDD construir, no próprio `projeto_hdd`, um **verify com oracle oculto** (suíte autoritativa que o nó `execute` não enxerga),
so that eu valide o pipeline de auto-modificação (Fase 2) num alvo real **e** feche o gap da 7.5 — passando a poder exercitar o loop de correção de verdade em ondas futuras.

## Acceptance Criteria

1. **Feature entregue (oracle oculto):** **Given** o nó `verify` (`adapters/sandbox/verifier.py` + `runner.py`) **When** uma onda configura um **diretório de oracle** **Then** o `SandboxRunner` monta esse dir **somente no verify** (`-v <oracle>:/oracle:ro`) e a suíte autoritativa roda de lá contra a implementação do workspace — **sem** que esse oracle esteja no clone que o `execute` lê. **And** sem oracle configurado, o comportamento atual é preservado (retrocompatível).
2. **Meta-onda real (Fase 2):** **Given** o GO do gate 7.6 (ADR 0006) **When** disparo a onda **Then** ela roda pelo **caminho in-container** (produtor `hdd start`/painel → worker container), alvo `projeto_hdd`, **nunca** pelo `scripts/calibration_wave.py` do host (PC-1) **And** termina em PR + **gate humano** (sem auto-merge), workspace efêmero, pré-flight de capacidade verde.
3. **Loop mensurável (validação do gap da 7.5):** **Given** o oracle oculto **When** uma feature de teste é construída com ele **Then** demonstra-se que o `execute` implementa **sem ver** os casos do oracle e o `verify` dá sinal real (o caminho `verify→CORRECTING→execute` pode disparar) — registrar a evidência (mesmo que esta meta-onda em si não exercite o loop, por construir a feature cujos próprios testes são visíveis).
4. **Tooling e boundaries:** **Given** o DoD **When** o PR é revisado **Then** `ruff`/`mypy --strict`/`import-linter`/`pytest` verdes; boundaries hexagonais preservados; caminho feliz das ondas (verify sem oracle) intacto.
5. **Auditoria:** **Given** a meta-onda **When** conclui **Then** o resultado (desfecho, correções, PR, decisão do gate) fica registrado em `docs/dogfood-calibragem.md` (ou um novo `docs/dogfood-meta.md`) como **primeira meta-onda**.

## Tasks / Subtasks

- [ ] **Task 1 — Especificar o oracle oculto (MVP, AC: #1)** — escopo mínimo e bem-delimitado (1ª meta-onda deve ser baixo risco).
  - [ ] Contrato: `SandboxConfig` ganha `oracle_dir: str | None = None`; quando setado, `_docker_cmd` adiciona `-v <oracle_dir>:/oracle:ro`. `make_sandbox_verifier` passa o oracle (de `settings`, ex.: `HDD_ORACLE_DIR`) ao `SandboxConfig`. Retrocompatível: `oracle_dir=None` → cmd idêntico ao atual.
  - [ ] A suíte autoritativa roda de `/oracle` (ex.: `verify_command="pytest -q /oracle"` quando há oracle), contra o código em `/workspace` (pythonpath/pacote). O **execute não recebe** `/oracle` (ele só tem `cwd=clone`).
- [ ] **Task 2 — Disparar a meta-onda in-container (AC: #2)** — **PARAR e pedir confirmação do operador antes** (consome quota, roda claude no projeto_hdd).
  - [ ] Garantir o caminho in-container: produtor real (`hdd start "<tarefa>"` ou painel "iniciar feature", Story 6.10) → fila → **worker container** processa. **NÃO** usar o driver do host.
  - [ ] Pré-flight de capacidade verde (swap + max_concurrent + RAM). Janela de dev isolada se aplicável.
  - [ ] Tarefa da onda (honesta, não super-especificada): "implementar o oracle oculto no nó verify conforme Task 1 — `oracle_dir` no `SandboxConfig`, mount `-v <oracle>:/oracle:ro` só no verify, retrocompatível, com testes; manter boundaries".
- [ ] **Task 3 — Observar e revisar (AC: #3, #4)**.
  - [ ] Acompanhar o loop (`verify→CORRECTING?→gate`), métricas (`corrections_sum`, desfecho).
  - [ ] **Gate humano:** revisar o PR no `projeto_hdd` — código correto, retrocompatível, tooling verde, boundaries OK. **PARAR e pedir confirmação do operador antes de aprovar o merge.**
- [ ] **Task 4 — Registrar a meta-onda (AC: #5)**.
  - [ ] Documentar em `docs/dogfood-calibragem.md` (ou `docs/dogfood-meta.md`): 1ª meta-onda, desfecho, correções, PR, decisão. Marcar o gap da 7.5 como endereçado (oracle oculto disponível para ondas futuras).

## Dev Notes

- **Esta é uma META-ONDA** (Fase 2): o **HDD constrói a feature** via `claude -p` num clone de `projeto_hdd`; o operador/dev **dirige e revisa**. A feature em si é o **oracle oculto**.
- **⚠️ PC-1 / execução in-container (ADR [[0006]], Story 7.7):** a meta-onda **DEVE** rodar pelo worker container (que não monta a árvore de prod nem secrets). **NUNCA** pelo `scripts/calibration_wave.py` (host) — lá o claude alcançaria `/var/lib/projeto_hdd`. Use o produtor real (`hdd start`/painel 6.10).
- **Estado atual (ler antes):**
  - `adapters/sandbox/runner.py`: `SandboxRunner._docker_cmd` monta `docker run … -v {workspace}:/workspace:rw -w /workspace … {image} {command}`. `SandboxConfig` é o ponto de extensão (adicionar `oracle_dir`).
  - `adapters/sandbox/verifier.py`: `make_sandbox_verifier(settings)` → `verify(workspace)`; roda `shlex.split(settings.verify_command)` no sandbox. Aqui se injeta o oracle.
  - `adapters/workspace.py`: `WorkspaceProvisioner.provision` clona o repo (depth 1) — é o que o `execute` vê. O oracle **não** pode vir daqui.
  - O `verify` é `--network none` por padrão (mantém — a suíte de teste não precisa de rede).
- **Recursão (consciente):** esta meta-onda constrói a *capacidade* de oracle oculto; os testes **da própria feature** são escritos pelo execute (visíveis), então esta onda provavelmente é one-shot — tudo bem. O valor é (a) validar o pipeline de auto-modificação em alvo real e (b) entregar a feature para **ondas futuras** exercitarem o loop de correção de verdade.
- **MVP / baixo risco:** manter o escopo mínimo (mount opcional + config), retrocompatível. Não reescrever o verify; estender. 1ª meta-onda deve ser bem-delimitada (sabedoria do scope: "dívida de baixo risco").
- **Salvaguardas Fase 2:** PR + gate humano (6.8); workspace efêmero (6.6); pré-flight de capacidade ([[0005]]); sem auto-deploy (PC-2); o HDD nunca toca `compose.prod.yaml`/`secrets/`/`deploy.env`. DoD: `docs/definition-of-done.md`.
- **Custo:** consome quota (claude no projeto_hdd). Parar para confirmação antes de disparar (Task 2) e antes de aprovar o gate (Task 3).

### Project Structure Notes

- Mudanças da feature (que o HDD fará no clone): `backend/src/hdd/adapters/sandbox/runner.py` (UPDATE — `oracle_dir` + mount), `backend/src/hdd/adapters/sandbox/verifier.py` (UPDATE — passar oracle), `backend/src/hdd/config/settings.py` (UPDATE — `oracle_dir`/`HDD_ORACLE_DIR`), `backend/tests/unit/test_verifier.py` + `test_*` (UPDATE — cmd com mount de oracle). Doc no `projeto_hdd`.
- Mudanças DESTA story no repo (operacional): só o registro em `docs/dogfood-*.md` (o código entra via PR da meta-onda, revisado no gate).
- Numeração: meta-ondas do `epic-7-scope-proposal.md` (7.7 dívida, 7.8 painel, 7.9 pool, 7.10 retro) deslocam +1 pela inserção da 7.7 de hardening; esta é a **meta-onda 1**.

### References

- [Source: docs/decisions/0006-gate-calibracao-go-nogo.md] (GO da Fase 2; PC-1 in-container)
- [Source: _bmad-output/implementation-artifacts/7-7-hardening-execute-contencao-fs.md] (contenção do execute; caminho in-container)
- [Source: docs/dogfood-calibragem.md] (achado do oracle visível — Ondas 2 e 3 da 7.5)
- [Source: backend/src/hdd/adapters/sandbox/runner.py] (SandboxRunner/_docker_cmd — ponto de extensão do mount)
- [Source: backend/src/hdd/adapters/sandbox/verifier.py] (make_sandbox_verifier — injeção do oracle)
- [Source: backend/src/hdd/adapters/workspace.py] (clone que o execute vê — oracle fica de fora)
- [Source: docs/definition-of-done.md] (salvaguardas Fase 2 + padrão de decisão)

## Dev Agent Record

### Agent Model Used

### Debug Log References

**HALT — pré-requisitos de execução ausentes (2026-06-03), antes de gastar quota:**
- ❌ **Sandbox incapaz de rodar a suíte do projeto_hdd:** `hdd-sandbox:latest` = Python 3.11 + pytest, **sem uv/sqlalchemy/langgraph** (feito p/ o repo calibragem, funções puras). A suíte do projeto_hdd precisa de Python 3.13 + uv + deps do backend; sandbox é `--network none` (sem install runtime). → precisa de **imagem de meta-sandbox** (deps embutidas, sem credenciais).
- ❌ **Worker de prod aponta p/ outro repo:** `HDD_REPO_URL=hdd-smoke-test`, `HDD_VERIFY_COMMAND=true` (no-op). Não configurado p/ meta-dogfood do projeto_hdd.
- ✅ Produtor existe (`hdd start` → `WorkQueue.enqueue`, `cli/main.py:33`).
- **Recursão:** o meta-sandbox NÃO pode ser construído por uma meta-onda (ela precisaria do meta-sandbox p/ verificar) → é infra a construir **direto pelo dev** (Dockerfile + build + config do worker in-container), sem quota/onda.
- **Achado de dogfood (gap p/ 7.2):** o harness de meta-dogfood pressupunha um sandbox universal; na prática só servia para repos sem dependências. Pré-requisito real exposto antes do 1º uso.

### Completion Notes List

### File List
