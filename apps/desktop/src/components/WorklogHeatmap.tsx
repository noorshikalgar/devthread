import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { computeStreaks } from "@/lib/worklogStreaks";
import type { WorklogDay } from "@/lib/worklog";
import { cn } from "@/lib/utils";

export interface WorklogHeatmapProps {
  days: ReadonlyArray<WorklogDay>;
  goalMinutes?: number;
  range: "7d" | "4w" | "12w" | "12m";
  selectedDay: string | null;
  onSelectDay: (key: string | null) => void;
}

const HEATMAP_LEVELS = [
  "bg-[hsl(var(--chart-1)/0.24)]",
  "bg-[hsl(var(--chart-1)/0.38)]",
  "bg-[hsl(var(--chart-1)/0.54)]",
  "bg-[hsl(var(--chart-1)/0.72)]",
  "bg-[hsl(var(--chart-1)/0.9)]",
] as const;

function bucketIndex(minutes: number): number {
  if (minutes < 30) return 0;
  if (minutes < 60) return 1;
  if (minutes < 120) return 2;
  if (minutes < 240) return 3;
  return 4;
}

const RANGE_DAYS = {
  "7d": 7,
  "4w": 28,
  "12w": 84,
  "12m": 365,
} as const;

const TOOLTIP_GAP = 8;
const TOOLTIP_WIDTH = 180;
const TOOLTIP_HEIGHT = 56;

interface HoverState {
  day: WorklogDay;
  top: number;
  left: number;
}

