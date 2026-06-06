import { formatDuration } from "./duration";
import {
  DEFAULT_SUMMARY_ORDER,
  DEFAULT_SUMMARY_TEMPLATE,
  loadSummaryOrder,
  loadSummaryTemplate,
  type SummaryFieldKey,
  type SummaryTemplate,
} from "./summaryTemplate";
import { STATUS_LABEL } from "./status";
import type { Task, TaskQuickLink } from "./types";

export interface TaskSummaryEntry {
  contentMarkdown: string;
  durationMinutes: number | null;
}

export interface TaskSummaryContext {
  totalMinutes?: number;
  entries?: TaskSummaryEntry[];
  quickLinks?: TaskQuickLink[];
}

function buildLines(
  task: Task,
  context: TaskSummaryContext,
  template: SummaryTemplate,
  order: ReadonlyArray<SummaryFieldKey>,
): string[] {
  const lines: string[] = [];

  for (const key of order) {
    switch (key) {
      case "title":
        if (template.title) {
          lines.push(`**Title:** ${task.title}`);
        }
        break;
      case "status":
        if (template.status) {
          lines.push(`**Status:** ${STATUS_LABEL[task.status]}`);
        }
        break;
      case "estimate":
        if (template.estimate) {
          lines.push(
            `**Estimate:** ${
              task.estimatedMinutes
                ? formatDuration(task.estimatedMinutes)
                : "None"
            }`,
          );
        }
        break;
      case "worklog":
        if (template.worklog && context.totalMinutes !== undefined) {
          lines.push(
            `**Logged:** ${
              context.totalMinutes > 0
                ? formatDuration(context.totalMinutes)
                : "0m"
            }`,
          );
        }
        if (
          template.worklogEntries &&
          template.worklog &&
          context.entries?.length
        ) {
          for (const entry of context.entries) {
            const duration = entry.durationMinutes
              ? `${formatDuration(entry.durationMinutes)} `
              : "";
            const content = entry.contentMarkdown.replace(/\s+/g, " ").trim();
            if (!content) continue;
            lines.push(`- ${duration}${content}`);
          }
        }
        break;
      case "worklogEntries":
        break;
      case "quickLinks":
        if (template.quickLinks && context.quickLinks?.length) {
          lines.push(`**Links:**`);
          for (const link of context.quickLinks) {
            lines.push(`- [${link.title}](${link.url})`);
          }
        }
        break;
      case "createdDate":
        if (template.createdDate) {
          lines.push(`**Created:** ${formatDate(task.createdAt)}`);
        }
        break;
      case "updatedDate":
        if (template.updatedDate) {
          lines.push(`**Updated:** ${formatDate(task.updatedAt)}`);
        }
        break;
    }
  }

  return lines;
}

export function formatTaskSummary(
  task: Task,
  context: TaskSummaryContext = {},
  template: SummaryTemplate = DEFAULT_SUMMARY_TEMPLATE,
  order: ReadonlyArray<SummaryFieldKey> = DEFAULT_SUMMARY_ORDER,
) {
  return buildLines(task, context, template, order).join("\n");
}

export function formatTaskSection(
  task: Task,
  context: TaskSummaryContext = {},
  template: SummaryTemplate = DEFAULT_SUMMARY_TEMPLATE,
  order: ReadonlyArray<SummaryFieldKey> = DEFAULT_SUMMARY_ORDER,
) {
  const body = formatTaskSummary(
    task,
    context,
    { ...template, title: false },
    order,
  );
  const bodyLines = body.length ? body.split("\n") : [];
  return ["## " + task.title, ...bodyLines].join("\n");
}

export async function copyTaskSummary(
  task: Task,
  context: TaskSummaryContext = {},
  template?: SummaryTemplate,
  order?: ReadonlyArray<SummaryFieldKey>,
) {
  const effectiveTemplate = template ?? loadSummaryTemplate();
  const effectiveOrder = order ?? loadSummaryOrder();
  await writeClipboard(
    formatTaskSummary(task, context, effectiveTemplate, effectiveOrder),
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
