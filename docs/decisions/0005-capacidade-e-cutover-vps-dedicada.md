# 0005 — Capacidade de host & cutover para VPS dedicada (correct-course OOM, Epic 7)

**Data:** 2026-06-03 · **Status:** ✅ Aceito (GO) · **Decisão do operador.**

## Contexto

Em **2026-06-02**, durante a Fase 1 (calibração) do Epic 7, a VPS compartilhada (Hetzner,
8 GB RAM, **0 swap**) sofreu uma série de mortes por **OOM killer** do kernel — pico em
`Tue Jun 2 12:04:16 2026 Killed process (claude)`, com OOMs também em 31/05 e 01/06 ×2.

**Causa raiz — falha de composição (não bug do HDD):** a máquina hospedava prod
(`projeto_hdd-*`) + `painel-relatorios` ×N + n8n + pgAdmin + Portainer + IDE Antigravity +
várias sessões `claude`. Às 11:42 subiu-se o stack de **dev** (`hdd_dev`); o
`calibration_wave.py run` roda **no host** e dispara `claude -p` (pico de RSS ~1.5–1.7 G),
somado ao `claude` do worker de dev. Sem swap, o estouro virou *kill*. O incidente é de
**memória do host** — ortogonal à quota da conta (`quota_lease` conta slots internos, não
uso da conta; o driver `subscription` nem emite tokens/custo).

Baseline `cep` (Story 7.4) ficou `merged` (preservado); a calibração `cnpj` morreu (2 ondas
`planned` + 3 itens `failed`, preservados como evidência); produção ficou intacta.

## Opções consideradas

- **A — VM dedicada para dev/calibração + prod (escolhida).** VPS dedicada 4 vCPU / 16 GB /
  200 GB (Boston). Remove a contenção na raiz; `mem_limit` por stack contém o blast radius.
- **B — só `mem_limit` por stack na máquina compartilhada de 8 GB.** Barato, mas 8 GB não
  comporta prod + dev + driver-no-host com folga; apenas adia o estouro.
- **C — driver `api` (pausar dogfood até escala).** Resolve quota, **não** memória do host;
  fora de escopo do incidente. Fica para o Epic 8.

## Decisão

Opção **A**, com `mem_limit` por stack (B incorporada como contenção). Implementado em
`259a26d`→`75d3fac`:

- **Cutover para VPS Boston (16 GB)** — confirmado live (2026-06-03): `MemTotal ≈ 16 GB`,
  `SwapTotal = 4 GB` ativo, `swappiness=10`, `/swapfile` em `/etc/fstab`.
- **`mem_limit`/`mem_reservation` por serviço** (`compose.prod.yaml`, kernel 6.8 cgroup v2 +
  swap accounting → teto plenamente enforçado): postgres 3g/1g · api 1g/512m · worker **6g**/1g
  (serviço mais pesado — hospeda os `claude -p`) · frontend 768m/256m · migrate 512m/128m.
  Se o cgroup do worker estourar, mata **só dentro do worker** (`restart: unless-stopped`
  recupera; a onda falha) — blast radius contido, host preservado.
- **Swap 4 G + `swappiness=10`** como rede de segurança: estouros transitórios degradam em
  vez de matar.
- **pgBackRest isolado por path** (`repo1-path=/hdd-boston`): o cluster novo tem outro
  system-id; isolar o stanza por path **preserva** o histórico do cluster antigo no mesmo
  bucket R2 sem conflito.
- **Ingress Traefik por file-provider** (`ops/traefik/`, rotas em `dynamic/hdd.yml`): sem
  acesso ao `docker.sock` (superfície menor) e contorna a incompatibilidade Traefik v3.3 ↔
  Docker 29.x.

## Salvaguarda verificável (não convenção)

A pré-condição de capacidade de qualquer onda de calibração/meta-dogfood é **enforçada em
código** — `evaluate_capacity` em `backend/scripts/calibration_wave.py` recusa rodar sem
**swap ativo + `max_concurrent==1` + `MemAvailable ≥ 2 GiB`**. Escape-hatch
`HDD_CALIB_SKIP_PREFLIGHT=1` com custo declarado. AC em `docs/dogfood-calibragem.md`.

## Trade-offs (performance · segurança · escalabilidade)

- **Performance:** host dedicado remove a contenção de CPU/RAM com os outros stacks; worker
  com 6 G cobre `max_concurrent=2` com folga (era o gargalo).
- **Segurança:** `mem_limit` por stack impede que um pico derrube vizinhos; ingress sem
  `docker.sock`; backup do cluster antigo preservado (não destrutivo).
- **Escalabilidade:** caminho aberto para subir `max_concurrent` em prod conforme a conta
  permitir; calibração isolada do prod evita auto-interferência. Custo: +1 VPS a manter.

## Validação

Cutover confirmado live na máquina (free/`/proc/meminfo`); `mem_limit` versionado em
`compose.prod.yaml`; pré-flight coberto por testes unitários (`test_dogfood_harness.py`).
Próximo passo: re-rodar `cnpj` + Story 7.5 com a salvaguarda ativa → Story 7.6 (gate GO/NO-GO).
