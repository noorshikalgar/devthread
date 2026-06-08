import { describe, expect, it } from "vitest";
import { aggregateByBucket } from "./worklogAggregates";
import type { WorklogMetricEntry } from "./types";

const entry = (
  id: string,
  occurredAt: string,
  durationMinutes: number,
): WorklogMetricEntry => ({
  id,
  taskId: id,
  taskTitle: "T",
  folderName: null,
  contentMarkdown: "",
  occurredAt,
  durationMinutes,
});

describe("aggregateByBucket", () => {
  it("groups entries by a caller-provided label and returns totals, newest first", () => {
    const items = aggregateByBucket(
      [
        entry("1", "2026-06-01T09:00:00Z", 60),
        entry("2", "2026-06-02T09:00:00Z", 120),
        entry("3", "2026-06-08T09:00:00Z", 240),
        entry("4", "2026-06-09T09:00:00Z", 60),
      ],
      (v) => `${new Date(v).getUTCMonth() + 1}/${new Date(v).getUTCDate()}`,
    );
    // Newest day first.
    expect(items[0]).toEqual({ label: "6/9", minutes: 60 });
    expect(items[1]).toEqual({ label: "6/8", minutes: 240 });
    expect(items[2]).toEqual({ label: "6/2", minutes: 120 });
    expect(items[3]).toEqual({ label: "6/1", minutes: 60 });
  });

  it("sums multiple entries in the same bucket", () => {
    const items = aggregateByBucket(
      [
        entry("a", "2026-06-01T09:00:00Z", 60),
        entry("b", "2026-06-01T13:00:00Z", 30),
      ],
      (v) => `${new Date(v).getUTCMonth() + 1}/${new Date(v).getUTCDate()}`,
    );
    expect(items).toEqual([{ label: "6/1", minutes: 90 }]);
  });

  it("returns an empty list when there are no entries", () => {
    expect(aggregateByBucket([], () => "Jun 26")).toEqual([]);
  });
});
