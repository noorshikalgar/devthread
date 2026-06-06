import { describe, expect, it } from "vitest";
import {
  DEFAULT_SUMMARY_TEMPLATE,
  type SummaryFieldKey,
  type SummaryTemplate,
} from "./summaryTemplate";
import { formatTaskSection, formatTaskSummary } from "./taskSummary";
import type { Task, TaskQuickLink } from "./types";

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
  it("returns an empty string when every field is off", () => {
    expect(formatTaskSummary(baseTask, {}, ALL_OFF)).toBe("");
  });

  it("uses the default template (no Title) and omits the Updates line", () => {
    const out = formatTaskSummary(baseTask, { totalMinutes: 4 * 60 + 30 });
    expect(out).toBe(
      ["**Status:** Active", "**Estimate:** 1d", "**Logged:** 4h 30m"].join(
        "\n",
      ),
    );
    expect(out).not.toContain("Updates:");
  });

  it("renders the Title line only when its toggle is on", () => {
    const on = formatTaskSummary(baseTask, {}, { ...ALL_OFF, title: true });
    expect(on).toBe("**Title:** Ship the summary template");

    const off = formatTaskSummary(baseTask, {}, ALL_OFF);
    expect(off).toBe("");
  });

  it("uses bold Markdown for every label", () => {
    const out = formatTaskSummary(
      baseTask,
      { totalMinutes: 90, quickLinks: [link] },
      {
        ...DEFAULT_SUMMARY_TEMPLATE,
        title: true,
        quickLinks: true,
        createdDate: true,
        updatedDate: true,
      },
    );
    expect(out).toContain("**Title:**");
    expect(out).toContain("**Status:**");
    expect(out).toContain("**Estimate:**");
    expect(out).toContain("**Logged:**");
    expect(out).toContain("**Links:**");
    expect(out).toContain("**Created:**");
    expect(out).toContain("**Updated:**");
  });

  it("shows 'None' when the task has no estimate", () => {
    const out = formatTaskSummary({ ...baseTask, estimatedMinutes: null });
    expect(out).toContain("**Estimate:** None");
  });

  it("falls back to 0m when totalMinutes is 0", () => {
    const out = formatTaskSummary(baseTask, { totalMinutes: 0 });
    expect(out).toContain("**Logged:** 0m");
  });

  it("omits Logged when worklog is off", () => {
    const out = formatTaskSummary(
      baseTask,
      { totalMinutes: 60 },
      { ...DEFAULT_SUMMARY_TEMPLATE, worklog: false },
    );
    expect(out).not.toContain("Logged");
  });

  it("renders per-entry bullets only when worklogEntries is on", () => {
    const entries = [
      { contentMarkdown: "Implemented X", durationMinutes: 90 },
      { contentMarkdown: "Reviewed Y", durationMinutes: 30 },
    ];
    const withEntries = formatTaskSummary(
      baseTask,
      { totalMinutes: 120, entries },
      { ...DEFAULT_SUMMARY_TEMPLATE, worklogEntries: true },
    );
    expect(withEntries).toContain("- 1h 30m Implemented X");
    expect(withEntries).toContain("- 30m Reviewed Y");

    const withoutEntries = formatTaskSummary(
      baseTask,
      { totalMinutes: 120, entries },
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

  it("renders quick links as Markdown links under a Links section", () => {
    const out = formatTaskSummary(
      baseTask,
      { quickLinks: [link] },
      { ...DEFAULT_SUMMARY_TEMPLATE, quickLinks: true },
    );
    expect(out).toContain("**Links:**");
    expect(out).toContain("- [Header mockup](https://figma.com/file/abc)");
  });

  it("formats created and updated dates in a human-readable form", () => {
    const out = formatTaskSummary(
      baseTask,
      {},
      {
        ...DEFAULT_SUMMARY_TEMPLATE,
        createdDate: true,
        updatedDate: true,
      },
    );
    expect(out).toContain("**Created:** ");
    expect(out).toContain("**Updated:** ");
    expect(out).not.toContain("2025-01-01T09:00:00Z");
  });

  it("respects a custom field order", () => {
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
    const out = formatTaskSummary(
      baseTask,
      { totalMinutes: 90, quickLinks: [link] },
      {
        title: true,
        status: true,
        estimate: true,
        worklog: true,
        worklogEntries: false,
        quickLinks: true,
        createdDate: true,
        updatedDate: true,
      },
      order,
    );
    const lines = out.split("\n");
    expect(lines[0]).toBe("**Title:** Ship the summary template");
    expect(lines[1]).toMatch(/^\*\*Updated:\*\*/);
    expect(lines[2]).toBe("**Status:** Active");
    expect(lines[3]).toBe("**Estimate:** 1d");
    expect(lines[4]).toBe("**Logged:** 1h 30m");
    expect(lines[5]).toBe("**Links:**");
    expect(lines[6]).toBe("- [Header mockup](https://figma.com/file/abc)");
    expect(lines[7]).toMatch(/^\*\*Created:\*\*/);
  });
});

describe("formatTaskSection", () => {
  it("prepends a Markdown H2 with the task title, even when Title is off", () => {
    const out = formatTaskSection(baseTask, { totalMinutes: 90 });
    expect(out.startsWith("## Ship the summary template")).toBe(true);
    expect(out).toContain("**Logged:** 1h 30m");
  });
});
