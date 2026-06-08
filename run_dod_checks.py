#!/usr/bin/env python3
"""Run the four DoD checks for the HDD backend and write results to a file."""
import subprocess
import os

BACKEND = "/var/lib/hdd-workspaces/hdd-wave-019ea8ef-f66e-7691-bbbc-49366975023a/backend"
OUTFILE = "/var/lib/hdd-workspaces/hdd-wave-019ea8ef-f66e-7691-bbbc-49366975023a/dod_results.txt"

commands = [
    ("ruff", ["uv", "run", "ruff", "check", "."], {}),
    ("mypy", ["uv", "run", "mypy"], {"MYPYPATH": "src"}),
    ("import-linter", ["uv", "run", "lint-imports"], {"PYTHONPATH": "src"}),
    ("pytest", ["uv", "run", "python", "-m", "pytest", "-q"], {}),
]

results = []
for name, cmd, extra_env in commands:
    env = os.environ.copy()
    env.update(extra_env)
    proc = subprocess.run(
        cmd,
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
    )
    combined = proc.stdout + proc.stderr
    results.append((name, cmd, proc.returncode, combined))

with open(OUTFILE, "w") as f:
    for name, cmd, rc, output in results:
        f.write(f"=== [{name}] ===\n")
        f.write(f"Command: {' '.join(cmd)}\n")
        f.write(f"Exit code: {rc}\n")
        f.write("--- output ---\n")
        f.write(output)
        f.write("\n\n")
    f.write("=== ALL DONE ===\n")

print(f"Written to {OUTFILE}")
for name, cmd, rc, output in results:
    print(f"=== [{name}] exit={rc} ===")
    for line in output.splitlines():
        print(line)
    print()
