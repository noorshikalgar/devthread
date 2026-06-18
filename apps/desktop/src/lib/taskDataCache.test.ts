import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearTaskDataCache,
  getCachedTaskData,
  invalidateTaskData,
  setCachedTaskData,
  updateCachedTaskData,
  type TaskData,
} from "./taskDataCache";
import type { Attachment, TaskQuickLink, WorkLogEntry } from "./types";

const sampleEntry: WorkLogEntry = {
  id: "e1",
  taskId: "t1",
  entryType: "progress",
  contentMarkdown: "hello",
  visibility: "private",
  durationMinutes: null,
  occurredAt: "2026-06-14T09:00:00Z",
  createdAt: "2026-06-14T09:00:00Z",
  updatedAt: "2026-06-14T09:00:00Z",
};

const sampleLink: TaskQuickLink = {
  id: "l1",
  taskId: "t1",
  url: "https://example.com",
  title: "Example",
  domain: "example.com",
  provider: "generic",
  createdAt: "2026-06-14T09:00:00Z",
  updatedAt: "2026-06-14T09:00:00Z",
};

const sampleAttachment: Attachment = {
  id: "a1",
  workLogEntryId: "e1",
  originalName: "image.png",
  mediaType: "image/png",
  path: "/tmp/image.png",
  byteSize: 4,
  createdAt: "2026-06-14T09:00:00Z",
};

const sample: TaskData = {
  entries: [sampleEntry],
  quickLinks: [sampleLink],
  attachments: [sampleAttachment],
};

describe("taskDataCache", () => {
  beforeEach(() => {
    clearTaskDataCache();
  });
  afterEach(() => {
    clearTaskDataCache();
  });

  it("returns null for an uncached task", () => {
    expect(getCachedTaskData("missing")).toBeNull();
  });

  it("stores and returns the full payload", () => {
    setCachedTaskData("t1", sample);
    expect(getCachedTaskData("t1")).toEqual(sample);
  });

  it("patches only the fields provided by `updateCachedTaskData`", () => {
    setCachedTaskData("t1", sample);
    const secondEntry: WorkLogEntry = { ...sampleEntry, id: "e2" };
    const updated = updateCachedTaskData("t1", { entries: [secondEntry] });
    expect(updated).toEqual({
      entries: [secondEntry],
      quickLinks: sample.quickLinks,
      attachments: sample.attachments,
    });
    // And the next read returns the merged payload.
    expect(getCachedTaskData("t1")?.entries).toEqual([secondEntry]);
  });

  it("upserts: patches seed the cache when the task is unknown", () => {
    const updated = updateCachedTaskData("missing", {
      entries: [sampleEntry],
    });
    expect(updated).toEqual({
      entries: [sampleEntry],
      quickLinks: [],
      attachments: [],
    });
    expect(getCachedTaskData("missing")?.entries).toEqual([sampleEntry]);
  });

  it("removes the task from the cache on invalidate", () => {
    setCachedTaskData("t1", sample);
    invalidateTaskData("t1");
    expect(getCachedTaskData("t1")).toBeNull();
  });

  it("keeps separate payloads per task", () => {
    setCachedTaskData("t1", sample);
    setCachedTaskData("t2", { ...sample, entries: [] });
    expect(getCachedTaskData("t1")?.entries).toHaveLength(1);
    expect(getCachedTaskData("t2")?.entries).toHaveLength(0);
  });
});
