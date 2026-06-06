import { describe, expect, it } from "vitest";
import {
  DEFAULT_SUMMARY_TEMPLATE,
  type SummaryTemplate,
} from "./summaryTemplate";
import { formatTaskSummary } from "./taskSummary";
import type { Task, TaskQuickLink } from "./types";

const ALL_OFF: SummaryTemplate = {
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

const link: TaskQuickLink = {
  id: "link-1",
  taskId: "task-1",
  url: "https://figma.com/file/abc",
  title: "Header mockup",
  domain: "figma.com",
  provider: "figma",
  createdAt: "2025-01-01T10:00:00Z",
  updatedAt: "2025-01-01T10:00:00Z",
};

describe("formatTaskSummary", () => {
  it("includes only the title when every field is off", () => {
    expect(formatTaskSummary(baseTask, {}, ALL_OFF)).toBe(
      "Ship the summary template",
    );
  });

  it("uses the default template when none is passed", () => {
    const out = formatTaskSummary(baseTask, {
      totalMinutes: 4 * 60 + 30,
      entriesLoaded: 6,
    });
    expect(out).toBe(
      [
        "Ship the summary template",
        "Status: Active",
        "Estimate: 1d",
        "Logged: 4h 30m",
        "Updates: 6",
      ].join("\n"),
    );
  });

  it("omits estimate when the field is off", () => {
    const template = { ...DEFAULT_SUMMARY_TEMPLATE, estimate: false };
    const out = formatTaskSummary(baseTask, { totalMinutes: 30 }, template);
    expect(out).not.toContain("Estimate:");
    expect(out).toContain("Status: Active");
    expect(out).toContain("Logged: 30m");
  });

  it("shows 'None' when the task has no estimate", () => {
    const out = formatTaskSummary({ ...baseTask, estimatedMinutes: null });
    expect(out).toContain("Estimate: None");
  });

  it("falls back to 0m when totalMinutes is 0", () => {
    const out = formatTaskSummary(baseTask, { totalMinutes: 0 });
    expect(out).toContain("Logged: 0m");
  });

  it("omits Logged and Updates when worklog is off", () => {
    const template = { ...DEFAULT_SUMMARY_TEMPLATE, worklog: false };
    const out = formatTaskSummary(
      baseTask,
      { totalMinutes: 60, entriesLoaded: 3 },
      template,
    );
    expect(out).not.toContain("Logged:");
    expect(out).not.toContain("Updates:");
  });

  it("renders per-entry bullets only when worklogEntries is on", () => {
    const entries = [
      { contentMarkdown: "Implemented X", durationMinutes: 90 },
      { contentMarkdown: "Reviewed Y", durationMinutes: 30 },
    ];
    const withEntries = formatTaskSummary(
      baseTask,
      { totalMinutes: 120, entriesLoaded: 2, entries },
      { ...DEFAULT_SUMMARY_TEMPLATE, worklogEntries: true },
    );
    expect(withEntries).toContain("- 1h 30m Implemented X");
    expect(withEntries).toContain("- 30m Reviewed Y");

    const withoutEntries = formatTaskSummary(
      baseTask,
      { totalMinutes: 120, entriesLoaded: 2, entries },
      DEFAULT_SUMMARY_TEMPLATE,
    );
    expect(withoutEntries).not.toContain("-");
  });

  it("collapses multi-line entry content to a single line", () => {
    const entries = [
      { contentMarkdown: "Line one\nLine two", durationMinutes: 15 },
    ];
    const out = formatTaskSummary(
      baseTask,
      { entries },
      { ...DEFAULT_SUMMARY_TEMPLATE, worklogEntries: true },
    );
    expect(out).toContain("- 15m Line one Line two");
  });

  it("skips empty entry content", () => {
    const entries = [
      { contentMarkdown: "   ", durationMinutes: 5 },
      { contentMarkdown: "Real entry", durationMinutes: 10 },
    ];
    const out = formatTaskSummary(
      baseTask,
      { entries },
      { ...DEFAULT_SUMMARY_TEMPLATE, worklogEntries: true },
    );
    expect(out).not.toContain("- 5m");
    expect(out).toContain("- 10m Real entry");
  });

  it("includes quick links when enabled", () => {
    const out = formatTaskSummary(
      baseTask,
      { quickLinks: [link] },
      { ...DEFAULT_SUMMARY_TEMPLATE, quickLinks: true },
    );
    expect(out).toContain("- Header mockup: https://figma.com/file/abc");
  });

  it("includes created and updated dates when enabled", () => {
    const out = formatTaskSummary(
      baseTask,
      {},
      {
        ...DEFAULT_SUMMARY_TEMPLATE,
        createdDate: true,
        updatedDate: true,
      },
    );
    expect(out).toContain("Created: 2025-01-01T09:00:00Z");
    expect(out).toContain("Updated: 2025-01-02T12:30:00Z");
  });
});
