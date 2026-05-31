"""Ambiente Alembic. DSN vem de hdd.config (Settings); driver psycopg3 (sync)."""
from __future__ import annotations

from alembic import context
from sqlalchemy import engine_from_config, pool

from hdd.config import get_settings

config = context.config

_dsn = get_settings().pg_dsn
if not _dsn.startswith("postgresql+"):
    _dsn = _dsn.replace("postgresql://", "postgresql+psycopg://", 1)
config.set_main_option("sqlalchemy.url", _dsn)


def run_migrations_offline() -> None:
    context.configure(url=_dsn, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    section = config.get_section(config.config_ini_section) or {}
    connectable = engine_from_config(
        section, prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    with connectable.connect() as connection:
        context.configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
