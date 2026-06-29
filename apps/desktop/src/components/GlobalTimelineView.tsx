import { useEffect, useMemo, useRef, useState } from "react";
import { ClockCounterClockwise, MagnifyingGlass as Search, X } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { ENTRY_DOT, ENTRY_LABEL, STATUS_DOT } from "@/lib/status";
import { ENTRY_TYPES, type EntryType, type GlobalTimelineEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

export type TimelineRange = "today" | "week" | "month" | "all";

interface Props {
  onSelectEntry: (taskId: string, entryId: string) => void;
  range: TimelineRange;
  onRangeChange: (range: TimelineRange) => void;
  typeFilter: EntryType | "all";
  onTypeFilterChange: (filter: EntryType | "all") => void;
  search: string;
  onSearchChange: (search: string) => void;
  initialScrollTop: number;
  onScrollPositionChange: (scrollTop: number) => void;
}

const RANGE_OPTIONS: { value: TimelineRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

function rangeStart(range: TimelineRange): string {
  const now = new Date();
  if (range === "all") return "0000-01-01T00:00:00Z";
  if (range === "today") {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
  }
  if (range === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function stripMarkdown(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_~>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dateLabel(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

interface TaskGroup {
  taskId: string;
  taskTitle: string;
  taskStatus: GlobalTimelineEntry["taskStatus"];
  items: GlobalTimelineEntry[];
}

interface DateGroup {
  label: string;
  taskGroups: TaskGroup[];
}

/** Entries arrive newest-first; grouping by first-occurrence preserves
 *  that order, so the most recently touched task's group sorts first. */
function groupByDateThenTask(entries: GlobalTimelineEntry[]): DateGroup[] {
  const dateGroups: DateGroup[] = [];
  for (const entry of entries) {
    const label = dateLabel(entry.occurredAt);
    let dateGroup = dateGroups.at(-1);
    if (!dateGroup || dateGroup.label !== label) {
      dateGroup = { label, taskGroups: [] };
      dateGroups.push(dateGroup);
    }
    let taskGroup = dateGroup.taskGroups.find(
      (group) => group.taskId === entry.taskId,
    );
    if (!taskGroup) {
      taskGroup = {
        taskId: entry.taskId,
        taskTitle: entry.taskTitle,
        taskStatus: entry.taskStatus,
        items: [],
      };
      dateGroup.taskGroups.push(taskGroup);
    }
    taskGroup.items.push(entry);
  }
  return dateGroups;
}

export function GlobalTimelineView({
  onSelectEntry,
  range,
  onRangeChange,
  typeFilter,
  onTypeFilterChange,
  search,
  onSearchChange,
  initialScrollTop,
  onScrollPositionChange,
}: Props) {
  const [entries, setEntries] = useState<GlobalTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredScrollRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .listGlobalTimeline(rangeStart(range), new Date().toISOString())
      .then((result) => {
        if (!cancelled) setEntries(result);
      })
      .catch((cause) => {
        if (!cancelled) setError(String(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  // Restore scroll position exactly once per mount, after the first
  // real render of content — restoring before content exists just
  // snaps back to 0 once the list grows to its real height.
  useEffect(() => {
    if (restoredScrollRef.current) return;
    if (loading) return;
    restoredScrollRef.current = true;
    const node = scrollRef.current;
    if (node && initialScrollTop > 0) node.scrollTop = initialScrollTop;
  }, [loading, initialScrollTop]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (typeFilter !== "all" && entry.entryType !== typeFilter) return false;
      if (!term) return true;
      return (
        entry.contentMarkdown.toLowerCase().includes(term) ||
        entry.taskTitle.toLowerCase().includes(term)
      );
    });
  }, [entries, typeFilter, search]);

  const groups = useMemo(() => groupByDateThenTask(filtered), [filtered]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 border-b border-border/70 px-6 py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
          {search && (
            <button
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => onSearchChange("")}
              type="button"
            >
              <X className="size-3.5" />
            </button>
          )}
          <Input
            autoCapitalize="off"
            autoCorrect="off"
            className="h-9 pl-8 pr-8 text-sm"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search across every task…"
            spellCheck={false}
            value={search}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex h-7 items-center rounded-md bg-muted/45 p-0.5">
            {RANGE_OPTIONS.map((option) => (
              <button
                aria-pressed={range === option.value}
                className={cn(
                  "h-6 rounded px-2.5 text-[11px] font-medium text-muted-foreground transition-all duration-fast ease-emphasized",
                  range === option.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:text-foreground",
                )}
                key={option.value}
                onClick={() => onRangeChange(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <button
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors duration-fast",
                typeFilter === "all"
                  ? "border-transparent bg-secondary text-secondary-foreground"
                  : "border-border/70 text-muted-foreground hover:border-ring/40 hover:text-foreground",
              )}
              onClick={() => onTypeFilterChange("all")}
              type="button"
            >
              All
            </button>
            {ENTRY_TYPES.map((type) => (
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors duration-fast",
                  typeFilter === type
                    ? "border-transparent bg-secondary text-secondary-foreground"
                    : "border-border/70 text-muted-foreground hover:border-ring/40 hover:text-foreground",
                )}
                key={type}
                onClick={() => onTypeFilterChange(type)}
                type="button"
              >
                <span
                  aria-hidden
                  className={cn("size-1.5 rounded-full", ENTRY_DOT[type])}
                />
                {ENTRY_LABEL[type]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto px-6 pb-4"
        onScroll={(event) =>
          onScrollPositionChange(event.currentTarget.scrollTop)
        }
        ref={scrollRef}
      >
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {!error && !loading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <ClockCounterClockwise className="size-6 opacity-60" />
            <span>
              {entries.length
                ? "No entries match this filter."
                : "Nothing logged in this range yet."}
            </span>
          </div>
        )}
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="sticky top-0 z-20 -mx-6 flex h-7 items-center gap-2 bg-background/90 px-6 backdrop-blur-md">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <p className="text-[11px] text-muted-foreground/70">
                  {group.taskGroups.length}{" "}
                  {group.taskGroups.length === 1 ? "task" : "tasks"}
                </p>
              </div>
              <div className="mt-2 flex flex-col gap-4">
                {group.taskGroups.map((taskGroup) => (
                  <div key={taskGroup.taskId}>
                    <button
                      className="group/task sticky top-7 z-10 -mx-6 flex h-8 w-[calc(100%_+_3rem)] items-center gap-2 bg-background/80 px-6 text-left backdrop-blur-md transition-colors hover:bg-accent/40"
                      onClick={() =>
                        onSelectEntry(taskGroup.taskId, taskGroup.items[0].id)
                      }
                      type="button"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          STATUS_DOT[taskGroup.taskStatus],
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground group-hover/task:underline">
                        {taskGroup.taskTitle}
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {taskGroup.items.length}
                      </span>
                    </button>
                    <div className="ml-3.5 flex flex-col border-l border-border/60 pl-4">
                      {taskGroup.items.map((entry) => (
                        <button
                          className="group flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50"
                          key={entry.id}
                          onClick={() => onSelectEntry(entry.taskId, entry.id)}
                          type="button"
                        >
                          <span className="mt-1 w-11 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {formatTime(entry.occurredAt)}
                          </span>
                          <span
                            aria-hidden
                            className={cn(
                              "mt-1.5 size-1.5 shrink-0 rounded-full",
                              ENTRY_DOT[entry.entryType],
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-foreground">
                              {stripMarkdown(entry.contentMarkdown) || "—"}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                                {ENTRY_LABEL[entry.entryType]}
                              </span>
                              {entry.durationMinutes ? (
                                <span className="shrink-0">
                                  {entry.durationMinutes}m
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
