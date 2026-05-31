"""Exporta o schema OpenAPI da API do painel para um arquivo JSON.

Fonte única do contrato → tipos TS do frontend (Story 4.2, sem drift). Uso:

    uv run python scripts/export_openapi.py [saida.json]

Sem argumento, escreve em `openapi.json` no diretório atual.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from hdd.api.app import create_app


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("openapi.json")
    spec = create_app().openapi()
    out.write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"OpenAPI escrito em {out} ({len(spec.get('paths', {}))} paths)")


if __name__ == "__main__":
    main()
