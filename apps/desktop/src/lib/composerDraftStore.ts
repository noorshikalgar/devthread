// Per-task composer draft store. The composer's local useState is
// lost when the ThreadColumn unmounts on task switch — this module
// survives that by keeping the in-progress entry (content, entry
// type, and pending images) in a module-level Map keyed by taskId.
// The TaskSidebar reads `hasComposerDraft(taskId)` to draw a ring
// around the status dot so the user can see which task still has
// unsent text waiting for them.

import type { EntryType, PendingImage } from "./types";

export interface ComposerDraft {
  content: string;
  entryType: EntryType;
  images: PendingImage[];
}

const drafts = new Map<string, ComposerDraft>();

export function getComposerDraft(taskId: string): ComposerDraft | null {
  return drafts.get(taskId) ?? null;
}

export function setComposerDraft(
  taskId: string,
  draft: ComposerDraft,
): ComposerDraft {
  drafts.set(taskId, draft);
  // Notify any subscribers (the sidebar ring) that the draft set
  // changed. Using a custom event avoids pulling in a full state
  // management library just for this one cross-component signal.
  window.dispatchEvent(new CustomEvent("devthread:composer-drafts"));
  return draft;
}

export function patchComposerDraft(
  taskId: string,
  patch: Partial<ComposerDraft>,
): ComposerDraft | null {
  const current = drafts.get(taskId);
  if (!current) return null;
  const next = { ...current, ...patch };
  drafts.set(taskId, next);
  window.dispatchEvent(new CustomEvent("devthread:composer-drafts"));
  return next;
}

export function clearComposerDraft(taskId: string): void {
  drafts.delete(taskId);
  window.dispatchEvent(new CustomEvent("devthread:composer-drafts"));
}

export function hasComposerDraft(taskId: string): boolean {
  const draft = drafts.get(taskId);
  if (!draft) return false;
  // An empty draft is not a draft — only mark the task when the
  // user has actually typed something or attached an image.
  return draft.content.trim().length > 0 || draft.images.length > 0;
}
