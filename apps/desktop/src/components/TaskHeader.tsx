import { Pause, Play } from "lucide-react";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { STATUS_DOT, STATUS_LABEL, STATUS_ORDER } from "@/lib/status";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  task: Task;
  entriesLoaded: number;
  pendingTitleEdit?: boolean;
  onPendingTitleEditConsumed?: () => void;
  onUpdate: (task: Task) => Promise<void>;
}

const TITLE_MAX_LENGTH = 140;

export function TaskHeader({
  task,
  entriesLoaded,
  pendingTitleEdit,
  onPendingTitleEditConsumed,
  onUpdate,
}: Props) {
  const [nextStep, setNextStep] = useState(task.nextStep ?? "");
  const [nextStepState, setNextStepState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleState, setTitleState] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [statusOpen, setStatusOpen] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const titleInputMounted = useRef(false);

  useEffect(() => {
    setNextStep(task.nextStep ?? "");
    setNextStepState("idle");
  }, [task.id, task.nextStep]);

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

  useEffect(() => {
    const normalized = nextStep.trim() || null;
    if (normalized === task.nextStep) return;

    const timer = window.setTimeout(() => {
      void saveNextStep();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [nextStep, task.nextStep]);

  async function saveNextStep() {
    const normalized = nextStep.trim() || null;
    if (normalized === task.nextStep || nextStepState === "saving") return;

    setNextStepState("saving");
    try {
      await onUpdate({ ...task, nextStep: normalized });
      setNextStepState("saved");
    } catch {
      setNextStepState("error");
    }
  }

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
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/i.test(navigator.platform);
  const metaKey = isMac ? "⌘" : "Ctrl";

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

        {showWorkSessionAction && (
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={
                    task.status === "active"
                      ? "Pause work session"
                      : "Start work session"
                  }
                  onClick={() =>
                    void onUpdate({
                      ...task,
                      status:
                        task.status === "active"
                          ? "paused"
                          : ("active" as TaskStatus),
                    })
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
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <Popover onOpenChange={setStatusOpen} open={statusOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  aria-label={`Status: ${statusLabel}. Click to change.`}
                  className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 text-left text-foreground hover:bg-accent"
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
            </TooltipTrigger>
            <TooltipContent>Change status</TooltipContent>
          </Tooltip>
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
                    void onUpdate({ ...task, status: status as TaskStatus });
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

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void saveNextStep();
        }}
      >
        <label
          className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          htmlFor="next-step"
        >
          Next
        </label>
        <Input
          className="h-7 max-w-xl flex-1 border-dashed bg-transparent text-xs shadow-none focus-visible:border-solid focus-visible:ring-1"
          id="next-step"
          onChange={(event) => setNextStep(event.target.value)}
          onBlur={() => void saveNextStep()}
          placeholder="What should happen next?"
          value={nextStep}
        />
        <span
          aria-live="polite"
          className={cn(
            "font-mono text-[10px] uppercase tracking-wider transition-colors",
            nextStepState === "saved" && "text-emerald-500",
            nextStepState === "saving" && "text-muted-foreground",
            nextStepState === "error" && "text-destructive",
            nextStepState === "idle" && "text-transparent",
          )}
        >
          {nextStepState === "saving" && "Saving"}
          {nextStepState === "saved" && "Saved"}
          {nextStepState === "error" && "Save failed"}
          {nextStepState === "idle" && "·"}
        </span>
        <span className="ml-auto hidden items-center gap-1 text-[10px] text-muted-foreground md:inline-flex">
          <span>Save with</span>
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[9px]">
            {metaKey}
          </span>
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[9px]">
            S
          </span>
        </span>
      </form>
    </header>
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
