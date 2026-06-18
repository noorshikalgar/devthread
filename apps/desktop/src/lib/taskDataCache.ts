// Per-task data cache. Used by the workspace shell so that switching
// between Tasks and Archive (and back) does not re-fetch every
// timeline entry, quick link, and attachment — the data hydrates
// from this store in O(1).
//
// The store is a module-level Map so it survives component
// unmount/remount cycles (which happen on every workspace mode
// toggle). Mutations that change the cached payload MUST call
// `invalidateTaskData` or `updateCachedTaskData` to keep the cache
// honest.

import type { Attachment, TaskQuickLink, WorkLogEntry } from "./types";

export interface TaskData {
  entries: WorkLogEntry[];
  quickLinks: TaskQuickLink[];
  attachments: Attachment[];
}

const cache = new Map<string, TaskData>();

const EMPTY_TASK_DATA: TaskData = {
  entries: [],
  quickLinks: [],
  attachments: [],
};

export function getCachedTaskData(taskId: string): TaskData | null {
  return cache.get(taskId) ?? null;
}

export function setCachedTaskData(taskId: string, data: TaskData): void {
  cache.set(taskId, data);
}

export function updateCachedTaskData(
  taskId: string,
  patch: Partial<TaskData>,
): TaskData | null {
  // Upsert: if the task isn't cached yet, start from an empty
  // payload so the first load can still seed the cache. Subsequent
  // calls merge into the existing entry, preserving slices that
  // other loads (e.g. quick links vs entries) have already written.
  const current = cache.get(taskId) ?? EMPTY_TASK_DATA;
  const next = { ...current, ...patch };
  cache.set(taskId, next);
  return next;
}

export function invalidateTaskData(taskId: string): void {
  cache.delete(taskId);
}

export function clearTaskDataCache(): void {
  cache.clear();
}
