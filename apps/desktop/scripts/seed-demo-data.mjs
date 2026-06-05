import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, "..");
const dbPath = process.env.TASKLINE_DB_PATH ?? defaultDatabasePath();
const migrationsDir = join(appDir, "src-tauri", "migrations");

mkdirSync(dirname(dbPath), { recursive: true });

const baseMigrations = ["001_initial.sql", "002_attachments.sql"]
  .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
  .join("\n\n");
const folderMigration = readFileSync(
  join(migrationsDir, "003_folders.sql"),
  "utf8",
);

runSql(baseMigrations);

const hasFolderColumn = runSql(
  "SELECT COUNT(*) FROM pragma_table_info('tasks') WHERE name = 'folder_id';",
  { capture: true },
).trim();

if (hasFolderColumn !== "1") {
  runSql("ALTER TABLE tasks ADD COLUMN folder_id TEXT REFERENCES folders(id);");
}

runSql(folderMigration);

const sql = `
PRAGMA foreign_keys = ON;

INSERT INTO folders (id, name, created_at, updated_at, deleted_at)
VALUES
  ('demo-folder-ux', 'UX Polish', '2026-06-03T09:00:00Z', '2026-06-05T10:15:00Z', NULL),
  ('demo-folder-launch', 'Launch Prep', '2026-06-03T09:20:00Z', '2026-06-05T10:08:00Z', NULL)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  updated_at = excluded.updated_at,
  deleted_at = NULL;

INSERT INTO tasks
  (id, title, description_markdown, status, next_step, folder_id, created_at, updated_at, deleted_at)
VALUES
  (
    'demo-task-onboarding',
    'Polish onboarding task capture for first-run users',
    'Tighten the first-run task capture experience so a new user can create a useful thread without learning the whole product first.',
    'active',
    'Record the empty-state pass and confirm the rename-folder dialog feels clear.',
    'demo-folder-ux',
    '2026-06-03T09:10:00Z',
    '2026-06-05T10:15:00Z',
    NULL
  ),
  (
    'demo-task-composer',
    'Composer @ type switcher and clean input behavior',
    'Make the composer feel fast for daily logging: @ should change the entry type, narrow results while typing, and remove the trigger text after selection.',
    'blocked',
    'Confirm keyboard selection behavior, then close the type menu immediately after selection.',
    'demo-folder-ux',
    '2026-06-03T11:25:00Z',
    '2026-06-05T09:42:00Z',
    NULL
  ),
  (
    'demo-task-feedback-video',
    'Prepare founder feedback walkthrough video',
    'Create a short product walkthrough with realistic tasks, folders, and timeline history so reviewers can react to the real workflow.',
    'planned',
    'Record a 90 second pass showing folders, search, status chips, and the timeline.',
    'demo-folder-launch',
    '2026-06-04T08:30:00Z',
    '2026-06-05T10:08:00Z',
    NULL
  ),
  (
    'demo-task-sidebar',
    'Sidebar hierarchy, resizing, and long-title handling',
    'Bring the task sidebar closer to a desktop editor: collapsible folders, line hierarchy, drag resize, and reliable truncation for long task names.',
    'done',
    'Share the before and after screenshots with the feedback group.',
    'demo-folder-ux',
    '2026-06-02T14:05:00Z',
    '2026-06-05T08:55:00Z',
    NULL
  )
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  description_markdown = excluded.description_markdown,
  status = excluded.status,
  next_step = excluded.next_step,
  folder_id = excluded.folder_id,
  updated_at = excluded.updated_at,
  deleted_at = NULL;

INSERT INTO work_log_entries
  (id, task_id, entry_type, content_markdown, visibility, occurred_at, created_at, updated_at, deleted_at)
VALUES
  ('demo-entry-onboarding-1', 'demo-task-onboarding', 'note', 'Mapped the first-run path from empty sidebar to a named task inside a folder. The biggest friction is naming: users need a clear prompt before the folder exists.', 'report', '2026-06-03T09:18:00Z', '2026-06-03T09:18:00Z', '2026-06-03T09:18:00Z', NULL),
  ('demo-entry-onboarding-2', 'demo-task-onboarding', 'finding', 'The default "Backlog" naming pattern looks automatic and weak in a demo. A small naming dialog makes the folder feel intentional and keeps the workspace cleaner.', 'report', '2026-06-04T13:35:00Z', '2026-06-04T13:35:00Z', '2026-06-04T13:35:00Z', NULL),
  ('demo-entry-onboarding-3', 'demo-task-onboarding', 'progress', 'Added the folder naming flow, rename action, and grouped task list. Folder clicks now expand or collapse instead of opening the first child task.', 'report', '2026-06-05T09:10:00Z', '2026-06-05T09:10:00Z', '2026-06-05T09:10:00Z', NULL),
  ('demo-entry-onboarding-4', 'demo-task-onboarding', 'next_step', 'Do one screen-recording pass with an empty database and verify the first useful task can be captured in under 20 seconds.', 'private', '2026-06-05T10:15:00Z', '2026-06-05T10:15:00Z', '2026-06-05T10:15:00Z', NULL),

  ('demo-entry-composer-1', 'demo-task-composer', 'decision', 'Use @ only as a type switcher. After the user selects a type, remove the @ query from the composer so the final note stays clean.', 'report', '2026-06-03T11:40:00Z', '2026-06-03T11:40:00Z', '2026-06-03T11:40:00Z', NULL),
  ('demo-entry-composer-2', 'demo-task-composer', 'progress', 'Bare @ now opens the full entry-type list, and typing after @ filters the menu down to matching types.', 'report', '2026-06-04T16:25:00Z', '2026-06-04T16:25:00Z', '2026-06-04T16:25:00Z', NULL),
  ('demo-entry-composer-3', 'demo-task-composer', 'blocker', 'The remaining polish is keyboard flow: selection should close the dropdown, preserve cursor position, and never leave partial filter text behind.', 'report', '2026-06-05T09:42:00Z', '2026-06-05T09:42:00Z', '2026-06-05T09:42:00Z', NULL),

  ('demo-entry-feedback-1', 'demo-task-feedback-video', 'note', 'Goal for the video: show Taskline as a local work journal, not a generic task board. The strongest flow is task context, daily updates, and quick type switching.', 'private', '2026-06-04T08:38:00Z', '2026-06-04T08:38:00Z', '2026-06-04T08:38:00Z', NULL),
  ('demo-entry-feedback-2', 'demo-task-feedback-video', 'decision', 'Keep the demo to four realistic threads across two folders. That gives enough hierarchy and timeline density without making the sidebar feel staged.', 'report', '2026-06-04T17:12:00Z', '2026-06-04T17:12:00Z', '2026-06-04T17:12:00Z', NULL),
  ('demo-entry-feedback-3', 'demo-task-feedback-video', 'next_step', 'Record a pass with the sidebar partially widened so the ellipsis and tooltip behavior are visible for long task names.', 'private', '2026-06-05T10:08:00Z', '2026-06-05T10:08:00Z', '2026-06-05T10:08:00Z', NULL),

  ('demo-entry-sidebar-1', 'demo-task-sidebar', 'finding', 'Long titles exposed a layout issue in the scroll area: the row content could expand wider than the resizable sidebar.', 'report', '2026-06-04T10:05:00Z', '2026-06-04T10:05:00Z', '2026-06-04T10:05:00Z', NULL),
  ('demo-entry-sidebar-2', 'demo-task-sidebar', 'progress', 'Moved the collapse control into the sidebar, added a slim expand rail, and kept the hierarchy visual as lines instead of heavy cards.', 'report', '2026-06-04T18:45:00Z', '2026-06-04T18:45:00Z', '2026-06-04T18:45:00Z', NULL),
  ('demo-entry-sidebar-3', 'demo-task-sidebar', 'progress', 'Fixed duplicate tooltip behavior by removing the native title attribute and letting the styled tooltip own long-title previews.', 'report', '2026-06-05T08:30:00Z', '2026-06-05T08:30:00Z', '2026-06-05T08:30:00Z', NULL),
  ('demo-entry-sidebar-4', 'demo-task-sidebar', 'decision', 'Marking this done for the demo. The sidebar now reads like a desktop workspace: folders, indentation, resize affordance, and controlled truncation.', 'report', '2026-06-05T08:55:00Z', '2026-06-05T08:55:00Z', '2026-06-05T08:55:00Z', NULL)
ON CONFLICT(id) DO UPDATE SET
  task_id = excluded.task_id,
  entry_type = excluded.entry_type,
  content_markdown = excluded.content_markdown,
  visibility = excluded.visibility,
  occurred_at = excluded.occurred_at,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  deleted_at = NULL;
`;

runSql(sql);

console.log(`Seeded demo data into ${dbPath}`);

function runSql(input, options = {}) {
  const result = spawnSync("sqlite3", [dbPath], {
    input,
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf8",
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  return options.capture ? result.stdout : "";
}

function defaultDatabasePath() {
  const home = process.env.HOME ?? process.env.USERPROFILE;
  if (!home) {
    throw new Error(
      "Could not determine home directory. Set TASKLINE_DB_PATH.",
    );
  }

  if (process.platform === "darwin") {
    return join(
      home,
      "Library",
      "Application Support",
      "dev.taskline.desktop",
      "taskline.sqlite3",
    );
  }

  if (process.platform === "win32") {
    return join(
      process.env.APPDATA ?? join(home, "AppData", "Roaming"),
      "dev.taskline.desktop",
      "taskline.sqlite3",
    );
  }

  return join(
    process.env.XDG_DATA_HOME ?? join(home, ".local", "share"),
    "dev.taskline.desktop",
    "taskline.sqlite3",
  );
}
