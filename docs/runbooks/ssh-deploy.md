# Runbook — SSH restricted deploy (Story 1.c.5)

**Objectivo:** o operador faz deploy via `ssh hdd-worker@vps deploy <sha>` sem
nunca obter shell livre na VPS, e cada deploy fica auditado na hash-chain
(`DeployCompleted` + commitSha). NFR-S6 / AR-112 / D-04.25.

---

## 1. Como funciona (forced command)

A SSH key do operador é instalada em `~hdd-worker/.ssh/authorized_keys` com a
restrição `command="/opt/hdd/scripts/deploy.sh"`. O sshd **ignora** o comando que
o cliente pede e corre SEMPRE o `deploy.sh`; o comando original chega-lhe em
`$SSH_ORIGINAL_COMMAND`. Resultado: a key só serve para deploy — não há shell.

```
command="/opt/hdd/scripts/deploy.sh",no-pty,no-port-forwarding,no-X11-forwarding,no-agent-forwarding ssh-ed25519 AAAA... operador-deploy
```

O `deploy.sh` valida `$SSH_ORIGINAL_COMMAND`: só aceita `deploy <sha>` com o sha
em `^[0-9a-f]{7,40}$` (fronteira anti command-injection). Qualquer outra coisa →
exit 2, sem efeito.

---

## 2. Gerar e instalar a key (uma vez, por host)

No **cliente** (máquina do operador):
```bash
ssh-keygen -t ed25519 -f ~/.ssh/hdd-deploy -C operador-deploy
# copiar ~/.ssh/hdd-deploy.pub para a VPS (scp/console)
```

Na **VPS** (como root ou via sudo; o user hdd-worker já tem de existir — host setup):
```bash
/opt/hdd/scripts/install-authorized-keys.sh /caminho/para/hdd-deploy.pub
```
O script: valida a pubkey (`ssh-keygen -l`), instala a linha forced-command,
garante `~/.ssh` 0700 + `authorized_keys` 0600 (owner hdd-worker), e é
**idempotente** (não duplica a mesma key). NÃO cria o user.

Config do cliente (`~/.ssh/config`):
```
Host hdd-vps
  HostName <ip-da-vps>
  User hdd-worker
  IdentityFile ~/.ssh/hdd-deploy
```

---

## 3. Fazer um deploy

```bash
ssh hdd-vps deploy 1a2b3c4
```

O `deploy.sh` (em `/opt/hdd`, conforme Q-C5-2):
1. `git fetch origin` + `git checkout <sha>`
2. `bun build --compile src/cli/hdd-worker.ts --outfile dist/hdd-worker`
3. `systemctl restart hdd-worker.service`
4. `bun run scripts/audit-deploy.ts <sha>` → regista `DeployCompleted`

O `<sha>` vem tipicamente de um run verde do CI / artifact do `release.yml`
(Story 1.c.4). Deploy é **forward-only**; para reverter ver `manual-rollback`
(runbook 1.c.6) — re-deploy de um sha anterior.

**Pré-requisitos na VPS:** `bun` instalado (o deploy recompila), `git`,
`systemctl` com permissão para reiniciar a unit, e a DB/audit nos paths default
(`/opt/hdd/.hdd-state.db`, `/opt/hdd/_bmad-output/audit`).

---

## 4. Verificar o audit do deploy

```bash
# o evento mais recente na chain de hoje:
tail -n1 /opt/hdd/_bmad-output/audit/projeto_hdd/$(date -u +%F).jsonl
# → {"type":"DeployCompleted","run_id":"deploy-1a2b3c4","payload":{"commitSha":"1a2b3c4"},...}

# integridade da chain (não foi adulterada):
cd /opt/hdd && bun run src/db/cli/... verify   # ou o verificador de chain do worker
```

O `audit-deploy.ts` usa o **mesmo** DB + baseDir que o worker (alinhamento de
path — senão criaria uma chain paralela e o evento não apareceria na oficial).
`run_id` = `deploy-<sha>` (Q-C5-4) correlaciona o evento com o commit.

---

## 5. Troubleshooting

| Sintoma | Causa provável | Acção |
|---|---|---|
| `ssh` abre prompt / shell | key sem forced command | re-correr `install-authorized-keys.sh` |
| `rejeitado: apenas 'deploy <sha>'` | comando ≠ `deploy <sha>` | usar a sintaxe exacta `ssh hdd-vps deploy <sha>` |
| `rejeitado: sha inválido` | sha não-hex ou tamanho errado | passar o SHA do commit (7-40 hex) |
| deploy corre mas sem audit | bun ausente / DB path divergente | instalar bun; alinhar `HDD_DB_PATH` com o worker |
| `RunIdMissing` no audit | (não deve ocorrer) audit-deploy passa runId explícito | verificar scripts/audit-deploy.ts |
| `Permission denied` no restart | hdd-worker sem sudo p/ systemctl | configurar polkit/sudoers para a unit (host setup) |
