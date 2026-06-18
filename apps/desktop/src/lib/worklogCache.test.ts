import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearWorklogCache,
  getCachedWorklogYear,
  invalidateWorklogYear,
  setCachedWorklogYear,
} from "./worklogCache";
import type { WorklogMetricEntry } from "./types";

const sampleEntry: WorklogMetricEntry = {
  id: "m1",
  taskId: "t1",
  taskTitle: "Sample",
  folderName: null,
  occurredAt: "2026-06-14T09:00:00Z",
  durationMinutes: 60,
  contentMarkdown: "",
};

describe("worklogCache", () => {
  beforeEach(() => {
    clearWorklogCache();
  });
  afterEach(() => {
    clearWorklogCache();
  });

  it("returns null for an uncached year", () => {
    expect(getCachedWorklogYear(2025)).toBeNull();
  });

  it("stores and returns metrics + heatmap per year", () => {
    setCachedWorklogYear(2026, {
      metrics: [sampleEntry],
      heatmapMetrics: [sampleEntry],
    });
    expect(getCachedWorklogYear(2026)).toEqual({
      metrics: [sampleEntry],
      heatmapMetrics: [sampleEntry],
    });
  });

  it("invalidates a single year without touching the others", () => {
    setCachedWorklogYear(2025, {
      metrics: [sampleEntry],
      heatmapMetrics: [sampleEntry],
    });
    setCachedWorklogYear(2026, {
      metrics: [sampleEntry],
      heatmapMetrics: [sampleEntry],
    });
    invalidateWorklogYear(2025);
    expect(getCachedWorklogYear(2025)).toBeNull();
    expect(getCachedWorklogYear(2026)).not.toBeNull();
  });
});
