# Postura de segurança do HDD

Documento vivo. Lista os **riscos aceites no MVP** (com gatilho/data de revisão
para não virarem dívida permanente), a política de segredos e os invariantes que
não podem ser violados sem reavaliação explícita.

> Regra: todo risco aceite tem um **gatilho** (condição que obriga a revisitar) e
> uma **data-limite** de revisão. Se a data chegar sem o gatilho, revisita-se
> mesmo assim (evita o apodrecimento de "benefícios otimistas sem TTL").

## Riscos aceites (revisão obrigatória)

| # | Risco | ADR | Gatilho que obriga revisão | Revisão até |
|---|---|---|---|---|
| S-1 | **Contenção *soft* do execute** — `claude` roda no host com `cwd=workspace`; `Write` pode escrever fora do clone via path absoluto (não é jail). | [0002](decisions/0002-execucao-execute-host-cwd.md) | operar tarefas **não-confiáveis/de terceiros**; ou incidente de escrita fora do workspace | 2026-09-01 |
| S-2 | **Token de merge na API internet-facing** — a api ganha `gh`+`GH_TOKEN`; comprometê-la expõe um token capaz de mergear. | [0003](decisions/0003-merge-no-resume-na-api.md) | token deixar de ser fine-grained/repo-único; ou exposição da api | 2026-09-01 |
| S-3 | **Socket do Docker no worker** = root-equivalente no host (maior exposição do MVP). | [0004](decisions/0004-verify-worker-docker-socket.md) | operar tarefas não-confiáveis; multi-tenant; ou endurecimento de produção | 2026-09-01 |

**Mitigações já em vigor** (defesa em profundidade): `claude` com `Bash`/`WebFetch`
bloqueados no execute; sandbox de verify `--network none` sem credenciais; worker
sem ingress (rede interna); workspaces efêmeros e descartáveis; api fail-closed
(OAuth + allowlist). **Evoluções registadas:** execute em sandbox real (S-1),
opção worker-merge (S-2), socket-proxy/runtime rootless (S-3).

## Política de segredos

- Segredos do `Settings` → Docker secrets `hdd_<campo>` em `/run/secrets` (nunca
  env, nunca log — redaction no structlog). Ver [runbook de secrets](runbooks/secrets.md).
- Tokens de runtime dos CLIs (`claude`/`gh`) → secrets `hdd_claude_oauth_token` /
  `hdd_gh_token`, exportados pelo `docker-entrypoint.sh` (não env → não vazam em
  `docker inspect`).
- `hdd_gh_token`: **PAT fine-grained, só o repo-alvo, permissão de merge** — nunca
  um token de conta amplo (a api é internet-facing).

## Invariantes (não violar sem reavaliação)

1. **Nunca liberar `Bash` no execute sem wirar o `CapabilityBroker` + sandbox real.**
   Hoje o broker (Story 2.4) está não-wirado porque `Bash`/`WebFetch` estão
   bloqueados no modo workspace (`WORKSPACE_DISALLOWED`). Se algum dia o execute
   precisar de `Bash`, ele deixa de ser contido por bloqueio total → o broker
   determinístico (classificação de comandos destrutivos → gate) passa a ser
   **obrigatório**, junto de execução em sandbox isolado. Guarda em CI:
   `tests/unit/test_security_invariants.py`.
2. **Nunca logar `Settings` cru** — só campos individuais não-sensíveis.
3. **Gates não auto-aprovam** — timeout → EXPIRED, decisão fica pendente (RF-03b).
