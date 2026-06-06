import {
  BookOpen,
  Calculator,
  Clock4,
  Copy,
  ExternalLink,
  Figma,
  FileSpreadsheet,
  FileText,
  Github,
  KanbanSquare,
  Link,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LogTimeDialog, type LogTimeInput } from "@/components/LogTimeDialog";
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
import { type Task, type TaskQuickLink, type TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  task: Task;
  entriesLoaded: number;
  totalMinutes: number;
  quickLinks?: TaskQuickLink[];
  pendingTitleEdit?: boolean;
  onLogTime: (input: LogTimeInput) => Promise<void>;
  onCreateQuickLink?: (url: string) => Promise<void>;
  onDeleteQuickLink?: (id: string) => Promise<void>;
  onEstimateChange?: (minutes: number | null) => Promise<void>;
  onPendingTitleEditConsumed?: () => void;
  onStatusChange?: (status: TaskStatus) => Promise<void>;
  onUpdate: (task: Task) => Promise<void>;
}

const TITLE_MAX_LENGTH = 140;

export function TaskHeader({
  task,
  entriesLoaded,
  totalMinutes,
  quickLinks = [],
  pendingTitleEdit,
  onLogTime,
  onCreateQuickLink,
  onDeleteQuickLink,
  onEstimateChange,
  onPendingTitleEditConsumed,
  onStatusChange,
  onUpdate,
}: Props) {
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleState, setTitleState] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [statusOpen, setStatusOpen] = useState(false);
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [quickLinkOpen, setQuickLinkOpen] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const titleInputMounted = useRef(false);

  useEffect(() => {
    if (pendingTitleEdit) {
      setTitleDraft(task.title);
      onPendingTitleEditConsumed?.();
    } else {
      setTitleDraft(null);
    }
    setTitleState("idle");
  }, [task.id, pendingTitleEdit, onPendingTitleEditConsumed, task.title]);

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
    const normalized = titleDraft.trim();
    setTitleDraft(null);
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
  return (
    <header className="flex flex-col gap-3 border-b border-border bg-background/85 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {titleDraft === null ? (
            <button
              aria-label="Edit task title"
              className="-mx-1.5 -my-0.5 flex min-w-0 flex-1 items-center rounded px-1.5 py-0.5 text-left text-[22px] font-semibold leading-tight tracking-tight hover:bg-accent/60"
              onClick={() => setTitleDraft(task.title)}
              type="button"
            >
              <span className="truncate">{task.title}</span>
            </button>
          ) : (
            <Input
              aria-label="Task title"
              autoFocus
              className="h-9 flex-1 border-border bg-transparent px-1.5 text-[22px] font-semibold leading-tight tracking-tight shadow-none focus-visible:ring-1"
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
        </div>

        <div className="flex items-center gap-0.5">
          {showWorkSessionAction && (
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
                onClick={() =>
                  void copyTaskSummary(task, entriesLoaded, totalMinutes)
                }
                size="icon-sm"
                variant="ghost"
              >
                <Copy />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy task summary</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="More task actions"
                size="icon-sm"
                variant="ghost"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Task</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() =>
                  void copyTaskSummary(task, entriesLoaded, totalMinutes)
                }
              >
                <Copy className="mr-2 size-3.5" />
                Copy summary
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!onCreateQuickLink || quickLinks.length >= 3}
                onSelect={() => setQuickLinkOpen(true)}
              >
                <Plus className="mr-2 size-3.5" />
                Add quick link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <Popover onOpenChange={setStatusOpen} open={statusOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label={`Status: ${statusLabel}. Click to change.`}
              className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 text-left text-foreground hover:bg-accent"
              type="button"
            >
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", STATUS_DOT[task.status])}
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
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent",
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
                    className={cn("size-1.5 rounded-full", STATUS_DOT[status])}
                  />
                  {STATUS_LABEL[status]}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
        <MetaChip label="ID" value={task.id.slice(0, 8)} mono />
        <MetaChip label="Created" value={formatShortDate(task.createdAt)} />
        <MetaChip label="Updated" value={formatShortDateTime(task.updatedAt)} />
        <MetaChip label="Updates" value={String(entriesLoaded)} mono />
        {titleState === "saving" && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            · saving title
          </span>
        )}
        {titleState === "error" && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-destructive">
            · title save failed
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <TaskFact
          actionLabel="Log time"
          icon={Clock4}
          label="Worklog"
          onAction={() => setLogTimeOpen(true)}
          tooltip="Record time spent on this task"
          value={totalMinutes > 0 ? formatDuration(totalMinutes) : "0m"}
        />
        <TaskFact
          actionLabel="Estimate"
          icon={Calculator}
          label="Estimate"
          onAction={() => setEstimateOpen(true)}
          tooltip="Set expected time for this task"
          value={
            task.estimatedMinutes
              ? formatDuration(task.estimatedMinutes)
              : "No estimate"
          }
        />
        <QuickLinks
          links={quickLinks}
          onAdd={
            onCreateQuickLink && quickLinks.length < 3
              ? () => setQuickLinkOpen(true)
              : undefined
          }
          onDelete={onDeleteQuickLink}
        />
      </div>
      <LogTimeDialog
        onOpenChange={setLogTimeOpen}
        onSubmit={onLogTime}
        open={logTimeOpen}
        taskTitle={task.title}
      />
      <EstimateDialog
        currentMinutes={task.estimatedMinutes}
        onOpenChange={setEstimateOpen}
        onSubmit={async (minutes) => {
          await onEstimateChange?.(minutes);
        }}
        open={estimateOpen}
        taskTitle={task.title}
      />
      <QuickLinkDialog
        onOpenChange={setQuickLinkOpen}
        onSubmit={async (url) => {
          if (!onCreateQuickLink) return;
          await onCreateQuickLink(url);
        }}
        open={quickLinkOpen}
      />
    </header>
  );

  async function changeStatus(status: TaskStatus) {
    if (status === task.status) return;
    if (onStatusChange) {
      await onStatusChange(status);
      return;
    }
    await onUpdate({ ...task, status });
  }
}

