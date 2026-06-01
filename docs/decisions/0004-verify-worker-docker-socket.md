# 0004 — Verify a partir do worker em produção: socket do Docker (Story 6.9)

**Data:** 2026-06-01 · **Status:** ✅ Aceito (MVP) · **Decisão do operador.**

## Contexto

O nó `verify` (Story 6.3) roda a suíte de testes da onda via `SandboxRunner`, que
faz `docker run` de uma imagem endurecida (`--network none`, FS read-only, sem
credenciais). Em produção o `verify` roda **a partir do container `worker`**, que
não tinha o CLI `docker` nem acesso ao daemon — logo falhava.

O sandbox é necessário (não dá para rodar a suíte direto no worker): o `execute`
(ADR [[0002]]) já escreve o código da onda no workspace do worker; rodar os testes
desse código **dentro do worker** exporia os tokens (claude/gh) e a rede (Postgres)
a código não-confiável. O sandbox (`--network none`, sem credenciais) contém isso.

## Opções consideradas

- **A — montar `/var/run/docker.sock` no worker** (escolhida). + CLI `docker` na
  imagem. O worker faz `docker run` do sandbox no daemon do host. Simples.
- **B — `docker-socket-proxy` sidecar.** Expõe ao worker só `create/run`; menor
  blast radius. Custo: mais um serviço + allowlist do proxy. Recusada no MVP.

## Decisão

Opção **A**. Implementado em:
- `backend/Dockerfile` (worker): CLI `docker` (binário estático) + (api) `gh` (merge, ADR [[0003]]).
- `stack.yaml` (worker): bind do socket; `group_add: [${HDD_DOCKER_GID}]` dá ao uid
  10001 acesso ao socket sem rodar como root; env da malha 6.x; bind do
  `HDD_WORKSPACE_ROOT`. (api): `GH_TOKEN` + `HDD_REPO_SLUG`.

### Subtileza crítica — caminho do workspace host↔worker

`docker run -v <ws>:/workspace` é resolvido pelo **daemon do HOST**, não pelo FS do
worker. Se o workspace viver só dentro do container do worker, o mount aponta para
o vazio. Por isso `HDD_WORKSPACE_ROOT` é um **caminho do host** (`/var/lib/hdd-
workspaces`) **bind-montado no worker no MESMO path** — assim worker e daemon
concordam. (Default antigo `/tmp` do container NÃO serve.)

## ⚠️ Trade-off de segurança (aceito)

**O socket do Docker = controle total do daemon = root-equivalente no host.** Um
comprometimento do worker (que roda `claude -p` + código não-confiável da onda)
permite escapar para o host. É a maior exposição do MVP.

**Mitigações em vigor:** o `claude` do execute tem Bash/WebFetch bloqueados (ADR
0002); o sandbox de verify roda `--network none` sem credenciais; o worker está na
rede interna `backend` (sem ingress). **Mitigação pendente / evolução:** Opção B
(socket-proxy) ou runtime rootless (sysbox/DinD) se o HDD operar tarefas não-
confiáveis de terceiros. Aceitável no dogfood single-operator.

## Validação

Artefatos preparados; **a validação ocorre no deploy real (Story 6.4)** — não é
testável neste ambiente (sem o nó Swarm/host). Pré-requisitos no runbook de deploy.
