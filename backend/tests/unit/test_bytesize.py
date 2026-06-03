"""Story 7.14 — format_bytes (meta-onda 6).

Testes derivados da especificação (mesma convenção do oracle oculto): base 1024,
sufixos B/KB/MB/GB/TB, bytes como inteiro, KB+ com 2 casas decimais, "0 B" p/ zero,
negativo → ValueError. Adicionados no gate humano (o verify foi oracle-only).
"""
from __future__ import annotations

import pytest

from hdd.domain.bytesize import format_bytes


@pytest.mark.parametrize(
    "n,esperado",
    [
        (0, "0 B"),
        (1, "1 B"),
        (512, "512 B"),
        (1023, "1023 B"),
        (1024, "1.00 KB"),
        (1536, "1.50 KB"),
        (1000000, "976.56 KB"),       # base 1024, não 1000
        (1048576, "1.00 MB"),
        (1073741824, "1.00 GB"),
        (1099511627776, "1.00 TB"),
    ],
)
def test_formata(n: int, esperado: str) -> None:
    assert format_bytes(n) == esperado


@pytest.mark.parametrize("n", [-1, -1024, -1048576])
def test_negativo_levanta(n: int) -> None:
    with pytest.raises(ValueError):
        format_bytes(n)
