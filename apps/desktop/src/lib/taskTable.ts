import { formatDuration } from "./duration";
import { STATUS_LABEL } from "./status";
import type { Task } from "./types";

const MAX_TITLE_LENGTH = 60;

export type TaskTableField =
  | "task"
  | "status"
  | "folder"
  | "estimate"
  | "logged";

export const TASK_TABLE_FIELDS: { key: TaskTableField; label: string }[] = [
  { key: "task", label: "Task" },
  { key: "status", label: "Status" },
  { key: "folder", label: "Folder" },
  { key: "estimate", label: "Est." },
  { key: "logged", label: "Logged" },
];

export interface TaskTableRow {
  task: Task;
  totalMinutes?: number;
}

export function formatTaskTable(
  rows: TaskTableRow[],
  folderNames?: Map<string, string>,
  fields?: ReadonlyArray<TaskTableField>,
): string {
  if (!rows.length) return "_No tasks._";

  const requested = fields && fields.length > 0 ? fields : null;
  const cols: Array<{
    key: TaskTableField;
    label: string;
    render: (row: TaskTableRow) => string;
    show: boolean;
  }> = [
    {
      key: "task",
      label: "Task",
      render: (r) => capTitle(r.task.title),
      show: !requested || requested.includes("task"),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => STATUS_LABEL[r.task.status],
      show: !requested || requested.includes("status"),
    },
    {
      key: "folder",
      label: "Folder",
      render: (r) =>
        r.task.folderId ? (folderNames?.get(r.task.folderId) ?? "—") : "—",
      show:
        (!requested || requested.includes("folder")) &&
        rows.some((r) => r.task.folderId),
    },
    {
      key: "estimate",
      label: "Est.",
      render: (r) =>
        r.task.estimatedMinutes != null
          ? formatDuration(r.task.estimatedMinutes)
          : "—",
      show:
        (!requested || requested.includes("estimate")) &&
        rows.some((r) => r.task.estimatedMinutes != null),
    },
    {
      key: "logged",
      label: "Logged",
      render: (r) =>
        r.totalMinutes != null && r.totalMinutes > 0
          ? formatDuration(r.totalMinutes)
          : "—",
      show:
        (!requested || requested.includes("logged")) &&
        rows.some((r) => r.totalMinutes != null && r.totalMinutes > 0),
    },
  ];

  const active = cols.filter((c) => c.show);
  if (!active.length) return "_No columns selected._";
  const header = `| ${active.map((c) => c.label).join(" | ")} |`;
  const sep = `| ${active.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((row) => {
      const cells = active.map((c) => c.render(row));
      return `| ${cells.join(" | ")} |`;
    })
    .join("\n");

  return `${header}\n${sep}\n${body}`;
}

function capTitle(title: string): string {
  if (title.length <= MAX_TITLE_LENGTH) return title;
  return title.slice(0, MAX_TITLE_LENGTH - 1) + "…";
}
