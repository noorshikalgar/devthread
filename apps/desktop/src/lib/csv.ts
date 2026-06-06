import { formatDuration } from "./duration";
import {
  DEFAULT_SUMMARY_ORDER,
  DEFAULT_SUMMARY_TEMPLATE,
  loadSummaryOrder,
  type SummaryFieldKey,
  type SummaryTemplate,
} from "./summaryTemplate";
import type { TaskSummaryContext } from "./taskSummary";
import type { Folder, Task, TaskQuickLink } from "./types";

const TITLE_COLUMN = "Title";
const STATUS_COLUMN = "Status";
const ESTIMATE_COLUMN = "Estimate";
const WORKLOG_COLUMN = "Worklog";
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

function buildColumns(
  template: SummaryTemplate,
  order: ReadonlyArray<SummaryFieldKey>,
): ColumnDef[] {
  const columns: ColumnDef[] = [];
  for (const key of order) {
    switch (key) {
      case "title":
        if (template.title) {
          columns.push({ key: TITLE_COLUMN, resolve: (task) => task.title });
        }
        break;
      case "status":
        if (template.status) {
          columns.push({
            key: STATUS_COLUMN,
            resolve: (task) => statusLabel(task.status),
          });
        }
        break;
      case "estimate":
        if (template.estimate) {
          columns.push({
            key: ESTIMATE_COLUMN,
            resolve: (task) =>
              task.estimatedMinutes
                ? formatDuration(task.estimatedMinutes)
                : "",
          });
        }
        break;
      case "worklog":
        if (template.worklog) {
          columns.push({
            key: WORKLOG_COLUMN,
            resolve: (_task, context) => formatWorklogCell(context, template),
          });
        }
        break;
      case "worklogEntries":
        break;
      case "quickLinks":
        if (template.quickLinks) {
          columns.push({
            key: QUICK_LINKS_COLUMN,
            resolve: (_task, context) =>
              formatQuickLinksCell(context.quickLinks),
          });
        }
        break;
      case "createdDate":
        if (template.createdDate) {
          columns.push({
            key: CREATED_COLUMN,
            resolve: (task) => formatDate(task.createdAt),
          });
        }
        break;
      case "updatedDate":
        if (template.updatedDate) {
          columns.push({
            key: UPDATED_COLUMN,
            resolve: (task) => formatDate(task.updatedAt),
          });
        }
        break;
    }
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
  return links.map((link) => `[${link.title}](${link.url})`).join(" | ");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  order: ReadonlyArray<SummaryFieldKey> = DEFAULT_SUMMARY_ORDER,
): string {
  const columns = buildColumns(template, order);
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
  order: ReadonlyArray<SummaryFieldKey> = DEFAULT_SUMMARY_ORDER,
): string {
  const columns = buildColumns(template, order);
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
  order?: ReadonlyArray<SummaryFieldKey>,
) {
  const { loadSummaryTemplate } = await import("./summaryTemplate");
  const effectiveTemplate = template ?? loadSummaryTemplate();
  const effectiveOrder = order ?? loadSummaryOrder();
  await writeClipboard(
    formatTaskCsv(task, context, effectiveTemplate, effectiveOrder),
  );
}

export async function copyFolderCsv(
  folder: Folder,
  tasks: FolderSummaryTask[],
  template?: SummaryTemplate,
  order?: ReadonlyArray<SummaryFieldKey>,
) {
  const { loadSummaryTemplate } = await import("./summaryTemplate");
  const effectiveTemplate = template ?? loadSummaryTemplate();
  const effectiveOrder = order ?? loadSummaryOrder();
  await writeClipboard(
    formatFolderCsv(folder, tasks, effectiveTemplate, effectiveOrder),
  );
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