export function WorklogHeatmap({
  days,
  goalMinutes = 8 * 60,
  range,
  selectedDay,
  onSelectDay,
}: WorklogHeatmapProps) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(14);

  // Measure the grid container and resize the cells to fill the
  // full available width. 7 rows × 53 columns (a year) with a
  // 3px gap gives us cellSize = (width - 52*3) / 53. The 12px
  // floor keeps tiny cells tappable on very narrow viewports.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (!width) return;
      const weeks = Math.ceil(days.length / 7);
      const gap = 3;
      const next = Math.max(12, (width - (weeks - 1) * gap) / weeks);
      setCellSize(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [days.length]);

  const streaks = useMemo(() => computeStreaks(days), [days]);
  const mostActive = useMemo(
    () =>
      days.reduce<WorklogDay | null>(
        (best, day) => (!best || day.minutes > best.minutes ? day : best),
        null,
      ),
    [days],
  );
  const goalHits = days.filter((day) => day.minutes >= goalMinutes).length;
  const loggedDays = days.filter((day) => day.minutes > 0).length;
  const selectedRangeKeys = useMemo(() => {
    const selectedKeys = new Set<string>();
    const lastDate = days.at(-1)?.date;
    if (!lastDate) return selectedKeys;
    if (range === "12m") {
      for (const day of days) {
        selectedKeys.add(day.key);
      }
      return selectedKeys;
    }
    const start = new Date(lastDate);
    start.setUTCDate(start.getUTCDate() - RANGE_DAYS[range] + 1);
    start.setUTCHours(0, 0, 0, 0);
    for (const day of days) {
      if (new Date(day.date) >= start) selectedKeys.add(day.key);
    }
    return selectedKeys;
  }, [days, range]);

  function handleCellEnter(
    event: MouseEvent<HTMLButtonElement>,
    day: WorklogDay,
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceRight = viewportWidth - rect.right;
    // Prefer the side that has the most room; fall back to the other
    // when there's not enough space.
    const placeAbove =
      spaceAbove > spaceBelow && spaceAbove > TOOLTIP_HEIGHT + TOOLTIP_GAP;
    const top = placeAbove
      ? rect.top - TOOLTIP_HEIGHT - TOOLTIP_GAP
      : rect.bottom + TOOLTIP_GAP;
    const placeRight =
      spaceRight < TOOLTIP_WIDTH && rect.left > TOOLTIP_WIDTH + TOOLTIP_GAP;
    const left = placeRight
      ? rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP
      : Math.max(
          TOOLTIP_GAP,
          Math.min(
            rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2,
            viewportWidth - TOOLTIP_WIDTH - TOOLTIP_GAP,
          ),
        );
    setHover({ day, top, left });
  }

  function handleCellLeave() {
    setHover(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="worklog-heatmap">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          Daily heatmap
          <span className="ml-2 text-xs font-normal text-foreground/70">
            Year overview · {loggedDays} logged day
            {loggedDays === 1 ? "" : "s"}
          </span>
        </h2>
        <div
          aria-label="Intensity legend, less to more"
          className="flex items-center gap-1.5 text-[11px] font-normal text-foreground/70"
        >
          <span className="mr-0.5">Less</span>
          {HEATMAP_LEVELS.map((level) => (
            <span
              aria-hidden
              className={cn(
                "inline-block size-3 rounded-[3px] border border-border/40",
                level,
              )}
              key={level}
            />
          ))}
          <span className="ml-0.5">More</span>
        </div>
      </div>
      <div className="mt-3 flex min-h-0">
        <div
          className="grid w-full grid-flow-col grid-rows-7 gap-[3px] px-0.5 py-1"
          ref={gridRef}
          style={{
            gridAutoColumns: `${cellSize}px`,
          }}
        >
          {/*
           * Render every day starting at the top-left of the grid
           * (no leading weekday padding). Days before the year
           * begins, or after it ends, are explicit zero-minute
           * placeholders so the visual rhythm is consistent and
           * the first day of the year is always the first cell.
           */}
          {days.map((day) => {
            const isSelected = selectedDay === day.key;
            const hasTime = day.minutes > 0;
            const bucket = hasTime ? bucketIndex(day.minutes) : -1;
            const isInSelectedRange = selectedRangeKeys.has(day.key);
            return (
              <button
                aria-label={`${day.key} ${formatHM(day.minutes)}`}
                className={cn(
                  "aspect-square rounded-[3px] border border-border/45 transition duration-150 hover:scale-110 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  hasTime ? HEATMAP_LEVELS[bucket]! : "bg-muted/35",
                  !isInSelectedRange && "opacity-25",
                  isSelected &&
                    "ring-2 ring-primary ring-offset-1 ring-offset-background",
                )}
                data-testid="heatmap-cell"
                key={day.key}
                onClick={() => onSelectDay(isSelected ? null : day.key)}
                onMouseEnter={(event) => handleCellEnter(event, day)}
                onMouseLeave={handleCellLeave}
                type="button"
              />
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 text-xs">
        <HeatmapStat
          label="Current streak"
          value={`${streaks.current}d`}
          tone={streaks.current > 0 ? "active" : "muted"}
        />
        <HeatmapStat label="Best streak" value={`${streaks.longest}d`} />
        <HeatmapStat
          label="Most active"
          value={
            mostActive && mostActive.minutes > 0
              ? `${formatShortDate(mostActive.date)} · ${formatHM(
                  mostActive.minutes,
                )}`
              : "—"
          }
        />
        <HeatmapStat label="Goal hit" value={`${goalHits} days`} />
      </div>
      {hover && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 max-w-[200px] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg shadow-black/30"
          style={{ top: hover.top, left: hover.left, width: TOOLTIP_WIDTH }}
        >
          <p className="font-medium text-popover-foreground">
            {formatShortDate(hover.day.key)}
          </p>
          <p className="font-mono tabular-nums text-muted-foreground">
            {formatHM(hover.day.minutes)}
            {hover.day.minutes > 0 && goalMinutes > 0 && (
              <span className="ml-2 text-foreground/70">
                {Math.round((hover.day.minutes / goalMinutes) * 100)}% of goal
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function HeatmapStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "active" | "muted";
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[11px] font-normal text-foreground/70">
        {label}
      </span>
      <span
        className={cn(
          "text-xs font-semibold tabular-nums",
          tone === "active" && "text-foreground",
          tone === "muted" && "text-muted-foreground",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </span>
    </span>
  );
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatHM(minutes: number): string {
  if (minutes === 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
