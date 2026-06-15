// Per-year worklog metrics cache. Mirrors the per-task data cache:
// the year metrics are stable for the life of the app session, so we
// only re-fetch when the user explicitly changes the year. Switching
// from Tasks → Worklog → Tasks → Worklog for the same year should
// hydrate instantly from this store.

import type { WorklogMetricEntry } from "./types";

export interface WorklogYearData {
  metrics: WorklogMetricEntry[];
  heatmapMetrics: WorklogMetricEntry[];
}

const cache = new Map<number, WorklogYearData>();

export function getCachedWorklogYear(year: number): WorklogYearData | null {
  return cache.get(year) ?? null;
}

export function setCachedWorklogYear(year: number, data: WorklogYearData): void {
  cache.set(year, data);
}

export function invalidateWorklogYear(year: number): void {
  cache.delete(year);
}

export function clearWorklogCache(): void {
  cache.clear();
}
