# Definition of Done (DoD) do projeto HDD

DoD do projeto: vale para toda story, onda autônoma e decisão de agente. Ancorado em
**gates verificáveis**, não em convenção.

## Padrão de decisão dos agentes (diretriz do operador, 2026-06-02)

> Em toda decisão, os agentes do HDD — dev/QA/review (BMAD) **e** o worker `claude -p` —
> **recomendam por default a alternativa com melhor prática de desenvolvimento + segurança
> + escalabilidade**, com justificativa explícita nesses **3 eixos**. O **atalho** só é
> apresentado **com o custo declarado**; nunca como default silencioso.

Corolário: toda salvaguarda nasce como **gate verificável** (pré-flight em código, AC
testável, ADR), não como nota/convenção que depende de memória humana. Quando há um
escape-hatch, ele exige sinal explícito de custo declarado (ex.: `HDD_CALIB_SKIP_PREFLIGHT=1`
imprime aviso ruidoso antes de prosseguir — ver `docs/dogfood-calibragem.md`).

## DoD operacional (já vigente)

- **Tooling verde** antes de qualquer merge: `ruff check` · `mypy --strict` ·
  `lint-imports` (import-linter) · `pytest`.
- **Revisão humana obrigatória** no merge ([[feedback-hdd-mandatory-review]]); o gate humano
  dos 6 pontos RF-03b é inviolável.
- **Sem auto-deploy.** O HDD abre PR; merge exige gate humano; deploy é manual. O HDD nunca
  toca `compose.prod.yaml`, `secrets/` ou `deploy.env` autonomamente
  ([[project-hdd-prod-on-dev-machine]]).
- **Workspace efêmero** por onda (clone isolado, nunca a árvore de produção); dev isolado
  com `-p hdd_dev`, que sobe só durante a janela e desce depois.
- **Pré-condições de capacidade** das ondas de calibração/meta-dogfood enforçadas em código
  (correct-course OOM — `docs/decisions/0005-capacidade-e-cutover-vps-dedicada.md`).
- **Append-only** onde aplicável: migrations Alembic (`NNNN_descricao`), ADRs em
  `docs/decisions/`, audit hash-chain.
