import {
  BookOpen,
  Calculator,
  Check,
  Clock as Clock4,
  Copy,
  DotsThree as Ellipsis,
  ArrowSquareOut as ExternalLink,
  FigmaLogo as Figma,
  Table as FileSpreadsheet,
  FileText,
  GithubLogo as Github,
  Kanban as KanbanSquare,
  Link,
  Pause,
  Pencil,
  Play,
  Plus,
  Tag,
  Trash as Trash2,
  X,
  type Icon as LucideIcon,
} from "@phosphor-icons/react";
import {
  cloneElement,
  FormEvent,
  isValidElement,
  KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { LogTimeDialog, type LogTimeInput } from "@/components/LogTimeDialog";
import type { TimelineViewMode } from "@/components/Timeline";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDuration, parseDuration } from "@/lib/duration";
import { openExternalUrl } from "@/lib/openExternal";
import { STATUS_DOT, STATUS_LABEL, STATUS_ORDER } from "@/lib/status";
import { copyTaskSummary as copyTaskSummaryToClipboard } from "@/lib/taskSummary";
import {
  type Release,
  type Task,
  type TaskQuickLink,
  type TaskStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  task: Task;
  totalMinutes: number;
  quickLinks?: TaskQuickLink[];
  timelineViewMode?: TimelineViewMode;
  pendingTitleEdit?: boolean;
  statusOpen?: boolean;
  onStatusOpenChange?: (open: boolean) => void;
  logTimeOpen?: boolean;
  onLogTimeOpenChange?: (open: boolean) => void;
  onLogTime?: (input: LogTimeInput) => Promise<void>;
  onTimelineViewModeChange?: (mode: TimelineViewMode) => void;
  onCreateQuickLink?: (url: string) => Promise<void>;
  onUpdateQuickLink?: (id: string, url: string) => Promise<void>;
  onDeleteQuickLink?: (id: string) => Promise<void>;
  onEstimateChange?: (minutes: number | null) => Promise<void>;
  onPendingTitleEditConsumed?: () => void;
  onStatusChange?: (status: TaskStatus) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
  onUpdate?: (task: Task) => Promise<void>;
  onTagRelease?: (name: string) => Promise<void>;
  onRemoveReleaseTag?: () => Promise<void>;
  releases?: Release[];
  readOnly?: boolean;
}

const TITLE_MAX_LENGTH = 140;
const TIMELINE_VIEW_LABEL: Record<TimelineViewMode, string> = {
  normal: "Detailed",
  compact: "Compact",
};
const TIMELINE_VIEW_OPTIONS: Array<{
  value: TimelineViewMode;
  label: string;
}> = [
  { value: "normal", label: "Detailed" },
  { value: "compact", label: "Compact" },
];

