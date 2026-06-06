export interface SummaryTemplate {
  title: boolean;
  status: boolean;
  estimate: boolean;
  worklog: boolean;
  worklogEntries: boolean;
  quickLinks: boolean;
  createdDate: boolean;
  updatedDate: boolean;
}

export const DEFAULT_SUMMARY_TEMPLATE: SummaryTemplate = {
  title: false,
  status: true,
  estimate: true,
  worklog: true,
  worklogEntries: false,
  quickLinks: false,
  createdDate: false,
  updatedDate: false,
};

const STORAGE_KEY = "devthread:summary-template";
const ORDER_STORAGE_KEY = "devthread:summary-template-order";

export type SummaryFieldKey = keyof SummaryTemplate;

export const DEFAULT_SUMMARY_ORDER: ReadonlyArray<SummaryFieldKey> = [
  "title",
  "status",
  "estimate",
  "worklog",
  "worklogEntries",
  "quickLinks",
  "createdDate",
  "updatedDate",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTemplate(value: unknown): SummaryTemplate {
  if (!isObject(value)) return { ...DEFAULT_SUMMARY_TEMPLATE };
  return {
    title:
      typeof value.title === "boolean"
        ? value.title
        : DEFAULT_SUMMARY_TEMPLATE.title,
    status:
      typeof value.status === "boolean"
        ? value.status
        : DEFAULT_SUMMARY_TEMPLATE.status,
    estimate:
      typeof value.estimate === "boolean"
        ? value.estimate
        : DEFAULT_SUMMARY_TEMPLATE.estimate,
    worklog:
      typeof value.worklog === "boolean"
        ? value.worklog
        : DEFAULT_SUMMARY_TEMPLATE.worklog,
    worklogEntries:
      typeof value.worklogEntries === "boolean"
        ? value.worklogEntries
        : DEFAULT_SUMMARY_TEMPLATE.worklogEntries,
    quickLinks:
      typeof value.quickLinks === "boolean"
        ? value.quickLinks
        : DEFAULT_SUMMARY_TEMPLATE.quickLinks,
    createdDate:
      typeof value.createdDate === "boolean"
        ? value.createdDate
        : DEFAULT_SUMMARY_TEMPLATE.createdDate,
    updatedDate:
      typeof value.updatedDate === "boolean"
        ? value.updatedDate
        : DEFAULT_SUMMARY_TEMPLATE.updatedDate,
  };
}

export function loadSummaryTemplate(): SummaryTemplate {
  if (typeof localStorage === "undefined") {
    return { ...DEFAULT_SUMMARY_TEMPLATE };
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_SUMMARY_TEMPLATE };
  try {
    return normalizeTemplate(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SUMMARY_TEMPLATE };
  }
}

export function saveSummaryTemplate(template: SummaryTemplate): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(template));
}

function isSummaryFieldKey(value: unknown): value is SummaryFieldKey {
  return (
    typeof value === "string" &&
    DEFAULT_SUMMARY_ORDER.includes(value as SummaryFieldKey)
  );
}

export function loadSummaryOrder(): ReadonlyArray<SummaryFieldKey> {
  if (typeof localStorage === "undefined") {
    return [...DEFAULT_SUMMARY_ORDER];
  }
  const raw = localStorage.getItem(ORDER_STORAGE_KEY);
  if (!raw) return [...DEFAULT_SUMMARY_ORDER];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_SUMMARY_ORDER];
    const seen = new Set<SummaryFieldKey>();
    const result: SummaryFieldKey[] = [];
    for (const value of parsed) {
      if (isSummaryFieldKey(value) && !seen.has(value)) {
        seen.add(value);
        result.push(value);
      }
    }
    for (const key of DEFAULT_SUMMARY_ORDER) {
      if (!seen.has(key)) result.push(key);
    }
    return result;
  } catch {
    return [...DEFAULT_SUMMARY_ORDER];
  }
}

export function saveSummaryOrder(order: ReadonlyArray<SummaryFieldKey>): void {
  if (typeof localStorage === "undefined") return;
  const sanitized = order.filter(isSummaryFieldKey);
  if (sanitized.length !== order.length) {
    throw new Error("Summary order contains unknown or duplicate keys");
  }
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(sanitized));
}

export function getSummaryFieldOrder(
  order?: ReadonlyArray<SummaryFieldKey>,
): ReadonlyArray<SummaryFieldKey> {
  return order ?? loadSummaryOrder();
}

export const SUMMARY_TEMPLATE_FIELDS: ReadonlyArray<{
  key: keyof SummaryTemplate;
  label: string;
  description: string;
}> = [
  {
    key: "title",
    label: "Title",
    description: "Task title as a labeled line.",
  },
  { key: "status", label: "Status", description: "Current status label." },
  {
    key: "estimate",
    label: "Estimate",
    description: "Expected time for the task.",
  },
  {
    key: "worklog",
    label: "Worklog total",
    description: "Total time logged.",
  },
  {
    key: "worklogEntries",
    label: "Worklog entries",
    description: "Per-entry bullet list. Requires 'Worklog total' to be on.",
  },
  {
    key: "quickLinks",
    label: "Quick links",
    description: "Pinned Figma, Jira, GitHub, etc.",
  },
  {
    key: "createdDate",
    label: "Created date",
    description: "Task creation date.",
  },
  {
    key: "updatedDate",
    label: "Updated date",
    description: "Last update date.",
  },
];
