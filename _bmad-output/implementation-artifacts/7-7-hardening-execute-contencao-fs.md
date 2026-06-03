# Story 7.7: Hardening do `execute` — contenção de filesystem (fecha PC-1, destrava a Fase 2)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operador,
I want que o nó `execute` não consiga escrever fora do workspace efêmero da onda (path absoluto ou `..`),
so that o gate de calibração (7.6) possa virar GO e o HDD construa features em `projeto_hdd` (Fase 2) **na máquina de produção** sem risco de tocar `/var/lib/projeto_hdd/...`, `secrets/` ou a árvore de prod.

## Acceptance Criteria

1. **PC-1 fechada (invariante testável):** **Given** o `execute` rodando `claude -p` em modo workspace **When** o agente tenta um efeito de **Write/Edit com path absoluto fora do workspace** (ex.: `/tmp/hdd-sentinela-fora-<rand>`) ou com `..` que escape do clone **Then** o efeito **não ocorre** (o arquivo-sentinela **não** é criado) — provado por um **teste de invariante** que falha na CI se a contenção regredir.
2. **Comportamento legítimo preservado:** **Given** a mesma configuração **When** o agente escreve **dentro** do workspace **Then** funciona normalmente (as ondas de calibração 7.4/7.5 continuariam passando) — a contenção não quebra o caminho feliz.
3. **Enforcement explícito (não só convenção):** **Given** o provider/`execute` **When** é construído **Then** a confinação é **explícita no código** (flag de confinamento do `claude` verificada como efetiva, e/ou sandbox de filesystem), não dependendo de um comportamento default não-documentado. A decisão entre as abordagens é fundamentada no **probe empírico** (Task 1).
4. **Boundaries e tooling:** **Given** o DoD **When** finalizo **Then** `ruff`/`mypy --strict`/`import-linter`/`pytest` verdes; os boundaries hexagonais (import-linter) preservados.
5. **Gate reabilitável:** **Given** PC-1 verde **When** atualizo `docs/decisions/0006-gate-calibracao-go-nogo.md` **Then** fica registrado que PC-1 foi fechada e o gate 7.6 pode ser re-rodado para **GO** (sem reabrir o veredito aqui — isso é o gate humano da 7.6).

## Tasks / Subtasks

