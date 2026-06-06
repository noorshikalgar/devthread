import { formatDuration } from "./duration";
import { STATUS_LABEL } from "./status";
import type { Task } from "./types";

export interface TaskSummaryContext {
  entriesLoaded?: number;
  totalMinutes?: number;
}

export function formatTaskSummary(
  task: Task,
  context: TaskSummaryContext = {},
) {
  const lines = [
    task.title,
    `Status: ${STATUS_LABEL[task.status]}`,
    `Estimate: ${
      task.estimatedMinutes ? formatDuration(task.estimatedMinutes) : "None"
    }`,
  ];

  if (context.totalMinutes !== undefined) {
    lines.push(
      `Logged: ${
        context.totalMinutes > 0 ? formatDuration(context.totalMinutes) : "0m"
      }`,
    );
  }

  if (context.entriesLoaded !== undefined) {
    lines.push(`Updates: ${context.entriesLoaded}`);
  }

  return lines.join("\n");
}

export async function copyTaskSummary(
  task: Task,
  context: TaskSummaryContext = {},
) {
  await writeClipboard(formatTaskSummary(task, context));
}

async function writeClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