function TaskFact({
  actionLabel,
  icon: Icon,
  label,
  tooltip,
  value,
  onAction,
}: {
  actionLabel: string;
  icon: LucideIcon;
  label: string;
  tooltip: string;
  value: string;
  onAction: () => void;
}) {
  return (
    <div className="inline-flex h-8 items-center overflow-hidden rounded-md border border-border bg-muted/20">
      <span className="inline-flex h-full items-center gap-1.5 border-r border-border/70 px-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="size-3 text-muted-foreground" />
        <span className="font-mono text-[11px] text-foreground">{value}</span>
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={actionLabel}
            className="h-8 gap-1 rounded-none border-0 px-2.5 text-xs"
            onClick={onAction}
            size="sm"
            variant="ghost"
          >
            <Icon className="size-3" />
            {actionLabel}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function QuickLinks({
  links,
  onAdd,
  onDelete,
}: {
  links: TaskQuickLink[];
  onAdd?: () => void;
  onDelete?: (id: string) => Promise<void>;
}) {
  if (!links.length && !onAdd) return null;

  return (
    <div className="inline-flex h-8 items-center overflow-hidden rounded-md border border-border bg-muted/20">
      <span className="inline-flex h-full items-center border-r border-border/70 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Links
      </span>
      <span className="inline-flex h-full items-center gap-1 px-1.5">
        {links.map((link) => (
          <QuickLinkButton key={link.id} link={link} onDelete={onDelete} />
        ))}
        {onAdd && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Add quick link"
                className="h-6 w-6"
                onClick={onAdd}
                size="icon-sm"
                variant="ghost"
              >
                <Plus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add quick link</TooltipContent>
          </Tooltip>
        )}
      </span>
    </div>
  );
}

function QuickLinkButton({
  link,
  onDelete,
}: {
  link: TaskQuickLink;
  onDelete?: (id: string) => Promise<void>;
}) {
  const Icon = quickLinkIcon(link.provider);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Open quick link: ${link.title}`}
              className={cn(
                "h-6 w-6 text-muted-foreground hover:text-foreground",
                quickLinkColor(link.provider),
              )}
              size="icon-sm"
              variant="ghost"
            >
              <Icon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium text-foreground">{link.title}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {link.domain}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {link.url}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="truncate">{link.title}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void openExternalUrl(link.url)}>
          <ExternalLink className="mr-2 size-3.5" />
          Open link
        </DropdownMenuItem>
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

function QuickLinkDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setUrl("");
    setSaving(false);
    setError("");
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(url);
      onOpenChange(false);
      toast.success("Quick link added");
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
            Add quick link
          </DialogTitle>
          <DialogDescription>
            Pin a Jira, Figma, Confluence, document, or file link to this task
            header.
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
              Taskline resolves the final URL when possible and keeps only a
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
              {saving ? "Adding..." : "Add link"}
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

function MetaChip({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-muted/30 px-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-foreground", mono && "font-mono text-[10px]")}>
        {value}
      </span>
    </span>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

async function copyTaskSummary(
  task: Task,
  entriesLoaded: number,
  totalMinutes: number,
) {
  const summary = [
    task.title,
    `Status: ${STATUS_LABEL[task.status]}`,
    `Estimate: ${
      task.estimatedMinutes ? formatDuration(task.estimatedMinutes) : "None"
    }`,
    `Logged: ${totalMinutes > 0 ? formatDuration(totalMinutes) : "0m"}`,
    `Updates: ${entriesLoaded}`,
  ].join("\n");

  await writeClipboard(summary);
  toast.success("Task summary copied");
}

async function writeClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
