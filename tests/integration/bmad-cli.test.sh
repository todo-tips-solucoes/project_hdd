#!/usr/bin/env bash
# bmad-cli.test.sh — Integration test wrapper for scripts/smoke-bmad-cli.sh.
#
# Purpose: runs as part of CI (Story 1.c.4) and guards against regression in
# the bmad-method CLI smoke surface (Story 1.c.7 invariant + D-052 Opção A).
#
# Difference vs. the smoke script:
#   * Smoke = one-shot manual diagnostic, exits 0/1/2 based on probe outcomes.
#   * This test = TAP-ish output, asserts on captured evidence, ALWAYS exits 0
#     unless an actual regression occurred.
#
# Expected baseline (per D-052, 2026-05-28):
#   * Probe 1 PASS: bmad-method status returns 0, manifest reports v6.7.1.
#   * Probe 2 FAIL: bmad-method CLI has no skill-invocation surface
#     (this is the BASELINE — if it ever starts PASSING, that means upstream
#     BMAD added a skill runner and Story 2.2 / D-052 should be revisited).
#   * Probe 3 OK:   bmad-help SKILL.md exists as data file.
#
# Regression triggers (exit 1):
#   R1. Probe 1 fails  → BMAD installer regression OR manifest version drifted.
#   R2. Probe 3 fails  → bmad-help skill removed from .claude/skills/.
#   R3. Probe 2 PASSES → upstream BMAD added skill runner; revisit D-052.
#
# Note: assertion R3 is intentional — a silent PASS would mask a stack-relevant
# upstream change. The test author MUST update this file (and re-open D-052)
# when that happens.

set -u

readonly REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
readonly SMOKE="${REPO_ROOT}/scripts/smoke-bmad-cli.sh"
readonly EXPECTED_BMAD_VERSION="6.7.1"
readonly EXPECTED_PROBE2_BASELINE="FAIL"  # baseline per D-052; PASS = regression

tap_n=0
tap_fail=0
ok()      { tap_n=$((tap_n+1)); printf 'ok %d - %s\n' "${tap_n}" "$*"; }
not_ok()  { tap_n=$((tap_n+1)); tap_fail=$((tap_fail+1)); printf 'not ok %d - %s\n' "${tap_n}" "$*"; }
diag()    { printf '# %s\n' "$*"; }

printf 'TAP version 13\n'
diag "bmad-cli integration test — baseline per D-052 (2026-05-28)"
diag "repo_root=${REPO_ROOT}"

# --- Pre-condition: smoke script present and executable ----------------------
if [ ! -x "${SMOKE}" ]; then
  not_ok "smoke script executable at ${SMOKE}"
  printf '1..%d\n' "${tap_n}"
  exit 1
fi
ok "smoke script executable at scripts/smoke-bmad-cli.sh"

# --- Run smoke; capture exit + last log file --------------------------------
SMOKE_OUT="$(mktemp)"
trap 'rm -f "${SMOKE_OUT}"' EXIT

bash "${SMOKE}" >"${SMOKE_OUT}" 2>&1
SMOKE_EXIT=$?
diag "smoke exit=${SMOKE_EXIT}"

# Re-derive baseline expectation: smoke exits 0 only if Probe 2 PASSES (i.e.
# upstream added a runner). Per D-052 baseline, smoke MUST exit 1 (Probe 2
# FAIL) and Probe 1 + Probe 3 must pass.

# --- Assertions --------------------------------------------------------------

# A1: Probe 1 (reachability) must PASS
if grep -q '^\[smoke .*\] PASS probe1' "${SMOKE_OUT}"; then
  ok "Probe 1 PASS — bmad-method status reachable"
else
  not_ok "Probe 1 FAIL — bmad-method status unreachable (R1 regression)"
  diag "evidence:"
  grep -E 'probe1|manifest|FAIL ENV' "${SMOKE_OUT}" | sed 's/^/#   /'
fi

# A2: manifest version matches expected (currently 6.7.1)
if grep -qE "manifest=OK \(version:${EXPECTED_BMAD_VERSION}\)" "${SMOKE_OUT}"; then
  ok "BMAD version matches expected ${EXPECTED_BMAD_VERSION}"
else
  not_ok "BMAD version mismatch — expected ${EXPECTED_BMAD_VERSION}"
  diag "evidence:"
  grep -E 'manifest=' "${SMOKE_OUT}" | sed 's/^/#   /'
fi

# A3: Probe 3 (skill file present) — informational, but FAIL is a regression
if grep -qE 'skill_file=OK' "${SMOKE_OUT}"; then
  ok "Probe 3 OK — bmad-help SKILL.md present"
else
  not_ok "Probe 3 FAIL — bmad-help SKILL.md missing (R2 regression)"
fi

# A4: Probe 2 baseline — must match expected (currently FAIL per D-052)
if [ "${EXPECTED_PROBE2_BASELINE}" = "FAIL" ]; then
  if grep -qE 'FAIL probe2' "${SMOKE_OUT}"; then
    ok "Probe 2 baseline FAIL preserved (D-052 still valid)"
  else
    not_ok "Probe 2 unexpectedly PASSED — upstream BMAD changed; revisit D-052 (R3)"
    diag "If upstream added skill runner, update EXPECTED_PROBE2_BASELINE=PASS and"
    diag "re-evaluate Opção A vs native bmad-method invocation in Story 2.2."
  fi
else  # baseline PASS — future state after upstream adds runner
  if grep -qE 'RESULT=PASS' "${SMOKE_OUT}"; then
    ok "Probe 2 baseline PASS preserved (upstream runner working)"
  else
    not_ok "Probe 2 unexpectedly FAILED after baseline=PASS (upstream regressed)"
  fi
fi

# A5: smoke exit matches baseline expectation
if [ "${EXPECTED_PROBE2_BASELINE}" = "FAIL" ]; then
  if [ "${SMOKE_EXIT}" -eq 1 ]; then
    ok "smoke exit=1 matches baseline (Probe 2 FAIL expected)"
  else
    not_ok "smoke exit=${SMOKE_EXIT} but baseline expects exit=1"
  fi
else
  if [ "${SMOKE_EXIT}" -eq 0 ]; then
    ok "smoke exit=0 matches baseline (Probe 2 PASS expected)"
  else
    not_ok "smoke exit=${SMOKE_EXIT} but baseline expects exit=0"
  fi
fi

# --- TAP plan & verdict -----------------------------------------------------
printf '1..%d\n' "${tap_n}"
if [ "${tap_fail}" -gt 0 ]; then
  diag "FAIL: ${tap_fail}/${tap_n} assertions failed — regression detected"
  exit 1
fi
diag "PASS: ${tap_n}/${tap_n} assertions ok"
exit 0
