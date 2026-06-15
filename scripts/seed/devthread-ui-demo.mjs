import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const migrationsDir = join(repoRoot, "apps", "desktop", "src-tauri", "migrations");
const dbPath = process.env.DEVTHREAD_DB_PATH ?? defaultDatabasePath();
const dataDir = dirname(dbPath);
const attachmentsDir = join(dataDir, "attachments");

mkdirSync(dataDir, { recursive: true });
mkdirSync(attachmentsDir, { recursive: true });

applyMigrations();
seed();

function seed() {
  const folders = [
    folder("seedui-folder-design", "Design System", "2026-06-10T08:30:00Z"),
    folder("seedui-folder-quality", "QA & Reliability", "2026-06-10T09:00:00Z"),
    folder("seedui-folder-launch", "Launch Readiness", "2026-06-10T09:30:00Z"),
  ];

  const tasks = [
    task("seedui-task-timeline-polish", "DT-141 Align timeline rows and compact link previews", "active", "seedui-folder-design", 95, "Tune metadata alignment, action sizing, and link preview width for screenshot-ready timeline density.", "Run one visual pass at 1280px and 390px before taking release screenshots.", "2026-06-14T08:50:00Z"),
    task("seedui-task-sidebar-density", "DT-139 Sidebar folder density and hover actions", "active", "seedui-folder-design", 120, "Keep the task tree compact while preserving scan speed, hover creation, and clean selected rows.", "Capture the sidebar with 3 folders and search active.", "2026-06-14T08:20:00Z"),
    task("seedui-task-composer-tools", "DT-136 Composer tools and @ type switcher polish", "active", null, 80, "Make daily updates quick: entry type switch, image attach, clear draft, and compact tool separation.", "Confirm pointer states in every dropdown item.", "2026-06-14T07:35:00Z"),
    task("seedui-task-visual-regression", "DT-132 Visual regression smoke for timeline and sidebar", "active", "seedui-folder-quality", 150, "Add screenshot checks around the high-risk surfaces used in public demos.", "Record baseline after the new demo seed is loaded.", "2026-06-13T17:10:00Z"),
    task("seedui-task-screenshot-kit", "DT-130 GitHub screenshot workspace preparation", "active", "seedui-folder-launch", 70, "Prepare a believable local workspace with real product language, worklogs, links, and UI evidence.", "Take one dark theme and one light theme pass.", "2026-06-13T15:40:00Z"),

    task("seedui-task-command-menu", "DT-127 Command palette outline for task actions", "planned", null, 110, "Map core commands for create task, switch task, add update, and move to folder.", "Keep the first version keyboard-first and local only.", "2026-06-12T18:20:00Z"),
    task("seedui-task-heatmap", "DT-125 Token activity heatmap concept", "paused", null, 180, "Explore whether a lightweight contribution-style view helps show project momentum.", "Resume after timeline screenshots are approved.", "2026-06-11T16:10:00Z"),
    task("seedui-task-archive-restore", "DT-124 Restore flow for accidentally archived tasks", "planned", "seedui-folder-quality", 90, "Design a reversible archive experience without adding a heavy trash view.", "Write acceptance criteria before implementation.", "2026-06-11T15:30:00Z"),
    task("seedui-task-release-notes", "DT-122 Draft release notes for UI polish milestone", "done", "seedui-folder-launch", 60, "Collect the user-visible changes from sidebar, composer, and timeline passes.", "Share final copy after screenshots are selected.", "2026-06-11T14:50:00Z"),
    task("seedui-task-keyboard-shortcuts", "DT-121 Keyboard shortcut overlay for timeline actions", "blocked", null, 130, "Expose useful shortcuts without covering the writing surface.", "Wait for final command naming from product.", "2026-06-11T12:10:00Z"),

    task("seedui-task-color-token-audit", "DT-118 Theme token audit for dark and light modes", "planned", "seedui-folder-design", 100, "Replace one-off colors with semantic tokens and verify contrast on muted rows.", "Audit timeline, sidebar, dialogs, and dropdowns.", "2026-06-10T17:20:00Z"),
    task("seedui-task-empty-states", "DT-116 Search empty states and folder empty copy", "done", "seedui-folder-design", 65, "Make empty states short, specific, and resilient to long search strings.", "Keep copy under one line at narrow sidebar width.", "2026-06-10T16:40:00Z"),
    task("seedui-task-icon-pass", "DT-114 Icon stroke and sizing pass", "paused", "seedui-folder-design", 75, "Normalize lucide icon weight, sizing, hover treatment, and header color matching.", "Return after final task icon exploration.", "2026-06-10T16:05:00Z"),
    task("seedui-task-a11y-smoke", "DT-113 Accessibility smoke for menus and dialogs", "planned", "seedui-folder-quality", 140, "Check focus order, aria labels, escape behavior, and keyboard navigation for core flows.", "Run a manual keyboard-only pass in the desktop shell.", "2026-06-10T14:35:00Z"),
    task("seedui-task-regression-matrix", "DT-112 Regression matrix for task lifecycle", "planned", "seedui-folder-quality", 125, "Document task create, edit, status, folder, search, and timeline regression cases.", "Convert the matrix into test fixtures.", "2026-06-10T13:25:00Z"),
    task("seedui-task-flaky-tests", "DT-111 Stabilize composer menu tests", "blocked", "seedui-folder-quality", 70, "Reduce timing assumptions in dropdown tests that depend on async type filtering.", "Replace brittle keyboard waits with visible state assertions.", "2026-06-10T12:10:00Z"),
    task("seedui-task-docs-changelog", "DT-110 Changelog notes for screenshot release", "planned", "seedui-folder-launch", 55, "Write a compact changelog entry that explains the UI polish without overselling it.", "Link screenshots after final crop.", "2026-06-10T11:45:00Z"),
    task("seedui-task-update-copy", "DT-109 App update copy and local data note", "done", "seedui-folder-launch", 45, "Clarify that app updates replace the bundle but keep the local SQLite workspace.", "Keep copy short inside the update dialog.", "2026-06-10T10:20:00Z"),

    task("seedui-task-link-parser", "DT-108 Link parser edge cases for markdown content", "planned", null, 100, "Handle punctuation, repeated URLs, and markdown links without duplicate preview rows.", "Add tests for trailing punctuation and query strings.", "2026-06-09T17:55:00Z"),
    task("seedui-task-image-attachments", "DT-107 Image attachment preview density", "paused", null, 85, "Keep attached images useful in the timeline without creating a gallery-heavy layout.", "Test 1, 3, and 6 image entry layouts.", "2026-06-09T16:45:00Z"),
    task("seedui-task-worklog-rollup", "DT-106 Worklog rollup for weekly progress review", "planned", null, 160, "Summarize duration entries across tasks for a lightweight weekly review.", "Keep the first view text-first with minimal charts.", "2026-06-09T15:05:00Z"),
    task("seedui-task-db-backup", "DT-105 Local database backup reminder", "blocked", null, 115, "Design a local-only backup reminder that does not feel like account sync.", "Decide whether backup lives in settings or command palette.", "2026-06-09T13:10:00Z"),
    task("seedui-task-import-json", "DT-104 Import task bundle from JSON", "planned", null, 180, "Support a simple JSON import for demo workspaces and QA fixtures.", "Draft the import format and validation failures.", "2026-06-09T11:40:00Z"),
    task("seedui-task-export-markdown", "DT-103 Markdown export for selected task", "done", null, 95, "Export one task with description, updates, worklogs, links, and attachment names.", "Add export command after command palette exists.", "2026-06-08T17:10:00Z"),
    task("seedui-task-status-menu", "DT-102 Status menu focus ring cleanup", "done", null, 40, "Remove odd outline treatment from the status dropdown while keeping keyboard focus visible.", "Verify in light theme and dark theme.", "2026-06-08T15:30:00Z"),
    task("seedui-task-folder-animations", "DT-101 Folder expand and collapse motion", "done", null, 50, "Add subtle open and close motion without making the sidebar feel playful.", "Keep animation disabled by reduced motion settings.", "2026-06-08T14:20:00Z"),
    task("seedui-task-search-clear", "DT-100 Search clear action and max length", "done", null, 55, "Swap the search icon to clear once a query exists and limit long input for predictable layout.", "Keep the empty state query truncated.", "2026-06-08T13:35:00Z"),
    task("seedui-task-folder-quick-add", "DT-099 Folder hover quick-add task action", "planned", null, 70, "Allow adding a task directly to a folder from the hover plus action.", "Remove duplicate create option from folder context menu.", "2026-06-08T12:45:00Z"),
    task("seedui-task-tooltip-pass", "DT-098 Tooltip language and timing pass", "paused", null, 65, "Make icon-only controls understandable without adding visible instructional text.", "Review sidebar, composer, and timeline controls.", "2026-06-07T17:25:00Z"),
    task("seedui-task-preferences", "DT-097 Preferences shell for local workspace settings", "planned", null, 210, "Create a restrained settings surface for theme, backups, and screenshot preferences.", "Start only after core task flows settle.", "2026-06-07T15:15:00Z"),
    task("seedui-task-release-checklist", "DT-096 Public repo release checklist", "planned", null, 75, "Track README screenshots, build instructions, known limits, and demo dataset cleanup.", "Confirm the screenshots do not expose local paths.", "2026-06-07T13:55:00Z"),
    task("seedui-task-readme-flow", "DT-095 README user flow section", "blocked", null, 90, "Explain the core loop: create task, log updates, attach evidence, review progress.", "Wait for final screenshots before writing captions.", "2026-06-07T12:20:00Z"),
    task("seedui-task-drag-resize", "DT-094 Sidebar drag resize hit area", "planned", null, 80, "Make the resize affordance easy to grab while staying visually quiet.", "Test on trackpad and mouse.", "2026-06-06T18:05:00Z"),
    task("seedui-task-window-chrome", "DT-093 Desktop window chrome spacing review", "paused", null, 60, "Review top chrome density and make sure it does not fight the sidebar header.", "Revisit after screenshot capture.", "2026-06-06T16:40:00Z"),
    task("seedui-task-offline-preview", "DT-092 Offline link metadata fallback", "planned", null, 120, "Show useful link previews even when metadata fetch fails or the user is offline.", "Cache title and domain on successful fetch.", "2026-06-06T15:10:00Z"),
    task("seedui-task-report-view", "DT-091 Report view privacy defaults", "paused", null, 170, "Keep all timeline entries private by default while preserving future report exports.", "Revisit after report eligibility returns.", "2026-06-06T13:05:00Z"),
    task("seedui-task-crash-recovery", "DT-090 Draft crash recovery for composer text", "planned", null, 135, "Persist composer draft text so a restart does not lose a half-written update.", "Define storage key per selected task.", "2026-06-06T11:25:00Z"),
  ];

  const entries = [
    entry("seedui-entry-timeline-1", "seedui-task-timeline-polish", "note", "Compared the current timeline against compact chat-style history. The row should read as one line of metadata, one content block, then a quiet timestamp on the right.", "2026-06-14T06:50:00Z"),
    entry("seedui-entry-timeline-2", "seedui-task-timeline-polish", "progress", "Reduced link previews to a short horizontal row and kept the full URL available through the tooltip. Reference pass: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout and https://playwright.dev/docs/test-snapshots.", "2026-06-14T07:20:00Z", 45),
    entry("seedui-entry-timeline-3", "seedui-task-timeline-polish", "finding", "The dot was visually higher than the type label because the left rail had less top padding than the metadata row. Aligning against the 20px label height makes the row feel calmer.", "2026-06-14T08:05:00Z"),
    entry("seedui-entry-timeline-4", "seedui-task-timeline-polish", "worklog", "Finished the first density pass: metadata row alignment, smaller action icons, compact link card width, and dashed date separators. Jira note: https://linear.app/devthread/issue/DT-141/timeline-density-pass", "2026-06-14T08:42:00Z", 95),

    entry("seedui-entry-sidebar-1", "seedui-task-sidebar-density", "decision", "Use indentation and folder icons only. No vertical folder border and no count on the folder row; the hover plus is the only secondary action.", "2026-06-13T10:05:00Z"),
    entry("seedui-entry-sidebar-2", "seedui-task-sidebar-density", "progress", "Search now returns tasks only, clears in one click, and stops rendering folders when no task matches. The empty-state query is truncated so long strings cannot break the panel.", "2026-06-13T12:30:00Z", 80),
    entry("seedui-entry-sidebar-3", "seedui-task-sidebar-density", "next_step", "Take screenshots at collapsed, default, and wide sidebar widths before the public README pass.", "2026-06-14T08:20:00Z"),

    entry("seedui-entry-composer-1", "seedui-task-composer-tools", "note", "Keep the placeholder professional and direct: \"What's the update?\". The helper text owns the @ behavior: Type @ to switch entry type. (note, progress, blocker, etc)", "2026-06-13T08:15:00Z"),
    entry("seedui-entry-composer-2", "seedui-task-composer-tools", "progress", "Removed visible privacy/report controls from the composer for now. New entries stay private by default while the UI remains focused on writing.", "2026-06-13T13:25:00Z", 60),
    entry("seedui-entry-composer-3", "seedui-task-composer-tools", "blocker", "Dropdown pointer states were inconsistent across entry type options and the image picker tools. Need a single menu item style.", "2026-06-14T07:35:00Z"),

    entry("seedui-entry-regression-1", "seedui-task-visual-regression", "note", "Baseline surfaces: sidebar tree, search empty state, composer tool row, timeline dense row, status menu, and link preview row.", "2026-06-12T09:15:00Z"),
    entry("seedui-entry-regression-2", "seedui-task-visual-regression", "progress", "Added a manual Playwright checklist and captured a first smoke image for the timeline. Reference: https://playwright.dev/docs/screenshots", "2026-06-13T17:10:00Z", 120),

    entry("seedui-entry-screenshot-1", "seedui-task-screenshot-kit", "note", "Screenshot story: a UI developer is actively polishing DevThread itself. Keep tasks realistic, fake, and close to a Jira workflow.", "2026-06-13T10:10:00Z"),
    entry("seedui-entry-screenshot-2", "seedui-task-screenshot-kit", "progress", "Seed data includes 36 tasks, 3 folders, active work, blocked items, paused explorations, completed polish, quick links, and image attachments.", "2026-06-13T15:40:00Z", 70),
  ];

  for (const item of tasks.slice(5)) {
    entries.push(
      entry(`${item.id}-entry-1`, item.id, item.status === "blocked" ? "blocker" : item.status === "done" ? "progress" : "note", `${item.title} is tracked with a Jira-style acceptance path. Current focus: ${item.nextStep}`, addMinutes(item.updatedAt, -35)),
    );
    if (["planned", "paused", "active"].includes(item.status)) {
      entries.push(
        entry(`${item.id}-entry-2`, item.id, item.status === "paused" ? "decision" : "next_step", `Related workflow note: https://linear.app/devthread/issue/${item.title.split(" ")[0].toLowerCase()}/${slug(item.title)}. Keep the first pass compact and testable.`, item.updatedAt, item.status === "planned" ? null : 35),
      );
    }
  }
  entries.push(...buildDemoWorklogs(tasks));

  const quickLinks = [
    link("seedui-link-timeline-jira", "seedui-task-timeline-polish", "https://linear.app/devthread/issue/DT-141/timeline-density-pass", "DT-141 Timeline density pass", "linear.app", "linear"),
    link("seedui-link-timeline-figma", "seedui-task-timeline-polish", "https://www.figma.com/file/devthread-timeline-polish", "Timeline polish frame", "figma.com", "figma"),
    link("seedui-link-timeline-playwright", "seedui-task-timeline-polish", "https://playwright.dev/docs/test-snapshots", "Playwright visual snapshots", "playwright.dev", "docs"),
    link("seedui-link-sidebar-jira", "seedui-task-sidebar-density", "https://linear.app/devthread/issue/DT-139/sidebar-density", "DT-139 Sidebar density", "linear.app", "linear"),
    link("seedui-link-composer-spec", "seedui-task-composer-tools", "https://www.figma.com/file/devthread-composer-tools", "Composer tools spec", "figma.com", "figma"),
    link("seedui-link-regression", "seedui-task-visual-regression", "https://playwright.dev/docs/screenshots", "Screenshot testing notes", "playwright.dev", "docs"),
    link("seedui-link-release", "seedui-task-screenshot-kit", "https://github.com/noormohammed/devthread/issues/130", "GitHub screenshot checklist", "github.com", "github"),
  ];

  const attachments = [
    attachment("seedui-attachment-timeline-density", "seedui-entry-timeline-4", "timeline-density-pass.svg", "Timeline density pass", ["Metadata aligned", "Short link row", "Quiet timestamp"], "#d6c5a1"),
    attachment("seedui-attachment-sidebar-tree", "seedui-entry-sidebar-2", "sidebar-tree-search.svg", "Sidebar search pass", ["Tasks only", "Folder quick add", "Empty copy"], "#84a98c"),
    attachment("seedui-attachment-screenshot-kit", "seedui-entry-screenshot-2", "github-screenshot-board.svg", "Screenshot workspace", ["36 tasks", "3 folders", "Realistic logs"], "#8aa4d6"),
  ];

  const sql = [
    "PRAGMA foreign_keys = ON;",
    "BEGIN;",
    "DELETE FROM attachments WHERE id LIKE 'seedui-%';",
    "DELETE FROM task_quick_links WHERE id LIKE 'seedui-%';",
    "DELETE FROM work_log_revisions WHERE id LIKE 'seedui-%';",
    "DELETE FROM work_log_entries WHERE id LIKE 'seedui-%';",
    "DELETE FROM tasks WHERE id LIKE 'seedui-%';",
    "DELETE FROM folders WHERE id LIKE 'seedui-%';",
    ...folders.map(insertFolder),
    ...tasks.map(insertTask),
    ...entries.map(insertEntry),
    ...quickLinks.map(insertLink),
    ...attachments.map(insertAttachment),
    "COMMIT;",
  ].join("\n");

  runSql(sql);

  const worklogCount = entries.filter((item) => item.entryType === "worklog").length;
  const worklogMinutes = entries.reduce((sum, item) => sum + (item.entryType === "worklog" ? item.durationMinutes ?? 0 : 0), 0);
  console.log(`Seeded ${tasks.length} tasks, ${folders.length} folders, ${entries.length} timeline entries, ${quickLinks.length} quick links, and ${attachments.length} images.`);
  console.log(`Worklog demo data: ${worklogCount} logs · ${Math.round(worklogMinutes / 60)}h across the last 12 months.`);
  console.log(`Database: ${dbPath}`);
}

