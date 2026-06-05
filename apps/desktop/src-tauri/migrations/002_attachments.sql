CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  work_log_entry_id TEXT NOT NULL REFERENCES work_log_entries(id),
  original_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_attachments_entry
  ON attachments(work_log_entry_id, deleted_at, created_at);

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '2');
