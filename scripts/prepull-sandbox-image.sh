#!/usr/bin/env bash
# prepull-sandbox-image.sh — build + verifica a sandbox image (Story 1.b.4, AC2).
#
# Idempotente: re-build é barato (layers cached). O boot do worker exige esta
# image presente (checkSandboxImageSync → fail-closed se ausente).
set -euo pipefail

IMAGE="hdd-sandbox:0.0.1"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../docker/sandbox" && pwd)"

echo "→ Building ${IMAGE} from ${DIR}/Dockerfile ..."
docker build -t "${IMAGE}" "${DIR}"

echo "→ Verifying image is present ..."
docker image inspect "${IMAGE}" >/dev/null

echo "✓ ${IMAGE} pronto (pre-pulled)."