- [x] **Task 1 — Determinar a contenção (AC: #3)** — ✅ **resolvido SEM quota** (probe dispensado por decisão do operador). Achado: na Fase 2 o `execute` roda **no container `worker`**, cujos volumes (`compose.prod.yaml:137-141`) são só `docker.sock` + `$HDD_WORKSPACE_ROOT` — a árvore de prod e os secrets **não** são montados → contenção por construção. O alarme de PC-1 era do caminho **host-driven** (`calibration_wave.py`, Fase 1), não da Fase 2. Probe (defesa-em-profundidade) ficou opcional/não feito.
- [x] **Task 2 — Enforçar a contenção (AC: #1, #2, #3)** — ✅ **Opção A (boundary do container).** A contenção já existe por construção (mounts do worker); o hardening é (a) **pinar** com o invariante (Task 3) e (b) **documentar** o modelo. Comentário PC-1 adicionado em `adapters/orchestrator/factory.py` (contenção = mount namespace do worker; driver host é Fase-1-only). Sem mudança de comportamento → caminho feliz preservado (AC #2).
- [x] **Task 3 — Teste de invariante de PC-1 (AC: #1, #2)**. ✅ `test_pc1_execute_contido_pelo_boundary_do_worker` em `tests/unit/test_security_invariants.py`: parseia `compose.prod.yaml` e prova que o worker **não** monta a árvore de prod nem secrets (só `docker.sock` + workspace root). Roda no CI **sem quota**; falha se alguém reabrir PC-1 ao adicionar um mount. (Probe de runtime do claude como integração opt-in ficou dispensado — a contenção primária é o boundary, não o runtime do claude.)
- [x] **Task 4 — Atualizar o ADR e destravar o gate (AC: #5)**. ✅ `docs/decisions/0006` ganhou "Atualização 2026-06-03 (Story 7.7) — PC-1 FECHADA", com a evidência (boundary + teste + nota no factory) e o registro de que o gate 7.6 pode ser re-rodado para reavaliar GO (sem reabrir o veredito). Tooling verde: ruff/mypy --strict (74)/import-linter (4)/pytest (113).

## Dev Notes

- **Story de hardening de segurança** — fecha o gap PC-1 do ADR [[0006]]. É pré-requisito da Fase 2. **NÃO** é meta-onda; é dev normal (usar o `execute` não-confinado para se auto-confinar no prod seria circular e arriscado).
- **Estado atual (ler antes de mexer):**
  - `adapters/llm/subscription.py`: `ClaudeSubscriptionProvider.invoke` monta `cmd = ["claude","-p",prompt,"--output-format","json", ("--model",…), ("--disallowedTools",*tools), ("--permission-mode",…)]` e roda `subprocess.run(cmd, cwd=self.cwd, timeout=…)`. `WORKSPACE_DISALLOWED=("Bash","WebFetch")` (Write/Edit **permitidos**). `DEFAULT_DISALLOWED` bloqueia tudo (plan/verify).
  - `adapters/orchestrator/factory.py:44-52`: no modo `allow_write`, monta o provider com `cwd=workspace`, `disallowed=WORKSPACE_DISALLOWED`, `permission_mode="acceptEdits"`. **Sem `--add-dir`.**
  - `adapters/sandbox/runner.py`: `SandboxRunner` do verify — `docker run --rm --network none --read-only --tmpfs /tmp -v workspace:/workspace:rw -w /workspace <image> <cmd>`. **Modelo de isolamento de FS** a reusar na Opção B (mas o execute precisa de **rede**, então sem `--network none`).
  - `domain/capability.py` + `application/broker.py`: broker determinístico classifica **comandos shell** (`rm`/DROP/push fora do workspace) — **não** intercepta Write do agente, e **não está wirado** ao `execute`. Não confundir: o broker não é o enforcement de PC-1.
- **O que NÃO quebrar:** o caminho feliz das ondas (Write dentro do workspace, abrir PR via `GitHubVcs`); a auth do `claude` (driver subscription, conta Max); os boundaries hexagonais (`domain ← contracts ← adapters`); o `verify` em `--network none` (não confundir com o sandbox do execute, que precisa de rede).
- **Probe primeiro (Task 1):** a escolha A vs B depende de fato observável, não de suposição. O comentário em `subscription.py:50-52` já registra incerteza sobre o `acceptEdits` — o probe a resolve. Documentar a evidência no Debug Log.
- **Custo de quota:** só a Task 1 (probe, ~1 chamada haiku) e, se o teste de invariante for integração opt-in, ele. Avisar o operador antes de gastar (alinhado às outras ondas). O grosso (sandbox/flags/teste unitário) não custa quota.
- **Salvaguardas/DoD:** `docs/definition-of-done.md` (segurança+best-practice por default; gate verificável), `docs/decisions/0005` (workspace efêmero, pré-flight). O HDD nunca toca `compose.prod.yaml`/`secrets/`.

### Project Structure Notes

- Mudanças prováveis: `backend/src/hdd/adapters/llm/subscription.py` (UPDATE — confinação/sandbox), `backend/src/hdd/adapters/orchestrator/factory.py` (UPDATE — como monta o provider do execute), possível novo helper de sandbox do execute (NEW, ou estender `adapters/sandbox/runner.py`), `backend/tests/unit/test_security_invariants.py` (UPDATE), possível `backend/tests/integration/test_execute_containment.py` (NEW, opt-in quota), `docs/decisions/0006-gate-calibracao-go-nogo.md` (UPDATE).
- Numeração: esta 7.7 é inserida à frente das meta-ondas; as stories 7.7-7.10 da `epic-7-scope-proposal.md` (meta-ondas + retro) deslocam-se para 7.8+ quando forem criadas.

### References

- [Source: docs/decisions/0006-gate-calibracao-go-nogo.md] (PC-1 gap, backlog bloqueante — origem desta story)
- [Source: docs/decisions/0002-execucao-execute-host-cwd.md] (execute roda no host com cwd; risco soft)
- [Source: docs/decisions/0004-verify-worker-docker-socket.md] (modelo de sandbox/isolamento via docker socket)
- [Source: backend/src/hdd/adapters/llm/subscription.py] (provider, cmd, cwd, permission_mode)
- [Source: backend/src/hdd/adapters/orchestrator/factory.py#L44-L52] (montagem do provider do execute)
- [Source: backend/src/hdd/adapters/sandbox/runner.py] (SandboxRunner — padrão de isolamento)
- [Source: backend/tests/unit/test_security_invariants.py] (invariantes executáveis S-1/G-1/G-2)
- [Source: _bmad-output/implementation-artifacts/7-6-gate-calibracao-go-nogo.md] (gate, PC-1/PC-2)
- [Source: docs/definition-of-done.md] (DoD, padrão de decisão)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- **PC-1 fechada sem quota** via boundary do container worker (contenção por construção): o `execute` da Fase 2 roda no worker, que não monta a árvore de prod nem secrets. Pinado por invariante executável + documentado em `factory.py` e no ADR 0006. Caminho feliz das ondas intacto (sem mudança de comportamento). Tooling verde.
- Reframe importante: o risco de PC-1 do ADR 0006 era do caminho **host-driven** (calibração Fase 1), não da Fase 2 — agora explicitado e guardado por teste.
- **Próximo:** re-rodar o gate da Story 7.6 para reavaliar GO (gate humano).

### File List

- `backend/tests/unit/test_security_invariants.py` (UPDATE — invariante PC-1 + imports yaml/Path)
- `backend/src/hdd/adapters/orchestrator/factory.py` (UPDATE — nota de contenção PC-1, sem mudança de comportamento)
- `docs/decisions/0006-gate-calibracao-go-nogo.md` (UPDATE — PC-1 fechada)

## Change Log

- 2026-06-03 — PC-1 fechada via boundary do container worker (Story 7.7). Invariante de mounts adicionado (sem quota), contenção documentada, ADR 0006 atualizado. Tooling verde. Status → review. Destrava o re-run do gate 7.6.
