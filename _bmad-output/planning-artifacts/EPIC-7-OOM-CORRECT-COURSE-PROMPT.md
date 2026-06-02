# Prompt de continuação — Correct Course: incidente OOM na calibração (Epic 7)

> Rodar em **contexto limpo** com `bmad-correct-course` (John/PM). Objetivo: formalizar
> como salvaguarda auditável do Epic 7 a restrição de capacidade descoberta no incidente
> de 2026-06-02, e ratificar o novo padrão de decisão dos agentes.

## Incidente (2026-06-02)

- **Sintoma relatado:** "servidor 100% CPU, processo travou e reiniciou".
- **Realidade:** o host **não** reiniciou (Hetzner vServer, 8 GB RAM, **0 swap**, uptime desde 2025-12-11).
  Foi o **OOM killer** do kernel matando processos por falta de memória — pico em
  `Tue Jun 2 12:04:16 2026  Killed process (claude)`. Série de OOMs em 31/05, 01/06 ×2 e 02/06.
- **Causa raiz (falha de composição):** a máquina hospeda prod (`projeto_hdd-*`) + `painel-relatorios` ×N +
  n8n + pgAdmin + Portainer + IDE Antigravity + várias sessões `claude`. Às 11:42 subiu-se o stack de
  **dev** (`hdd_dev`) para dirigir a calibração; o `calibration_wave.py run` roda **no host** e dispara
  `claude -p` (faminto de memória), somado ao `claude` do worker de dev. Sem swap, o estouro virou kill.

## Onde a calibração parou

- **Story 7.4 (cep) — baseline:** ✅ onda `019e861e…` chegou a `merged` às 02:20. Caminho feliz validado.
- **Calibração seguinte (cnpj):** 2 ondas em `planned` (11:42 e 11:54) + 3 itens `work_queue=failed` —
  mortas no OOM. **Preservadas** como evidência (não deletadas).
- **Produção: intacta** (containers healthy, DB limpo, sem lease preso).

## Mitigações JÁ aplicadas (2026-06-02, antes deste correct-course)

1. **Swap 4 GB** criado, persistido em `/etc/fstab`, `vm.swappiness=10` (`/etc/sysctl.d/99-hdd-swappiness.conf`).
2. **`app.quota_counter.max_concurrent = 1`** no dev (era 2).
3. Gate `pending` pendurado (onda de teste morta) resolvido → 0 pendentes. Nenhum lease vazou
   (`quota_lease` auto-expira — design já correto).
4. Prod **não** foi alterado (max_concurrent=2, 0 leases) — decisão deixada para o operador.

## O que o correct-course deve formalizar

1. **Salvaguarda de capacidade do Epic 7 (gate verificável, não soft convention):**
   - Pré-condição de qualquer onda de calibração/meta-dogfood: **swap ativo** + `max_concurrent=1`
     nesta máquina + **não** rodar driver-no-host junto com worker-dev junto com prod.
   - Janela de calibração: `hdd_dev` sobe só durante a janela e desce depois (`docker compose -p hdd_dev down`).
   - Tornar isto um **AC/checklist** da story de calibração (e idealmente um pre-flight no
     `calibration_wave.py` que recusa rodar sem swap), para não depender de memória humana.
2. **Decisão de escalabilidade (registrar trade-off):** a solução durável é mover calibração/dev para
   **outra VM** ou aplicar **limites de memória por stack** (cgroups / `mem_limit` no compose). Decidir
   GO/NO-GO e prazo.
3. **Ratificar o padrão de decisão dos agentes (diretriz do operador, 2026-06-02):** em toda decisão,
   os agentes do HDD (dev/QA/review + worker `claude -p`) devem **recomendar por default a alternativa com
   melhor prática de desenvolvimento + segurança + escalabilidade**, com justificativa nesses 3 eixos; o
   atalho só aparece com o custo declarado. Materializar no **Definition of Done** das stories e nos
   prompts/persona dos agentes — ancorado em gate verificável.

## Depois do correct-course

- Re-rodar a calibração cnpj (e Story 7.5 nível 2) com as salvaguardas ativas → `approve <wave_id>` no gate.
- Seguir para **Story 7.6** (gate de calibração GO/NO-GO para a Fase 2 / meta-dogfood).
