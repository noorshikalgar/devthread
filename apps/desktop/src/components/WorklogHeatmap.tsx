import { useMemo } from "react";
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

export function WorklogHeatmap({
  days,
  goalMinutes = 8 * 60,
  range,
  selectedDay,
  onSelectDay,
}: WorklogHeatmapProps) {
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
  const leadingBlanks = days.length ? new Date(days[0]!.date).getDay() : 0;
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

  return (
    <div
      className="flex h-full min-h-0 flex-col rounded-md border border-border/55 bg-card/70 p-4 shadow-sm"
      data-testid="worklog-heatmap"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          Daily heatmap
          <span className="ml-2 font-normal text-xs text-muted-foreground">
            Year overview · {loggedDays} logged day
            {loggedDays === 1 ? "" : "s"}
          </span>
        </h2>
        <div
          aria-label="Intensity legend, less to more"
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
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
      <div className="mt-3 flex min-h-0 justify-center">
        <div
          className="grid max-w-full grid-flow-col grid-rows-7 gap-[3px] overflow-x-auto px-0.5 py-1"
          style={{
            gridAutoColumns: "clamp(11px, 1.05vw, 14px)",
          }}
        >
          {Array.from({ length: leadingBlanks }).map((_, index) => (
            <span
              aria-hidden
              className="size-[clamp(11px,1.05vw,14px)]"
              key={`blank-${index}`}
            />
          ))}
          {days.map((day) => {
            const isSelected = selectedDay === day.key;
            const hasTime = day.minutes > 0;
            const bucket = hasTime ? bucketIndex(day.minutes) : -1;
            const isInSelectedRange = selectedRangeKeys.has(day.key);
            return (
              <button
                aria-label={`${day.key} ${formatHM(day.minutes)}`}
                className={cn(
                  "size-[clamp(11px,1.05vw,14px)] rounded-[3px] border border-border/45 transition duration-150 hover:scale-110 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  hasTime ? HEATMAP_LEVELS[bucket]! : "bg-muted/35",
                  !isInSelectedRange && "opacity-25",
                  isSelected &&
                    "ring-2 ring-primary ring-offset-1 ring-offset-background",
                )}
                data-testid="heatmap-cell"
                key={day.key}
                onClick={() => onSelectDay(isSelected ? null : day.key)}
                title={`${day.key} · ${formatHM(day.minutes)}`}
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
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-medium tabular-nums",
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
