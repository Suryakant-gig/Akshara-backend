"""
Minimal SQLite storage for screening sessions. Swap for PostgreSQL by
changing the connection string when this moves past a single-classroom pilot.
"""
import sqlite3
import json
import uuid
import os
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "akshara.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            child_alias TEXT NOT NULL,
            language TEXT NOT NULL,
            created_at TEXT NOT NULL,
            report_json TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def save_session(child_alias: str, language: str, report_json: dict) -> str:
    session_id = str(uuid.uuid4())
    conn = get_connection()
    conn.execute(
        "INSERT INTO sessions (id, child_alias, language, created_at, report_json) VALUES (?, ?, ?, ?, ?)",
        (session_id, child_alias, language, datetime.now(timezone.utc).isoformat(), json.dumps(report_json)),
    )
    conn.commit()
    conn.close()
    return session_id


def list_sessions():
    conn = get_connection()
    rows = conn.execute("SELECT id, child_alias, language, created_at FROM sessions ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_session(session_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    if row is None:
        return None
    d = dict(row)
    d["report_json"] = json.loads(d["report_json"])
    return d
