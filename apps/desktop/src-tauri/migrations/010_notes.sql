CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  body_markdown TEXT NOT NULL DEFAULT '',
  folder_id TEXT REFERENCES folders(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notes_folder
  ON notes(folder_id, deleted_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_updated_at
  ON notes(deleted_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS note_attachments (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id),
  original_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_note_attachments_note
  ON note_attachments(note_id, deleted_at, created_at);

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '10');
