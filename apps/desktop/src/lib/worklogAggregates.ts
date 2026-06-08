import type { WorklogMetricEntry } from "@/lib/types";

export interface WorklogBarItem {
  label: string;
  minutes: number;
}

/**
 * Buckets entries by a caller-provided label (e.g. week-of or
 * month-name) and returns the total minutes per bucket, newest first.
 * Used by the Weekly and Monthly totals cards.
 */
export function aggregateByBucket(
  entries: ReadonlyArray<WorklogMetricEntry>,
  bucketLabel: (value: string) => string,
): WorklogBarItem[] {
  const buckets = new Map<string, number>();
  for (const entry of entries) {
    const label = bucketLabel(entry.occurredAt);
    buckets.set(label, (buckets.get(label) ?? 0) + entry.durationMinutes);
  }
  return [...buckets.entries()]
    .map(([label, minutes]) => ({ label, minutes }))
    .reverse();
}

