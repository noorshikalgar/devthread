// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorklogHeatmap } from "./WorklogHeatmap";
import type { WorklogDay } from "@/lib/worklog";

const DAYS: WorklogDay[] = [
  { key: "2026-06-01", date: "2026-06-01", minutes: 6 * 60 },
  { key: "2026-06-02", date: "2026-06-02", minutes: 9 * 60 },
  { key: "2026-06-03", date: "2026-06-03", minutes: 2 * 60 },
];

afterEach(() => {
  cleanup();
});

describe("WorklogHeatmap", () => {
  it("renders a cell for every day", () => {
    render(
      <WorklogHeatmap
        days={DAYS}
        onSelectDay={vi.fn()}
        range="12w"
        selectedDay={null}
      />,
    );
    expect(screen.getAllByTestId("heatmap-cell")).toHaveLength(3);
  });

  it("paints each cell using the theme accent and a hatch pattern", () => {
    render(
      <WorklogHeatmap
        days={DAYS}
        onSelectDay={vi.fn()}
        range="12w"
        selectedDay={null}
      />,
    );
    const cells = screen.getAllByTestId("heatmap-cell") as HTMLButtonElement[];
    // The 9h day (cell #2) is the brightest. It should declare an
    // accent fill AND a diagonal-hatch backgroundImage, with no
    // fixed emerald-500 class.
    const busy = cells[1]!;
    const style = busy.getAttribute("style") ?? "";
    expect(style).toMatch(/background-color/);
    expect(style).toMatch(/repeating-linear-gradient\(45deg/);
    // The 2h day (cell #3) should also have the hatch but a
    // different (looser) stripe.
    const light = cells[2]!;
    expect(light.getAttribute("style") ?? "").toMatch(
      /repeating-linear-gradient\(45deg/,
    );
  });

  it("renders the current streak in the header pill", () => {
    render(
      <WorklogHeatmap
        days={DAYS}
        onSelectDay={vi.fn()}
        range="12w"
        selectedDay={null}
      />,
    );
    const pill = screen.getByTestId("worklog-streak-pill");
    expect(pill).toHaveTextContent(/3d/);
  });

  it("shows 0d when the most recent day has no logged time", () => {
    const days: WorklogDay[] = [
      { key: "2026-06-01", date: "2026-06-01", minutes: 4 * 60 },
      { key: "2026-06-02", date: "2026-06-02", minutes: 0 },
    ];
    render(
      <WorklogHeatmap
        days={days}
        onSelectDay={vi.fn()}
        range="12w"
        selectedDay={null}
      />,
    );
    expect(screen.getByTestId("worklog-streak-pill")).toHaveTextContent("0d");
  });

  it("surfaces the longest streak in the range alongside the current", () => {
    const days: WorklogDay[] = [
      { key: "2026-06-01", date: "2026-06-01", minutes: 4 * 60 },
      { key: "2026-06-02", date: "2026-06-02", minutes: 4 * 60 },
      { key: "2026-06-03", date: "2026-06-03", minutes: 4 * 60 },
      { key: "2026-06-04", date: "2026-06-04", minutes: 4 * 60 },
      { key: "2026-06-05", date: "2026-06-05", minutes: 0 },
      { key: "2026-06-06", date: "2026-06-06", minutes: 4 * 60 },
    ];
    render(
      <WorklogHeatmap
        days={days}
        onSelectDay={vi.fn()}
        range="12w"
        selectedDay={null}
      />,
    );
    const pill = screen.getByTestId("worklog-streak-pill");
    expect(pill).toHaveTextContent(/1d/);
    expect(pill).toHaveTextContent(/best 4d/);
  });

  it("renders rectangular cells (not squares)", () => {
    // Bigger boxes — the spec called for a "chart-like" cell,
    // not a GitHub dot. We assert the cell has a fixed height
    // class which keeps the row count short and the chart tall.
    render(
      <WorklogHeatmap
        days={DAYS}
        onSelectDay={vi.fn()}
        range="12w"
        selectedDay={null}
      />,
    );
    const cells = screen.getAllByTestId("heatmap-cell");
    cells.forEach((cell) => {
      expect(cell.className).toMatch(/\bh-7\b/);
    });
  });

  it("does not render any amber goal overlays", () => {
    const { container } = render(
      <WorklogHeatmap
        days={DAYS}
        onSelectDay={vi.fn()}
        range="12w"
        selectedDay={null}
      />,
    );
    expect(container.querySelector(".bg-amber-300")).toBeNull();
  });
});
