# Runbook — Secrets & configuração (Story 5.4)

Como o HDD carrega configuração e segredos, qual o contrato em produção
(Docker Swarm) e como garantimos que segredos **não vazam** em logs/audit.

## Fonte de configuração (`pydantic-settings`)

`backend/src/hdd/config/settings.py` usa `BaseSettings` com:

- `env_prefix = "HDD_"` — variáveis de ambiente têm prefixo `HDD_`.
- `env_file = ".env"` — em **dev**, valores vêm do `.env` (ver `.env.example`).
- Em **produção**, `get_settings()` detecta `/run/secrets` e instancia
  `Settings(_secrets_dir="/run/secrets")` — os segredos vêm de arquivos lá.

Precedência (maior → menor): argumentos explícitos → variáveis de ambiente →
`/run/secrets` → `.env` → defaults do modelo.

## ⚠️ Descoberta crítica: o `env_prefix` se aplica ao NOME do arquivo de secret

Confirmado empiricamente (Story 5.4): `SecretsSettingsSource` resolve o nome do
campo **com o prefixo**, igual à fonte de ambiente. Logo:

| Campo pydantic | Arquivo em `/run/secrets/` | Lido? |
|---|---|---|
| `pg_dsn` | `pg_dsn` | ❌ **não** |
| `pg_dsn` | `hdd_pg_dsn` | ✅ sim |
| `pg_dsn` | `HDD_pg_dsn` | ✅ sim (case-insensitive) |

> Por isso os Docker Swarm secrets se chamam `hdd_<campo>` — **não** `<campo>`.
> O `stack.yaml` (Story 5.1) declara os secrets com esses nomes; o Swarm os
> monta em `/run/secrets/hdd_<campo>`.

## Contrato de secrets (produção)

Campos sensíveis e o arquivo correspondente em `/run/secrets/`:

| Campo (`Settings`) | Arquivo de secret | Conteúdo |
|---|---|---|
| `pg_dsn` | `hdd_pg_dsn` | DSN Postgres (inclui senha) |
| `session_secret` | `hdd_session_secret` | chave de assinatura do cookie de sessão |
| `github_client_secret` | `hdd_github_client_secret` | OAuth GitHub (client secret) |
| `clihelper_token` | `hdd_clihelper_token` | token do clihelper (outbound WhatsApp) |
| `webhook_hmac_secret` | `hdd_webhook_hmac_secret` | HMAC do webhook n8n inbound |

Não-segredos (`github_client_id`, `github_allowlist`, `panel_base_url`,
`cors_origins`, `clihelper_base_url`, `llm_driver`, `model`, `log_level`,
`notifier_min_interval_s`) ficam em variáveis de ambiente do serviço — não em
secrets.

### Criar os secrets no Swarm

```bash
printf '%s' 'postgresql://hdd:SENHA@postgres:5432/hdd' | docker secret create hdd_pg_dsn -
openssl rand -hex 32 | docker secret create hdd_session_secret -
printf '%s' "$GITHUB_CLIENT_SECRET"  | docker secret create hdd_github_client_secret -
printf '%s' "$CLIHELPER_TOKEN"       | docker secret create hdd_clihelper_token -
openssl rand -hex 32 | docker secret create hdd_webhook_hmac_secret -
```

`printf '%s'` (sem `echo`) evita o `\n` final entrar no segredo.

## Garantia: segredos não aparecem em logs nem no audit

`backend/src/hdd/observability/logging.py` adiciona o processor
`redact_secrets` ao pipeline do structlog (antes do `JSONRenderer`). Ele:

1. **Mascara por nome de chave** qualquer campo cujo nome contenha
   `secret`/`password`/`credential`/`hmac`/`api_key`/`authorization`, termine em
   `_token`/`_dsn`, ou seja exatamente `token`/`dsn`/`cookie` — recursivamente em
   dicts/listas aninhados.
2. **Redige credenciais embutidas em URLs** (ex.: a senha em
   `postgresql://user:senha@host`) em qualquer valor string — cobre o caso de um
   DSN vazar dentro de uma mensagem de erro.

Telemetria não-sensível (`tokens_used`, `idempotency_key`, …) é preservada.
Cobertura em `tests/unit/test_observability.py`.

O **audit** (`audit.events`, hash-chain) já não carrega segredos por design (PII
pseudonimizada na Story 3.4); a redaction é defesa-em-profundidade na camada de
log. **Nunca** logar `Settings` cru — logar campos individuais não-sensíveis.
