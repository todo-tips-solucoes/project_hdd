"""Acesso a dados — SQLAlchemy 2 async sobre psycopg3 (driver único, R-15)."""

from .engine import make_engine, make_sessionmaker

__all__ = ["make_engine", "make_sessionmaker"]
