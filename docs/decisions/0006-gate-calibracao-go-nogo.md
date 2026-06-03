# 0006 — Gate de calibração: GO para a Fase 2 (meta-dogfood)

**Data:** 2026-06-03 · **Status:** ✅ **GO** (re-avaliado após PC-1 fechada na Story 7.7;
veredito original NO-GO condicional preservado abaixo) · **Decisão do operador.** · **Story 7.6.**

## Veredito final 2026-06-03 (re-run do gate) — ✅ GO

Com **PC-1 fechada** (Story 7.7 — contenção do `execute` pelo boundary do container worker,
pinada por invariante) e **PC-2 verde**, as duas pré-condições bloqueantes estão satisfeitas;
a **capacidade (H-A)** já estava provada (3/3 features one-shot). **Decisão do operador: GO.**

A **Fase 2 (meta-dogfood)** está liberada: o HDD pode construir features no próprio
`projeto_hdd`, sempre **via PR + gate humano** (6.8), em **workspace efêmero** (6.6), sob o
**pré-flight de capacidade** ([[0005]]), **sem auto-deploy** (PC-2) e **sem tocar**
`compose.prod.yaml`/`secrets/`/`deploy.env`. Candidatos à 1ª meta-onda: dívida conhecida de
baixo risco (ex.: worker multi-arch) ou o backlog "oracle oculto" (achado da 7.5).

## Contexto

Fim da **Fase 1 (calibração)** do Epic 7. Este gate — análogo ao gate de fundação
([[0001]]) — decide se o HDD pode passar à **Fase 2 (meta-dogfood)**: construir features
no **próprio `projeto_hdd`** (via PR + gate humano), na **máquina de produção**
([[project-hdd-prod-on-dev-machine]]). Critério de GO (`epic-7-scope-proposal.md` §7.6):
qualitativo informado por métricas, ancorado em **H-A**, **com 2 pré-condições bloqueantes**.

## Evidência — capacidade (H-A): forte

| Onda | Feature | Modelo | Desfecho | Correções |
|---|---|---|---|---|
| 7.4 | `cep` | haiku | `reached_gate` → merge | 0 |
| 7.5 | `cnpj` | sonnet | `reached_gate` → merge | 0 |
| 7.5 | `data_br` | haiku | `reached_gate` → merge | 0 |

**3/3 features reais** construídas autonomamente, **0 correções, 0 escaladas, 0 leases
vazados**; pipeline `clone→claude→verify→PR→gate→merge` validado ponta a ponta. Quota
sustentável (driver `subscription` não emite custo; 0 `quota_hit`). O critério "≥1 onda
completa sem intervenção fora do gate" foi atendido **3×**. Nuance: 0 correções decorre do
**oracle visível ao `execute`** (achado da 7.5, `docs/dogfood-calibragem.md`), não de
incapacidade — o loop de correção não foi exercitado de verdade.

## Pré-condições de prontidão

- **PC-2 — sem auto-deploy: ✅ VERDE (verificado).** `.github/workflows/ci.yml` (push/PR em
  main): jobs de lint/types/unit, integração, openapi-drift, frontend, scan de deps e
  `docker-build` com **`push: false`** — **nenhum** step de deploy/ssh/swarm/redeploy.
  `compose.prod.yaml`: sem watchtower/webhook/autoredeploy (só políticas `restart:`; o
  `webhook` é o HMAC inbound do n8n). Deploy é **manual** (`docs/runbooks/deploy.md`).
