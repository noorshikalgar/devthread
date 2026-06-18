import { describe, expect, it } from "vitest";
import {
  buildWorklogExportSheets,
  buildWorklogFilename,
} from "./worklogExportPayload";
import type { WorklogMetricEntry } from "./types";
import type { WorklogSettings } from "./worklogSettings";

const SETTINGS: WorklogSettings = { dailyHours: 8, breakMinutes: 0 };

const entry = (
  id: string,
  taskId: string,
  taskTitle: string,
  occurredAt: string,
  durationMinutes: number,
  folderName: string | null = null,
): WorklogMetricEntry => ({
  id,
  taskId,
  taskTitle,
  folderName,
  occurredAt,
  durationMinutes,
  contentMarkdown: "",
});

describe("buildWorklogExportSheets", () => {
  it("produces four sheets in the agreed order", () => {
    const sheets = buildWorklogExportSheets({
      year: 2026,
      settings: SETTINGS,
      entries: [entry("e1", "t1", "T1 task", "2026-06-14T09:00:00Z", 60)],
    });
    expect(sheets.map((s) => s.name)).toEqual([
      "Guide",
      "Summary",
      "Weeks",
      "Months",
      "Tasks",
    ]);
  });

  it("Guide sheet explains the columns and coloring rules", () => {
    const sheets = buildWorklogExportSheets({
      year: 2026,
      settings: SETTINGS,
      entries: [entry("e1", "t1", "T1 task", "2026-06-14T09:00:00Z", 60)],
    });
    const guide = sheets[0]!;
    const labels = guide.rows
      .map((row) => row[0]?.value)
      .filter((v): v is string => typeof v === "string");
    expect(labels).toContain("Worklog export guide");
    expect(labels).toContain("What each sheet contains");
    expect(labels).toContain("Why some columns look the way they do");
    expect(labels).toContain("Reading the colors");
    expect(guide.tabColor).toBe("94A3B8");
  });

  it("Guide section titles use the light-yellow guideSection style, not the dark header", () => {
    const sheets = buildWorklogExportSheets({
      year: 2026,
      settings: SETTINGS,
      entries: [entry("e1", "t1", "T1 task", "2026-06-14T09:00:00Z", 60)],
    });
    const guide = sheets[0]!;
    // Locate the section headings: the rows that immediately follow a
    // blank row contain section title text. We assert the style index
    // is the guideSection style (8), not the dark header style (1).
    const sectionTitles = [
      "Worklog export guide",
      "About this export",
      "What each sheet contains",
      "Why some columns look the way they do",
      "Reading the colors",
      "Generated",
    ];
    for (const title of sectionTitles) {
      const row = guide.rows.find((r) => r[0]?.value === title);
      expect(row, `missing section title: ${title}`).toBeDefined();
      expect(row![0]?.style, `${title} should use guideSection (8)`).toBe(8);
      expect(row![0]?.wrap, `${title} should be marked wrap`).toBe(true);
    }
  });

  it("Guide body lines are wrapped so long prose doesn't spill across cells", () => {
    const sheets = buildWorklogExportSheets({
      year: 2026,
      settings: SETTINGS,
      entries: [entry("e1", "t1", "T1 task", "2026-06-14T09:00:00Z", 60)],
    });
    const guide = sheets[0]!;
    // Find a known long line and assert it's marked wrap.
    const longLineRow = guide.rows.find(
      (r) =>
        typeof r[0]?.value === "string" &&
        r[0].value.startsWith("All four sheets are generated"),
    );
    expect(longLineRow).toBeDefined();
    expect(longLineRow![0]?.wrap).toBe(true);
  });

  it("Tasks sheet wraps long task title and folder cells", () => {
    const entries: WorklogMetricEntry[] = [
      entry(
        "e1",
        "t1",
        "An absurdly long task title that definitely does not fit on one Excel column without wrapping",
        "2026-06-01T09:00:00Z",
        60,
        "Engineering / Platform / Subteam name that is also quite long",
      ),
    ];
    const sheets = buildWorklogExportSheets({
      year: 2026,
      settings: SETTINGS,
      entries,
    });
    const tasks = sheets[4]!;
    const dataRow = tasks.rows[1]!;
    // Title (col 1) and folder (col 2) cells opt in to wrap.
    expect(dataRow[1]?.wrap).toBe(true);
    expect(dataRow[2]?.wrap).toBe(true);
    // Numeric columns do not wrap.
    expect(dataRow[0]?.wrap).toBeUndefined();
    expect(dataRow[3]?.wrap).toBeUndefined();
  });

  it("period sheets use tiered fills and freeze the header row", () => {
    const sheets = buildWorklogExportSheets({
      year: 2026,
      settings: SETTINGS,
      entries: [
        // Week of Jun 1 (Mon) — 5 workdays * 8h = 40h weekly goal
        entry("e1", "t1", "T1", "2026-06-01T09:00:00Z", 40 * 60), // 100%
        // Week of Jun 15 (Mon)
        entry("e2", "t1", "T1", "2026-06-15T09:00:00Z", 30 * 60), // 75%
        // Week of Jun 22 (Mon)
        entry("e3", "t1", "T1", "2026-06-22T09:00:00Z", 20 * 60), // 50%
      ],
    });
    const weeks = sheets[2]!;
    expect(weeks.freezeHeader).toBe(true);
    expect(weeks.tabColor).toBe("38BDF8");
    const dataRows = weeks.rows.slice(1);
    // 100% row uses goalHit (style 2)
    const row100 = dataRows.find((r) => r[4]?.value === "100%")!;
    expect(row100[1]?.style).toBe(2);
    // 75% row uses nearGoal (style 5)
    const row75 = dataRows.find((r) => r[4]?.value === "75%")!;
    expect(row75[1]?.style).toBe(5);
    // 50% row uses partial (style 6)
    const row50 = dataRows.find((r) => r[4]?.value === "50%")!;
    expect(row50[1]?.style).toBe(6);
  });

  it("Summary sheet reports totals, best day, goal hit, coverage", () => {
    const entries: WorklogMetricEntry[] = [
      entry("e1", "t1", "T1 task", "2026-06-09T09:00:00Z", 9 * 60),
      entry("e2", "t1", "T1 task", "2026-06-10T09:00:00Z", 4 * 60),
      entry("e3", "t1", "T1 task", "2026-06-11T09:00:00Z", 0),
    ];
    const sheets = buildWorklogExportSheets({
      year: 2026,
      settings: SETTINGS,
      entries,
    });
    const summary = sheets[1]!;
    const byLabel = (label: string) =>
      summary.rows.find((row) => row[0]?.value === label)?.[1]?.value;

    expect(byLabel("Total logged (min)")).toBe(13 * 60);
    expect(byLabel("Average active day (min)")).toBe(Math.round((13 * 60) / 2));
    expect(byLabel("Logged days")).toBe(2);
    expect(byLabel("Best day")).toContain("Jun 9, 2026");
    expect(byLabel("Goal-hit days")).toBe(1); // only 9h day >= 8h goal
  });

  it("Weeks sheet applies goal-hit style to rows at or above the weekly goal", () => {
    const entries: WorklogMetricEntry[] = [
      // Week of 2026-06-01 (Mon) — 5 workdays = 40h weekly goal
      entry("e1", "t1", "T1", "2026-06-01T09:00:00Z", 8 * 60),
      entry("e2", "t1", "T1", "2026-06-02T09:00:00Z", 8 * 60),
      entry("e3", "t1", "T1", "2026-06-03T09:00:00Z", 8 * 60),
      entry("e4", "t1", "T1", "2026-06-04T09:00:00Z", 8 * 60),
      entry("e5", "t1", "T1", "2026-06-05T09:00:00Z", 8 * 60), // 40h, hits goal
      // Week of 2026-06-15 — 2h only (low coverage)
      entry("e6", "t1", "T1", "2026-06-15T09:00:00Z", 2 * 60),
    ];
    const sheets = buildWorklogExportSheets({
      year: 2026,
      settings: SETTINGS,
      entries,
    });
    const weeks = sheets[2]!;
    const dataRows = weeks.rows.slice(1);
    expect(dataRows).toHaveLength(2);
    // Newest first: 2026-06-15 (2h) then 2026-06-01 (40h)
    const firstRow = dataRows[0]!;
    const secondRow = dataRows[1]!;
    expect(firstRow[0]?.value).toMatch(/Week of Jun 15/);
    // 2h = 5% of 40h → no tier matches, so default style (0) on even row
    expect(firstRow[1]?.style).toBe(0);
    expect(secondRow[0]?.value).toMatch(/Week of Jun 1/);
    // 40h = 100% of weekly goal → goalHit tier (style 2), banded on odd row index
    expect(secondRow[1]?.style).toBe(2);
    expect(secondRow[4]?.value).toBe("100%");
  });

  it("Tasks sheet ranks by minutes with an Entries column", () => {
    const entries: WorklogMetricEntry[] = [
      entry("e1", "t1", "DT-141 first task", "2026-06-01T09:00:00Z", 60),
      entry("e2", "t1", "DT-141 first task", "2026-06-02T09:00:00Z", 60),
      entry("e3", "t2", "DT-142 second", "2026-06-03T09:00:00Z", 90),
    ];
    const sheets = buildWorklogExportSheets({
      year: 2026,
      settings: SETTINGS,
      entries,
    });
    const tasks = sheets[4]!;
    const dataRows = tasks.rows.slice(1);
    expect(dataRows).toHaveLength(2);
    // Columns: Rank | Task title | Folder | Hours | Duration | Entries | Share | Last logged
    expect(tasks.rows[0]?.[5]?.value).toBe("Entries");
    // t1 (60+60=120 min) ranks first; t2 (90 min) is second
    expect(dataRows[0]?.[0]?.value).toBe(1);
    expect(dataRows[0]?.[1]?.value).toBe("DT-141 first task");
    expect(dataRows[0]?.[3]?.value).toBe(2); // hours = 120/60
    expect(dataRows[0]?.[4]?.value).toBe("2h");
    expect(dataRows[0]?.[5]?.value).toBe(2);
    expect(dataRows[0]?.[6]?.value).toBe("57%");
    expect(dataRows[1]?.[0]?.value).toBe(2);
    expect(dataRows[1]?.[1]?.value).toBe("DT-142 second");
    expect(dataRows[1]?.[3]?.value).toBe(1.5);
    expect(dataRows[1]?.[4]?.value).toBe("1h 30m");
    expect(dataRows[1]?.[5]?.value).toBe(1);
    expect(dataRows[1]?.[6]?.value).toBe("43%");
    expect(tasks.freezeHeader).toBe(true);
    expect(tasks.tabColor).toBe("10B981");
  });

  it("Months sheet uses monthly goal of 20 workdays", () => {
    const entries: WorklogMetricEntry[] = [
      entry("e1", "t1", "T1", "2026-06-01T09:00:00Z", 8 * 60),
      entry("e2", "t1", "T1", "2026-06-02T09:00:00Z", 8 * 60),
    ];
    const sheets = buildWorklogExportSheets({
      year: 2026,
      settings: SETTINGS,
      entries,
    });
    const months = sheets[3]!;
    const june = months.rows[1]!;
    // 16h logged / 160h (20 × 8h) goal = 10%
    expect(june[1]?.value).toBe(16);
    expect(june[4]?.value).toBe("10%");
  });
});

describe("buildWorklogFilename", () => {
  it("includes the year and a local-time stamp", () => {
    const fixed = new Date(2026, 5, 14, 14, 32);
    expect(buildWorklogFilename(2026, fixed)).toBe(
      "worklog-2026-20260614-1432.xlsx",
    );
  });
});
