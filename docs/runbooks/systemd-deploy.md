# Runbook — Deploy do hdd-worker via systemd

Story 1.c.1 (AR-020, NFR-P1, D-04.14). Supervisão por systemd `Type=simple` +
`/healthz` polling (o Bun não suporta `sd_notify`).

## Pré-requisitos (host)

- Bun 1.3.14 + docker (sandbox).
- User dedicado `hdd-worker` (provisioning completo + 0600 → Story 1.c.2).
- **Sandbox image pre-pulled** (fail-closed no boot — Q-C1-4):
  ```bash
  bash scripts/prepull-sandbox-image.sh   # constrói hdd-sandbox:0.0.1
  ```

## 1. Build do binário (D-04.15 — compilado, não interpretado)

```bash
bun run build        # bun build --compile src/cli/hdd-worker.ts → dist/hdd-worker
install -m 0755 dist/hdd-worker /opt/hdd/dist/hdd-worker
```

## 2. Secrets (EnvironmentFile)

```bash
install -d -m 0750 -o hdd-worker -g hdd-worker /etc/hdd
install -o hdd-worker -g hdd-worker -m 0600 \
  systemd/hdd-worker.env.example /etc/hdd/secrets.env
# editar /etc/hdd/secrets.env → ANTHROPIC_API_KEY=... PORT=8080
```

## 3. Instalar a unit

```bash
install -m 0644 systemd/hdd-worker.service /etc/systemd/system/hdd-worker.service
systemctl daemon-reload
systemctl enable --now hdd-worker
```

`ExecStartPost` faz poll a `http://localhost:${PORT}/healthz` até responder — a
unit só fica `active` quando o `/healthz` devolve 200 (NFR-P1 ≤30s).

## 4. Verificar

```bash
systemctl status hdd-worker          # active (running)
curl -s http://localhost:8080/healthz   # {"status":"ok","uptime":<s>}
journalctl -u hdd-worker -f          # logs
```

## 5. Supervisão externa (AC4 — depende de E3, ainda não implementado)

- **Healthchecks.io:** criar check com período 15min + grace 60s; configurar um
  poll ao `/healthz` (cron/uptime-agent) que faz ping ao check URL enquanto 200.
- **Alerta WhatsApp `hdd_heartbeat`:** quando o canal WhatsApp (E3) existir,
  ligar o webhook do Healthchecks.io ao template Meta `hdd_heartbeat` (heartbeat
  proactivo 4h + alerta em flap). **Até lá**, configurar o alerta nativo do
  Healthchecks.io (email/Slack) como stop-gap.

## Troubleshooting

| Sintoma | Causa provável | Acção |
|---|---|---|
| `start` falha `sandbox image missing` | image não pre-pulled | `bash scripts/prepull-sandbox-image.sh` |
| `ANTHROPIC_API_KEY required` | secrets.env vazio/ausente | preencher `/etc/hdd/secrets.env` |
| unit fica `activating` (ExecStartPost) | `/healthz` não responde | `journalctl -u hdd-worker`; confirmar `PORT` |
| flap (restart loop) | erro no boot | `journalctl`; `RestartSec=5` dá backoff |

## Notas

- `litestream run --` (backup) entra na **Story 1.c.3** — nessa altura o
  `ExecStart` passa a `litestream run -- /opt/hdd/dist/hdd-worker start`.
- Deploy é **manual** v1 (ssh + git pull + rebuild + restart) — sem auto-deploy
  (D-04.11'); SSH restrito é a **Story 1.c.5**.