function applyMigrations() {
  const baseMigrations = ["001_initial.sql", "002_attachments.sql", "003_folders.sql", "007_quick_links.sql"]
    .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
    .join("\n\n");

  runSql(baseMigrations);

  const hasFolderColumn = runSql("SELECT COUNT(*) FROM pragma_table_info('tasks') WHERE name = 'folder_id';", { capture: true }).trim();
  if (hasFolderColumn !== "1") {
    runSql("ALTER TABLE tasks ADD COLUMN folder_id TEXT REFERENCES folders(id);");
  }

  const hasDurationColumn = runSql("SELECT COUNT(*) FROM pragma_table_info('work_log_entries') WHERE name = 'duration_minutes';", { capture: true }).trim();
  if (hasDurationColumn !== "1") {
    runSql("ALTER TABLE work_log_entries ADD COLUMN duration_minutes INTEGER;");
  }
}

function folder(id, name, at) {
  return { id, name, createdAt: at, updatedAt: at };
}

function task(id, title, status, folderId, estimate, description, nextStep, updatedAt) {
  return {
    id,
    title,
    description,
    status,
    nextStep,
    estimatedMinutes: estimate * 4,
    folderId,
    createdAt: addMinutes(updatedAt, -420),
    updatedAt,
  };
}

function entry(id, taskId, entryType, content, occurredAt, durationMinutes = null) {
  return {
    id,
    taskId,
    entryType,
    content,
    visibility: "private",
    occurredAt,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    durationMinutes,
  };
}

