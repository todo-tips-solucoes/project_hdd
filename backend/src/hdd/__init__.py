"""HORSE DRIVEN DEVELOPMENT (HDD) v2 — backend (control plane).

Arquitetura hexagonal: domain ← contracts ← adapters/application ← api/cli.
A regra de dependência é enforçada por import-linter (ver pyproject.toml).
"""

__version__ = "0.1.0"
