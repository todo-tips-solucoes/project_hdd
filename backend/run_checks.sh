#!/usr/bin/env bash
set -euo pipefail
cd /var/lib/hdd-workspaces/hdd-wave-019e8fec-414e-7752-809d-c8f4fabdf9d0/backend

echo "=== CMD1: uv run ruff check src/ tests/ ==="
uv run ruff check src/ tests/ 2>&1 || true
ruff_exit=$?
echo "RUFF_EXIT:${ruff_exit}"

echo "=== CMD2: uv run mypy --strict src/ ==="
uv run mypy --strict src/ 2>&1 || true
mypy_exit=$?
echo "MYPY_EXIT:${mypy_exit}"

echo "=== CMD3: uv run pytest tests/unit/test_api.py -x -q ==="
uv run pytest tests/unit/test_api.py -x -q 2>&1 || true
pytest_exit=$?
echo "PYTEST_EXIT:${pytest_exit}"
