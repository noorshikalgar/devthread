/**
 * Release template engine. A small Mustache-like renderer for release
 * summaries. Supports:
 *   - `{{var}}`                 variable substitution
 *   - `{{var|filter}}`         filters (date, upper, lower, duration, default, fields)
 *   - `{{#if cond}}...{{/if}}` truthy conditional
 *   - `{{#each items}}...{{/each}}` iteration (with `{{this.X}}` access)
 *
 * Unknown placeholders render as empty strings. Unknown filters leave the
 * value untouched. Block mismatches render as-is (graceful degradation).
 */
import {
  formatTaskTable,
  TASK_TABLE_FIELDS,
  type TaskTableField,
} from "./taskTable";
import type { Folder, Release, Task } from "./types";

export interface TaskRenderContext {
  title: string;
  status: string;
  statusRaw: Task["status"];
  folder: string;
  folderId: string;
  estimate: string;
  estimateMinutes: number;
  logged: string;
  loggedMinutes: number;
  nextStep: string;
  description: string;
  id: string;
  createdAt: string;
  updatedAt: string;
  createdAtRaw: string;
  updatedAtRaw: string;
}

export interface TaskRowForTable {
  task: Task;
  totalMinutes?: number;
}

export interface ReleaseRenderContext {
  name: string;
  version: string;
  releasedAt: string;
  releasedAtDate: string;
  notes: string;
  tasks: string;
  taskCount: number;
  generatedAt: string;
  taskList: TaskRenderContext[];
  folderNames: Record<string, string>;
  taskRows: TaskRowForTable[];
}

const DEFAULT_TEMPLATE = `# {{name}}{{version}}

_{{releasedAt}}_

{{notes}}

{{tasks}}`;

export function defaultReleaseTemplate(): string {
  return DEFAULT_TEMPLATE;
}

export function buildReleaseContext(args: {
  release: Release;
  notes: string;
  taskTableMd?: string;
  tasks: Task[];
  folderNames: Map<string, string>;
  generatedAt?: Date;
}): ReleaseRenderContext {
  const { release, notes, taskTableMd, tasks, folderNames } = args;
  const now = args.generatedAt ?? new Date();
  const folderNamesRecord: Record<string, string> = {};
  for (const [id, name] of folderNames) {
    folderNamesRecord[id] = name;
  }
  return {
    name: release.name,
    version: release.version ?? "",
    releasedAt: release.releasedAt
      ? `Released ${formatShortDate(release.releasedAt)}`
      : "Draft",
    releasedAtDate: release.releasedAt
      ? formatShortDate(release.releasedAt)
      : "",
    notes,
    tasks: taskTableMd ?? "",
    taskCount: tasks.length,
    generatedAt: now.toISOString(),
    taskList: tasks.map((task) => buildTaskContext(task, folderNames)),
    folderNames: folderNamesRecord,
    taskRows: tasks.map((task) => ({ task, totalMinutes: 0 })),
  };
}

export { TASK_TABLE_FIELDS };
export type { TaskTableField };

function buildTaskContext(
  task: Task,
  folderNames: Map<string, string>,
): TaskRenderContext {
  const folderName = task.folderId
    ? (folderNames.get(task.folderId) ?? "")
    : "";
  const estimate = task.estimatedMinutes
    ? formatDuration(task.estimatedMinutes)
    : "";
  return {
    title: task.title,
    status: task.status,
    statusRaw: task.status,
    folder: folderName,
    folderId: task.folderId ?? "",
    estimate,
    estimateMinutes: task.estimatedMinutes ?? 0,
    logged: "",
    loggedMinutes: 0,
    nextStep: task.nextStep ?? "",
    description: task.descriptionMarkdown,
    id: task.id,
    createdAt: formatShortDate(task.createdAt),
    updatedAt: formatShortDate(task.updatedAt),
    createdAtRaw: task.createdAt,
    updatedAtRaw: task.updatedAt,
  };
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return Boolean(value);
}

