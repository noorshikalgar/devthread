export interface SummaryTemplate {
  status: boolean;
  estimate: boolean;
  worklog: boolean;
  worklogEntries: boolean;
  quickLinks: boolean;
  createdDate: boolean;
  updatedDate: boolean;
}

export const DEFAULT_SUMMARY_TEMPLATE: SummaryTemplate = {
  status: true,
  estimate: true,
  worklog: true,
  worklogEntries: false,
  quickLinks: false,
  createdDate: false,
  updatedDate: false,
};

const STORAGE_KEY = "devthread:summary-template";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTemplate(value: unknown): SummaryTemplate {
  if (!isObject(value)) return { ...DEFAULT_SUMMARY_TEMPLATE };
  return {
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

export const SUMMARY_TEMPLATE_FIELDS: ReadonlyArray<{
  key: keyof SummaryTemplate;
  label: string;
  description: string;
}> = [
  { key: "status", label: "Status", description: "Current status label." },
  {
    key: "estimate",
    label: "Estimate",
    description: "Expected time for the task.",
  },
  {
    key: "worklog",
    label: "Worklog total",
    description: "Total time logged and entry count.",
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
    description: "Task creation timestamp.",
  },
  {
    key: "updatedDate",
    label: "Updated date",
    description: "Last update timestamp.",
  },
];
