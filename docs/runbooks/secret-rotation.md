# Runbook — Gestão e rotação de secrets

Story 1.c.2 (NFR-S1, AR-019, D-04.6'). Secrets vivem em `/etc/hdd/secrets.env`
(systemd `EnvironmentFile`), **nunca no workspace/repo**, perm `0600`, owner
`hdd-worker`.

| Var | Obrigatório | Usado por |
|---|---|---|
| `ANTHROPIC_API_KEY` | sim | LLM adapters (1.a.10) |
| `CLIHELPER_TOKEN` | sim (Q-C2-1) | cliente clihelper outbound (Epic 3) |
| `PORT` | não (default 8080) | `/healthz` (1.c.1) |

## Sintoma

- Rotação **planeada** (política periódica) ou **de emergência** (chave
  comprometida/exposta — ver `[[ban-anthropic-emergency]]`).
- Boot falha com `CLIHELPER_TOKEN required` ou `ANTHROPIC_API_KEY` ausente.
- `ExecStartPre` recusa arrancar (perm ≠ 0600).

## Diagnóstico

```bash
systemctl status hdd-worker
stat -c %a /etc/hdd/secrets.env          # tem de ser 600 (ou 400)
journalctl -u hdd-worker --since "10 min ago" | grep -iE "required|secrets|ExecStartPre"
```

## Passos de Recuperação

**Pré-requisito de host (uma vez)** — user dedicado (NÃO criado pelo script, Q-C2-3):
```bash
useradd --system --no-create-home --shell /usr/sbin/nologin hdd-worker
```

**Instalar / actualizar / rodar um secret:**
```bash
cp systemd/hdd-worker.env.example /tmp/secrets.env
chmod 600 /tmp/secrets.env
$EDITOR /tmp/secrets.env            # preencher/actualizar ANTHROPIC_API_KEY + CLIHELPER_TOKEN
sudo bash scripts/install-secrets.sh /tmp/secrets.env   # instala 0600 + verifica
shred -u /tmp/secrets.env           # apagar a cópia temporária
sudo systemctl restart hdd-worker
```

Para **rotação**: gerar a nova credencial no provider → editar → `install-secrets.sh`
→ `restart` → **só depois** revogar a antiga no provider (após confirmar o restart).

## Verificação

```bash
systemctl status hdd-worker          # active após restart
stat -c %a /etc/hdd/secrets.env      # 600
# /healthz responde 200 (ver nota sobre curl no harness; usar do shell do operador)
```
**Garantias:** redaction (1.b.3) cobre `sk-ant-`/Bearer/`(token|secret|password|api_key)=…`
→ secrets redigidos no audit/log (testado). `.gitignore` cobre `*.env` (excepto
`*.example`) — confirmar com `git status` antes de qualquer commit.

## Post-mortem

- **Timeline:** motivo da rotação (planeada/comprometida) → instalação → revogação.
- **Causa-raiz:** se de emergência — como foi exposta a chave? (log? commit? screen-share?)
- **Prevenção:** rotação periódica; `0600` sempre; redaction; `.gitignore`; nunca
  ecoar secrets (sem `set -x`). Troubleshooting: perm≠600 → `chmod 600`; token
  ausente → preencher + restart; origem laxa → `chmod 600` na origem.
