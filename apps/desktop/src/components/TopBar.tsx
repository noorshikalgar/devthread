import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Archive,
  ChartBar as BarChart3,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  ClockCounterClockwise,
  ListChecks as ListTodo,
  MagnifyingGlass as Search,
  Tag,
  Timer,
} from "@phosphor-icons/react";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export type WorkspaceMode =
  | "tasks"
  | "archive"
  | "worklog"
  | "releases"
  | "sessions"
  | "timeline";

const WORKSPACE_META: Record<WorkspaceMode, { label: string; icon: typeof ListTodo }> = {
  tasks: { label: "Tasks", icon: ListTodo },
  archive: { label: "Archive", icon: Archive },
  worklog: { label: "Worklog", icon: BarChart3 },
  releases: { label: "Releases", icon: Tag },
  sessions: { label: "Sessions", icon: Timer },
  timeline: { label: "Timeline", icon: ClockCounterClockwise },
};

interface SessionPillInfo {
  label: string;
  phase: "work" | "rest";
  paused: boolean;
}

interface Props {
  workspaceMode: WorkspaceMode;
  selectedTask: Task | null;
  onSearchOpen: () => void;
  updateAvailable?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  sessionPill?: SessionPillInfo | null;
  onSessionPillClick?: () => void;
}

const isMac = /Mac|iPhone|iPad/i.test(navigator.platform);
const appWindow =
  "isTauri" in window && window.isTauri ? getCurrentWindow() : null;

function handleDragMouseDown(event: React.MouseEvent<HTMLElement>) {
  if (event.button !== 0) return;
  const target = event.target as HTMLElement;
  if (target.closest("button, a, input, [role='button']")) return;
  appWindow?.startDragging().catch(() => {});
}

export function TopBar({
  workspaceMode,
  selectedTask,
  onSearchOpen,
  updateAvailable,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  sessionPill,
  onSessionPillClick,
}: Props) {
  const meta = WORKSPACE_META[workspaceMode];
  const Icon = meta.icon;

  return (
    <header
      className={cn(
        "flex h-9 shrink-0 select-none items-center gap-3 border-b border-border bg-card px-3",
        isMac && "pl-20",
      )}
      data-tauri-drag-region
      onMouseDown={handleDragMouseDown}
    >
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          aria-label="Go back"
          className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors duration-fast hover:bg-muted/70 hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
          disabled={!canGoBack}
          onClick={onGoBack}
          type="button"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          aria-label="Go forward"
          className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors duration-fast hover:bg-muted/70 hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
          disabled={!canGoForward}
          onClick={onGoForward}
          type="button"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

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
        className="group mx-auto flex h-6 w-full max-w-[280px] items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 text-xs text-muted-foreground transition-colors duration-fast hover:border-ring/40 hover:bg-background/90 hover:text-foreground"
        onClick={onSearchOpen}
        type="button"
      >
        <Search className="size-3 shrink-0" />
        <span className="flex-1 truncate text-center">Search…</span>
        <kbd className="hidden shrink-0 rounded border border-border/70 bg-muted px-1 py-0.5 font-mono text-[10px] leading-none text-muted-foreground/80 sm:inline">
          ⌘K
        </kbd>
      </button>

      <div className="flex shrink-0 items-center justify-end gap-1.5">
        {sessionPill && (
          <button
            aria-label={`Work session in progress, ${sessionPill.label} remaining. Click to return to the session.`}
            className={cn(
              "flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium tabular-nums transition-colors",
              sessionPill.paused
                ? "border-border/70 bg-muted/50 text-muted-foreground"
                : sessionPill.phase === "work"
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                  : "border-success/30 bg-success/10 text-success hover:bg-success/15",
            )}
            onClick={onSessionPillClick}
            type="button"
          >
            <Timer className="size-3" />
            {sessionPill.label}
          </button>
        )}
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
