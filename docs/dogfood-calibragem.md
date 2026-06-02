# Repo-alvo de calibração (Story 7.3)

A Fase 1 do dogfood (Epic 7) roda contra um **repo-alvo separado**, de baixo risco,
antes do meta-dogfood. Aqui se registra esse alvo e como configurar as ondas.

## O alvo

- **Repo:** [`paulotodo/hdd-calibragem`](https://github.com/paulotodo/hdd-calibragem) (privado).
- **Domínio:** utilitários do Brasil (CPF/CNPJ/CEP/telefone/PIX/data/moeda) — funções
  puras, determinísticas, sem I/O/rede/dependências. Ver `BACKLOG.md` do próprio repo.
- **Por quê:** cada feature do backlog é uma onda autônoma e bem-delimitada; os testes
  (válidos + inválidos) dão sinal forte e real ao nó `verify`; nada toca produção.
- **Baseline:** `calibragem.cpf` implementado e verde (9 testes) — prova que a suíte
  produz sinal. As demais features serão construídas **pelo HDD** (uma por onda), com
  **gate humano no merge**.

## Configuração das ondas de calibração

| Setting (env) | Valor |
|---|---|
| `HDD_REPO_URL` | `https://github.com/paulotodo/hdd-calibragem` |
| `HDD_VERIFY_COMMAND` | `pytest -q` |
| `HDD_SANDBOX_IMAGE` | imagem com **Python + pytest** (ver nota abaixo) |

> ⚠️ **Sandbox sem rede.** O nó `verify` roda o sandbox com `--network none` (Story 6.3),
> então **não há `pip install` em runtime**. Duas consequências:
> 1. a imagem do sandbox precisa **já conter `pytest`**;
> 2. o pacote usa `pythonpath = ["src"]` no `pyproject.toml`, então `pytest -q` importa
>    `calibragem` **sem instalar o pacote** — basta o `pytest` estar presente.
>
> Se a imagem padrão do sandbox não tiver `pytest`, isso vira um ajuste de configuração
> na Story 7.4 (imagem dedicada de calibração) — registrar como gap se aparecer.

## Validado na 7.3

- Repo criado e populado (baseline + backlog + README).
- Clonável pelo token do bot (conta `paulotodo`, mesmo dono).
- `pytest -q` verde no clone (9 testes) → sinal real para o `verify`.

O fluxo completo `clone → claude → verify → PR → gate → merge` (6.6→6.8) será
**exercido de verdade na Story 7.4** (primeira onda: feature trivial do backlog).

## Driver de calibração

`backend/scripts/calibration_wave.py` dirige uma onda real no host (sem subir o
stack): `run "<tarefa>"` (enfileira → worker → para no gate), `approve <wave_id>`
(resume → merge — o ponto humano da hipótese H-A), `status <wave_id>` (gaps/métricas).
Lê a config das ondas do env (`.env` em `backend/`, gitignored).

## Resultado — Onda 1 (Story 7.4, 2026-06-02): `cep`

**Tarefa:** implementar `calibragem.cep` (validate/format) com testes. **Modelo:** haiku.

- ✅ **Sucesso autônomo** (H-A): `reached_gate=1`, **0 correções**. O `claude` implementou
  `cep.py` + `tests/test_cep.py` + export; o `verify` (pytest real no sandbox) passou;
  PR #1 aberto; aprovado no gate → **merge real** (squash) na `main` do calibragem.
- ✅ Encanamento `clone → claude → verify → PR → gate → resume → merge` validado ponta a
  ponta. Zero lease vazado, workspace efêmero limpo, audit com `wave.started`/`gate.approved`.
- ✅ Harness (7.1) e loop de gaps (7.2) provados em condição real (ver achados).

**Achados de calibração (a 1ª tentativa falhou e o dogfood expôs gaps reais):**
1. **Timeout do `claude -p` curto (120s).** O claude é um agente completo (lê o repo,
   planeja, edita) — 120s não basta. **Ajuste:** timeout configurável `HDD_CLAUDE_TIMEOUT_S`
   (default **600s**). Re-rodada → sucesso.
2. **Sandbox sem pytest** (previsto na 7.3). **Ajuste:** `sandbox/Dockerfile` estendido com
   python3+pytest (serve calibração e o futuro meta-dogfood Python).
3. **Gap raiz (já no backlog):** `retry.decide` não está wirado → o `TransientError` de
   timeout não vira RETRY, mata a onda. Reforça o candidato a meta-onda de resiliência.