function link(id, taskId, url, title, domain, provider) {
  return {
    id,
    taskId,
    url,
    title,
    domain,
    provider,
    createdAt: "2026-06-14T08:55:00Z",
    updatedAt: "2026-06-14T08:55:00Z",
  };
}

function buildDemoWorklogs(tasks) {
  const focusTasks = tasks.filter((item) => item.status !== "blocked");
  const content = [
    "Reviewed acceptance criteria and split the UI pass into a small implementation checklist.",
    "Paired the layout changes with a quick visual smoke pass before moving to the next surface.",
    "Validated dark gray and light gray theme tokens against the updated task timeline treatment.",
    "Captured before and after notes for the README screenshot story.",
    "Reworked spacing and text hierarchy so the panel reads faster during repeated use.",
    "Checked hover, focus, and empty states after the interaction changes landed.",
    "Trimmed the component API and kept the implementation aligned with existing shadcn patterns.",
    "Ran a local desktop pass and logged follow-up polish items for the next UI review.",
  ];
  const links = [
    "https://linear.app/devthread/view/ui-polish",
    "https://playwright.dev/docs/screenshots",
    "https://www.figma.com/file/devthread-product-polish",
    "https://github.com/noormohammed/devthread/pull/42",
    "https://ui.shadcn.com/docs/components/card",
  ];
  const logs = [];
  const end = new Date("2026-06-14T18:00:00Z");
  let cursor = 0;

  for (let offset = 0; offset < 365; offset += 1) {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - offset);
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    const cadence = offset < 21 ? 1 : offset < 120 ? 2 : offset < 240 ? 3 : 5;
    if (offset % cadence !== 0 && offset % 11 !== 0) continue;

    const entriesForDay = offset < 28 ? 2 + (offset % 3 === 0 ? 1 : 0) : offset % 9 === 0 ? 2 : 1;
    for (let index = 0; index < entriesForDay; index += 1) {
      const task = focusTasks[(offset + index * 7) % focusTasks.length];
      const minutes = [25, 35, 45, 50, 60, 75, 90, 110, 125][(offset + index * 3) % 9];
      const hour = 9 + ((offset + index * 2) % 7);
      const minute = [5, 15, 25, 35, 45][(offset + index) % 5];
      const occurred = new Date(day);
      occurred.setUTCHours(hour, minute, 0, 0);
      const taskKey = task.title.match(/\b[A-Z]{2,}-\d+\b/)?.[0] ?? "DT";
      const body = content[(offset + index) % content.length];
      const maybeLink = (offset + index) % 5 === 0 ? ` Reference: ${links[(offset + index) % links.length]}` : "";
      logs.push(
        entry(
          `seedui-worklog-${String(cursor).padStart(4, "0")}`,
          task.id,
          "worklog",
          `${taskKey}: ${body}${maybeLink}`,
          occurred.toISOString().replace(".000Z", "Z"),
          minutes,
        ),
      );
      cursor += 1;
    }
  }

  return logs.reverse();
}

