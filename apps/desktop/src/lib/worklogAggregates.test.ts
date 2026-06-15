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

const dayKey = (v: string) => v.slice(0, 10);
const dayLabel = (v: string) => {
  const d = new Date(v);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

describe("aggregateByBucket", () => {
  it("groups entries by a caller-provided key + label, newest first", () => {
    const items = aggregateByBucket(
      [
        entry("1", "2026-06-01T09:00:00Z", 60),
        entry("2", "2026-06-02T09:00:00Z", 120),
        entry("3", "2026-06-08T09:00:00Z", 240),
        entry("4", "2026-06-09T09:00:00Z", 60),
      ],
      dayLabel,
      dayKey,
    );
    // Newest day first; the key + label are surfaced for the
    // inspector to filter on.
    expect(items[0]).toEqual({ key: "2026-06-09", label: "6/9", minutes: 60 });
    expect(items[1]).toEqual({ key: "2026-06-08", label: "6/8", minutes: 240 });
    expect(items[2]).toEqual({ key: "2026-06-02", label: "6/2", minutes: 120 });
    expect(items[3]).toEqual({ key: "2026-06-01", label: "6/1", minutes: 60 });
  });

  it("sums multiple entries in the same bucket", () => {
    const items = aggregateByBucket(
      [
        entry("a", "2026-06-01T09:00:00Z", 60),
        entry("b", "2026-06-01T13:00:00Z", 30),
      ],
      dayLabel,
      dayKey,
    );
    expect(items).toEqual([{ key: "2026-06-01", label: "6/1", minutes: 90 }]);
  });

  it("returns an empty list when there are no entries", () => {
    expect(aggregateByBucket([], () => "Jun 26", dayKey)).toEqual([]);
  });

  it("keeps the label and key from the first entry when several share a label", () => {
    // Daylight-savings edge case: two entries from the same calendar
    // day but with the same human label. The key is what makes the
    // bucket unique; the label is just the display string.
    const items = aggregateByBucket(
      [entry("a", "2026-06-01T09:00:00Z", 60)],
      () => "6/1",
      dayKey,
    );
    expect(items).toEqual([{ key: "2026-06-01", label: "6/1", minutes: 60 }]);
  });
});
