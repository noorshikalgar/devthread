import { type EntryType, type TaskStatus, type Visibility } from "./types";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  planned: "Planned",
  active: "Active",
  blocked: "Blocked",
  paused: "Paused",
  done: "Done",
  archived: "Archived",
};

export const STATUS_DOT: Record<TaskStatus, string> = {
  planned: "bg-slate-400",
  active: "bg-emerald-500",
  blocked: "bg-amber-500",
  paused: "bg-sky-500",
  done: "bg-violet-500",
  archived: "bg-zinc-400",
};

export const STATUS_BG: Record<TaskStatus, string> = {
  planned: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  blocked: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  paused: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  done: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  archived: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
};

export const STATUS_ORDER: TaskStatus[] = [
  "planned",
  "active",
  "blocked",
  "paused",
  "done",
  "archived",
];

export const ENTRY_LABEL: Record<EntryType, string> = {
  note: "Note",
  progress: "Progress",
  finding: "Finding",
  blocker: "Blocker",
  decision: "Decision",
  next_step: "Next step",
};

export const ENTRY_DOT: Record<EntryType, string> = {
  progress: "bg-sky-500",
  next_step: "bg-sky-500",
  finding: "bg-emerald-500",
  blocker: "bg-amber-500",
  decision: "bg-violet-500",
  note: "bg-muted-foreground",
};

export const ENTRY_BG: Record<EntryType, string> = {
  progress: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  next_step: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  finding: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  blocker: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  decision: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  note: "bg-muted text-muted-foreground",
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: "Private",
  report: "Report eligible",
};

export const VISIBILITY_BG: Record<Visibility, string> = {
  private: "bg-muted text-muted-foreground",
  report: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
};