- **PC-1 — contenção de path: ❌ NÃO MET (bloqueante).** O `execute` roda `claude -p` no
  **host** com `permission_mode="acceptEdits"` + `cwd=workspace`, **sem `--add-dir`**
  (`adapters/orchestrator/factory.py:44-51`). `WORKSPACE_DISALLOWED` bloqueia `Bash`/
  `WebFetch`, mas **Write/Edit é permitido**. O capability broker (`domain/capability.py`)
  classifica só **comandos shell** (`rm`/DROP/push fora do workspace) e **não está wirado**
  aos efeitos de Write do agente. Logo, a contenção de um **Write com path absoluto fora do
  workspace** (ex.: `/var/lib/projeto_hdd/...`, `secrets/`) depende inteiramente de o
  `acceptEdits` respeitar o cwd — **não verificado e sem teste**. Na Fase 2, com o HDD
  rodando na máquina de prod, é um risco concreto de escapar do clone efêmero.

## Atualização 2026-06-03 (Story 7.7) — PC-1 FECHADA ✅

A análise da Story 7.7 mostrou que o alarme de PC-1 valia para o caminho **host-driven**
(`scripts/calibration_wave.py` roda `claude` no host, onde `/var/lib/projeto_hdd` é
alcançável) — que é **Fase 1** (repo separado). Na **Fase 2 (meta-dogfood)** o `execute`
roda **dentro do container `worker`**, cujo mount namespace (`compose.prod.yaml`)
inclui **apenas** `/var/run/docker.sock` (verify, [[0004]]) e `$HDD_WORKSPACE_ROOT`
(workspaces efêmeros): **a árvore de prod e o dir de secrets NÃO são montados**, então um
Write absoluto do agente não os alcança — **contenção por construção**, análoga ao `verify`.

**Enforcement:** invariante executável
`tests/unit/test_security_invariants.py::test_pc1_execute_contido_pelo_boundary_do_worker`
(falha na CI se o worker passar a montar a árvore de prod ou os secrets) + nota de contenção
em `adapters/orchestrator/factory.py`. Salvaguarda: o driver host de calibração é Fase-1-only
(nunca meta-dogfood). → **PC-1 verde. O gate (Story 7.6) pode ser RE-RODADO para reavaliar
GO.** Esta atualização não reabre o veredito (isso é o gate humano da 7.6).

## Decisão (original — 2026-06-03)

**NO-GO condicional.** A Fase 2 (meta-dogfood) **não inicia** enquanto PC-1 estiver aberta.
A capacidade (H-A) está provada e PC-2 verde, mas liberar a auto-modificação no prod com a
contenção de filesystem *soft* e não testada é inaceitável sob as lentes
**segurança · best-practice · escalabilidade** (`docs/definition-of-done.md`).

### Backlog bloqueante (caminho para reabrir o gate → GO)

1. **Confinar o `execute`:** passar `--add-dir <workspace>` (writable-only ao clone) **e
   verificar** que um Write absoluto fora do workspace é recusado; **ou** sandboxar o
   `execute` num container com só o workspace montado (análogo ao `verify`, [[0004]]).
2. **Teste de invariante** (integração, opt-in de quota): dirigir o `claude` num workspace
   temporário e provar que um Write num sentinela **fora** do workspace **não ocorre**.
3. (Opcional) guard de filesystem determinístico no caminho do `execute`.
4. **Re-rodar este gate** com PC-1 verde → atualizar este ADR para GO.

> ⚠️ Esta deve ser uma **story normal de dev** (não uma meta-onda) — usar o `execute`
> ainda não-confinado para se auto-confinar na máquina de prod seria circular e arriscado.

## Salvaguardas que continuam valendo (Fase 1 e além)

Sem auto-deploy (PC-2 ✅); merge só com gate humano (6.8); workspace efêmero por onda (6.6);
pré-flight de capacidade ([[0005]], correct-course OOM); o HDD **nunca** toca
`compose.prod.yaml`/`secrets/`/`deploy.env`. Ver `docs/definition-of-done.md`.

## Validação

Métricas em `docs/dogfood-calibragem.md`; PC-2 verificado em `ci.yml` + `compose.prod.yaml`;
PC-1 analisado em `factory.py`/`subscription.py`/`capability.py`/`broker.py`. Veredito
registrado por decisão do operador no gate humano da Story 7.6.
