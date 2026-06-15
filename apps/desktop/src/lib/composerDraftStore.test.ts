// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearComposerDraft,
  getComposerDraft,
  hasComposerDraft,
  patchComposerDraft,
  setComposerDraft,
} from "./composerDraftStore";
import type { EntryType, PendingImage } from "./types";

const sampleImages: PendingImage[] = [
  {
    id: "img-1",
    name: "shot.png",
    mediaType: "image/png",
    base64Data: "data:image/png;base64,AAAA",
    previewUrl: "blob:preview",
  },
];

describe("composerDraftStore", () => {
  beforeEach(() => {
    clearComposerDraft("t1");
    clearComposerDraft("t2");
  });
  afterEach(() => {
    clearComposerDraft("t1");
    clearComposerDraft("t2");
  });

  it("returns null for an unknown task", () => {
    expect(getComposerDraft("missing")).toBeNull();
  });

  it("stores and returns the full draft", () => {
    const saved = setComposerDraft("t1", {
      content: "Working on it",
      entryType: "progress" as EntryType,
      images: [],
    });
    expect(saved).toEqual({
      content: "Working on it",
      entryType: "progress",
      images: [],
    });
    expect(getComposerDraft("t1")).toEqual(saved);
  });

  it("patches an existing draft in place", () => {
    setComposerDraft("t1", { content: "draft", entryType: "note", images: [] });
    const updated = patchComposerDraft("t1", { entryType: "blocker" });
    expect(updated?.entryType).toBe("blocker");
    expect(updated?.content).toBe("draft");
  });

  it("returns null when patching an unknown task", () => {
    expect(patchComposerDraft("missing", { content: "x" })).toBeNull();
  });

  it("clears the draft", () => {
    setComposerDraft("t1", { content: "draft", entryType: "note", images: [] });
    clearComposerDraft("t1");
    expect(getComposerDraft("t1")).toBeNull();
  });

  it("hasComposerDraft returns true only when content or images are present", () => {
    setComposerDraft("t1", { content: "", entryType: "note", images: [] });
    expect(hasComposerDraft("t1")).toBe(false);

    setComposerDraft("t1", { content: "hello", entryType: "note", images: [] });
    expect(hasComposerDraft("t1")).toBe(true);

    setComposerDraft("t1", {
      content: "   ",
      entryType: "note",
      images: sampleImages,
    });
    expect(hasComposerDraft("t1")).toBe(true);
  });

  it("notifies subscribers via a custom event when the store changes", () => {
    const handler = vi.fn();
    window.addEventListener("devthread:composer-drafts", handler);
    try {
      setComposerDraft("t1", { content: "x", entryType: "note", images: [] });
      expect(handler).toHaveBeenCalledTimes(1);
      patchComposerDraft("t1", { content: "y" });
      expect(handler).toHaveBeenCalledTimes(2);
      clearComposerDraft("t1");
      expect(handler).toHaveBeenCalledTimes(3);
    } finally {
      window.removeEventListener("devthread:composer-drafts", handler);
    }
  });
});
