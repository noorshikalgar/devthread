CREATE TABLE IF NOT EXISTS task_quick_links (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK(length(trim(url)) > 0),
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  domain TEXT NOT NULL CHECK(length(trim(domain)) > 0),
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(task_id, url)
);

CREATE INDEX IF NOT EXISTS idx_task_quick_links_task
  ON task_quick_links(task_id, deleted_at, created_at ASC);

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '7');