function applyFilter(
  value: string,
  filterSpec: string,
  context: ReleaseRenderContext,
  varName: string,
): string {
  const [name, ...args] = filterSpec.split(":").map((s) => s.trim());
  switch (name) {
    case "upper":
      return value.toUpperCase();
    case "lower":
      return value.toLowerCase();
    case "date": {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      const pattern = args[0];
      if (!pattern) return formatShortDate(value);
      return formatDateWithPattern(date, pattern);
    }
    case "duration": {
      if (!value) return "";
      const num = Number(value);
      if (Number.isNaN(num)) return value;
      return formatDuration(num);
    }
    case "default": {
      if (value) return value;
      return args[0] ?? "";
    }
    case "fields": {
      // Only valid on the `{{tasks}}` placeholder; otherwise no-op.
      if (varName !== "tasks") return value;
      const requested = args[0]
        ? (args[0]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean) as TaskTableField[])
        : [];
      const valid = requested.filter((f) =>
        TASK_TABLE_FIELDS.some((col) => col.key === f),
      );
      if (!valid.length) return value;
      return formatTaskTable(
        context.taskRows,
        new Map(Object.entries(context.folderNames)),
        valid,
      );
    }
    default:
      return value;
  }
}

function formatDateWithPattern(date: Date, pattern: string): string {
  const yyyy = date.getFullYear().toString();
  const yy = yyyy.slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const mon = date.toLocaleString(undefined, { month: "short" });
  const dd = String(date.getDate()).padStart(2, "0");
  const HH = String(date.getHours()).padStart(2, "0");
  const MM = String(date.getMinutes()).padStart(2, "0");
  return pattern
    .replace(/YYYY/g, yyyy)
    .replace(/YY/g, yy)
    .replace(/MMMM/g, mon)
    .replace(/MMM/g, mon)
    .replace(/MM/g, mm)
    .replace(/DD/g, dd)
    .replace(/HH/g, HH)
    .replace(/mm/g, MM);
}

type Token =
  | { type: "text"; value: string }
  | { type: "var"; name: string; filters: string[] }
  | { type: "if"; name: string; body: Token[]; elseBody?: Token[] }
  | { type: "each"; name: string; body: Token[] };

function tokenize(template: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let buffer = "";

  function flushBuffer() {
    if (buffer.length > 0) {
      tokens.push({ type: "text", value: buffer });
      buffer = "";
    }
  }

  while (i < template.length) {
    if (template.startsWith("{{#each ", i)) {
      flushBuffer();
      const closeIdx = findBlockEnd(
        template,
        i + "{{#each ".length,
        "{{/each}}",
      );
      if (closeIdx < 0) {
        buffer += template.slice(i);
        i = template.length;
        continue;
      }
      const inner = template.slice(i, closeIdx);
      const openClose = inner.indexOf("}}", 8);
      const eachExpr =
        openClose >= 0 ? inner.slice(8, openClose) : inner.slice(8);
      const name = eachExpr.split(/\s+/)[0]?.trim() ?? "";
      const bodyStr = openClose >= 0 ? inner.slice(openClose + 2) : "";
      tokens.push({ type: "each", name, body: tokenize(bodyStr) });
      i = closeIdx + 9;
    } else if (template.startsWith("{{#if ", i)) {
      flushBuffer();
      const closeIdx = findBlockEnd(template, i + "{{#if ".length, "{{/if}}");
      if (closeIdx < 0) {
        buffer += template.slice(i);
        i = template.length;
        continue;
      }
      const inner = template.slice(i, closeIdx);
      // Find the closing `}}` of the opening `{{#if X}}` tag.
      const openClose = inner.indexOf("}}", 6);
      const condExpr =
        openClose >= 0 ? inner.slice(6, openClose) : inner.slice(6);
      const elseMarker = "{{else}}";
      const elseIdx = inner.indexOf(
        elseMarker,
        openClose >= 0 ? openClose + 2 : 6,
      );
      let name: string;
      let bodyStr: string;
      let elseStr: string | undefined;
      if (elseIdx >= 0) {
        name = condExpr.split(/\s+/)[0]?.trim() ?? "";
        bodyStr = inner.slice(openClose + 2, elseIdx);
        elseStr = inner.slice(elseIdx + elseMarker.length);
      } else {
        name = condExpr.split(/\s+/)[0]?.trim() ?? "";
        bodyStr = openClose >= 0 ? inner.slice(openClose + 2) : "";
      }
      tokens.push({
        type: "if",
        name,
        body: tokenize(bodyStr),
        elseBody: elseStr !== undefined ? tokenize(elseStr) : undefined,
      });
      i = closeIdx + 8;
    } else if (template.startsWith("{{", i)) {
      const end = template.indexOf("}}", i);
      if (end < 0) {
        buffer += template.slice(i);
        i = template.length;
        continue;
      }
      flushBuffer();
      const raw = template.slice(i + 2, end).trim();
      if (raw === "else" || raw === "/if" || raw === "/each") {
        // Stray closer; treat as text.
        buffer += template.slice(i, end + 2);
        i = end + 2;
        continue;
      }
      const pipeIdx = raw.indexOf("|");
      let name: string;
      let filters: string[] = [];
      if (pipeIdx >= 0) {
        name = raw.slice(0, pipeIdx).trim();
        filters = raw
          .slice(pipeIdx + 1)
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        name = raw;
      }
      tokens.push({ type: "var", name, filters });
      i = end + 2;
    } else {
      buffer += template[i];
      i++;
    }
  }
  flushBuffer();
  return tokens;
}

