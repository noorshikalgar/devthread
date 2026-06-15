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

  it("paints logged cells with shadcn chart token levels", () => {
    render(
      <WorklogHeatmap
        days={DAYS}
        onSelectDay={vi.fn()}
        range="12w"
        selectedDay={null}
      />,
    );
    const cells = screen.getAllByTestId("heatmap-cell") as HTMLButtonElement[];
    const busy = cells[1]!;
    expect(busy.className).toMatch(/bg-\[hsl\(var\(--chart-1\)/);
    expect(busy.className).not.toMatch(/bg-emerald/);
    expect(busy.getAttribute("style") ?? "").not.toMatch(
      /repeating-linear-gradient/,
    );
    const light = cells[2]!;
    expect(light.className).toMatch(/bg-\[hsl\(var\(--chart-1\)/);
  });

  it("routes 2h and 6h into different chart token intensity buckets", () => {
    render(
      <WorklogHeatmap
        days={[
          { key: "2026-06-01", date: "2026-06-01", minutes: 2 * 60 },
          { key: "2026-06-02", date: "2026-06-02", minutes: 6 * 60 },
        ]}
        onSelectDay={vi.fn()}
        range="12w"
        selectedDay={null}
      />,
    );
    const cells = screen.getAllByTestId("heatmap-cell") as HTMLButtonElement[];
    expect(cells[0]!.className).not.toBe(cells[1]!.className);
  });

  it("paints the streak pill with shadcn chart accent tokens", () => {
    render(
      <WorklogHeatmap
        days={DAYS}
        onSelectDay={vi.fn()}
        range="12w"
        selectedDay={null}
      />,
    );
    const pill = screen.getByTestId("worklog-streak-pill");
    expect(pill.className).toMatch(/bg-\[hsl\(var\(--chart-1\)/);
    expect(pill.className).not.toMatch(/bg-emerald/);
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
    expect(pill).toHaveTextContent(/Best 4d/);
  });

  it("renders small square cells", () => {
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
      expect(cell.className).toContain("size-[clamp(9px,1.08vw,15px)]");
    });
  });

  it("dims cells outside the selected range without removing them", () => {
    const days = Array.from({ length: 10 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return {
        key: `2026-06-${day}`,
        date: `2026-06-${day}`,
        minutes: index * 10,
      };
    });
    render(
      <WorklogHeatmap
        days={days}
        onSelectDay={vi.fn()}
        range="7d"
        selectedDay={null}
      />,
    );
    const cells = screen.getAllByTestId("heatmap-cell");
    expect(cells).toHaveLength(10);
    expect(cells[0]!.className).toContain("opacity-25");
    expect(cells[9]!.className).not.toContain("opacity-25");
  });

  it("does not dim year cells in the 12m view", () => {
    render(
      <WorklogHeatmap
        days={DAYS}
        onSelectDay={vi.fn()}
        range="12m"
        selectedDay={null}
        selectedYear={2026}
        yearOptions={[2026, 2025, 2024]}
      />,
    );
    const cells = screen.getAllByTestId("heatmap-cell");
    cells.forEach((cell) => {
      expect(cell.className).not.toContain("opacity-25");
    });
    expect(screen.getByRole("button", { name: "2026" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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
