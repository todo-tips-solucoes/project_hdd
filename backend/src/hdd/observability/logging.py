"""Logs estruturados JSON com structlog (sempre com correlation_id quando houver).

Inclui um processor de *redaction* (Story 5.4): segredos nunca devem aparecer em
logs nem no audit. A redaction atua por nome de chave (camadas que contêm
``secret``/``token``/``dsn``…) e também sobre credenciais embutidas em URLs
(ex.: a senha dentro de ``postgresql://user:pass@host``), cobrindo o caso de um
DSN vazar dentro de uma mensagem de erro.
"""
from __future__ import annotations

import logging
import re
from typing import Any, cast

import structlog
from structlog.typing import EventDict, WrappedLogger

_REDACTED = "«redacted»"

# Chaves cujo VALOR é sempre sensível.
_SENSITIVE_SUBSTR = (
    "secret",
    "password",
    "passwd",
    "credential",
    "hmac",
    "api_key",
    "apikey",
    "authorization",
)
_SENSITIVE_SUFFIX = ("_token", "_dsn")
_SENSITIVE_EXACT = frozenset({"token", "dsn", "cookie", "set-cookie", "set_cookie"})

# Credenciais embutidas em URLs: scheme://user:SENHA@host → redige só a senha.
_URL_CRED_RE = re.compile(r"(?P<head>[a-z][a-z0-9+.\-]*://[^:/@\s]+:)[^@/\s]+@")


def _is_sensitive_key(key: str) -> bool:
    lowered = key.lower()
    if lowered in _SENSITIVE_EXACT:
        return True
    if lowered.endswith(_SENSITIVE_SUFFIX):
        return True
    return any(part in lowered for part in _SENSITIVE_SUBSTR)


def _scrub_value(value: Any) -> Any:
    if isinstance(value, str):
        return _URL_CRED_RE.sub(rf"\g<head>{_REDACTED}@", value)
    if isinstance(value, dict):
        return {
            k: (_REDACTED if _is_sensitive_key(str(k)) else _scrub_value(v))
            for k, v in value.items()
        }
    if isinstance(value, (list, tuple)):
        scrubbed = [_scrub_value(v) for v in value]
        return type(value)(scrubbed)
    return value


def redact_secrets(
    _logger: WrappedLogger, _method_name: str, event_dict: EventDict
) -> EventDict:
    """Mascara valores sensíveis por nome de chave e credenciais em URLs."""
    for key in list(event_dict):
        if _is_sensitive_key(str(key)):
            event_dict[key] = _REDACTED
        else:
            event_dict[key] = _scrub_value(event_dict[key])
    return event_dict


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(format="%(message)s", level=getattr(logging, level, logging.INFO))
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            redact_secrets,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, level, logging.INFO)
        ),
        cache_logger_on_first_use=True,
    )


def get_logger(component: str) -> structlog.stdlib.BoundLogger:
    return cast(
        "structlog.stdlib.BoundLogger", structlog.get_logger(component=component)
    )
