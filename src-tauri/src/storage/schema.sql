PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vault_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO vault_state (id, revision) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('login', 'note', 'card', 'identity')),
    title TEXT NOT NULL,
    favorite INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    revision INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS entries_active_order
    ON entries (deleted_at, favorite DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS custom_fields (
    entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    label TEXT NOT NULL COLLATE NOCASE,
    kind TEXT NOT NULL CHECK (kind IN ('text', 'password', 'date')),
    value TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (entry_id, id),
    UNIQUE (entry_id, label)
);

CREATE TABLE IF NOT EXISTS password_history (
    entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    password TEXT NOT NULL,
    changed_at TEXT NOT NULL,
    PRIMARY KEY (entry_id, id)
);
CREATE INDEX IF NOT EXISTS password_history_time
    ON password_history (entry_id, changed_at DESC);

INSERT OR IGNORE INTO schema_migrations (version, applied_at)
VALUES (1, datetime('now'));
