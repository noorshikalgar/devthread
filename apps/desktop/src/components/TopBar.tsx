import { Archive, BarChart3, ChevronRight, ListTodo, Search, Tag } from "lucide-react";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export type WorkspaceMode = "tasks" | "archive" | "worklog" | "releases";

const WORKSPACE_META: Record<WorkspaceMode, { label: string; icon: typeof ListTodo }> = {
  tasks: { label: "Tasks", icon: ListTodo },
  archive: { label: "Archive", icon: Archive },
  worklog: { label: "Worklog", icon: BarChart3 },
  releases: { label: "Releases", icon: Tag },
};

interface Props {
  workspaceMode: WorkspaceMode;
  selectedTask: Task | null;
  onSearchOpen: () => void;
  updateAvailable?: boolean;
}

export function TopBar({
  workspaceMode,
  selectedTask,
  onSearchOpen,
  updateAvailable,
}: Props) {
  const meta = WORKSPACE_META[workspaceMode];
  const Icon = meta.icon;

  return (
    <header className="flex h-9 shrink-0 select-none items-center gap-3 border-b border-border bg-card px-3">
      <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="shrink-0">{meta.label}</span>
        {workspaceMode === "tasks" && selectedTask && (
          <>
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/50" />
            <span className="min-w-0 truncate text-foreground">
              {selectedTask.title}
            </span>
          </>
        )}
      </div>

      <button
        aria-label="Search tasks, folders, and updates"
        className="group mx-auto flex h-7 w-full max-w-sm items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-2.5 text-xs text-muted-foreground transition-colors duration-fast hover:border-ring/40 hover:bg-muted/70 hover:text-foreground"
        onClick={onSearchOpen}
        type="button"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="flex-1 truncate text-left">Search…</span>
        <kbd className="hidden shrink-0 rounded border border-border/70 bg-background px-1 py-0.5 font-mono text-[10px] leading-none text-muted-foreground/80 sm:inline">
          ⌘K
        </kbd>
      </button>

      <div className="flex w-[88px] shrink-0 items-center justify-end gap-1.5">
        {updateAvailable && (
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full bg-destructive",
              "animate-pulse-dot",
            )}
            title="Update available"
          />
        )}
      </div>
    </header>
  );
}
