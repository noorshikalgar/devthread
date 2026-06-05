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
const MAX_ATTACHMENT_BYTES: usize = 10 * 1024 * 1024;
const TASK_STATUSES: &[&str] = &["planned", "active", "blocked", "paused", "done", "archived"];
const ENTRY_TYPES: &[&str] = &[
    "note",
    "progress",
    "finding",
    "blocker",
    "decision",
    "next_step",
];
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
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEntryInput {
    pub task_id: String,
    pub entry_type: String,
    pub content_markdown: String,
    pub visibility: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEntryInput {
    pub id: String,
    pub entry_type: String,
    pub content_markdown: String,
    pub visibility: String,
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
        let attachments_dir = std::env::temp_dir().join(format!("devthread-test-{}", id()));
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
        connection.execute_batch(FOLDER_MIGRATION)?;
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

    fn connection(&self) -> Result<MutexGuard<'_, Connection>> {
        self.connection.lock().map_err(|_| RepositoryError::Lock)
    }

    pub fn list_tasks(&self) -> Result<Vec<Task>> {
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT id, title, description_markdown, status, next_step, folder_id, created_at, updated_at
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
        let connection = self.connection()?;
        ensure_folder_is_valid(&connection, input.folder_id.as_deref())?;
        let changed = connection.execute(
            "UPDATE tasks SET title = ?2, description_markdown = ?3, status = ?4,
             next_step = ?5, folder_id = ?6, updated_at = ?7 WHERE id = ?1 AND deleted_at IS NULL",
            params![
                input.id,
                title,
                input.description_markdown,
                input.status,
                clean_optional(input.next_step),
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
        let mut statement = connection.prepare(
            "SELECT 1 FROM tasks WHERE folder_id = ?1 AND deleted_at IS NULL LIMIT 1",
        )?;
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
             created_at, updated_at FROM work_log_entries
             WHERE task_id = ?1 AND deleted_at IS NULL
             ORDER BY occurred_at DESC, id DESC LIMIT ?2 OFFSET ?3",
        )?;
        let entries = statement
            .query_map(params![task_id, limit, offset], map_entry)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(entries)
    }

    pub fn create_entry(&self, input: CreateEntryInput) -> Result<WorkLogEntry> {
        allowed(&input.entry_type, ENTRY_TYPES, "entry type")?;
        allowed(&input.visibility, VISIBILITIES, "visibility")?;
        let content = required(input.content_markdown, "Entry content")?;
        let id = id();
        let now = now();
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        ensure_task(&transaction, &input.task_id)?;
        transaction.execute(
            "INSERT INTO work_log_entries
             (id, task_id, entry_type, content_markdown, visibility, occurred_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?6)",
            params![id, input.task_id, input.entry_type, content, input.visibility, now],
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
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        write_revision(&transaction, &input.id, "user_edit")?;
        let changed = transaction.execute(
            "UPDATE work_log_entries SET entry_type = ?2, content_markdown = ?3,
             visibility = ?4, updated_at = ?5 WHERE id = ?1 AND deleted_at IS NULL",
            params![input.id, input.entry_type, content, input.visibility, now()],
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
             created_at, updated_at FROM work_log_entries WHERE id = ?1 AND deleted_at IS NULL",
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
            "SELECT id, title, description_markdown, status, next_step, folder_id, created_at, updated_at
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
             created_at, updated_at FROM work_log_entries WHERE id = ?1 AND deleted_at IS NULL",
            params![entry_id],
            map_entry,
        )
        .optional()?
        .ok_or(RepositoryError::NotFound("Entry"))
}

fn map_task(row: &Row<'_>) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        description_markdown: row.get(2)?,
        status: row.get(3)?,
        next_step: row.get(4)?,
        folder_id: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
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
            folder_id: None,
        });
        assert!(matches!(result, Err(RepositoryError::Invalid(_))));
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
        let path = directory.path().join("devthread.sqlite3");
        let task_id = {
            let database = Database::open(&path).unwrap();
            task(&database).id
        };
        let reopened = Database::open(&path).unwrap();
        assert_eq!(reopened.list_tasks().unwrap()[0].id, task_id);
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
}
