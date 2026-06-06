use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
};
use uuid::Uuid;

const MIGRATION: &str = include_str!("../migrations/001_initial.sql");
const ATTACHMENT_MIGRATION: &str = include_str!("../migrations/002_attachments.sql");
const FOLDER_MIGRATION: &str = include_str!("../migrations/003_folders.sql");
const WORKLOG_ENTRY_TYPE_MIGRATION: &str = include_str!("../migrations/004_worklog_entry_type.sql");
const STATUS_ENTRY_TYPE_MIGRATION: &str = include_str!("../migrations/005_status_entry_type.sql");
const ESTIMATE_ENTRY_TYPE_MIGRATION: &str =
    include_str!("../migrations/006_estimate_entry_type.sql");
const QUICK_LINK_MIGRATION: &str = include_str!("../migrations/007_quick_links.sql");
const MAX_ATTACHMENT_BYTES: usize = 10 * 1024 * 1024;
const MAX_QUICK_LINKS_PER_TASK: i64 = 3;
const TASK_STATUSES: &[&str] = &["planned", "active", "blocked", "paused", "done", "archived"];
const ENTRY_TYPES: &[&str] = &[
    "note",
    "progress",
    "finding",
    "blocker",
    "decision",
    "next_step",
    "worklog",
    "status",
    "estimate",
];
const PROTECTED_ENTRY_TYPES: &[&str] = &["progress", "worklog", "status", "estimate"];
const VISIBILITIES: &[&str] = &["private", "report"];

#[derive(Debug)]
pub enum RepositoryError {
    Database(rusqlite::Error),
    Invalid(String),
    NotFound(&'static str),
    Lock,
}

impl RepositoryError {
    pub fn redacted(&self) -> String {
        match self {
            Self::Database(error) => format!("sqlite error: {error}"),
            Self::Invalid(_) => "invalid input".into(),
            Self::NotFound(kind) => format!("{kind} not found"),
            Self::Lock => "database lock poisoned".into(),
        }
    }
}

impl std::fmt::Display for RepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Database(_) => write!(formatter, "The local database operation failed."),
            Self::Invalid(message) => write!(formatter, "{message}"),
            Self::NotFound(kind) => write!(formatter, "{kind} was not found."),
            Self::Lock => write!(formatter, "The local database is unavailable."),
        }
    }
}

impl From<rusqlite::Error> for RepositoryError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Database(value)
    }
}

