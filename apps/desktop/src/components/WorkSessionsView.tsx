import { useMemo, useState } from "react";
import {
  ArrowSquareOut as ExternalLink,
  Check,
  Coffee,
  MagnifyingGlass as Search,
  Pause,
  Play,
  Stop,
  Timer,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { STATUS_DOT } from "@/lib/status";
import type { Task } from "@/lib/types";
import {
  formatSessionClock,
  POMODORO_PRESETS,
  type WorkSessionState,
} from "@/lib/workSession";
import { cn } from "@/lib/utils";

interface Props {
  onDiscard: () => void;
  onGoToTask: (taskId: string) => void;
  onLog: () => void;
  onPause: () => void;
  onResume: () => void;
  onStart: (config: {
    workMinutes: number;
    restMinutes: number;
    linkedTaskId: string | null;
  }) => void;
  onStop: () => void;
  session: WorkSessionState;
  tasks: Task[];
}

export function WorkSessionsView({
  onDiscard,
  onGoToTask,
  onLog,
  onPause,
  onResume,
  onStart,
  onStop,
  session,
  tasks,
}: Props) {
  if (session.status === "running" || session.status === "paused") {
    return (
      <ActiveSession
        onGoToTask={onGoToTask}
        onPause={onPause}
        onResume={onResume}
        onStop={onStop}
        session={session}
        tasks={tasks}
      />
    );
  }
  if (session.status === "finished") {
    return (
      <FinishedSession
        onDiscard={onDiscard}
        onLog={onLog}
        session={session}
        tasks={tasks}
      />
    );
  }
  return <SessionSetup onStart={onStart} tasks={tasks} />;
}

function SessionSetup({
  onStart,
  tasks,
}: {
  onStart: Props["onStart"];
  tasks: Task[];
}) {
  const [kind, setKind] = useState<"pomodoro" | "custom">("pomodoro");
  const [presetIndex, setPresetIndex] = useState(0);
  const [customWork, setCustomWork] = useState("40");
  const [customRest, setCustomRest] = useState("10");
  const [linkEnabled, setLinkEnabled] = useState(false);
  const [taskQuery, setTaskQuery] = useState("");
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null);

  const linkedTask = tasks.find((task) => task.id === linkedTaskId) ?? null;

  const taskResults = useMemo(() => {
    const term = taskQuery.trim().toLowerCase();
    if (!term) return [];
    return tasks
      .filter((task) => task.title.toLowerCase().includes(term))
      .slice(0, 6);
  }, [taskQuery, tasks]);

  const workMinutes =
    kind === "pomodoro"
      ? POMODORO_PRESETS[presetIndex].workMinutes
      : Number(customWork);
  const restMinutes =
    kind === "pomodoro"
      ? POMODORO_PRESETS[presetIndex].restMinutes
      : Number(customRest);

  const customInvalid =
    kind === "custom" &&
    (!Number.isFinite(workMinutes) ||
      !Number.isFinite(restMinutes) ||
      workMinutes <= 0 ||
      restMinutes <= 0);
  const linkInvalid = linkEnabled && !linkedTaskId;
  const canStart = !customInvalid && !linkInvalid;

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Timer className="size-5" />
          </div>
          <h1 className="text-sm font-medium text-foreground">
            Start a work session
          </h1>
          <p className="text-xs text-muted-foreground">
            Pick a timer, optionally link a task, then start.
          </p>
        </div>

        <div className="flex h-8 items-center rounded-md bg-muted/45 p-0.5">
          {(["pomodoro", "custom"] as const).map((option) => (
            <button
              aria-pressed={kind === option}
              className={cn(
                "h-7 flex-1 rounded text-xs font-medium text-muted-foreground transition-all duration-fast ease-emphasized",
                kind === option
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:text-foreground",
              )}
              key={option}
              onClick={() => setKind(option)}
              type="button"
            >
              {option === "pomodoro" ? "Pomodoro" : "Custom"}
            </button>
          ))}
        </div>

        {kind === "pomodoro" ? (
          <div className="flex flex-wrap justify-center gap-1.5">
            {POMODORO_PRESETS.map((preset, index) => (
              <button
                aria-pressed={presetIndex === index}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-fast",
                  presetIndex === index
                    ? "border-transparent bg-secondary text-secondary-foreground"
                    : "border-border/70 text-muted-foreground hover:border-ring/40 hover:text-foreground",
                )}
                key={preset.label}
                onClick={() => setPresetIndex(index)}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <label className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Work (min)
              </span>
              <Input
                autoCorrect="off"
                className="h-8 w-20 text-center text-sm"
                inputMode="numeric"
                onChange={(event) => setCustomWork(event.target.value)}
                spellCheck={false}
                value={customWork}
              />
            </label>
            <label className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Rest (min)
              </span>
              <Input
                autoCorrect="off"
                className="h-8 w-20 text-center text-sm"
                inputMode="numeric"
                onChange={(event) => setCustomRest(event.target.value)}
                spellCheck={false}
                value={customRest}
              />
            </label>
          </div>
        )}

        <div className="space-y-2 rounded-md border border-border/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground">
              Link to a task
            </span>
            <Switch
              checked={linkEnabled}
              onCheckedChange={(checked) => {
                setLinkEnabled(checked);
                if (!checked) {
                  setLinkedTaskId(null);
                  setTaskQuery("");
                }
              }}
            />
          </div>
          {linkEnabled &&
            (linkedTask ? (
              <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5">
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    STATUS_DOT[linkedTask.status],
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                  {linkedTask.title}
                </span>
                <button
                  aria-label="Remove linked task"
                  className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => setLinkedTaskId(null)}
                  type="button"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
                <Input
                  autoCapitalize="off"
                  autoCorrect="off"
                  className="h-8 pl-8 text-xs"
                  onChange={(event) => setTaskQuery(event.target.value)}
                  placeholder="Search tasks…"
                  spellCheck={false}
                  value={taskQuery}
                />
                {taskResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-9 z-10 rounded-md border border-border bg-popover p-1 shadow-lg">
                    {taskResults.map((task) => (
                      <button
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                        key={task.id}
                        onClick={() => {
                          setLinkedTaskId(task.id);
                          setTaskQuery("");
                        }}
                        type="button"
                      >
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            STATUS_DOT[task.status],
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {task.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>

        <Button
          className="w-full"
          disabled={!canStart}
          onClick={() =>
            onStart({
              workMinutes,
              restMinutes,
              linkedTaskId: linkEnabled ? linkedTaskId : null,
            })
          }
          type="button"
        >
          <Play />
          Start session
        </Button>
      </div>
    </div>
  );
}

function ActiveSession({
  onGoToTask,
  onPause,
  onResume,
  onStop,
  session,
  tasks,
}: {
  onGoToTask: Props["onGoToTask"];
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  session: WorkSessionState;
  tasks: Task[];
}) {
  const linkedTask = tasks.find((task) => task.id === session.linkedTaskId);
  const totalSeconds =
    (session.phase === "work" ? session.workMinutes : session.restMinutes) * 60;
  const progress = 1 - session.remainingSeconds / totalSeconds;
  const isWork = session.phase === "work";

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            isWork
              ? "bg-primary/10 text-primary"
              : "bg-success/10 text-success",
          )}
        >
          {isWork ? (
            <Timer className="size-3.5" />
          ) : (
            <Coffee className="size-3.5" />
          )}
          {isWork ? "Focus" : "Break"}
          {session.status === "paused" && " · Paused"}
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Round {session.round}
        </span>
      </div>

      <div className="text-8xl font-semibold tabular-nums tracking-tight text-foreground">
        {formatSessionClock(session.remainingSeconds)}
      </div>

      <div className="h-1.5 w-64 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-1000 ease-linear",
            isWork ? "bg-primary" : "bg-success",
          )}
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Timer className="size-3.5 text-primary" />
          Total focus {formatSessionClock(session.elapsedWorkSeconds)}
        </span>
        <span className="flex items-center gap-1.5">
          <Coffee className="size-3.5 text-success" />
          Total break {formatSessionClock(session.elapsedRestSeconds)}
        </span>
      </div>

      {linkedTask && (
        <button
          className="flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground"
          onClick={() => onGoToTask(linkedTask.id)}
          type="button"
        >
          <ExternalLink className="size-3" />
          Go to {linkedTask.title}
        </button>
      )}

      <div className="flex items-center gap-2">
        {session.status === "running" ? (
          <Button onClick={onPause} type="button" variant="secondary">
            <Pause />
            Pause
          </Button>
        ) : (
          <Button onClick={onResume} type="button" variant="secondary">
            <Play />
            Resume
          </Button>
        )}
        <Button onClick={onStop} type="button" variant="outline">
          <Stop />
          Stop
        </Button>
      </div>
    </div>
  );
}

function FinishedSession({
  onDiscard,
  onLog,
  session,
  tasks,
}: {
  onDiscard: () => void;
  onLog: () => void;
  session: WorkSessionState;
  tasks: Task[];
}) {
  const linkedTask = tasks.find((task) => task.id === session.linkedTaskId);
  const minutes = Math.max(1, Math.round(session.elapsedWorkSeconds / 60));

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-success/10 text-success">
          <Check className="size-5" />
        </div>
        <div>
          <h1 className="text-sm font-medium text-foreground">
            Session complete
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {minutes} {minutes === 1 ? "minute" : "minutes"} of focus
            {linkedTask ? (
              <>
                {" "}
                on <span className="text-foreground">{linkedTask.title}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          {linkedTask ? (
            <>
              <Button onClick={onLog} type="button">
                <Check />
                Log work session
              </Button>
              <Button onClick={onDiscard} type="button" variant="ghost">
                Discard
              </Button>
            </>
          ) : (
            <Button onClick={onDiscard} type="button" variant="secondary">
              Close
            </Button>
          )}
        </div>
        {!linkedTask && (
          <p className="text-[11px] text-muted-foreground/80">
            No task was linked, so there's nothing to log.
          </p>
        )}
      </div>
    </div>
  );
}
