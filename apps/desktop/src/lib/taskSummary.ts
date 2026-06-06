import { formatDuration } from "./duration";
import {
  DEFAULT_SUMMARY_TEMPLATE,
  loadSummaryTemplate,
  type SummaryTemplate,
} from "./summaryTemplate";
import { STATUS_LABEL } from "./status";
import type { Task, TaskQuickLink } from "./types";

export interface TaskSummaryEntry {
  contentMarkdown: string;
  durationMinutes: number | null;
}

export interface TaskSummaryContext {
  entriesLoaded?: number;
  totalMinutes?: number;
  entries?: TaskSummaryEntry[];
  quickLinks?: TaskQuickLink[];
}

export function formatTaskSummary(
  task: Task,
  context: TaskSummaryContext = {},
  template: SummaryTemplate = DEFAULT_SUMMARY_TEMPLATE,
) {
  const lines: string[] = [task.title];

  if (template.status) {
    lines.push(`Status: ${STATUS_LABEL[task.status]}`);
  }

  if (template.estimate) {
    lines.push(
      `Estimate: ${
        task.estimatedMinutes ? formatDuration(task.estimatedMinutes) : "None"
      }`,
    );
  }

  if (template.worklog) {
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
    if (template.worklogEntries && context.entries?.length) {
      for (const entry of context.entries) {
        const duration = entry.durationMinutes
          ? `${formatDuration(entry.durationMinutes)} `
          : "";
        const content = entry.contentMarkdown.replace(/\s+/g, " ").trim();
        if (!content) continue;
        lines.push(`- ${duration}${content}`);
      }
    }
  }

  if (template.quickLinks && context.quickLinks?.length) {
    for (const link of context.quickLinks) {
      lines.push(`- ${link.title}: ${link.url}`);
    }
  }

  if (template.createdDate) {
    lines.push(`Created: ${task.createdAt}`);
  }

  if (template.updatedDate) {
    lines.push(`Updated: ${task.updatedAt}`);
  }

  return lines.join("\n");
}

export async function copyTaskSummary(
  task: Task,
  context: TaskSummaryContext = {},
  template?: SummaryTemplate,
) {
  const effectiveTemplate = template ?? loadSummaryTemplate();
  await writeClipboard(formatTaskSummary(task, context, effectiveTemplate));
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
