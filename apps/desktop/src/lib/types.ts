export const ENTRY_TYPES = [
  "note",
  "progress",
  "finding",
  "blocker",
  "decision",
  "next_step",
  "worklog",
  "status",
  "estimate",
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
export type ReleaseStatus = "draft" | "pre_release" | "released";

export interface Task {
  id: string;
  title: string;
  descriptionMarkdown: string;
  status: TaskStatus;
  nextStep: string | null;
  estimatedMinutes: number | null;
  folderId: string | null;
  releaseName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  releaseName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Release {
  name: string;
  version: string | null;
  descriptionMarkdown: string;
  releaseStatus: ReleaseStatus;
  releasedAt: string | null;
  folderId: string | null;
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
  durationMinutes: number | null;
  startedAt?: string | null;
}

export interface WorklogMetricEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  folderName: string | null;
  contentMarkdown: string;
  occurredAt: string;
  durationMinutes: number;
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

export interface TaskQuickLink {
  id: string;
  taskId: string;
  url: string;
  title: string;
  domain: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
}