export function TaskHeader({
  task,
  totalMinutes,
  quickLinks = [],
  timelineViewMode = "normal",
  pendingTitleEdit,
  statusOpen: statusOpenProp,
  onStatusOpenChange,
  logTimeOpen: logTimeOpenProp,
  onLogTimeOpenChange,
  onLogTime,
  onTimelineViewModeChange,
  onCreateQuickLink,
  onUpdateQuickLink,
  onDeleteQuickLink,
  onEstimateChange,
  onPendingTitleEditConsumed,
  onStatusChange,
  onDelete,
  onUpdate,
  onTagRelease,
  onRemoveReleaseTag,
  releases,
  readOnly = false,
}: Props) {
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleState, setTitleState] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [statusOpenInternal, setStatusOpenInternal] = useState(false);
  const [logTimeOpenInternal, setLogTimeOpenInternal] = useState(false);
  const statusOpen = statusOpenProp ?? statusOpenInternal;
  const logTimeOpen = logTimeOpenProp ?? logTimeOpenInternal;
  const setStatusOpen = onStatusOpenChange ?? setStatusOpenInternal;
  const setLogTimeOpen = onLogTimeOpenChange ?? setLogTimeOpenInternal;
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [quickLinkOpen, setQuickLinkOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [editingQuickLink, setEditingQuickLink] =
    useState<TaskQuickLink | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const titleInputMounted = useRef(false);
  const consumePendingTitleEditRef = useRef(onPendingTitleEditConsumed);
  consumePendingTitleEditRef.current = onPendingTitleEditConsumed;

  useEffect(() => {
    if (pendingTitleEdit) {
      setTitleDraft(task.title);
    } else {
      setTitleDraft(null);
    }
    setTitleState("idle");
  }, [task.id, pendingTitleEdit, task.title]);

  useEffect(() => {
    if (titleDraft === null) {
      titleInputMounted.current = false;
      return;
    }
    if (titleInputMounted.current) return;
    titleInputMounted.current = true;
    titleInput.current?.focus();
    titleInput.current?.select();
  }, [titleDraft]);

  async function commitTitle() {
    if (titleDraft === null) return;
    if (!onUpdate) return;
    const normalized = titleDraft.trim();
    setTitleDraft(null);
    consumePendingTitleEditRef.current?.();
    if (!normalized || normalized === task.title) return;
    setTitleState("saving");
    try {
      await onUpdate({ ...task, title: normalized });
      setTitleState("idle");
    } catch {
      setTitleState("error");
    }
  }

  function cancelTitle() {
    setTitleDraft(null);
    consumePendingTitleEditRef.current?.();
  }

  function titleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitTitle();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelTitle();
    }
  }

  const titleChars = titleDraft?.length ?? 0;
  const showTitleCounter =
    titleDraft !== null && titleChars > TITLE_MAX_LENGTH * 0.8;

  const statusLabel = STATUS_LABEL[task.status];
  const showWorkSessionAction =
    task.status !== "done" && task.status !== "archived";
  const isArchived = task.status === "archived";
  return (
    <header className="flex flex-col gap-2.5 bg-card px-6 py-3">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {titleDraft === null ? (
            readOnly ? (
              <h1
                className="-mx-1.5 -my-0.5 flex min-w-0 flex-1 items-center rounded px-1.5 py-0.5 text-left text-[20px] font-semibold leading-tight tracking-tight"
                title={task.title}
              >
                <span className="truncate">{task.title}</span>
              </h1>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label="Edit task title"
                    className="-mx-1.5 -my-0.5 flex min-w-0 flex-1 items-center rounded px-1.5 py-0.5 text-left text-[20px] font-semibold leading-tight tracking-tight transition-colors duration-fast hover:bg-accent/60"
                    onClick={() => setTitleDraft(task.title)}
                    type="button"
                  >
                    <span className="truncate">{task.title}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  align="start"
                  className="max-w-md whitespace-normal break-words leading-5"
                  side="bottom"
                >
                  {task.title}
                </TooltipContent>
              </Tooltip>
            )
          ) : (
            <Input
              aria-label="Task title"
              autoFocus
              className="h-8 flex-1 border-border bg-transparent px-1.5 text-[20px] font-semibold leading-tight tracking-tight shadow-none focus-visible:ring-1"
              maxLength={TITLE_MAX_LENGTH}
              onBlur={() => void commitTitle()}
              onChange={(event) =>
                setTitleDraft(event.target.value.slice(0, TITLE_MAX_LENGTH))
              }
              onKeyDown={titleKeyDown}
              ref={titleInput}
              value={titleDraft}
            />
          )}
          {titleDraft !== null && showTitleCounter && (
            <span
              className={cn(
                "mt-2 shrink-0 font-mono text-[10px] tabular-nums",
                titleChars >= TITLE_MAX_LENGTH
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {titleChars}/{TITLE_MAX_LENGTH}
            </span>
          )}
          {(titleState === "saving" || titleState === "error") && (
            <span
              className={cn(
                "mt-2 shrink-0 font-mono text-[10px] uppercase tracking-wider",
                titleState === "error"
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              · {titleState === "saving" ? "saving title" : "title save failed"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {onTimelineViewModeChange && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  aria-label="Timeline view"
                  className="flex h-7 items-center rounded-md bg-muted/45 p-0.5"
                  role="group"
                >
                  {TIMELINE_VIEW_OPTIONS.map((option) => (
                    <button
                      aria-pressed={timelineViewMode === option.value}
                      className={cn(
                        "h-6 rounded px-2 text-[11px] font-medium text-muted-foreground transition-all duration-fast ease-emphasized",
                        timelineViewMode === option.value
                          ? "bg-foreground text-background shadow-sm"
                          : "hover:text-foreground",
                      )}
                      key={option.value}
                      onClick={() => onTimelineViewModeChange(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Timeline view: {TIMELINE_VIEW_LABEL[timelineViewMode]}
              </TooltipContent>
            </Tooltip>
          )}
          {showWorkSessionAction && !readOnly && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={
                    task.status === "active"
                      ? "Pause work session"
                      : "Start work session"
                  }
                  onClick={() =>
                    void changeStatus(
                      task.status === "active" ? "paused" : "active",
                    )
                  }
                  size="icon-sm"
                  variant="ghost"
                >
                  {task.status === "active" ? <Pause /> : <Play />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {task.status === "active" ? "Pause work" : "Start work"}
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Copy task summary"
                onClick={() => void copyHeaderTaskSummary(task, totalMinutes)}
                size="icon-sm"
                variant="ghost"
              >
                <Copy />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy task summary</TooltipContent>
          </Tooltip>
          {!readOnly && (
            <DropdownMenu onOpenChange={setOverflowOpen} open={overflowOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="More task actions"
                  onClick={() => setOverflowOpen(true)}
                  size="icon-sm"
                  variant="ghost"
                  title="More actions"
                >
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onSelect={() =>
                    void changeStatus(isArchived ? "planned" : "archived")
                  }
                >
                  {isArchived ? (
                    <>
                      <Check className="mr-2 size-3.5" />
                      Restore to active
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 size-3.5" />
                      Archive task
                    </>
                  )}
                </DropdownMenuItem>
                {onDelete && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => void onDelete(task.id)}
                  >
                    <Trash2 className="mr-2 size-3.5" />
                    Delete permanently
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {readOnly ? (
            <span
              aria-label={`Status: ${statusLabel}.`}
              className="inline-flex h-6 shrink-0 cursor-default items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 text-[11px] text-foreground"
            >
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", STATUS_DOT[task.status])}
              />
              <span className="font-medium">{statusLabel}</span>
            </span>
          ) : (
            <Popover onOpenChange={setStatusOpen} open={statusOpen}>
              <PopoverTrigger asChild>
                <button
                  aria-label={`Status: ${statusLabel}. Click to change.`}
                  className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 text-[11px] text-foreground transition-colors duration-fast hover:bg-accent"
                  type="button"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      STATUS_DOT[task.status],
                    )}
                  />
                  <span className="font-medium">{statusLabel}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-44 p-1">
                <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </p>
                {STATUS_ORDER.map((status) => {
                  const active = task.status === status;
                  return (
                    <button
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-0",
                        active && "bg-accent",
                      )}
                      key={status}
                      onClick={() => {
                        setStatusOpen(false);
                        void changeStatus(status as TaskStatus);
                      }}
                      type="button"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 rounded-full",
                          STATUS_DOT[status],
                        )}
                      />
                      {STATUS_LABEL[status]}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          )}
          <QuickLinks
            links={quickLinks}
            onAdd={
              !readOnly && onCreateQuickLink && quickLinks.length < 3
                ? () => {
                    setEditingQuickLink(null);
                    setQuickLinkOpen(true);
                  }
                : undefined
            }
            onDelete={readOnly ? undefined : onDeleteQuickLink}
            onEdit={
              !readOnly && onUpdateQuickLink
                ? (link) => {
                    setEditingQuickLink(link);
                    setQuickLinkOpen(true);
                  }
                : undefined
            }
          />
          {(onTagRelease || task.releaseName || releases?.length) &&
            (readOnly ? (
              task.releaseName && (
                <span
                  aria-label={`Release: ${releases?.find((r) => r.name === task.releaseName)?.name ?? task.releaseName}.`}
                  className="inline-flex h-6 shrink-0 cursor-default items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 text-[11px] text-foreground"
                >
                  <Tag className="size-3 text-muted-foreground" />
                  <span className="font-medium">
                    {(() => {
                      const r = releases?.find(
                        (x) => x.name === task.releaseName,
                      );
                      return r
                        ? r.version
                          ? `${r.name} (${r.version})`
                          : r.name
                        : task.releaseName;
                    })()}
                  </span>
                </span>
              )
            ) : (
              <Popover onOpenChange={setReleaseOpen} open={releaseOpen}>
                <PopoverTrigger asChild>
                  <button
                    aria-label={
                      task.releaseName
                        ? `Release: ${releases?.find((r) => r.name === task.releaseName)?.name ?? task.releaseName}. Click to change.`
                        : "Assign release. Click to choose."
                    }
                    className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 text-[11px] text-foreground transition-colors duration-fast hover:bg-accent"
                    type="button"
                  >
                    <Tag className="size-3 text-muted-foreground" />
                    <span className="font-medium">
                      {(() => {
                        if (!task.releaseName) return "Assign release";
                        const r = releases?.find(
                          (x) => x.name === task.releaseName,
                        );
                        return r
                          ? r.version
                            ? `${r.name} (${r.version})`
                            : r.name
                          : task.releaseName;
                      })()}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-1">
                  <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Release
                  </p>
                  {(!releases || releases.length === 0) && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      No releases yet
                    </p>
                  )}
                  {releases?.map((r) => {
                    const active = task.releaseName === r.name;
                    return (
                      <button
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent",
                          active && "bg-accent",
                        )}
                        key={r.name}
                        onClick={() => {
                          setReleaseOpen(false);
                          if (active) {
                            void onRemoveReleaseTag?.();
                          } else {
                            void onTagRelease?.(r.name);
                          }
                        }}
                        type="button"
                      >
                        <Tag className="size-3 text-muted-foreground" />
                        <span className="truncate">
                          {r.version ? `${r.name} (${r.version})` : r.name}
                        </span>
                      </button>
                    );
                  })}
                  {task.releaseName && (
                    <button
                      className="flex w-full items-center gap-2 rounded-sm border-t border-border px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={() => {
                        setReleaseOpen(false);
                        void onRemoveReleaseTag?.();
                      }}
                      type="button"
                    >
                      <X className="size-3" />
                      Remove release tag
                    </button>
                  )}
                </PopoverContent>
              </Popover>
            ))}
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={
                  totalMinutes > 0
                    ? `Log time. ${formatDuration(totalMinutes)} logged.`
                    : "Log time"
                }
                aria-disabled={readOnly}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded text-foreground/70 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  readOnly ? "cursor-not-allowed" : "hover:text-foreground",
                )}
                onClick={() => {
                  if (readOnly) return;
                  setLogTimeOpen(true);
                }}
                type="button"
              >
                <Clock4 className="size-3.5" />
                <span>Log time</span>
                {totalMinutes > 0 && (
                  <span className="text-foreground/40">·</span>
                )}
                {totalMinutes > 0 && (
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {formatDuration(totalMinutes)}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {readOnly
                ? "Read-only in archive"
                : "Record time spent on this task"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={
                  task.estimatedMinutes
                    ? `Estimate: ${formatDuration(task.estimatedMinutes)}. Click to change.`
                    : "Set estimate"
                }
                aria-disabled={readOnly}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded text-foreground/70 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  readOnly ? "cursor-not-allowed" : "hover:text-foreground",
                )}
                onClick={() => {
                  if (readOnly) return;
                  setEstimateOpen(true);
                }}
                type="button"
              >
                <Calculator className="size-3.5" />
                <span>Estimate</span>
                <span className="text-foreground/40">·</span>
                {task.estimatedMinutes != null && task.estimatedMinutes > 0 ? (
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {formatDuration(task.estimatedMinutes)}
                  </span>
                ) : (
                  <span className="font-mono font-normal text-foreground/60">
                    none
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {readOnly
                ? "Read-only in archive"
                : "Set expected time for this task"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      {!readOnly && onLogTime && (
        <LogTimeDialog
          onOpenChange={setLogTimeOpen}
          onSubmit={onLogTime}
          open={logTimeOpen}
          taskTitle={task.title}
        />
      )}
      {!readOnly && onEstimateChange && (
        <EstimateDialog
          currentMinutes={task.estimatedMinutes}
          onOpenChange={setEstimateOpen}
          onSubmit={async (minutes) => {
            await onEstimateChange?.(minutes);
          }}
          open={estimateOpen}
          taskTitle={task.title}
        />
      )}
      {!readOnly && (onCreateQuickLink || onUpdateQuickLink) && (
        <QuickLinkDialog
          link={editingQuickLink}
          onOpenChange={(open) => {
            setQuickLinkOpen(open);
            if (!open) setEditingQuickLink(null);
          }}
          onSubmit={async (url) => {
            if (editingQuickLink) {
              if (!onUpdateQuickLink) return;
              await onUpdateQuickLink(editingQuickLink.id, url);
              return;
            }
            if (onCreateQuickLink) await onCreateQuickLink(url);
          }}
          open={quickLinkOpen}
        />
      )}
    </header>
  );

  async function changeStatus(status: TaskStatus) {
    if (status === task.status) return;
    if (onStatusChange) {
      await onStatusChange(status);
      return;
    }
    await onUpdate?.({ ...task, status });
  }
}

function QuickLinks({
  links,
  onAdd,
  onEdit,
  onDelete,
}: {
  links: TaskQuickLink[];
  onAdd?: () => void;
  onEdit?: (link: TaskQuickLink) => void;
  onDelete?: (id: string) => Promise<void>;
}) {
  if (!links.length && !onAdd) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-normal text-foreground/70">
        Quicklinks
      </span>
      {links.map((link) => (
        <QuickLinkButton
          key={link.id}
          link={link}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
      {onAdd && (
        <HoverTooltip content="Add quick link">
          <Button
            aria-label="Add quick link"
            className="h-6 w-6"
            onClick={onAdd}
            size="icon-sm"
            variant="ghost"
          >
            <Plus className="size-3.5" />
          </Button>
        </HoverTooltip>
      )}
    </div>
  );
}

function QuickLinkButton({
  link,
  onEdit,
  onDelete,
}: {
  link: TaskQuickLink;
  onEdit?: (link: TaskQuickLink) => void;
  onDelete?: (id: string) => Promise<void>;
}) {
  const Icon = quickLinkIcon(link.provider);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
      <HoverTooltip
        content={
          <div className="space-y-1">
            <p className="font-medium text-foreground">{link.title}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {link.domain}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {link.url}
            </p>
          </div>
        }
        disabled={menuOpen}
      >
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Open quick link: ${link.title}`}
            className={cn(
              "h-6 w-6 text-muted-foreground hover:text-foreground",
              quickLinkColor(link.provider),
            )}
            onClick={() => setMenuOpen(true)}
            size="icon-sm"
            variant="ghost"
          >
            <Icon className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
      </HoverTooltip>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        <DropdownMenuItem
          onSelect={() => {
            void navigator.clipboard
              .writeText(link.url)
              .then(() => toast.success("Link copied"))
              .catch((cause) =>
                toast.error(`Could not copy link: ${String(cause)}`),
              );
          }}
        >
          <Copy className="mr-2 size-3.5" />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void openExternalUrl(link.url)}>
          <ExternalLink className="mr-2 size-3.5" />
          Open link
        </DropdownMenuItem>
        {onEdit && (
          <DropdownMenuItem onSelect={() => onEdit(link)}>
            <Pencil className="mr-2 size-3.5" />
            Edit
          </DropdownMenuItem>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => void onDelete(link.id)}
            >
              <Trash2 className="mr-2 size-3.5" />
              Remove
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Anchor = {
  cx: number;
  cy: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

type Size = { width: number; height: number };

const TIP_DEFAULT_SIZE: Size = { width: 240, height: 96 };

function measureTip(): Size {
  return TIP_DEFAULT_SIZE;
}

function HoverTooltip({
  content,
  children,
  disabled = false,
}: {
  content: ReactNode;
  children: ReactElement<Record<string, unknown>>;
  disabled?: boolean;
}) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [tip, setTip] = useState<{
    side: "top" | "right" | "bottom" | "left";
    top: number;
    left: number;
  } | null>(null);

  function showTip() {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const anchor = anchorFromRect(rect);
    setTip(chooseTipSide(anchor, measureTip(), 8));
  }

  function hideTip() {
    setTip(null);
  }

  useEffect(() => {
    if (disabled) setTip(null);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!tip || !tipRef.current) return;
    const { width, height } = tipRef.current.getBoundingClientRect();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const adjusted = chooseTipSide(anchorFromRect(rect), { width, height }, 8);
    if (
      adjusted.side !== tip.side ||
      adjusted.top !== tip.top ||
      adjusted.left !== tip.left
    ) {
      setTip(adjusted);
    }
  }, [tip]);

  if (!isValidElement(children)) return <>{children}</>;
  const childProps = children.props;
  const trigger = cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: composeHover(
      childProps.onMouseEnter as ((event: SyntheticEvent) => void) | undefined,
      showTip,
    ),
    onMouseLeave: composeHover(
      childProps.onMouseLeave as ((event: SyntheticEvent) => void) | undefined,
      hideTip,
    ),
  } as Partial<React.HTMLAttributes<HTMLElement>> & {
    ref: React.Ref<HTMLElement>;
  });

  return (
    <>
      {trigger}
      {tip &&
        createPortal(
          <div
            ref={tipRef}
            aria-hidden
            className={cn(
              "pointer-events-none fixed z-50 max-w-xs rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md",
              tip.side === "top" && "-translate-x-1/2 -translate-y-full",
              tip.side === "bottom" && "-translate-x-1/2 translate-y-0",
              tip.side === "right" && "translate-x-0 -translate-y-1/2",
              tip.side === "left" && "-translate-x-full -translate-y-1/2",
            )}
            style={{ top: tip.top, left: tip.left }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}

function anchorFromRect(rect: DOMRect): Anchor {
  return {
    cx: rect.left + window.scrollX + rect.width / 2,
    cy: rect.top + window.scrollY + rect.height / 2,
    top: rect.top + window.scrollY,
    bottom: rect.bottom + window.scrollY,
    left: rect.left + window.scrollX,
    right: rect.right + window.scrollX,
  };
}

function composeHover<E extends SyntheticEvent>(
  existing: ((event: E) => void) | undefined,
  next: (event: E) => void,
): (event: E) => void {
  return (event) => {
    existing?.(event);
    if (!event.defaultPrevented) next(event);
  };
}

function chooseTipSide(
  anchor: Anchor,
  size: Size,
  margin: number,
): { side: "top" | "right" | "bottom" | "left"; top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceTop = anchor.top - margin;
  const spaceBottom = vh - anchor.bottom - margin;
  const spaceLeft = anchor.left - margin;
  const spaceRight = vw - anchor.right - margin;

  const fitsTop = spaceTop >= size.height;
  const fitsBottom = spaceBottom >= size.height;
  const fitsLeft = spaceLeft >= size.width;
  const fitsRight = spaceRight >= size.width;

  const preferred: Array<"top" | "bottom" | "right" | "left"> = [
    "top",
    "bottom",
    "right",
    "left",
  ];
  const fits: Record<(typeof preferred)[number], boolean> = {
    top: fitsTop,
    bottom: fitsBottom,
    right: fitsRight,
    left: fitsLeft,
  };

  const side =
    preferred.find((s) => fits[s]) ??
    pickByLargestSpace({
      spaceTop,
      spaceBottom,
      spaceLeft,
      spaceRight,
    });

  if (side === "top") {
    return {
      side,
      top: anchor.top - margin,
      left: clamp(
        anchor.cx,
        margin + size.width / 2,
        vw - margin - size.width / 2,
      ),
    };
  }
  if (side === "bottom") {
    return {
      side,
      top: anchor.bottom + margin,
      left: clamp(
        anchor.cx,
        margin + size.width / 2,
        vw - margin - size.width / 2,
      ),
    };
  }
  if (side === "right") {
    return {
      side,
      top: clamp(
        anchor.cy,
        margin + size.height / 2,
        vh - margin - size.height / 2,
      ),
      left: anchor.right + margin,
    };
  }
  return {
    side,
    top: clamp(
      anchor.cy,
      margin + size.height / 2,
      vh - margin - size.height / 2,
    ),
    left: anchor.left - margin,
  };
}

function pickByLargestSpace(space: {
  spaceTop: number;
  spaceBottom: number;
  spaceLeft: number;
  spaceRight: number;
}): "top" | "right" | "bottom" | "left" {
  const entries: Array<["top" | "right" | "bottom" | "left", number]> = [
    ["top", space.spaceTop],
    ["right", space.spaceRight],
    ["bottom", space.spaceBottom],
    ["left", space.spaceLeft],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}

function QuickLinkDialog({
  link,
  open,
  onOpenChange,
  onSubmit,
}: {
  link: TaskQuickLink | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setUrl(link?.url ?? "");
    setSaving(false);
    setError("");
  }, [link, open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(url);
      onOpenChange(false);
      toast.success(link ? "Quick link updated" : "Quick link added");
    } catch (cause) {
      setError(String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="size-4 text-muted-foreground" />
            {link ? "Edit quick link" : "Add quick link"}
          </DialogTitle>
          <DialogDescription>
            {link
              ? "Update the pinned task resource."
              : "Pin a Jira, Figma, Confluence, document, or file link to this task header."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="quick-link-url">Link</Label>
            <Input
              autoFocus
              id="quick-link-url"
              onChange={(event) => {
                setUrl(event.target.value);
                if (error) setError("");
              }}
              placeholder="https://..."
              value={url}
            />
            <p className="text-xs text-muted-foreground">
              DevThread resolves the final URL when possible and keeps only a
              compact icon in the header.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={saving || !url.trim()} type="submit">
              {saving ? "Saving..." : link ? "Save link" : "Add link"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EstimateDialog({
  currentMinutes,
  open,
  taskTitle,
  onOpenChange,
  onSubmit,
}: {
  currentMinutes: number | null;
  open: boolean;
  taskTitle: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (minutes: number | null) => Promise<void>;
}) {
  const [duration, setDuration] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDuration(currentMinutes ? formatDuration(currentMinutes) : "");
      setError("");
      setSaving(false);
    }
  }, [currentMinutes, open]);

  const parsedMinutes = parseDuration(duration);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!duration.trim()) {
      await save(null);
      return;
    }
    if (!parsedMinutes) {
      setError("Enter an estimate like 30m, 2h, 1d, or 1w (1d = 8h, 1w = 5d).");
      return;
    }
    await save(parsedMinutes);
  }

  async function save(minutes: number | null) {
    setSaving(true);
    setError("");
    try {
      await onSubmit(minutes);
      onOpenChange(false);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-4 text-muted-foreground" />
            Estimate time
          </DialogTitle>
          <DialogDescription>
            Set the expected time for {taskTitle}.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="estimate-duration">Estimate</Label>
            <Input
              aria-describedby="estimate-duration-hint"
              autoFocus
              className="font-mono"
              id="estimate-duration"
              onChange={(event) => {
                setDuration(event.target.value);
                if (error) setError("");
              }}
              placeholder="2d 4h"
              value={duration}
            />
            <p
              className="font-mono text-[10px] text-muted-foreground"
              id="estimate-duration-hint"
            >
              {parsedMinutes
                ? `= ${formatDuration(parsedMinutes)}`
                : "Leave empty to clear. Units: 1d = 8h, 1w = 5d."}
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={saving}
              onClick={() => void save(null)}
              type="button"
              variant="outline"
            >
              Clear
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? "Saving..." : "Save estimate"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function quickLinkIcon(provider: string): LucideIcon {
  if (provider === "figma") return Figma;
  if (provider === "jira") return KanbanSquare;
  if (provider === "confluence") return BookOpen;
  if (provider === "sheet") return FileSpreadsheet;
  if (provider === "doc" || provider === "office") return FileText;
  if (provider === "github") return Github;
  return Link;
}

function quickLinkColor(provider: string) {
  if (provider === "figma") return "text-fuchsia-400 hover:text-fuchsia-300";
  if (provider === "jira") return "text-sky-400 hover:text-sky-300";
  if (provider === "confluence") return "text-blue-400 hover:text-blue-300";
  if (provider === "sheet") return "text-emerald-400 hover:text-emerald-300";
  if (provider === "doc" || provider === "office") {
    return "text-indigo-400 hover:text-indigo-300";
  }
  if (provider === "github") return "text-foreground hover:text-foreground";
  return "";
}

async function copyHeaderTaskSummary(task: Task, totalMinutes: number) {
  await copyTaskSummaryToClipboard(task, { totalMinutes });
  toast.success("Task summary copied");
}