function attachment(id, entryId, fileName, title, rows, accent) {
  const svg = renderMockImage(title, rows, accent);
  const sha = createHash("sha256").update(svg).digest("hex");
  const relativePath = join(sha.slice(0, 2), `${sha}.svg`);
  const absolutePath = join(attachmentsDir, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, svg, "utf8");

  return {
    id,
    entryId,
    originalName: fileName,
    mediaType: "image/svg+xml",
    relativePath,
    byteSize: Buffer.byteLength(svg),
    sha,
    createdAt: "2026-06-14T08:55:00Z",
  };
}

function insertFolder(item) {
  return `INSERT INTO folders (id, name, created_at, updated_at, deleted_at) VALUES (${q(item.id)}, ${q(item.name)}, ${q(item.createdAt)}, ${q(item.updatedAt)}, NULL);`;
}

function insertTask(item) {
  return `INSERT INTO tasks (id, title, description_markdown, status, next_step, estimated_minutes, folder_id, created_at, updated_at, deleted_at) VALUES (${q(item.id)}, ${q(item.title)}, ${q(item.description)}, ${q(item.status)}, ${q(item.nextStep)}, ${item.estimatedMinutes}, ${q(item.folderId)}, ${q(item.createdAt)}, ${q(item.updatedAt)}, NULL);`;
}

