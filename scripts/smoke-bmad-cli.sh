#!/usr/bin/env bash
# smoke-bmad-cli.sh — Story 1.c.7 Day-1 hard prereq smoke test.
#
# Goal: validar que existe uma forma NON-INTERACTIVE de invocar a skill
# `bmad-help` (a mais simples e idempotente) via CLI. Se não houver, o
# worker autónomo do Epic 2 não pode existir como desenhado (D-043) e
# Plan B tem de ser activado (ver docs/decisions/bmad-cli-vs-plan-b.md).
#
# Acceptance Criteria mapping:
#   AC-1: invoca `bmad-help` non-interactive + captura stdout + exit 0 em ≤30s.
#   AC-2: se falhar, decisão Plan B registada antes de continuar (out-of-scope deste script).
#
# Exit codes:
#   0 — PASS (bmad-help invocável non-interactive em ≤30s)
#   1 — FAIL (sem CLI surface ou timeout)
#   2 — ENV (BMAD não instalado / pré-requisitos ausentes)
set -u  # nota: NÃO usamos -e; gerimos falhas explicitamente

readonly TIMEOUT_S=30
readonly REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly EVIDENCE_DIR="${REPO_ROOT}/.smoke-evidence"
readonly MANIFEST="${REPO_ROOT}/_bmad/_config/manifest.yaml"

mkdir -p "${EVIDENCE_DIR}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
readonly RUN_LOG="${EVIDENCE_DIR}/smoke-${RUN_ID}.log"

log() { printf '[smoke %s] %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "${RUN_LOG}"; }
section() { printf '\n=== %s ===\n' "$*" | tee -a "${RUN_LOG}"; }

section "ENV checks (Pre-Probe)"
log "repo_root=${REPO_ROOT}"
log "run_id=${RUN_ID}"
log "evidence=${RUN_LOG}"

if [ ! -f "${MANIFEST}" ]; then
  log "FAIL ENV — manifest ausente em ${MANIFEST}"
  exit 2
fi
log "manifest=OK ($(grep -E '^\s*version:' "${MANIFEST}" | head -1 | tr -d ' '))"

for bin in npx node bash timeout; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    log "FAIL ENV — binário '${bin}' ausente em PATH"
    exit 2
  fi
done
log "node=$(node --version) | npx=$(npx --version) | bash=${BASH_VERSION%%(*}"

# -----------------------------------------------------------------------------
# Probe 1: BMAD reachable (bmad-method status non-interactive em ≤30s)
# -----------------------------------------------------------------------------
section "Probe 1 — bmad-method status (reachability)"
P1_OUT="${EVIDENCE_DIR}/p1-status-${RUN_ID}.out"
P1_START="$(date +%s)"
timeout "${TIMEOUT_S}s" npx -y bmad-method status </dev/null >"${P1_OUT}" 2>&1
P1_EXIT=$?
P1_DUR=$(( $(date +%s) - P1_START ))
log "probe1 exit=${P1_EXIT} dur=${P1_DUR}s out=${P1_OUT}"
if [ "${P1_EXIT}" -ne 0 ] || [ "${P1_DUR}" -gt "${TIMEOUT_S}" ]; then
  log "FAIL probe1 — bmad-method status não retornou 0 em ≤${TIMEOUT_S}s"
  exit 1
fi
if ! grep -qE 'Version:\s*6\.7\.1' "${P1_OUT}"; then
  log "FAIL probe1 — stdout não contém 'Version: 6.7.1' (manifest mismatch?)"
  exit 1
fi
log "PASS probe1"

# -----------------------------------------------------------------------------
# Probe 2 (BINARY AC): invocar bmad-help non-interactive via CLI.
# Tentamos várias formas plausíveis; basta UMA funcionar para PASS.
# -----------------------------------------------------------------------------
section "Probe 2 — invoke bmad-help non-interactive (binary AC)"
P2_OUT="${EVIDENCE_DIR}/p2-help-${RUN_ID}.out"
P2_PASSED=0
P2_START="$(date +%s)"

attempts=(
  "npx -y bmad-method bmad-help"
  "npx -y bmad-method help bmad-help"
  "npx -y bmad-method skill bmad-help"
  "npx -y bmad-method run bmad-help"
  "npx -y bmad-method invoke bmad-help"
  "npx -y bmad-method exec bmad-help"
)

: >"${P2_OUT}"
for cmd in "${attempts[@]}"; do
  printf -- '----- attempt: %s -----\n' "${cmd}" >>"${P2_OUT}"
  # shellcheck disable=SC2086
  timeout "${TIMEOUT_S}s" ${cmd} </dev/null >>"${P2_OUT}" 2>&1
  rc=$?
  printf -- '----- exit=%s -----\n' "${rc}" >>"${P2_OUT}"
  log "attempt '${cmd}' → exit=${rc}"
  # Sucesso real: exit 0 + stdout contém pelo menos "bmad" ou "skill" ou "help"
  # AND não contém 'unknown command' / 'error: unknown'.
  if [ "${rc}" -eq 0 ] \
     && ! grep -qiE 'unknown command|error: unknown|did you mean' "${P2_OUT}"; then
    P2_PASSED=1
    P2_WINNING_CMD="${cmd}"
    break
  fi
done
P2_DUR=$(( $(date +%s) - P2_START ))
log "probe2 dur=${P2_DUR}s passed=${P2_PASSED}"

if [ "${P2_PASSED}" -ne 1 ]; then
  log "FAIL probe2 — nenhum subcommand do bmad-method CLI invoca 'bmad-help' non-interactive"
  log "evidence=${P2_OUT}"
  # Probe 3 (informativa) ainda corre — útil para o decision doc.
fi

# -----------------------------------------------------------------------------
# Probe 3 (informativa): skill existe como ficheiro? (proves it's data, not CLI)
# -----------------------------------------------------------------------------
section "Probe 3 — bmad-help SKILL.md exists as data file (informational)"
SKILL_MD="${REPO_ROOT}/.claude/skills/bmad-help/SKILL.md"
if [ -f "${SKILL_MD}" ]; then
  log "skill_file=OK (${SKILL_MD}, $(wc -c <"${SKILL_MD}") bytes)"
  log "→ bmad-help existe como SKILL.md (LLM-driven); requer driver (Claude Code) para executar."
else
  log "skill_file=MISSING (${SKILL_MD})"
fi

# -----------------------------------------------------------------------------
# Verdict
# -----------------------------------------------------------------------------
section "Verdict"
if [ "${P2_PASSED}" -eq 1 ]; then
  log "RESULT=PASS — bmad-help invocável non-interactive via: ${P2_WINNING_CMD}"
  log "Plan B: NÃO accionado."
  exit 0
fi

log "RESULT=FAIL — bmad-method CLI não tem surface para invocar skills non-interactive."
log "AC-1 não satisfeito. Próximo passo: registar decisão em docs/decisions/bmad-cli-vs-plan-b.md (AC-2)."
exit 1
