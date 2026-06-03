"""Testes para hdd.domain.parsing — parse_bool.

Cobre os 8 aliases canônicos, variações de case e strip de whitespace (22 casos
válidos) e 9 entradas inválidas que devem levantar ValueError.
"""
from __future__ import annotations

import pytest

from hdd.domain.parsing import parse_bool


@pytest.mark.parametrize(
    "entrada,esperado",
    [
        # aliases canônicos → True
        ("1", True),
        ("true", True),
        ("yes", True),
        ("on", True),
        # aliases canônicos → False
        ("0", False),
        ("false", False),
        ("no", False),
        ("off", False),
        # variações de case → True
        ("TRUE", True),
        ("True", True),
        ("YES", True),
        ("Yes", True),
        ("ON", True),
        # variações de case → False
        ("FALSE", False),
        ("False", False),
        ("NO", False),
        ("No", False),
        ("OFF", False),
        # strip de whitespace
        ("  true  ", True),
        ("\tfalse\n", False),
        ("  1  ", True),
        ("  0  ", False),
    ],
)
def test_parse_bool_valido(entrada: str, esperado: bool) -> None:
    assert parse_bool(entrada) is esperado


@pytest.mark.parametrize(
    "entrada",
    [
        "",
        " ",
        "2",
        "-1",
        "maybe",
        "enabled",
        "disabled",
        "sim",
        "não",
    ],
)
def test_parse_bool_invalido(entrada: str) -> None:
    with pytest.raises(ValueError):
        parse_bool(entrada)
