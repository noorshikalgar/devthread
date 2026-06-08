// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WorklogBars } from "./WorklogBars";

afterEach(() => {
  cleanup();
});

describe("WorklogBars", () => {
  it("renders one row per item", () => {
    render(
      <WorklogBars
        items={[
          { label: "6/1", minutes: 120 },
          { label: "6/8", minutes: 240 },
        ]}
        title="Weekly totals"
      />,
    );
    expect(screen.getByText("6/1")).toBeInTheDocument();
    expect(screen.getByText("6/8")).toBeInTheDocument();
  });

  it("shows an empty hint when there are no items", () => {
    render(<WorklogBars items={[]} title="Weekly totals" />);
    expect(screen.getByText(/No logged time yet\./)).toBeInTheDocument();
  });

  it("caps the bar fill at 4% so a tiny bar is still visible", () => {
    // Avoid jsdom's lack of layout by asserting on the inline style
    // attribute that drives the bar width.
    render(
      <WorklogBars
        items={[
          { label: "6/1", minutes: 5 },
          { label: "6/8", minutes: 600 },
        ]}
        title="Weekly totals"
      />,
    );
    // The 5-minute day is far below the max, so its bar should be
    // clamped to the 4% minimum.
    const minBars = document.querySelectorAll<HTMLDivElement>(
      "div[style*='width: 4%']",
    );
    expect(minBars.length).toBeGreaterThan(0);
  });
});
