export const ENTRY_TYPES = [
  "note",
  "progress",
  "finding",
  "blocker",
  "decision",
  "next_step",
] as const;

export const TASK_STATUSES = [
  "planned",
  "active",
  "blocked",
  "paused",
  "done",
  "archived",
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type Visibility = "private" | "report";

export interface Task {
  id: string;
  title: string;
  descriptionMarkdown: string;
  status: TaskStatus;
  nextStep: string | null;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkLogEntry {
  id: string;
  taskId: string;
  entryType: EntryType;
  contentMarkdown: string;
  visibility: Visibility;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkLogRevision {
  id: string;
  workLogEntryId: string;
  revisionNumber: number;
  previousContentMarkdown: string;
  previousEntryType: EntryType;
  previousVisibility: Visibility;
  changedAt: string;
  changeSource: "user_edit" | "restore";
}

export interface Attachment {
  id: string;
  workLogEntryId: string;
  originalName: string;
  mediaType: string;
  path: string;
  byteSize: number;
  createdAt: string;
}

export interface PendingImage {
  id: string;
  name: string;
  mediaType: string;
  base64Data: string;
  previewUrl: string;
}

export interface LinkMetadata {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}
