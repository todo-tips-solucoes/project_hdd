"""Testes unitários para format_duration_human."""
from __future__ import annotations

import pytest

from hdd.domain.duration import format_duration_human


@pytest.mark.parametrize(
    "seconds,expected",
    [
        (0, "0s"),
        (1, "1s"),
        (59, "59s"),
        (60, "1m"),
        (61, "1m 1s"),
        (3600, "1h"),
        (3601, "1h 1s"),
        (3660, "1h 1m"),
        (3661, "1h 1m 1s"),
        (7322, "2h 2m 2s"),
        (86399, "23h 59m 59s"),
        (86400, "24h"),
    ],
)
def test_format_duration_saidas(seconds, expected):
    assert format_duration_human(seconds) == expected


@pytest.mark.parametrize("seconds", [-1, -100, -3600])
def test_format_duration_negativo_levanta_value_error(seconds):
    with pytest.raises(ValueError, match="non-negative"):
        format_duration_human(seconds)
