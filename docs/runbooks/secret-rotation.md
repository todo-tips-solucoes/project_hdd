# Runbook — Gestão e rotação de secrets

Story 1.c.2 (NFR-S1, AR-019, D-04.6'). Secrets vivem em `/etc/hdd/secrets.env`
(systemd `EnvironmentFile`), **nunca no workspace/repo**, perm `0600`, owner
`hdd-worker`.

## Secrets actuais

| Var | Obrigatório | Usado por |
|---|---|---|
| `ANTHROPIC_API_KEY` | sim | LLM adapters (1.a.10) |
| `CLIHELPER_TOKEN` | sim (Q-C2-1) | cliente clihelper outbound (Epic 3) |
| `PORT` | não (default 8080) | `/healthz` (1.c.1) |

## Pré-requisito de host (uma vez)

```bash
# user dedicado não-privilegiado (NÃO criado pelo install-secrets.sh — Q-C2-3)
useradd --system --no-create-home --shell /usr/sbin/nologin hdd-worker
```

## Instalar / actualizar secrets

```bash
cp systemd/hdd-worker.env.example /tmp/secrets.env
chmod 600 /tmp/secrets.env
$EDITOR /tmp/secrets.env            # preencher ANTHROPIC_API_KEY + CLIHELPER_TOKEN
sudo bash scripts/install-secrets.sh /tmp/secrets.env   # instala 0600 + verifica
shred -u /tmp/secrets.env           # apagar a cópia temporária
sudo systemctl restart hdd-worker
```

O `ExecStartPre` da unit recusa arrancar se `/etc/hdd/secrets.env` não for
`0600` (gate de permissão). Em código, `checkSecretsFilePerms` espelha a regra
(rejeita se group/world acessível).

## Rotação de um secret

1. Gerar a nova credencial no provider (Anthropic console / clihelper).
2. Editar `/tmp/secrets.env` com o **novo** valor → `install-secrets.sh` → `restart`.
3. Confirmar saúde: `systemctl status hdd-worker` + `/healthz` 200.
4. **Revogar** a credencial antiga no provider só após confirmar o restart OK.

## Garantias

- **Nunca no audit/log:** a redaction (Story 1.b.3) cobre `sk-ant-`, Bearer e
  `(token|secret|password|api_key)=…` → `CLIHELPER_TOKEN`/`ANTHROPIC_API_KEY`
  são redigidos antes do write no JSONL. Confirmado por teste.
- **Nunca no repo:** `.gitignore` cobre `*.env` (excepto `*.example`). Verificar
  antes de qualquer commit (`git status`).
- **Perm restrita:** `0600` (ou `0400` read-only) — group/world sem acesso.

## Troubleshooting

| Sintoma | Causa | Acção |
|---|---|---|
| unit não arranca, `ExecStartPre` falha | perm ≠ 0600 | `chmod 600 /etc/hdd/secrets.env` |
| `CLIHELPER_TOKEN required` no boot | token ausente no env file | preencher + restart |
| `install-secrets.sh` recusa origem | origem com perm laxa | `chmod 600` no ficheiro de origem |
