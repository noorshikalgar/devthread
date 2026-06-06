import { formatDuration } from "./duration";
import {
  DEFAULT_SUMMARY_TEMPLATE,
  type SummaryTemplate,
} from "./summaryTemplate";
import type { TaskSummaryContext } from "./taskSummary";
import type { Folder, Task, TaskQuickLink } from "./types";

const TITLE_COLUMN = "Title";
const STATUS_COLUMN = "Status";
const ESTIMATE_COLUMN = "Estimate";
const WORKLOG_COLUMN = "Worklog";
const UPDATES_COLUMN = "Updates";
const QUICK_LINKS_COLUMN = "Quick Links";
const CREATED_COLUMN = "Created";
const UPDATED_COLUMN = "Updated";

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(",");
}

interface ColumnDef {
  key: string;
  resolve: (task: Task, context: TaskSummaryContext) => string;
}

function buildColumns(template: SummaryTemplate): ColumnDef[] {
  const columns: ColumnDef[] = [
    { key: TITLE_COLUMN, resolve: (task) => task.title },
  ];
  if (template.status) {
    columns.push({
      key: STATUS_COLUMN,
      resolve: (task) => statusLabel(task.status),
    });
  }
  if (template.estimate) {
    columns.push({
      key: ESTIMATE_COLUMN,
      resolve: (task) =>
        task.estimatedMinutes ? formatDuration(task.estimatedMinutes) : "",
    });
  }
  if (template.worklog) {
    columns.push({
      key: WORKLOG_COLUMN,
      resolve: (_task, context) => formatWorklogCell(context, template),
    });
    columns.push({
      key: UPDATES_COLUMN,
      resolve: (_task, context) =>
        context.entriesLoaded != null ? String(context.entriesLoaded) : "",
    });
  }
  if (template.quickLinks) {
    columns.push({
      key: QUICK_LINKS_COLUMN,
      resolve: (_task, context) => formatQuickLinksCell(context.quickLinks),
    });
  }
  if (template.createdDate) {
    columns.push({
      key: CREATED_COLUMN,
      resolve: (task) => task.createdAt,
    });
  }
  if (template.updatedDate) {
    columns.push({
      key: UPDATED_COLUMN,
      resolve: (task) => task.updatedAt,
    });
  }
  return columns;
}

function formatWorklogCell(
  context: TaskSummaryContext,
  template: SummaryTemplate,
): string {
  const total = context.totalMinutes ?? 0;
  const hasEntries = (context.entries?.length ?? 0) > 0;
  if (!hasEntries) {
    return total > 0 ? formatDuration(total) : "";
  }
  const totalPart = total > 0 ? formatDuration(total) : "0m";
  if (!template.worklogEntries) return totalPart;
  const entryParts = (context.entries ?? [])
    .map((entry) => {
      const duration = entry.durationMinutes
        ? `${formatDuration(entry.durationMinutes)} `
        : "";
      const content = entry.contentMarkdown.replace(/\s+/g, " ").trim();
      return content ? `${duration}· ${content}` : "";
    })
    .filter((part) => part.length > 0);
  return [totalPart, ...entryParts].join(" | ");
}

function formatQuickLinksCell(links: TaskQuickLink[] | undefined): string {
  if (!links?.length) return "";
  return links.map((link) => `${link.title}: ${link.url}`).join(" | ");
}

function statusLabel(status: Task["status"]): string {
  switch (status) {
    case "planned":
      return "Planned";
    case "active":
      return "Active";
    case "blocked":
      return "Blocked";
    case "paused":
      return "Paused";
    case "done":
      return "Done";
    case "archived":
      return "Archived";
  }
}

function resolveRow(
  columns: ColumnDef[],
  task: Task,
  context: TaskSummaryContext,
): string {
  return csvRow(columns.map((col) => col.resolve(task, context)));
}

export function formatTaskCsv(
  task: Task,
  context: TaskSummaryContext = {},
  template: SummaryTemplate = DEFAULT_SUMMARY_TEMPLATE,
): string {
  const columns = buildColumns(template);
  return [
    csvRow(columns.map((col) => col.key)),
    resolveRow(columns, task, context),
  ].join("\n");
}

export interface FolderSummaryTask {
  task: Task;
  context: TaskSummaryContext;
}

export function formatFolderCsv(
  folder: Folder,
  tasks: FolderSummaryTask[],
  template: SummaryTemplate = DEFAULT_SUMMARY_TEMPLATE,
): string {
  const columns = buildColumns(template);
  const lines: string[] = [csvRow(columns.map((col) => col.key))];
  if (!tasks.length) {
    lines.push(`(no tasks in ${folder.name})`);
  }
  for (const { task, context } of tasks) {
    lines.push(resolveRow(columns, task, context));
  }
  return lines.join("\n");
}

export async function copyTaskCsv(
  task: Task,
  context: TaskSummaryContext = {},
  template?: SummaryTemplate,
) {
  const { loadSummaryTemplate } = await import("./summaryTemplate");
  const effectiveTemplate = template ?? loadSummaryTemplate();
  await writeClipboard(formatTaskCsv(task, context, effectiveTemplate));
}

export async function copyFolderCsv(
  folder: Folder,
  tasks: FolderSummaryTask[],
  template?: SummaryTemplate,
) {
  const { loadSummaryTemplate } = await import("./summaryTemplate");
  const effectiveTemplate = template ?? loadSummaryTemplate();
  await writeClipboard(formatFolderCsv(folder, tasks, effectiveTemplate));
}

async function writeClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  if (typeof document === "undefined") return;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
