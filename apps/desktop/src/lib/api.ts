import { invoke } from "@tauri-apps/api/core";
import type {
  Attachment,
  EntryType,
  Folder,
  LinkMetadata,
  Task,
  TaskStatus,
  Visibility,
  WorkLogEntry,
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
        folderId: task.folderId,
      },
    }),
  moveTask: (taskId: string, folderId: string | null) =>
    invoke<Task>("move_task", {
      input: { taskId, folderId },
    }),
  listFolders: () => invoke<Folder[]>("list_folders"),
  createFolder: (name: string) =>
    invoke<Folder>("create_folder", { input: { name } }),
  renameFolder: (id: string, name: string) =>
    invoke<Folder>("rename_folder", { input: { id, name } }),
  deleteFolder: (id: string) => invoke<void>("delete_folder", { id }),
  listEntries: (taskId: string, limit = 100, offset = 0) =>
    invoke<WorkLogEntry[]>("list_entries", { taskId, limit, offset }),
  createEntry: (
    taskId: string,
    entryType: EntryType,
    contentMarkdown: string,
    visibility: Visibility,
  ) =>
    invoke<WorkLogEntry>("create_entry", {
      input: { taskId, entryType, contentMarkdown, visibility },
    }),
  updateEntry: (
    id: string,
    entryType: EntryType,
    contentMarkdown: string,
    visibility: Visibility,
  ) =>
    invoke<WorkLogEntry>("update_entry", {
      input: { id, entryType, contentMarkdown, visibility },
    }),
  listRevisions: (entryId: string) =>
    invoke<WorkLogRevision[]>("list_revisions", { entryId }),
  restoreRevision: (revisionId: string) =>
    invoke<WorkLogEntry>("restore_revision", { revisionId }),
  trashEntry: (entryId: string) => invoke<void>("trash_entry", { entryId }),
  restoreEntry: (entryId: string) => invoke<void>("restore_entry", { entryId }),
  listAttachments: (taskId: string) =>
    invoke<Attachment[]>("list_attachments", { taskId }),
  fetchLinkPreview: (url: string) =>
    invoke<LinkMetadata>("fetch_link_preview", { url }),
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
