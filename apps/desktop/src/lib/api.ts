import { invoke } from "@tauri-apps/api/core";
import type {
  Attachment,
  EntryType,
  Folder,
  GlobalTimelineEntry,
  LinkMetadata,
  Release,
  Task,
  TaskQuickLink,
  TaskStatus,
  Visibility,
  WorkLogEntry,
  WorklogMetricEntry,
  WorkLogRevision,
} from "./types";

export const api = {
  listTasks: () => invoke<Task[]>("list_tasks"),
  createTask: (title: string) =>
    invoke<Task>("create_task", { input: { title } }),
  updateTask: (task: Task) =>
    invoke<Task>("update_task", {
      input: {
        id: task.id,
        title: task.title,
        descriptionMarkdown: task.descriptionMarkdown,
        status: task.status satisfies TaskStatus,
        nextStep: task.nextStep,
        estimatedMinutes: task.estimatedMinutes,
        folderId: task.folderId,
      },
    }),
  moveTask: (taskId: string, folderId: string | null) =>
    invoke<Task>("move_task", {
      input: { taskId, folderId },
    }),
  deleteTask: (id: string) => invoke<void>("delete_task", { id }),
  listFolders: () => invoke<Folder[]>("list_folders"),
  createFolder: (name: string) =>
    invoke<Folder>("create_folder", { input: { name } }),
  renameFolder: (id: string, name: string) =>
    invoke<Folder>("rename_folder", { input: { id, name } }),
  deleteFolder: (id: string) => invoke<void>("delete_folder", { id }),
  deleteFolderCascade: (id: string) =>
    invoke<number>("delete_folder_cascade", { id }),
  unassignFolderTasks: (id: string) =>
    invoke<number>("unassign_folder_tasks", { id }),
  listEntries: (taskId: string, limit = 100, offset = 0) =>
    invoke<WorkLogEntry[]>("list_entries", { taskId, limit, offset }),
  listWorklogMetrics: (startAt: string, endAt: string) =>
    invoke<WorklogMetricEntry[]>("list_worklog_metrics", { startAt, endAt }),
  listGlobalTimeline: (startAt: string, endAt: string, limit = 500) =>
    invoke<GlobalTimelineEntry[]>("list_global_timeline", {
      startAt,
      endAt,
      limit,
    }),
  createEntry: (
    taskId: string,
    entryType: EntryType,
    contentMarkdown: string,
    visibility: Visibility,
    durationMinutes: number | null = null,
    occurredAt?: string,
    startedAt?: string,
  ) =>
    invoke<WorkLogEntry>("create_entry", {
      input: {
        taskId,
        entryType,
        contentMarkdown,
        visibility,
        durationMinutes,
        occurredAt,
        startedAt,
      },
    }),
  updateEntry: (
    id: string,
    entryType: EntryType,
    contentMarkdown: string,
    visibility: Visibility,
    durationMinutes: number | null = null,
  ) =>
    invoke<WorkLogEntry>("update_entry", {
      input: {
        id,
        entryType,
        contentMarkdown,
        visibility,
        durationMinutes,
      },
    }),
  listRevisions: (entryId: string) =>
    invoke<WorkLogRevision[]>("list_revisions", { entryId }),
  restoreRevision: (revisionId: string) =>
    invoke<WorkLogEntry>("restore_revision", { revisionId }),
  trashEntry: (entryId: string) => invoke<void>("trash_entry", { entryId }),
  restoreEntry: (entryId: string) => invoke<void>("restore_entry", { entryId }),
  listAttachments: (taskId: string) =>
    invoke<Attachment[]>("list_attachments", { taskId }),
  listQuickLinks: (taskId: string) =>
    invoke<TaskQuickLink[]>("list_quick_links", { taskId }),
  createQuickLink: (
    taskId: string,
    url: string,
    title: string,
    domain: string,
    provider: string,
  ) =>
    invoke<TaskQuickLink>("create_quick_link", {
      input: { taskId, url, title, domain, provider },
    }),
  updateQuickLink: (
    id: string,
    url: string,
    title: string,
    domain: string,
    provider: string,
  ) =>
    invoke<TaskQuickLink>("update_quick_link", {
      input: { id, url, title, domain, provider },
    }),
  deleteQuickLink: (id: string) => invoke<void>("delete_quick_link", { id }),
  fetchLinkPreview: (url: string) =>
    invoke<LinkMetadata>("fetch_link_preview", { url }),
  listReleases: () => invoke<Release[]>("list_releases"),
  createRelease: (
    name: string,
    version: string | null,
    descriptionMarkdown?: string,
  ) =>
    invoke<Release>("create_release", {
      input: { name, version, descriptionMarkdown: descriptionMarkdown ?? "" },
    }),
  updateRelease: (
    name: string,
    input: {
      newName?: string;
      version?: string | null;
      descriptionMarkdown?: string;
      releaseStatus?: Release["releaseStatus"];
      releasedAt?: string | null;
    },
  ) =>
    invoke<Release>("update_release", {
      input: { name, ...input },
    }),
  deleteRelease: (name: string) => invoke<void>("delete_release", { name }),
  tagTaskRelease: (taskId: string, name: string) =>
    invoke<void>("tag_task_release", { taskId, name }),
  removeTaskRelease: (taskId: string) =>
    invoke<void>("remove_task_release", { taskId }),
  tagFolderRelease: (folderId: string, name: string) =>
    invoke<void>("tag_folder_release", { folderId, name }),
  removeFolderRelease: (folderId: string) =>
    invoke<void>("remove_folder_release", { folderId }),
  createAttachment: (
    workLogEntryId: string,
    originalName: string,
    mediaType: string,
    base64Data: string,
  ) =>
    invoke<Attachment>("create_attachment", {
      input: { workLogEntryId, originalName, mediaType, base64Data },
    }),
};
