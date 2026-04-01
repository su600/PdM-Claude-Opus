"""SQLite connection management and schema creation."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path("/app/data/pdm.db")

_DDL = """
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    username        TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role            TEXT NOT NULL,
    display_name    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    device_type      TEXT NOT NULL,
    location         TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'online',
    model            TEXT,
    manufacturer     TEXT,
    manufacture_year INTEGER,
    serial_number    TEXT,
    description      TEXT,
    datasource_tag   TEXT,
    created_at       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
    id           TEXT PRIMARY KEY,
    device_id    TEXT NOT NULL,
    device_name  TEXT NOT NULL,
    level        TEXT NOT NULL,
    message      TEXT NOT NULL,
    metric       TEXT,
    value        REAL,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rules (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    device_type    TEXT NOT NULL,
    metric         TEXT NOT NULL,
    condition_expr TEXT NOT NULL,
    level          TEXT NOT NULL,
    enabled        INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS predictions (
    id                TEXT PRIMARY KEY,
    device_id         TEXT NOT NULL,
    risk_score        REAL,
    rul_hours         REAL,
    confidence        REAL,
    risk_level        TEXT,
    recommendation    TEXT,
    algorithm_outputs TEXT,
    created_at        TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS templates (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    algorithms  TEXT NOT NULL,
    weights     TEXT NOT NULL,
    thresholds  TEXT NOT NULL,
    algo_params TEXT,
    description TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS evaluations (
    id         TEXT PRIMARY KEY,
    device_id  TEXT NOT NULL,
    algorithm  TEXT,
    risk_score REAL,
    rul_hours  REAL,
    confidence REAL,
    notes      TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
    id          TEXT PRIMARY KEY,
    action      TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id   TEXT NOT NULL,
    username    TEXT NOT NULL,
    detail      TEXT,
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_events (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    level      TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending',
    target_url TEXT,
    retries    INTEGER NOT NULL DEFAULT 0,
    error      TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS datasources (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    ds_type        TEXT NOT NULL,
    host           TEXT,
    port           INTEGER,
    username       TEXT,
    password       TEXT,
    database_name  TEXT,
    enabled        INTEGER NOT NULL DEFAULT 1,
    status         TEXT DEFAULT 'unknown',
    status_message TEXT DEFAULT '',
    updated_at     TEXT
);
CREATE TABLE IF NOT EXISTS maintenance_records (
    id               TEXT PRIMARY KEY,
    device_id        TEXT NOT NULL,
    date             TEXT NOT NULL,
    maintenance_type TEXT NOT NULL,
    description      TEXT,
    operator         TEXT,
    cost             REAL,
    created_at       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS system_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


@contextmanager
def tx():
    """Yield a committed SQLite connection; roll back on error."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def create_tables() -> None:
    """Create all tables (idempotent)."""
    with tx() as conn:
        conn.executescript(_DDL)