function findBlockEnd(template: string, start: number, closer: string): number {
  let depth = 1;
  let i = start;
  // closer has the form "{{/X}}"; derive the matching opener "{{#X " for nesting.
  const closerBody = closer.slice(2, -2).replace(/^\//, "");
  const openerPrefix = `{{#${closerBody} `;
  while (i < template.length && depth > 0) {
    if (template.startsWith(openerPrefix, i)) {
      depth++;
      i += openerPrefix.length;
      continue;
    }
    if (template.startsWith(closer, i)) {
      depth--;
      if (depth === 0) return i;
      i += closer.length;
      continue;
    }
    i++;
  }
  return -1;
}

function lookup(context: ReleaseRenderContext, path: string): unknown {
  if (!path) return "";
  if (path === "this") return undefined;
  const segments = path.split(".");
  let current: unknown = context;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function renderTokens(
  tokens: Token[],
  context: ReleaseRenderContext,
  itemContext: Record<string, unknown> | null,
): string {
  let out = "";
  for (const token of tokens) {
    if (token.type === "text") {
      out += token.value;
    } else if (token.type === "var") {
      let value: unknown;
      if (itemContext) {
        value = lookup(
          { ...context, ...itemContext } as unknown as ReleaseRenderContext,
          token.name,
        );
      } else {
        value = lookup(context, token.name);
      }
      let str = value === null || value === undefined ? "" : String(value);
      for (const filter of token.filters) {
        str = applyFilter(str, filter, context, token.name);
      }
      out += str;
    } else if (token.type === "if") {
      const value = itemContext
        ? lookup(
            { ...context, ...itemContext } as unknown as ReleaseRenderContext,
            token.name,
          )
        : lookup(context, token.name);
      const truthy = isTruthy(value);
      if (truthy) {
        out += renderTokens(token.body, context, itemContext);
      } else if (token.elseBody) {
        out += renderTokens(token.elseBody, context, itemContext);
      }
    } else if (token.type === "each") {
      const value = itemContext
        ? lookup(
            { ...context, ...itemContext } as unknown as ReleaseRenderContext,
            token.name,
          )
        : lookup(context, token.name);
      if (!Array.isArray(value)) continue;
      for (const item of value) {
        const itemCtx =
          item && typeof item === "object"
            ? (item as Record<string, unknown>)
            : { this: item };
        out += renderTokens(token.body, context, itemCtx);
      }
    }
  }
  return out;
}

export function renderReleaseTemplate(
  template: string,
  context: ReleaseRenderContext,
): string {
  if (!template.trim()) return renderReleaseTemplate(DEFAULT_TEMPLATE, context);
  const tokens = tokenize(template);
  return renderTokens(tokens, context, null);
}

export const RELEASE_TEMPLATE_PLACEHOLDERS = [
  {
    label: "Release name",
    snippet: "{{name}}",
    description: "Name of the release",
  },
  {
    label: "Version",
    snippet: "{{version}}",
    description: "Optional version string",
  },
  {
    label: "Release status",
    snippet: "{{releasedAt}}",
    description: "Released <date> or Draft",
  },
  {
    label: "Release date",
    snippet: "{{releasedAtDate}}",
    description: "Just the date",
  },
  {
    label: "Notes",
    snippet: "{{notes}}",
    description: "Free-form notes (the Notes textarea content)",
  },
  {
    label: "Tasks table",
    snippet: "{{tasks}}",
    description: "Auto-generated markdown table of tagged tasks",
  },
  {
    label: "Task count",
    snippet: "{{taskCount}}",
    description: "Number of tagged tasks",
  },
  {
    label: "Generated at",
    snippet: "{{generatedAt}}",
    description: "Current timestamp",
  },
  {
    label: "If has tasks",
    snippet: "{{#if taskList}}## Tasks\n\n{{tasks}}{{/if}}",
    description: "Show section only when tasks exist",
  },
  {
    label: "If has version",
    snippet: "{{#if version}} ({{version}}){{/if}}",
    description: "Show inline only when version is set",
  },
  {
    label: "If has notes",
    snippet: "{{#if notes}}## Notes\n\n{{notes}}{{/if}}",
    description: "Show section only when notes are non-empty",
  },
  {
    label: "Each task",
    snippet: "{{#each taskList}}- {{title}} — {{status}}\n{{/each}}",
    description: "Render a bullet list of every tagged task",
  },
];

export const RELEASE_TASK_FIELDS: {
  label: string;
  snippet: string;
  description: string;
}[] = [
  {
    label: "Task title",
    snippet: "{{title}}",
    description: "Task title",
  },
  {
    label: "Status",
    snippet: "{{status}}",
    description: "Status (planned, active, done, …)",
  },
  {
    label: "Folder",
    snippet: "{{folder}}",
    description: "Folder name the task belongs to",
  },
  {
    label: "Estimate",
    snippet: "{{estimate}}",
    description: "Estimated time (e.g. 1h 30m)",
  },
  {
    label: "Logged",
    snippet: "{{logged}}",
    description: "Logged time on the task",
  },
  {
    label: "Next step",
    snippet: "{{nextStep}}",
    description: "The task's next-step text",
  },
  {
    label: "Description",
    snippet: "{{description}}",
    description: "Task description (markdown)",
  },
  {
    label: "Created",
    snippet: "{{createdAt}}",
    description: "Created date",
  },
  {
    label: "Updated",
    snippet: "{{updatedAt}}",
    description: "Last-updated date",
  },
  {
    label: "Tasks table (custom fields)",
    snippet: "{{tasks|fields:task,status,estimate}}",
    description: "Auto-generated table with chosen columns",
  },
];

export interface TemplateHelpEntry {
  label: string;
  syntax: string;
  description: string;
}

export const RELEASE_TEMPLATE_VARIABLES: TemplateHelpEntry[] = [
  {
    label: "Release name",
    syntax: "{{name}}",
    description: "The release's name.",
  },
  {
    label: "Version",
    syntax: "{{version}}",
    description: "Optional version label. Renders empty if not set.",
  },
  {
    label: "Release status",
    syntax: "{{releasedAt}}",
    description: 'Renders "Released <date>" or "Draft".',
  },
  {
    label: "Release date",
    syntax: "{{releasedAtDate}}",
    description: "Just the release date (e.g. Jun 1, 2025).",
  },
  {
    label: "Notes",
    syntax: "{{notes}}",
    description: "The free-form notes you wrote.",
  },
  {
    label: "Tasks table",
    syntax: "{{tasks}}",
    description:
      "Auto-generated markdown table of tagged tasks. Pipe through |fields: to pick columns.",
  },
  {
    label: "Task count",
    syntax: "{{taskCount}}",
    description: "Number of tagged tasks.",
  },
  {
    label: "Generated at",
    syntax: "{{generatedAt}}",
    description: "Current timestamp (ISO 8601).",
  },
];

export const RELEASE_TEMPLATE_TASK_VARIABLES: TemplateHelpEntry[] = [
  {
    label: "Title",
    syntax: "{{title}}",
    description: "Task title (max 60 chars in auto-table).",
  },
  {
    label: "Status",
    syntax: "{{status}}",
    description: "Status slug (planned, active, done, …).",
  },
  {
    label: "Folder",
    syntax: "{{folder}}",
    description: "Folder the task belongs to.",
  },
  {
    label: "Estimate",
    syntax: "{{estimate}}",
    description: "Formatted estimate, e.g. 2h 30m.",
  },
  {
    label: "Logged",
    syntax: "{{logged}}",
    description: "Total time logged on the task.",
  },
  {
    label: "Next step",
    syntax: "{{nextStep}}",
    description: "The task's next-step text.",
  },
  {
    label: "Description",
    syntax: "{{description}}",
    description: "Full task description (markdown).",
  },
  {
    label: "Created",
    syntax: "{{createdAt}}",
    description: "Created date.",
  },
  {
    label: "Updated",
    syntax: "{{updatedAt}}",
    description: "Last-updated date.",
  },
];

export const RELEASE_TEMPLATE_BLOCKS: TemplateHelpEntry[] = [
  {
    label: "If (truthy)",
    syntax: "{{#if X}}...{{/if}}",
    description: "Render the body only when X is non-empty / non-zero.",
  },
  {
    label: "If / Else",
    syntax: "{{#if X}}yes{{else}}no{{/if}}",
    description: "Pick one of two branches based on X.",
  },
  {
    label: "Each",
    syntax: "{{#each taskList}}...{{/each}}",
    description:
      "Iterate every tagged task. Inside, fields are bare names like {{title}}, {{status}}.",
  },
];

export const RELEASE_TEMPLATE_FILTERS: TemplateHelpEntry[] = [
  {
    label: "upper",
    syntax: "{{name|upper}}",
    description: "Convert value to upper case.",
  },
  {
    label: "lower",
    syntax: "{{name|lower}}",
    description: "Convert value to lower case.",
  },
  {
    label: "date",
    syntax: "{{createdAt|date:YYYY-MM-DD}}",
    description:
      "Format a date. Tokens: YYYY YY MMMM MMM MM DD HH mm. No pattern = locale short date.",
  },
  {
    label: "duration",
    syntax: "{{minutes|duration}}",
    description: "Convert minutes (number) to 1h 30m format.",
  },
  {
    label: "default",
    syntax: "{{value|default:fallback}}",
    description: "Use a fallback when the value is empty.",
  },
  {
    label: "fields",
    syntax: "{{tasks|fields:title,status,estimate}}",
    description:
      "Pick which columns appear in the auto-generated {{tasks}} table. Available: task, status, folder, estimate, logged.",
  },
];

export const RELEASE_TEMPLATE_EXAMPLES: { title: string; template: string }[] =
  [
    {
      title: "Default",
      template: `# {{name}}{{version}}

_{{releasedAt}}_

{{notes}}

{{tasks}}`,
    },
    {
      title: "Highlight bullets, no version",
      template: `## {{name}}

{{#if notes}}
{{notes}}
{{/if}}

{{#if taskCount}}
**{{taskCount}} task{{#if taskCount > 1}}s{{/if}}** shipped in this release:

{{#each taskList}}- {{title}}
{{/each}}
{{/if}}`,
    },
    {
      title: "Custom table with chosen fields",
      template: `## {{name}} ({{version}})

| Task | Status | Estimate |
| --- | --- | --- |
{{tasks|fields:task,status,estimate}}`,
    },
  ];
