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
