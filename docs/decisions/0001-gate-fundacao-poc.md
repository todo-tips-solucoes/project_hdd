# 0001 — Gate de Fundação (Story 1.1): resultado da PoC

**Data:** 2026-05-31 · **Status:** ✅ **GO** · **Veredito:** a fundação se sustenta.

## Contexto

A arquitetura HDD v2 aposta em **LangGraph como FSM durável cujos nós invocam `claude -p` headless** (uso fora do padrão), com checkpoint Postgres. A revisão adversarial marcou isto como o maior risco e exigiu uma PoC com 5 critérios antes de qualquer execução autônoma.

## Ambiente validado

Python 3.14.5 (uv) · langgraph 1.2.2 · langgraph-checkpoint-postgres 3.1.0 · Postgres 17 + pgvector · Claude Code CLI 2.1.158 (`claude -p` autenticado na conta de assinatura).

## Resultado dos 5 critérios (todos PASS — `backend/tests/test_poc.py`)

1. **Idempotência sob kill→resume** ✅ — processo morto (exit 137) logo após o commit; ao retomar do checkpoint, o nó re-executa mas o efeito idempotente (`ON CONFLICT DO NOTHING`) **não duplica**.
2. **Contexto reconstruído do banco** ✅ — o adapter `claude -p` **nunca usa `--resume`**; a durabilidade vem 100% do checkpoint Postgres. `session_id` é capturado mas não usado para correção.
3. **`interrupt()` puro** ✅ — o nó de gate não produz efeito antes do `interrupt()`; retomar não repete o efeito do nó anterior (contagem permanece 1).
4. **`--model` no subscription** ✅ — `claude -p --model haiku` aceito (exit 0, resposta válida).
5. **Detecção de exaustão de quota** ✅ — lógica isolada (`detect_quota`) reconhece marcadores de limite; exaustão real fica para observação em produção (risco D-032).

## ⚠️ Descoberta crítica (dogfood)

O `claude -p` **não é um LLM puro — é um agente Claude Code completo**: herda ferramentas (Write/Edit/Bash) e o contexto do projeto. Ao receber a tarefa de teste "registrar um marcador", **criou um arquivo de memória e editou o índice global** — efeito colateral persistente que o grafo nunca pediu. Isto **valida empiricamente G-1/G-2** da revisão adversarial (tarefa = injeção → efeito real).

**Mitigação aplicada e validada:** o adapter passa `--disallowedTools Write Edit MultiEdit NotebookEdit Bash WebFetch` por padrão → re-execução produziu **zero** efeitos colaterais. No produto isto soma-se ao **sandbox isolado (Story 2.3)** e ao **capability broker (Story 2.4)**, agora confirmados como não-negociáveis.

## Implicações para o backlog

- Story 2.3 (sandbox) e 2.4 (broker) sobem de prioridade — a descoberta prova que executar `claude -p` sem isolamento é inseguro mesmo sem malícia.
- O adapter `LLMProvider` deve, por contrato, restringir ferramentas ao mínimo necessário por papel (least-privilege no nível de ferramenta — NFR-SEG-2/4).
