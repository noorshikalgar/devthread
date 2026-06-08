// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WorklogHoursChart,
  tooltipValueFormatter,
} from "./WorklogHoursChart";
import type { WorklogDay } from "@/lib/worklog";
import type { WorklogSettings } from "@/lib/worklogSettings";

// jsdom doesn't compute layout, so ResponsiveContainer would warn that
// it has no width. Mock it out so the chart renders in a fixed box.
vi.mock("recharts", async () => {
  const actual =
    await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 260 }}>{children}</div>
    ),
  };
});

const SETTINGS: WorklogSettings = { dailyHours: 8, breakMinutes: 0 };

const DAYS: WorklogDay[] = [
  { key: "2026-06-01", date: "2026-06-01", minutes: 4 * 60 },
  { key: "2026-06-02", date: "2026-06-02", minutes: 9 * 60 },
  { key: "2026-06-03", date: "2026-06-03", minutes: 0 },
  { key: "2026-06-04", date: "2026-06-04", minutes: 7 * 60 },
];

afterEach(() => {
  cleanup();
});

describe("WorklogHoursChart", () => {
  it("renders the chart with a goal line at the effective daily hours", () => {
    render(<WorklogHoursChart days={DAYS} settings={SETTINGS} />);
    expect(screen.getByTestId("worklog-hours-chart")).toBeInTheDocument();
    // The goal hours appear in the description, broken across a span.
    expect(screen.getByText("8h")).toBeInTheDocument();
  });

  it("renders the empty-state when there are no days", () => {
    render(<WorklogHoursChart days={[]} settings={SETTINGS} />);
    expect(
      screen.getByText(/No worklog entries in the selected range\./),
    ).toBeInTheDocument();
  });

  it("subtracts break minutes from the goal line", () => {
    render(
      <WorklogHoursChart
        days={DAYS}
        settings={{ dailyHours: 8, breakMinutes: 60 }}
      />,
    );
    expect(screen.getByText("7h")).toBeInTheDocument();
  });

  it("falls back to 0h goal when daily hours is 0", () => {
    render(
      <WorklogHoursChart
        days={DAYS}
        settings={{ dailyHours: 0, breakMinutes: 0 }}
      />,
    );
    expect(screen.getByText("0h")).toBeInTheDocument();
  });

  it("counts days that exceeded the goal", () => {
    render(<WorklogHoursChart days={DAYS} settings={SETTINGS} />);
    // DAYS has 9h (over), 4h, 0h, 7h against an 8h goal. Only the 9h
    // day is above the goal.
    expect(screen.getByText(/1 day above goal/i)).toBeInTheDocument();
  });

  it("passes the series name through to the tooltip (does not collapse 'Logged' and 'Above goal' into one row)", () => {
    // Regression test: an earlier version hard-coded the second
    // formatter arg to "Logged", so the Above-goal series in the
    // tooltip was also labelled "Logged" and the two stacked rows
    // read identically. The chart must use this exact function so
    // both series keep their own label.
    expect(tooltipValueFormatter(15, "Logged")).toEqual(["15h", "Logged"]);
    expect(tooltipValueFormatter(15, "Above goal")).toEqual([
      "15h",
      "Above goal",
    ]);
  });
});
