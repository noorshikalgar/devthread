import type { WorklogMetricEntry } from "@/lib/types";

export interface WorklogBarItem {
  key: string;
  label: string;
  minutes: number;
}

/**
 * Buckets entries by a caller-provided key + label (e.g. the
 * ISO Monday for a week, or "2026-06" for a month) and returns the
 * total minutes per bucket, newest first. The `key` is a stable
 * identifier used to filter the inspector and the `label` is what
 * gets shown to the user ("Week of Jun 8" or "June 2026").
 */
export function aggregateByBucket(
  entries: ReadonlyArray<WorklogMetricEntry>,
  bucketLabel: (value: string) => string,
  bucketKey: (value: string) => string,
): WorklogBarItem[] {
  const buckets = new Map<
    string,
    { key: string; label: string; minutes: number }
  >();
  for (const entry of entries) {
    const key = bucketKey(entry.occurredAt);
    const label = bucketLabel(entry.occurredAt);
    const compositeKey = `${key}::${label}`;
    const current = buckets.get(compositeKey);
    if (current) {
      current.minutes += entry.durationMinutes;
    } else {
      buckets.set(compositeKey, { key, label, minutes: entry.durationMinutes });
    }
  }
  return [...buckets.values()].sort((a, b) => b.key.localeCompare(a.key));
}
