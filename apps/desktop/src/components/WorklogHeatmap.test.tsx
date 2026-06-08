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

  it("routes 2h and 6h into different intensity buckets (different hatch stripe widths)", () => {
    // Regression test: an earlier ladder routed both 2h and 6h
    // to the >= 240 bucket, so the cells looked identical. The
    // new ladder uses 5 buckets with visibly different stripe
    // widths (8 / 4 / 2.5 / 1.5 / 1px) — measurable even when
    // getComputedStyle returns null in the jsdom environment
    // (so the colour fall back is the same for both cells).
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
    const style2h = cells[0]!.getAttribute("style") ?? "";
    const style6h = cells[1]!.getAttribute("style") ?? "";
    // The hatch stripe width is a stable literal the component
    // bakes into the style attribute, so we can assert on it
    // without depending on getComputedStyle.
    const stripe2h = /repeating-linear-gradient\(45deg,\s*\S+\s+([\d.]+)px/.exec(
      style2h,
    );
    const stripe6h = /repeating-linear-gradient\(45deg,\s*\S+\s+([\d.]+)px/.exec(
      style6h,
    );
    expect(stripe2h).not.toBeNull();
    expect(stripe6h).not.toBeNull();
    // 2h → bucket index 2 → 2.5px stripe. 6h → bucket index 4 →
    // 1px stripe. They must differ.
    expect(stripe2h![1]).not.toBe(stripe6h![1]);
  });

  it("paints the streak pill using the theme background + accent text (theme-aware)", () => {
    // Regression test: the previous className set 'text-foreground'
    // (and even 'boxShadow' over a same-colour background), which
    // made the pill invisible on amber-heavy themes. The new pill
    // uses --background as its canvas and --chart-1 for the text
    // colour, so the contrast comes from "light accent on dark
    // card" rather than "amber on amber".
    render(
      <WorklogHeatmap
        days={DAYS}
        onSelectDay={vi.fn()}
        range="12w"
        selectedDay={null}
      />,
    );
    const pill = screen.getByTestId("worklog-streak-pill");
    const style = pill.getAttribute("style") ?? "";
    // The pill paints its own background from --background so the
    // accent text always contrasts with it.
    expect(style).toMatch(/background-color:\s*var\(--background\)/);
    expect(style).toMatch(/color:/);
    // The pill should NOT carry a hard-coded emerald background.
    expect(pill.className).not.toMatch(/bg-emerald/);
    // The label colour cascades from the inline style, not the
    // class list (which was the original bug).
    expect(pill.className).not.toMatch(/text-foreground/);
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
