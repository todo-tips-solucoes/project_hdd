# 0002 — Modelo de execução do nó `execute` (Story 6.6): claude no host com `cwd=workspace`

**Data:** 2026-06-01 · **Status:** ✅ Aceito (MVP) · **Decisão do operador.**

## Contexto

A Story 6.6 provisiona um workspace efêmero por onda (clone do repo-alvo) e precisa
que o nó `execute` rode o `claude -p` com **ferramentas de escrita liberadas** para
implementar o plano — algo que o padrão (Story 1.1, ADR [[0001]]) bloqueia por
inteiro após a descoberta G-1/G-2 (o `claude -p` é um agente completo, não um LLM).

No modelo de **assinatura** (motor = conta, não API — ver [[project-hdd-v2-reboot]]),
rodar o `claude` **dentro do sandbox endurecido (Story 2.3)** exigiria colocar as
credenciais da conta **dentro do container** e docker-in-docker — violando o
contrato "sem segredos de produção no container".

## Opções consideradas

- **A — claude no host com `cwd=workspace`** (escolhida). Write/Edit/MultiEdit/
  NotebookEdit liberados; **Bash e WebFetch bloqueados** (sem exec arbitrário no
  host nem egress). O `cwd` aponta o claude para o clone efêmero; `verify` roda no
  sandbox isolado (Story 6.3). Sem credenciais em container, sem docker-in-docker.
- **B — claude dentro do sandbox.** Contenção *hard*, mas exige credenciais da conta
  no container (viola Story 2.3) e adiciona docker-in-docker. Recusada para o MVP.

## Decisão

Opção **A**. Implementada via `open_orchestrator(workspace, allow_write)` →
`ClaudeSubscriptionProvider(cwd=…, disallowed_tools=WORKSPACE_DISALLOWED)`. O
workspace é descartável e limpo ao retornar de `run_wave`.

## ⚠️ Risco residual (aceito conscientemente)

**A contenção é *soft*, não *hard*.** `cwd=workspace` orienta o claude a operar no
clone, mas as ferramentas `Write`/`Edit` rodam no **host** e *podem* escrever em
caminhos absolutos fora do workspace — o `cwd` **não é uma jail de filesystem**. O
bloqueio total anterior existia exatamente por isto.

**Mitigações em vigor:** Bash e WebFetch bloqueados (sem exec arbitrário nem
egress); workspace efêmero e descartável; `verify` num sandbox isolado.

**Risco que permanece:** escrita fora do workspace por um agente confuso ou
adversário (prompt injection no texto da tarefa → efeito no host). Aceitável no
MVP (operador único, dogfood); **contenção dura (Opção B ou execução com filesystem
restrito) fica como evolução** se/quando o HDD operar tarefas não-confiáveis.

**Corolário:** o `CapabilityBroker` (Story 2.4) permanece **não-wirado** no
`execute` — ele classifica comandos *Bash* destrutivos, e como o Bash está
bloqueado por inteiro neste modelo, não se aplica. Volta a importar se/quando o
Bash for liberado dentro de um sandbox real.
