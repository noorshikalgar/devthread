import { describe, expect, it } from "vitest";
import { formatFolderCsv, formatTaskCsv } from "./csv";
import {
  DEFAULT_SUMMARY_TEMPLATE,
  type SummaryFieldKey,
  type SummaryTemplate,
} from "./summaryTemplate";
import type { Folder, Task, TaskQuickLink } from "./types";

const ALL_OFF: SummaryTemplate = {
  title: false,
  status: false,
  estimate: false,
  worklog: false,
  worklogEntries: false,
  quickLinks: false,
  createdDate: false,
  updatedDate: false,
};

const baseTask: Task = {
  id: "task-1",
  title: "Ship the summary template",
  descriptionMarkdown: "",
  status: "active",
  nextStep: null,
  estimatedMinutes: 8 * 60,
  folderId: "folder-1",
  createdAt: "2025-01-01T09:00:00Z",
  updatedAt: "2025-01-02T12:30:00Z",
};

const folder: Folder = {
  id: "folder-1",
  name: "Q1 roadmap",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-15T00:00:00Z",
};

const figmaLink: TaskQuickLink = {
  id: "link-1",
  taskId: "task-1",
  url: "https://figma.com/file/abc",
  title: "Header, mockup",
  domain: "figma.com",
  provider: "figma",
  createdAt: "2025-01-01T10:00:00Z",
  updatedAt: "2025-01-01T10:00:00Z",
};

describe("formatTaskCsv", () => {
  it("emits a header row and one data row using the default template", () => {
    const out = formatTaskCsv(
      baseTask,
      { totalMinutes: 270 },
      DEFAULT_SUMMARY_TEMPLATE,
    );
    const [header, row] = out.split("\n");
    expect(header).toBe("Status,Estimate,Worklog");
    expect(row).toBe("Active,1d,4h 30m");
    expect(header).not.toContain("Updates");
    expect(header).not.toContain("Title");
  });

  it("renders an empty body when every field is off", () => {
    const out = formatTaskCsv(baseTask, {}, ALL_OFF);
    expect(out).toBe("\n");
  });

  it("expands the Worklog cell with entries when worklogEntries is on", () => {
    const out = formatTaskCsv(
      baseTask,
      {
        totalMinutes: 90,
        entries: [
          { contentMarkdown: "Did the thing", durationMinutes: 60 },
          { contentMarkdown: "Reviewed", durationMinutes: 30 },
        ],
      },
      { ...DEFAULT_SUMMARY_TEMPLATE, worklogEntries: true },
    );
    const [header, row] = out.split("\n");
    expect(header).toBe("Status,Estimate,Worklog");
    expect(row).toBe("Active,1d,1h 30m | 1h · Did the thing | 30m · Reviewed");
  });

  it("renders the Worklog cell as total only when entries are provided but worklogEntries is off", () => {
    const out = formatTaskCsv(
      baseTask,
      {
        totalMinutes: 90,
        entries: [{ contentMarkdown: "Did the thing", durationMinutes: 60 }],
      },
      DEFAULT_SUMMARY_TEMPLATE,
    );
    const [_header, row] = out.split("\n");
    expect(row.endsWith(",1h 30m")).toBe(true);
  });

  it("includes the Title column when its toggle is on", () => {
    const out = formatTaskCsv(
      baseTask,
      {},
      { ...DEFAULT_SUMMARY_TEMPLATE, title: true },
    );
    const [header, row] = out.split("\n");
    expect(header.startsWith("Title,")).toBe(true);
    expect(row.startsWith("Ship the summary template,")).toBe(true);
  });

  it("renders quick links as Markdown links in the cell", () => {
    const out = formatTaskCsv(
      baseTask,
      { quickLinks: [figmaLink] },
      { ...DEFAULT_SUMMARY_TEMPLATE, quickLinks: true },
    );
    const [header, row] = out.split("\n");
    expect(header).toContain("Quick Links");
    expect(row).toContain('"[Header, mockup](https://figma.com/file/abc)"');
  });

  it("formats created and updated columns in a human-readable form", () => {
    const out = formatTaskCsv(
      baseTask,
      {},
      { ...DEFAULT_SUMMARY_TEMPLATE, createdDate: true, updatedDate: true },
    );
    const [header, row] = out.split("\n");
    expect(header).toBe("Status,Estimate,Worklog,Created,Updated");
    expect(row).not.toContain("2025-01-01T09:00:00Z");
    const fields = row.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    expect(fields.length).toBe(5);
  });

  it("quotes and escapes cells containing commas or quotes", () => {
    const out = formatTaskCsv(
      { ...baseTask, title: 'A "weird", title' },
      {},
      { ...ALL_OFF, title: true },
    );
    const [header, row] = out.split("\n");
    expect(header).toBe("Title");
    expect(row).toBe('"A ""weird"", title"');
  });
});

describe("formatFolderCsv", () => {
  it("emits a header row and one data row per task", () => {
    const out = formatFolderCsv(
      folder,
      [
        { task: baseTask, context: { totalMinutes: 90 } },
        {
          task: { ...baseTask, id: "task-2", title: "Wire the menu" },
          context: { totalMinutes: 30 },
        },
      ],
      DEFAULT_SUMMARY_TEMPLATE,
    );
    const lines = out.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Status,Estimate,Worklog");
    expect(lines[1]).toBe("Active,1d,1h 30m");
    expect(lines[2]).toBe("Active,1d,30m");
  });

  it("emits a placeholder row when the folder is empty", () => {
    const out = formatFolderCsv(folder, [], DEFAULT_SUMMARY_TEMPLATE);
    expect(out).toBe("Status,Estimate,Worklog\n(no tasks in Q1 roadmap)");
  });

  it("builds columns in the supplied order", () => {
    const order: ReadonlyArray<SummaryFieldKey> = [
      "title",
      "updatedDate",
      "status",
      "estimate",
      "worklog",
      "worklogEntries",
      "quickLinks",
      "createdDate",
    ];
    const out = formatTaskCsv(
      baseTask,
      { totalMinutes: 30 },
      {
        ...DEFAULT_SUMMARY_TEMPLATE,
        title: true,
        createdDate: true,
        updatedDate: true,
      },
      order,
    );
    const header = out.split("\n")[0];
    expect(header).toBe("Title,Updated,Status,Estimate,Worklog,Created");
  });
});
