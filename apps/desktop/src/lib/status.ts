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
  planned: "bg-muted-foreground/50",
  active: "bg-success",
  blocked: "bg-destructive",
  paused: "bg-info",
  done: "bg-primary",
  archived: "bg-muted-foreground/30",
};

export const STATUS_BG: Record<TaskStatus, string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-success/15 text-success",
  blocked: "bg-destructive/15 text-destructive",
  paused: "bg-info/15 text-info",
  done: "bg-primary/10 text-primary",
  archived: "bg-muted/60 text-muted-foreground/70",
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
  worklog: "Worklog",
  status: "Status",
  estimate: "Estimate",
};

export const ENTRY_DOT: Record<EntryType, string> = {
  progress: "bg-info",
  next_step: "bg-info",
  finding: "bg-success",
  blocker: "bg-warning",
  decision: "bg-[hsl(var(--chart-4))]",
  note: "bg-muted-foreground",
  worklog: "bg-[hsl(var(--chart-3))]",
  status: "bg-[hsl(var(--chart-1))]",
  estimate: "bg-[hsl(var(--chart-2))]",
};

export const ENTRY_BG: Record<EntryType, string> = {
  progress: "bg-info/15 text-info",
  next_step: "bg-info/15 text-info",
  finding: "bg-success/15 text-success",
  blocker: "bg-warning/15 text-warning",
  decision: "bg-[hsl(var(--chart-4)/0.15)] text-[hsl(var(--chart-4))]",
  note: "bg-muted text-muted-foreground",
  worklog: "bg-[hsl(var(--chart-3)/0.15)] text-[hsl(var(--chart-3))]",
  status: "bg-[hsl(var(--chart-1)/0.15)] text-[hsl(var(--chart-1))]",
  estimate: "bg-[hsl(var(--chart-2)/0.15)] text-[hsl(var(--chart-2))]",
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: "Private",
  report: "Report eligible",
};

export const VISIBILITY_BG: Record<Visibility, string> = {
  private: "bg-muted text-muted-foreground",
  report: "bg-info/15 text-info",
};