function insertEntry(item) {
  const duration = item.durationMinutes == null ? "NULL" : String(item.durationMinutes);
  return `INSERT INTO work_log_entries (id, task_id, entry_type, content_markdown, visibility, occurred_at, created_at, updated_at, duration_minutes, deleted_at) VALUES (${q(item.id)}, ${q(item.taskId)}, ${q(item.entryType)}, ${q(item.content)}, ${q(item.visibility)}, ${q(item.occurredAt)}, ${q(item.createdAt)}, ${q(item.updatedAt)}, ${duration}, NULL);`;
}

function insertLink(item) {
  return `INSERT INTO task_quick_links (id, task_id, url, title, domain, provider, created_at, updated_at, deleted_at) VALUES (${q(item.id)}, ${q(item.taskId)}, ${q(item.url)}, ${q(item.title)}, ${q(item.domain)}, ${q(item.provider)}, ${q(item.createdAt)}, ${q(item.updatedAt)}, NULL);`;
}

function insertAttachment(item) {
  return `INSERT INTO attachments (id, work_log_entry_id, original_name, media_type, relative_path, byte_size, sha256, created_at, deleted_at) VALUES (${q(item.id)}, ${q(item.entryId)}, ${q(item.originalName)}, ${q(item.mediaType)}, ${q(item.relativePath)}, ${item.byteSize}, ${q(item.sha)}, ${q(item.createdAt)}, NULL);`;
}

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

