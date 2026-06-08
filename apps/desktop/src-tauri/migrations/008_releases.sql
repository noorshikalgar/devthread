CREATE TABLE IF NOT EXISTS releases (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  description_markdown TEXT NOT NULL DEFAULT '',
  released_at TEXT,
  folder_id TEXT REFERENCES folders(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '8');
