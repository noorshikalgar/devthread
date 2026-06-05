PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '1');

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  description_markdown TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK(status IN ('planned', 'active', 'blocked', 'paused', 'done', 'archived')),
  next_step TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_updated_at
  ON tasks(deleted_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS work_log_entries (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  entry_type TEXT NOT NULL
    CHECK(entry_type IN ('note', 'progress', 'finding', 'blocker', 'decision', 'next_step')),
  content_markdown TEXT NOT NULL CHECK(length(trim(content_markdown)) > 0),
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK(visibility IN ('private', 'report')),
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_entries_task_timeline
  ON work_log_entries(task_id, deleted_at, occurred_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS work_log_revisions (
  id TEXT PRIMARY KEY,
  work_log_entry_id TEXT NOT NULL REFERENCES work_log_entries(id),
  revision_number INTEGER NOT NULL,
  previous_content_markdown TEXT NOT NULL,
  previous_entry_type TEXT NOT NULL,
  previous_visibility TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  change_source TEXT NOT NULL
    CHECK(change_source IN ('user_edit', 'restore')),
  UNIQUE(work_log_entry_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_revisions_entry
  ON work_log_revisions(work_log_entry_id, revision_number DESC);