function q(value) {
  if (value == null) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function addMinutes(value, minutes) {
  return new Date(new Date(value).getTime() + minutes * 60_000).toISOString().replace(".000Z", "Z");
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
}

function renderMockImage(title, rows, accent) {
  const rowText = rows
    .map((row, index) => `<text x="48" y="${150 + index * 38}" fill="#c9d0dc" font-size="20">${escapeXml(row)}</text><rect x="310" y="${134 + index * 38}" width="${180 - index * 28}" height="12" rx="6" fill="${accent}" opacity="${0.72 - index * 0.12}"/>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <rect width="960" height="540" fill="#15171b"/>
  <rect x="28" y="28" width="904" height="484" rx="18" fill="#1d2026" stroke="#30343c"/>
  <rect x="48" y="54" width="168" height="16" rx="8" fill="${accent}"/>
  <text x="48" y="112" fill="#f3f4f6" font-family="Inter, ui-sans-serif, system-ui" font-size="34" font-weight="650">${escapeXml(title)}</text>
  ${rowText}
  <rect x="48" y="326" width="540" height="74" rx="12" fill="#252932"/>
  <rect x="70" y="350" width="260" height="14" rx="7" fill="#d7dce5" opacity=".8"/>
  <rect x="70" y="374" width="396" height="10" rx="5" fill="#8a94a6" opacity=".65"/>
  <rect x="650" y="90" width="208" height="284" rx="14" fill="#252932"/>
  <rect x="676" y="124" width="156" height="12" rx="6" fill="${accent}" opacity=".78"/>
  <rect x="676" y="164" width="112" height="12" rx="6" fill="#8a94a6" opacity=".55"/>
  <rect x="676" y="204" width="140" height="12" rx="6" fill="#8a94a6" opacity=".45"/>
</svg>`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function defaultDatabasePath() {
  const home = process.env.HOME ?? process.env.USERPROFILE;
  if (!home) {
    throw new Error("Could not determine home directory. Set DEVTHREAD_DB_PATH.");
  }

  if (process.platform === "darwin") {
    return join(home, "Library", "Application Support", "io.devthread.desktop", "devthread.sqlite3");
  }

  if (process.platform === "win32") {
    return join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "io.devthread.desktop", "devthread.sqlite3");
  }

  return join(process.env.XDG_DATA_HOME ?? join(home, ".local", "share"), "io.devthread.desktop", "devthread.sqlite3");
}
