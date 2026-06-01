# 0003 — Onde roda o merge do PR ao aprovar o gate (Story 6.8)

**Data:** 2026-06-01 · **Status:** ✅ Aceito (MVP) · **Decisão do operador.**

## Contexto

A Story 6.2 (resume pós-gate) ao aprovar só transicionava a onda para `MERGED` —
sem `gh pr merge` real. A Story 6.7 passou a abrir um PR rascunho e a guardar o
`pr_number` no estado do grafo. Falta integrar o PR de fato ao aprovar.

O `resume` da onda roda na **API** (o painel autenticado decide o gate, Story 4.3).
O merge de um PR (`gh pr merge <n>`) opera no **GitHub via número do PR** — **não
precisa do workspace** (que vive no worker). Isso elimina o split worker/API para
o merge.

## Opções consideradas

- **A — merge no nó `gate` durante o resume, na API** (escolhida). O nó `gate`, ao
  ser retomado com aprovação, chama `Vcs.merge_pr(state["pr_number"])`. Coeso (o nó
  já tem o número do PR) e idempotente (o checkpoint não re-roda o nó após terminal).
- **B — enfileirar um item de merge para o worker.** A API enfileira; o worker (que
  já tem `gh`+token) executa. Mantém a API slim, mas adiciona um tipo de item na
  fila + roteamento no loop, e o merge fica assíncrono ao clique.

## Decisão

Opção **A**. Implementado em `WaveOrchestrator._gate` (agora async): em aprovação,
`merge_pr` (draft → ready → squash merge → delete branch) via `GitHubVcs`, com
`--repo <slug>` (`settings.repo_slug`) porque o resume na API não tem git no cwd.
Rejeição não mergeia (onda → `FAILED`). Falha de merge é registrada (`merge_error`)
e **não trava** — a decisão humana de merge mantém-se (`MERGED`); retry manual.

## ⚠️ Trade-off de segurança (aceito) e requisito de deploy (Story 6.9)

Para mergear na API, o container **`api` precisa do CLI `gh` + um token GitHub
(`GH_TOKEN`)** com escopo de merge no repo, além de `HDD_REPO_SLUG`. A API é
internet-facing (atrás do Caddy) — portanto **um comprometimento da API expõe um
token capaz de mergear PRs**. Isto é mais superfície do que a Opção B (onde o token
de merge ficaria só no worker, não exposto).

**Mitigações esperadas (a aplicar na Story 6.9, deploy):** token de escopo mínimo
(apenas o repo-alvo, permissão de merge), via secret do Swarm (não em env logável);
a API já é fail-closed por OAuth+allowlist (só logins autorizados decidem gates).

**Pendências para a Story 6.9 (deploy):** adicionar `gh` à imagem `api`; expor
`GH_TOKEN`/`HDD_REPO_SLUG` ao serviço `api` no `stack.yaml`. Sem `repo_slug`
configurado, o merge é no-op (comportamento de dev preservado).
