# HDD sandbox image (Story 1.b.4 — AR-015, AO-47).
#
# Threat-model: executa código LLM-generated com o MENOR privilégio possível.
# A imagem em si é apenas uma base mínima; o isolamento forte vem das flags do
# `docker run` (--network=none, --cap-drop=ALL, --read-only, no-new-privileges)
# construídas em src/adapters/sandbox/docker-spawn.adapter.ts.
#
# Sem ferramentas de rede extra (curl/wget) — defesa em profundidade: mesmo que
# --network=none falhasse, não há cliente HTTP pré-instalado.
#
# Build/tag via scripts/prepull-sandbox-image.sh → hdd-sandbox:0.0.1
FROM alpine:3.20

# Corre como nobody:nogroup (65534) — nunca root. Reforçado por --user no run.
USER 65534:65534

WORKDIR /work

# SEM ENTRYPOINT: o comando real chega como `sh -c <script>` nos args do
# `docker run` (ver buildDockerArgs). Um ENTRYPOINT ["/bin/sh"] faria o exec
# tornar-se `/bin/sh sh -c ...` → erro "can't open 'sh'" (bug apanhado por
# teste de integração real, Story 1.b.4/retro Epic 1.b). A base alpine já tem
# /bin/sh; o `sh` dos args resolve via PATH.