type Result<T> = std::result::Result<T, RepositoryError>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description_markdown: String,
    pub status: String,
    pub next_step: Option<String>,
    pub estimated_minutes: Option<i64>,
    pub folder_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub title: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskInput {
    pub id: String,
    pub title: String,
    pub description_markdown: String,
    pub status: String,
    pub next_step: Option<String>,
    pub estimated_minutes: Option<i64>,
    pub folder_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFolderInput {
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameFolderInput {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveTaskInput {
    pub task_id: String,
    pub folder_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkLogEntry {
    pub id: String,
    pub task_id: String,
    pub entry_type: String,
    pub content_markdown: String,
    pub visibility: String,
    pub occurred_at: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_minutes: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorklogMetricEntry {
    pub id: String,
    pub task_id: String,
    pub task_title: String,
    pub folder_name: Option<String>,
    pub content_markdown: String,
    pub occurred_at: String,
    pub duration_minutes: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEntryInput {
    pub task_id: String,
    pub entry_type: String,
    pub content_markdown: String,
    pub visibility: String,
    #[serde(default)]
    pub duration_minutes: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEntryInput {
    pub id: String,
    pub entry_type: String,
    pub content_markdown: String,
    pub visibility: String,
    #[serde(default)]
    pub duration_minutes: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkLogRevision {
    pub id: String,
    pub work_log_entry_id: String,
    pub revision_number: i64,
    pub previous_content_markdown: String,
    pub previous_entry_type: String,
    pub previous_visibility: String,
    pub changed_at: String,
    pub change_source: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: String,
    pub work_log_entry_id: String,
    pub original_name: String,
    pub media_type: String,
    pub path: String,
    pub byte_size: i64,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAttachmentInput {
    pub work_log_entry_id: String,
    pub original_name: String,
    pub media_type: String,
    pub base64_data: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskQuickLink {
    pub id: String,
    pub task_id: String,
    pub url: String,
    pub title: String,
    pub domain: String,
    pub provider: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateQuickLinkInput {
    pub task_id: String,
    pub url: String,
    pub title: String,
    pub domain: String,
    pub provider: String,
}

pub struct Database {
    connection: Mutex<Connection>,
    attachments_dir: PathBuf,
}

impl Database {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        let connection = Connection::open(path)?;
        Self::configure(&connection)?;
        let attachments_dir = path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join("attachments");
        fs::create_dir_all(&attachments_dir).map_err(|error| {
            RepositoryError::Invalid(format!("Could not prepare attachments: {error}"))
        })?;
        Ok(Self {
            connection: Mutex::new(connection),
            attachments_dir,
        })
    }

    #[cfg(test)]
    fn memory() -> Result<Self> {
        let connection = Connection::open_in_memory()?;
        Self::configure(&connection)?;
        let attachments_dir = std::env::temp_dir().join(format!("taskline-test-{}", id()));
        fs::create_dir_all(&attachments_dir).map_err(|error| {
            RepositoryError::Invalid(format!("Could not prepare attachments: {error}"))
        })?;
        Ok(Self {
            connection: Mutex::new(connection),
            attachments_dir,
        })
    }

    fn configure(connection: &Connection) -> Result<()> {
        connection.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")?;
        connection.execute_batch(MIGRATION)?;
        connection.execute_batch(ATTACHMENT_MIGRATION)?;
        Self::ensure_tasks_folder_column(connection)?;
        Self::ensure_task_estimate_column(connection)?;
        Self::ensure_work_log_duration_column(connection)?;
        Self::ensure_worklog_entry_type(connection)?;
        Self::ensure_status_entry_type(connection)?;
        Self::ensure_estimate_entry_type(connection)?;
        connection.execute_batch(FOLDER_MIGRATION)?;
        connection.execute_batch(QUICK_LINK_MIGRATION)?;
        Ok(())
    }

    fn ensure_tasks_folder_column(connection: &Connection) -> Result<()> {
        let mut pragma_columns = connection.prepare("PRAGMA table_info(tasks)")?;
        let names: Vec<String> = pragma_columns
            .query_map([], |row| row.get::<_, String>(1))?
            .map(|entry| entry.map_err(RepositoryError::Database))
            .collect::<Result<Vec<_>>>()?;
        if names.iter().any(|name| name == "folder_id") {
            return Ok(());
        }
        connection.execute(
            "ALTER TABLE tasks ADD COLUMN folder_id TEXT REFERENCES folders(id)",
            [],
        )?;
        Ok(())
    }

    fn ensure_task_estimate_column(connection: &Connection) -> Result<()> {
        let mut pragma_columns = connection.prepare("PRAGMA table_info(tasks)")?;
        let names: Vec<String> = pragma_columns
            .query_map([], |row| row.get::<_, String>(1))?
            .map(|entry| entry.map_err(RepositoryError::Database))
            .collect::<Result<Vec<_>>>()?;
        if names.iter().any(|name| name == "estimated_minutes") {
            return Ok(());
        }
        connection.execute("ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER", [])?;
        Ok(())
    }

    fn ensure_status_entry_type(connection: &Connection) -> Result<()> {
        let applied: Option<String> = connection
            .query_row(
                "SELECT value FROM schema_meta WHERE key = 'status_entry_type_applied'",
                [],
                |row| row.get(0),
            )
            .optional()?;
        if applied.as_deref() == Some("1") {
            return Ok(());
        }
        connection.execute_batch(STATUS_ENTRY_TYPE_MIGRATION)?;
        connection.execute(
            "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('status_entry_type_applied', '1')",
            [],
        )?;
        Ok(())
    }

    fn ensure_estimate_entry_type(connection: &Connection) -> Result<()> {
        let applied: Option<String> = connection
            .query_row(
                "SELECT value FROM schema_meta WHERE key = 'estimate_entry_type_applied'",
                [],
                |row| row.get(0),
            )
            .optional()?;
        if applied.as_deref() == Some("1") {
            return Ok(());
        }
        connection.execute_batch(ESTIMATE_ENTRY_TYPE_MIGRATION)?;
        connection.execute(
            "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('estimate_entry_type_applied', '1')",
            [],
        )?;
        Ok(())
    }

    fn ensure_work_log_duration_column(connection: &Connection) -> Result<()> {
        let mut pragma_columns = connection.prepare("PRAGMA table_info(work_log_entries)")?;
        let names: Vec<String> = pragma_columns
            .query_map([], |row| row.get::<_, String>(1))?
            .map(|entry| entry.map_err(RepositoryError::Database))
            .collect::<Result<Vec<_>>>()?;
        if names.iter().any(|name| name == "duration_minutes") {
            return Ok(());
        }
        connection.execute(
            "ALTER TABLE work_log_entries ADD COLUMN duration_minutes INTEGER",
            [],
        )?;
        Ok(())
    }

    fn ensure_worklog_entry_type(connection: &Connection) -> Result<()> {
        let applied: Option<String> = connection
            .query_row(
                "SELECT value FROM schema_meta WHERE key = 'worklog_entry_type_applied'",
                [],
                |row| row.get(0),
            )
            .optional()?;
        if applied.as_deref() == Some("1") {
            return Ok(());
        }
        let worklog_count: i64 = connection.query_row(
            "SELECT COUNT(*) FROM work_log_entries WHERE entry_type = 'worklog'",
            [],
            |row| row.get(0),
        )?;
        if worklog_count == 0 {
            // No worklog rows yet — still need to widen the CHECK constraint
            // so the first one can be inserted.
        }
        connection.execute_batch(WORKLOG_ENTRY_TYPE_MIGRATION)?;
        connection.execute(
            "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('worklog_entry_type_applied', '1')",
            [],
        )?;
        Ok(())
    }

    fn connection(&self) -> Result<MutexGuard<'_, Connection>> {
        self.connection.lock().map_err(|_| RepositoryError::Lock)
    }

    pub fn list_tasks(&self) -> Result<Vec<Task>> {
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT id, title, description_markdown, status, next_step, estimated_minutes, folder_id, created_at, updated_at
             FROM tasks WHERE deleted_at IS NULL ORDER BY updated_at DESC",
        )?;
        let tasks = statement
            .query_map([], map_task)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(tasks)
    }

    pub fn create_task(&self, input: CreateTaskInput) -> Result<Task> {
        let title = required(input.title, "Task title")?;
        let id = id();
        let now = now();
        let connection = self.connection()?;
        connection.execute(
            "INSERT INTO tasks (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
            params![id, title, now],
        )?;
        get_task(&connection, &id)
    }

    pub fn update_task(&self, input: UpdateTaskInput) -> Result<Task> {
        let title = required(input.title, "Task title")?;
        allowed(&input.status, TASK_STATUSES, "task status")?;
        if let Some(value) = input.estimated_minutes {
            if value <= 0 {
                return Err(RepositoryError::Invalid(
                    "Estimate must be a positive number of minutes.".into(),
                ));
            }
        }
        let connection = self.connection()?;
        ensure_folder_is_valid(&connection, input.folder_id.as_deref())?;
        let changed = connection.execute(
            "UPDATE tasks SET title = ?2, description_markdown = ?3, status = ?4,
             next_step = ?5, estimated_minutes = ?6, folder_id = ?7, updated_at = ?8 WHERE id = ?1 AND deleted_at IS NULL",
            params![
                input.id,
                title,
                input.description_markdown,
                input.status,
                clean_optional(input.next_step),
                input.estimated_minutes,
                input.folder_id,
                now()
            ],
        )?;
        if changed == 0 {
            return Err(RepositoryError::NotFound("Task"));
        }
        get_task(&connection, &input.id)
    }

    pub fn move_task(&self, input: MoveTaskInput) -> Result<Task> {
        let connection = self.connection()?;
        ensure_folder_is_valid(&connection, input.folder_id.as_deref())?;
        let changed = connection.execute(
            "UPDATE tasks SET folder_id = ?2, updated_at = ?3
             WHERE id = ?1 AND deleted_at IS NULL",
            params![input.task_id, input.folder_id, now()],
        )?;
        if changed == 0 {
            return Err(RepositoryError::NotFound("Task"));
        }
        get_task(&connection, &input.task_id)
    }

    pub fn delete_task(&self, task_id: &str) -> Result<()> {
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let stamp = now();
        let changed = transaction.execute(
            "UPDATE tasks SET deleted_at = ?2, updated_at = ?2
             WHERE id = ?1 AND deleted_at IS NULL",
            params![task_id, stamp],
        )?;
        if changed == 0 {
            return Err(RepositoryError::NotFound("Task"));
        }
        transaction.execute(
            "UPDATE work_log_entries SET deleted_at = ?2, updated_at = ?2
             WHERE task_id = ?1 AND deleted_at IS NULL",
            params![task_id, stamp],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn list_folders(&self) -> Result<Vec<Folder>> {
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT id, name, created_at, updated_at FROM folders
             WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC",
        )?;
        let folders = statement
            .query_map([], map_folder)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(folders)
    }

    pub fn create_folder(&self, input: CreateFolderInput) -> Result<Folder> {
        let name = required(input.name, "Folder name")?;
        let folder_id = id();
        let stamp = now();
        let connection = self.connection()?;
        connection.execute(
            "INSERT INTO folders (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
            params![folder_id, name, stamp],
        )?;
        get_folder(&connection, &folder_id)
    }

    pub fn rename_folder(&self, input: RenameFolderInput) -> Result<Folder> {
        let name = required(input.name, "Folder name")?;
        let connection = self.connection()?;
        let changed = connection.execute(
            "UPDATE folders SET name = ?2, updated_at = ?3
             WHERE id = ?1 AND deleted_at IS NULL",
            params![input.id, name, now()],
        )?;
        if changed == 0 {
            return Err(RepositoryError::NotFound("Folder"));
        }
        get_folder(&connection, &input.id)
    }

    pub fn delete_folder(&self, folder_id: &str) -> Result<()> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare("SELECT 1 FROM tasks WHERE folder_id = ?1 AND deleted_at IS NULL LIMIT 1")?;
        let in_use: bool = statement
            .query_row(params![folder_id], |row| row.get(0))
            .optional()?
            .unwrap_or(false);
        if in_use {
            return Err(RepositoryError::Invalid(
                "Folder still contains tasks.".into(),
            ));
        }
        let changed = connection.execute(
            "UPDATE folders SET deleted_at = ?2, updated_at = ?2
             WHERE id = ?1 AND deleted_at IS NULL",
            params![folder_id, now()],
        )?;
        if changed == 0 {
            return Err(RepositoryError::NotFound("Folder"));
        }
        Ok(())
    }

    pub fn list_entries(
        &self,
        task_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<WorkLogEntry>> {
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT id, task_id, entry_type, content_markdown, visibility, occurred_at,
             created_at, updated_at, duration_minutes FROM work_log_entries
             WHERE task_id = ?1 AND deleted_at IS NULL
             ORDER BY occurred_at DESC, id DESC LIMIT ?2 OFFSET ?3",
        )?;
        let entries = statement
            .query_map(params![task_id, limit, offset], map_entry)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(entries)
    }

    pub fn list_worklog_metrics(
        &self,
        start_at: Option<String>,
        end_at: Option<String>,
    ) -> Result<Vec<WorklogMetricEntry>> {
        let connection = self.connection()?;
        let start = start_at.unwrap_or_else(|| "0000-01-01T00:00:00Z".into());
        let end = end_at.unwrap_or_else(|| "9999-12-31T23:59:59Z".into());
        let mut statement = connection.prepare(
            "SELECT work_log_entries.id, work_log_entries.task_id, tasks.title,
                    folders.name, work_log_entries.content_markdown,
                    work_log_entries.occurred_at, work_log_entries.duration_minutes
             FROM work_log_entries
             JOIN tasks ON tasks.id = work_log_entries.task_id
             LEFT JOIN folders ON folders.id = tasks.folder_id
             WHERE work_log_entries.deleted_at IS NULL
               AND tasks.deleted_at IS NULL
               AND work_log_entries.entry_type = 'worklog'
               AND work_log_entries.duration_minutes > 0
               AND work_log_entries.occurred_at >= ?1
               AND work_log_entries.occurred_at <= ?2
             ORDER BY work_log_entries.occurred_at DESC, work_log_entries.id DESC",
        )?;
        let entries = statement
            .query_map(params![start, end], |row| {
                Ok(WorklogMetricEntry {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    task_title: row.get(2)?,
                    folder_name: row.get(3)?,
                    content_markdown: row.get(4)?,
                    occurred_at: row.get(5)?,
                    duration_minutes: row.get(6)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(entries)
    }

    pub fn create_entry(&self, input: CreateEntryInput) -> Result<WorkLogEntry> {
        allowed(&input.entry_type, ENTRY_TYPES, "entry type")?;
        allowed(&input.visibility, VISIBILITIES, "visibility")?;
        let content = required(input.content_markdown, "Entry content")?;
        if let Some(value) = input.duration_minutes {
            if value < 0 {
                return Err(RepositoryError::Invalid(
                    "Duration must be a positive number of minutes.".into(),
                ));
            }
        }
        let id = id();
        let now = now();
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        ensure_task(&transaction, &input.task_id)?;
        transaction.execute(
            "INSERT INTO work_log_entries
             (id, task_id, entry_type, content_markdown, visibility, occurred_at,
              created_at, updated_at, duration_minutes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?6, ?7)",
            params![
                id,
                input.task_id,
                input.entry_type,
                content,
                input.visibility,
                now,
                input.duration_minutes,
            ],
        )?;
        transaction.execute(
            "UPDATE tasks SET updated_at = ?2 WHERE id = ?1",
            params![input.task_id, now],
        )?;
        transaction.commit()?;
        get_entry(&connection, &id)
    }

    pub fn update_entry(&self, input: UpdateEntryInput) -> Result<WorkLogEntry> {
        allowed(&input.entry_type, ENTRY_TYPES, "entry type")?;
        allowed(&input.visibility, VISIBILITIES, "visibility")?;
        let content = required(input.content_markdown, "Entry content")?;
        if let Some(value) = input.duration_minutes {
            if value < 0 {
                return Err(RepositoryError::Invalid(
                    "Duration must be a positive number of minutes.".into(),
                ));
            }
        }
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        write_revision(&transaction, &input.id, "user_edit")?;
        let changed = transaction.execute(
            "UPDATE work_log_entries SET entry_type = ?2, content_markdown = ?3,
             visibility = ?4, duration_minutes = ?5, updated_at = ?6
             WHERE id = ?1 AND deleted_at IS NULL",
            params![
                input.id,
                input.entry_type,
                content,
                input.visibility,
                input.duration_minutes,
                now()
            ],
        )?;
        if changed == 0 {
            return Err(RepositoryError::NotFound("Entry"));
        }
        transaction.commit()?;
        get_entry(&connection, &input.id)
    }

    pub fn list_revisions(&self, entry_id: &str) -> Result<Vec<WorkLogRevision>> {
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT id, work_log_entry_id, revision_number, previous_content_markdown,
             previous_entry_type, previous_visibility, changed_at, change_source
             FROM work_log_revisions WHERE work_log_entry_id = ?1 ORDER BY revision_number DESC",
        )?;
        let revisions = statement
            .query_map(params![entry_id], map_revision)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(revisions)
    }

    pub fn restore_revision(&self, revision_id: &str) -> Result<WorkLogEntry> {
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let revision = transaction
            .query_row(
                "SELECT id, work_log_entry_id, revision_number, previous_content_markdown,
                 previous_entry_type, previous_visibility, changed_at, change_source
                 FROM work_log_revisions WHERE id = ?1",
                params![revision_id],
                map_revision,
            )
            .optional()?
            .ok_or(RepositoryError::NotFound("Revision"))?;
        write_revision(&transaction, &revision.work_log_entry_id, "restore")?;
        transaction.execute(
            "UPDATE work_log_entries SET content_markdown = ?2, entry_type = ?3,
             visibility = ?4, updated_at = ?5 WHERE id = ?1 AND deleted_at IS NULL",
            params![
                revision.work_log_entry_id,
                revision.previous_content_markdown,
                revision.previous_entry_type,
                revision.previous_visibility,
                now()
            ],
        )?;
        transaction.commit()?;
        get_entry(&connection, &revision.work_log_entry_id)
    }

    pub fn trash_entry(&self, entry_id: &str) -> Result<()> {
        let connection = self.connection()?;
        let entry_type: String = connection
            .query_row(
                "SELECT entry_type FROM work_log_entries WHERE id = ?1 AND deleted_at IS NULL",
                params![entry_id],
                |row| row.get(0),
            )
            .optional()?
            .ok_or(RepositoryError::NotFound("Entry"))?;
        if PROTECTED_ENTRY_TYPES.contains(&entry_type.as_str()) {
            return Err(RepositoryError::Invalid(
                "This timeline fact is protected and cannot be deleted.".into(),
            ));
        }
        drop(connection);
        self.set_entry_deleted(entry_id, Some(now()))
    }

    pub fn restore_entry(&self, entry_id: &str) -> Result<()> {
        self.set_entry_deleted(entry_id, None)
    }

    pub fn list_attachments(&self, task_id: &str) -> Result<Vec<Attachment>> {
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT attachments.id, attachments.work_log_entry_id, attachments.original_name,
             attachments.media_type, attachments.relative_path, attachments.byte_size,
             attachments.created_at
             FROM attachments
             JOIN work_log_entries ON work_log_entries.id = attachments.work_log_entry_id
             WHERE work_log_entries.task_id = ?1 AND attachments.deleted_at IS NULL
             ORDER BY attachments.created_at",
        )?;
        let relative = statement
            .query_map(params![task_id], map_attachment)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(relative
            .into_iter()
            .map(|attachment| attachment.with_root(&self.attachments_dir))
            .collect())
    }

    pub fn create_attachment(&self, input: CreateAttachmentInput) -> Result<Attachment> {
        if !input.media_type.starts_with("image/") {
            return Err(RepositoryError::Invalid(
                "Only image attachments are supported right now.".into(),
            ));
        }
        let bytes = STANDARD
            .decode(input.base64_data)
            .map_err(|_| RepositoryError::Invalid("Image data is invalid.".into()))?;
        if bytes.is_empty() || bytes.len() > MAX_ATTACHMENT_BYTES {
            return Err(RepositoryError::Invalid(
                "Image must be between 1 byte and 10 MB.".into(),
            ));
        }
        let original_name = required(input.original_name, "Image name")?;
        let connection = self.connection()?;
        let entry_exists: bool = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM work_log_entries WHERE id = ?1 AND deleted_at IS NULL)",
            params![input.work_log_entry_id],
            |row| row.get(0),
        )?;
        if !entry_exists {
            return Err(RepositoryError::NotFound("Entry"));
        }

        let digest = format!("{:x}", Sha256::digest(&bytes));
        let relative_path = format!("{}/{}", &digest[..2], digest);
        let absolute_path = self.attachments_dir.join(&relative_path);
        if let Some(parent) = absolute_path.parent() {
            fs::create_dir_all(parent).map_err(|_| {
                RepositoryError::Invalid("Could not prepare the attachment folder.".into())
            })?;
        }
        if !absolute_path.exists() {
            fs::write(&absolute_path, &bytes)
                .map_err(|_| RepositoryError::Invalid("Could not save the image.".into()))?;
        }

        let attachment_id = id();
        let created_at = now();
        connection.execute(
            "INSERT INTO attachments
             (id, work_log_entry_id, original_name, media_type, relative_path, byte_size, sha256, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                attachment_id,
                input.work_log_entry_id,
                original_name,
                input.media_type,
                relative_path,
                bytes.len() as i64,
                digest,
                created_at
            ],
        )?;
        Ok(Attachment {
            id: attachment_id,
            work_log_entry_id: input.work_log_entry_id,
            original_name,
            media_type: input.media_type,
            path: absolute_path.to_string_lossy().into_owned(),
            byte_size: bytes.len() as i64,
            created_at,
        })
    }

    pub fn list_quick_links(&self, task_id: &str) -> Result<Vec<TaskQuickLink>> {
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT id, task_id, url, title, domain, provider, created_at, updated_at
             FROM task_quick_links
             WHERE task_id = ?1 AND deleted_at IS NULL
             ORDER BY created_at ASC, id ASC",
        )?;
        let links = statement
            .query_map(params![task_id], map_quick_link)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(links)
    }

    pub fn create_quick_link(&self, input: CreateQuickLinkInput) -> Result<TaskQuickLink> {
        let url = required(input.url, "Quick link URL")?;
        if !(url.starts_with("https://") || url.starts_with("http://")) {
            return Err(RepositoryError::Invalid(
                "Quick link must be a web URL.".into(),
            ));
        }
        let title = required(input.title, "Quick link title")?;
        let domain = required(input.domain, "Quick link domain")?;
        let provider = required(input.provider, "Quick link provider")?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        ensure_task(&transaction, &input.task_id)?;

        if let Some(existing_id) = transaction
            .query_row(
                "SELECT id FROM task_quick_links WHERE task_id = ?1 AND url = ?2",
                params![input.task_id, url],
                |row| row.get::<_, String>(0),
            )
            .optional()?
        {
            let stamp = now();
            transaction.execute(
                "UPDATE task_quick_links
                 SET title = ?2, domain = ?3, provider = ?4, updated_at = ?5, deleted_at = NULL
                 WHERE id = ?1",
                params![existing_id, title, domain, provider, stamp],
            )?;
            transaction.commit()?;
            return get_quick_link(&connection, &existing_id);
        }

        let active_count: i64 = transaction.query_row(
            "SELECT COUNT(*) FROM task_quick_links WHERE task_id = ?1 AND deleted_at IS NULL",
            params![input.task_id],
            |row| row.get(0),
        )?;
        if active_count >= MAX_QUICK_LINKS_PER_TASK {
            return Err(RepositoryError::Invalid(
                "Tasks can have up to 3 quick links.".into(),
            ));
        }

        let link_id = id();
        let stamp = now();
        transaction.execute(
            "INSERT INTO task_quick_links
             (id, task_id, url, title, domain, provider, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
            params![link_id, input.task_id, url, title, domain, provider, stamp],
        )?;
        transaction.commit()?;
        get_quick_link(&connection, &link_id)
    }

    pub fn delete_quick_link(&self, id: &str) -> Result<()> {
        let connection = self.connection()?;
        let changed = connection.execute(
            "UPDATE task_quick_links SET deleted_at = ?2, updated_at = ?2
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id, now()],
        )?;
        if changed == 0 {
            return Err(RepositoryError::NotFound("Quick link"));
        }
        Ok(())
    }

    fn set_entry_deleted(&self, entry_id: &str, deleted_at: Option<String>) -> Result<()> {
        let connection = self.connection()?;
        let changed = connection.execute(
            "UPDATE work_log_entries SET deleted_at = ?2, updated_at = ?3 WHERE id = ?1",
            params![entry_id, deleted_at, now()],
        )?;
        if changed == 0 {
            return Err(RepositoryError::NotFound("Entry"));
        }
        Ok(())
    }
}

impl Attachment {
    fn with_root(mut self, root: &Path) -> Self {
        self.path = root.join(&self.path).to_string_lossy().into_owned();
        self
    }
}

fn write_revision(transaction: &Transaction<'_>, entry_id: &str, source: &str) -> Result<()> {
    let entry = transaction
        .query_row(
            "SELECT id, task_id, entry_type, content_markdown, visibility, occurred_at,
             created_at, updated_at, duration_minutes FROM work_log_entries
             WHERE id = ?1 AND deleted_at IS NULL",
            params![entry_id],
            map_entry,
        )
        .optional()?
        .ok_or(RepositoryError::NotFound("Entry"))?;
    let revision_number: i64 = transaction.query_row(
        "SELECT COALESCE(MAX(revision_number), 0) + 1 FROM work_log_revisions
         WHERE work_log_entry_id = ?1",
        params![entry_id],
        |row| row.get(0),
    )?;
    transaction.execute(
        "INSERT INTO work_log_revisions
         (id, work_log_entry_id, revision_number, previous_content_markdown,
          previous_entry_type, previous_visibility, changed_at, change_source)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id(),
            entry_id,
            revision_number,
            entry.content_markdown,
            entry.entry_type,
            entry.visibility,
            now(),
            source
        ],
    )?;
    Ok(())
}

fn ensure_task(transaction: &Transaction<'_>, task_id: &str) -> Result<()> {
    let exists: bool = transaction.query_row(
        "SELECT EXISTS(SELECT 1 FROM tasks WHERE id = ?1 AND deleted_at IS NULL)",
        params![task_id],
        |row| row.get(0),
    )?;
    if exists {
        Ok(())
    } else {
        Err(RepositoryError::NotFound("Task"))
    }
}

fn get_task(connection: &Connection, task_id: &str) -> Result<Task> {
    connection
        .query_row(
            "SELECT id, title, description_markdown, status, next_step, estimated_minutes, folder_id, created_at, updated_at
             FROM tasks WHERE id = ?1 AND deleted_at IS NULL",
            params![task_id],
            map_task,
        )
        .optional()?
        .ok_or(RepositoryError::NotFound("Task"))
}

fn get_folder(connection: &Connection, folder_id: &str) -> Result<Folder> {
    connection
        .query_row(
            "SELECT id, name, created_at, updated_at FROM folders
             WHERE id = ?1 AND deleted_at IS NULL",
            params![folder_id],
            map_folder,
        )
        .optional()?
        .ok_or(RepositoryError::NotFound("Folder"))
}

fn ensure_folder_is_valid(connection: &Connection, folder_id: Option<&str>) -> Result<()> {
    if let Some(id) = folder_id {
        let exists: bool = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM folders WHERE id = ?1 AND deleted_at IS NULL)",
            params![id],
            |row| row.get(0),
        )?;
        if !exists {
            return Err(RepositoryError::NotFound("Folder"));
        }
    }
    Ok(())
}

fn get_entry(connection: &Connection, entry_id: &str) -> Result<WorkLogEntry> {
    connection
        .query_row(
            "SELECT id, task_id, entry_type, content_markdown, visibility, occurred_at,
             created_at, updated_at, duration_minutes FROM work_log_entries
             WHERE id = ?1 AND deleted_at IS NULL",
            params![entry_id],
            map_entry,
        )
        .optional()?
        .ok_or(RepositoryError::NotFound("Entry"))
}

fn get_quick_link(connection: &Connection, id: &str) -> Result<TaskQuickLink> {
    connection
        .query_row(
            "SELECT id, task_id, url, title, domain, provider, created_at, updated_at
             FROM task_quick_links WHERE id = ?1 AND deleted_at IS NULL",
            params![id],
            map_quick_link,
        )
        .optional()?
        .ok_or(RepositoryError::NotFound("Quick link"))
}

fn map_task(row: &Row<'_>) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        description_markdown: row.get(2)?,
        status: row.get(3)?,
        next_step: row.get(4)?,
        estimated_minutes: row.get(5)?,
        folder_id: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

fn map_folder(row: &Row<'_>) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: row.get(0)?,
        name: row.get(1)?,
        created_at: row.get(2)?,
        updated_at: row.get(3)?,
    })
}

fn map_entry(row: &Row<'_>) -> rusqlite::Result<WorkLogEntry> {
    Ok(WorkLogEntry {
        id: row.get(0)?,
        task_id: row.get(1)?,
        entry_type: row.get(2)?,
        content_markdown: row.get(3)?,
        visibility: row.get(4)?,
        occurred_at: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
        duration_minutes: row.get(8)?,
    })
}

fn map_revision(row: &Row<'_>) -> rusqlite::Result<WorkLogRevision> {
    Ok(WorkLogRevision {
        id: row.get(0)?,
        work_log_entry_id: row.get(1)?,
        revision_number: row.get(2)?,
        previous_content_markdown: row.get(3)?,
        previous_entry_type: row.get(4)?,
        previous_visibility: row.get(5)?,
        changed_at: row.get(6)?,
        change_source: row.get(7)?,
    })
}

fn map_attachment(row: &Row<'_>) -> rusqlite::Result<Attachment> {
    Ok(Attachment {
        id: row.get(0)?,
        work_log_entry_id: row.get(1)?,
        original_name: row.get(2)?,
        media_type: row.get(3)?,
        path: row.get(4)?,
        byte_size: row.get(5)?,
        created_at: row.get(6)?,
    })
}

fn map_quick_link(row: &Row<'_>) -> rusqlite::Result<TaskQuickLink> {
    Ok(TaskQuickLink {
        id: row.get(0)?,
        task_id: row.get(1)?,
        url: row.get(2)?,
        title: row.get(3)?,
        domain: row.get(4)?,
        provider: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn required(value: String, label: &str) -> Result<String> {
    let value = value.trim().to_owned();
    if value.is_empty() {
        Err(RepositoryError::Invalid(format!("{label} is required.")))
    } else {
        Ok(value)
    }
}

fn allowed(value: &str, allowed: &[&str], label: &str) -> Result<()> {
    if allowed.contains(&value) {
        Ok(())
    } else {
        Err(RepositoryError::Invalid(format!("Unknown {label}.")))
    }
}

fn clean_optional(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let clean = value.trim().to_owned();
        (!clean.is_empty()).then_some(clean)
    })
}

fn id() -> String {
    Uuid::now_v7().to_string()
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(database: &Database) -> Task {
        database
            .create_task(CreateTaskInput {
                title: "Ship task threads".into(),
            })
            .unwrap()
    }

    fn entry(database: &Database, task_id: &str) -> WorkLogEntry {
        database
            .create_entry(CreateEntryInput {
                task_id: task_id.into(),
                entry_type: "finding".into(),
                content_markdown: "Drafts need durable recovery.".into(),
                visibility: "private".into(),
                duration_minutes: None,
            })
            .unwrap()
    }

    #[test]
    fn rejects_unknown_task_status() {
        let database = Database::memory().unwrap();
        let task = task(&database);
        let result = database.update_task(UpdateTaskInput {
            id: task.id,
            title: task.title,
            description_markdown: String::new(),
            status: "in_review".into(),
            next_step: None,
            estimated_minutes: None,
            folder_id: None,
        });
        assert!(matches!(result, Err(RepositoryError::Invalid(_))));
    }

    #[test]
    fn worklog_entry_type_is_accepted_and_round_trips() {
        let database = Database::memory().unwrap();
        let task = task(&database);
        let logged = database
            .create_entry(CreateEntryInput {
                task_id: task.id.clone(),
                entry_type: "worklog".into(),
                content_markdown: "Logged 1d 3h on the sidebar.".into(),
                visibility: "private".into(),
                duration_minutes: Some(8 * 60 + 3 * 60),
            })
            .unwrap();
        assert_eq!(logged.entry_type, "worklog");
        assert_eq!(logged.duration_minutes, Some(8 * 60 + 3 * 60));

        let listed = database.list_entries(&task.id, 50, 0).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].entry_type, "worklog");
    }

    #[test]
    fn status_entry_type_is_accepted_and_round_trips() {
        let database = Database::memory().unwrap();
        let task = task(&database);
        let logged = database
            .create_entry(CreateEntryInput {
                task_id: task.id.clone(),
                entry_type: "status".into(),
                content_markdown: "Status changed from Planned to Active.".into(),
                visibility: "private".into(),
                duration_minutes: None,
            })
            .unwrap();
        assert_eq!(logged.entry_type, "status");

        let listed = database.list_entries(&task.id, 50, 0).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].entry_type, "status");
    }

    #[test]
    fn estimate_round_trips_and_logs_as_entry_type() {
        let database = Database::memory().unwrap();
        let task = task(&database);
        let updated = database
            .update_task(UpdateTaskInput {
                id: task.id.clone(),
                title: task.title,
                description_markdown: String::new(),
                status: task.status,
                next_step: None,
                estimated_minutes: Some(480),
                folder_id: None,
            })
            .unwrap();
        assert_eq!(updated.estimated_minutes, Some(480));

        let logged = database
            .create_entry(CreateEntryInput {
                task_id: task.id.clone(),
                entry_type: "estimate".into(),
                content_markdown: "Estimate set to 1d.".into(),
                visibility: "private".into(),
                duration_minutes: Some(480),
            })
            .unwrap();
        assert_eq!(logged.entry_type, "estimate");
        assert_eq!(logged.duration_minutes, Some(480));
    }

    #[test]
    fn protected_timeline_facts_cannot_be_trashed() {
        let database = Database::memory().unwrap();
        let task = task(&database);
        for entry_type in ["progress", "worklog", "status", "estimate"] {
            let entry = database
                .create_entry(CreateEntryInput {
                    task_id: task.id.clone(),
                    entry_type: entry_type.into(),
                    content_markdown: format!("{entry_type} fact"),
                    visibility: "private".into(),
                    duration_minutes: (entry_type == "worklog").then_some(30),
                })
                .unwrap();
            let result = database.trash_entry(&entry.id);
            assert!(matches!(result, Err(RepositoryError::Invalid(_))));
        }
    }

    #[test]
    fn worklog_metrics_returns_logged_time_with_task_context() {
        let database = Database::memory().unwrap();
        let task = task(&database);
        database
            .create_entry(CreateEntryInput {
                task_id: task.id.clone(),
                entry_type: "worklog".into(),
                content_markdown: "Implemented metrics.".into(),
                visibility: "private".into(),
                duration_minutes: Some(90),
            })
            .unwrap();
        database
            .create_entry(CreateEntryInput {
                task_id: task.id,
                entry_type: "note".into(),
                content_markdown: "Not a worklog.".into(),
                visibility: "private".into(),
                duration_minutes: Some(90),
            })
            .unwrap();

        let metrics = database.list_worklog_metrics(None, None).unwrap();
        assert_eq!(metrics.len(), 1);
        assert_eq!(metrics[0].duration_minutes, 90);
        assert_eq!(metrics[0].task_title, "Ship task threads");
    }

    #[test]
    fn select_after_update_returns_duration_minutes() {
        let database = Database::memory().unwrap();
        let task = task(&database);
        let original = entry(&database, &task.id);
        let edited = database
            .update_entry(UpdateEntryInput {
                id: original.id.clone(),
                entry_type: "decision".into(),
                content_markdown: "Keep drafts until SQLite confirms.".into(),
                visibility: "report".into(),
                duration_minutes: Some(120),
            })
            .unwrap();
        assert_eq!(edited.duration_minutes, Some(120));
    }

    #[test]
    fn editing_and_restoring_preserve_revisions() {
        let database = Database::memory().unwrap();
        let task = task(&database);
        let original = entry(&database, &task.id);
        let edited = database
            .update_entry(UpdateEntryInput {
                id: original.id.clone(),
                entry_type: "decision".into(),
                content_markdown: "Keep drafts until SQLite confirms.".into(),
                visibility: "report".into(),
                duration_minutes: None,
            })
            .unwrap();
        assert_eq!(edited.entry_type, "decision");

        let revisions = database.list_revisions(&original.id).unwrap();
        assert_eq!(revisions.len(), 1);
        let restored = database.restore_revision(&revisions[0].id).unwrap();
        assert_eq!(restored.content_markdown, original.content_markdown);
        assert_eq!(database.list_revisions(&original.id).unwrap().len(), 2);
    }

    #[test]
    fn trash_and_restore_hide_and_reveal_entry() {
        let database = Database::memory().unwrap();
        let task = task(&database);
        let entry = entry(&database, &task.id);
        database.trash_entry(&entry.id).unwrap();
        assert!(database.list_entries(&task.id, 50, 0).unwrap().is_empty());
        database.restore_entry(&entry.id).unwrap();
        assert_eq!(database.list_entries(&task.id, 50, 0).unwrap().len(), 1);
    }

    #[test]
    fn file_database_survives_reopen() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("taskline.sqlite3");
        let task_id = {
            let database = Database::open(&path).unwrap();
            task(&database).id
        };
        let reopened = Database::open(&path).unwrap();
        assert_eq!(reopened.list_tasks().unwrap()[0].id, task_id);
    }

    #[test]
    fn reopens_a_legacy_database_and_widens_the_entry_type_constraint() {
        // Lay down a v1-style schema (no 'worklog' in the CHECK, no
        // duration_minutes column, no schema_meta key for the migration).
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("legacy.sqlite3");
        let legacy = Connection::open(&path).unwrap();
        legacy.execute_batch(MIGRATION).unwrap();
        legacy.execute_batch(ATTACHMENT_MIGRATION).unwrap();
        // Strip the marker that ensure_worklog_entry_type would look for
        // so reopening forces the constraint widening.
        legacy
            .execute(
                "DELETE FROM schema_meta WHERE key = 'worklog_entry_type_applied'",
                [],
            )
            .unwrap();
        drop(legacy);

        // Reopening the same file should run the migration and accept
        // 'worklog' entries without losing existing rows.
        let database = Database::open(&path).unwrap();
        let task = task(&database);
        let logged = database
            .create_entry(CreateEntryInput {
                task_id: task.id.clone(),
                entry_type: "worklog".into(),
                content_markdown: "Logged 2h after the schema widened.".into(),
                visibility: "private".into(),
                duration_minutes: Some(120),
            })
            .unwrap();
        assert_eq!(logged.entry_type, "worklog");
        assert_eq!(logged.duration_minutes, Some(120));
    }

    #[test]
    fn paginates_a_ten_thousand_entry_thread() {
        let database = Database::memory().unwrap();
        let task = task(&database);
        let connection = database.connection().unwrap();
        let now = now();
        for index in 0..10_000 {
            connection
                .execute(
                    "INSERT INTO work_log_entries
                     (id, task_id, entry_type, content_markdown, visibility, occurred_at, created_at, updated_at)
                     VALUES (?1, ?2, 'note', ?3, 'private', ?4, ?4, ?4)",
                    params![id(), task.id, format!("Entry {index}"), now],
                )
                .unwrap();
        }
        drop(connection);

        assert_eq!(database.list_entries(&task.id, 100, 0).unwrap().len(), 100);
        assert_eq!(
            database.list_entries(&task.id, 100, 9_900).unwrap().len(),
            100
        );
    }

    #[test]
    fn saves_image_attachments_outside_sqlite() {
        let database = Database::memory().unwrap();
        let task = task(&database);
        let entry = entry(&database, &task.id);
        let attachment = database
            .create_attachment(CreateAttachmentInput {
                work_log_entry_id: entry.id,
                original_name: "pasted.png".into(),
                media_type: "image/png".into(),
                base64_data: STANDARD.encode(b"fake-png"),
            })
            .unwrap();

        assert!(Path::new(&attachment.path).exists());
        assert_eq!(database.list_attachments(&task.id).unwrap().len(), 1);
    }

    #[test]
    fn quick_links_are_limited_and_idempotent_per_task() {
        let database = Database::memory().unwrap();
        let task = task(&database);
        for index in 0..3 {
            database
                .create_quick_link(CreateQuickLinkInput {
                    task_id: task.id.clone(),
                    url: format!("https://example.com/{index}"),
                    title: format!("Resource {index}"),
                    domain: "example.com".into(),
                    provider: "web".into(),
                })
                .unwrap();
        }

        let duplicate = database
            .create_quick_link(CreateQuickLinkInput {
                task_id: task.id.clone(),
                url: "https://example.com/1".into(),
                title: "Updated resource".into(),
                domain: "example.com".into(),
                provider: "web".into(),
            })
            .unwrap();
        assert_eq!(duplicate.title, "Updated resource");
        assert_eq!(database.list_quick_links(&task.id).unwrap().len(), 3);

        let result = database.create_quick_link(CreateQuickLinkInput {
            task_id: task.id.clone(),
            url: "https://example.com/4".into(),
            title: "Too much".into(),
            domain: "example.com".into(),
            provider: "web".into(),
        });
        assert!(matches!(result, Err(RepositoryError::Invalid(_))));
    }

    #[test]
    fn deleting_a_quick_link_frees_a_header_slot() {
        let database = Database::memory().unwrap();
        let task = task(&database);
        let link = database
            .create_quick_link(CreateQuickLinkInput {
                task_id: task.id.clone(),
                url: "https://figma.com/file/taskline".into(),
                title: "Design file".into(),
                domain: "figma.com".into(),
                provider: "figma".into(),
            })
            .unwrap();

        database.delete_quick_link(&link.id).unwrap();
        assert!(database.list_quick_links(&task.id).unwrap().is_empty());

        let replacement = database
            .create_quick_link(CreateQuickLinkInput {
                task_id: task.id.clone(),
                url: "https://docs.google.com/spreadsheets/d/demo".into(),
                title: "Plan sheet".into(),
                domain: "docs.google.com".into(),
                provider: "sheet".into(),
            })
            .unwrap();
        assert_eq!(replacement.provider, "sheet");
    }
}
