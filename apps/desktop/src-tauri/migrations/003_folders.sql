CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_folders_updated_at
  ON folders(deleted_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_folder
  ON tasks(folder_id, deleted_at, updated_at DESC);

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '3');
