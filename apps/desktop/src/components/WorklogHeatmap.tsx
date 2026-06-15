import { useMemo } from "react";
import { Flame } from "lucide-react";
import { computeStreaks } from "@/lib/worklogStreaks";
import type { WorklogDay } from "@/lib/worklog";
import { cn } from "@/lib/utils";

export interface WorklogHeatmapProps {
  days: ReadonlyArray<WorklogDay>;
  goalMinutes?: number;
  range: "7d" | "4w" | "12w" | "12m";
  selectedDay: string | null;
  selectedYear?: number;
  yearOptions?: ReadonlyArray<number>;
  onSelectDay: (key: string | null) => void;
  onYearChange?: (year: number) => void;
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

function streakLabel(value: number): string {
  if (value === 0) return "No streak";
  return `${value}-day streak`;
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
  selectedYear = new Date().getUTCFullYear(),
  yearOptions = [new Date().getUTCFullYear()],
  onSelectDay,
  onYearChange,
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
      className="rounded-md border border-border/55 bg-card/70 p-4 shadow-sm"
      data-testid="worklog-heatmap"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium">Daily heatmap</h2>
          <span
            aria-label={streakLabel(streaks.current)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--chart-1)/0.45)] bg-[hsl(var(--chart-1)/0.14)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--chart-1))] shadow-[0_0_0_1px_hsl(var(--chart-1)/0.08),0_8px_20px_hsl(var(--chart-1)/0.08)]",
              streaks.current > 0
                ? "border-[hsl(var(--chart-1)/0.55)] bg-[hsl(var(--chart-1)/0.18)]"
                : "opacity-90",
            )}
            data-testid="worklog-streak-pill"
            title={
              streaks.longest > streaks.current
                ? `Longest streak this range: ${streaks.longest} days`
                : undefined
            }
          >
            <Flame className="size-3.5 fill-current opacity-90" />
            Streak {streaks.current}d · Best {streaks.longest}d
          </span>
          <div
            aria-label="Select heatmap year"
            className="flex items-center gap-0.5 rounded-md border border-border/60 bg-muted/20 p-0.5"
          >
            <span className="px-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Year
            </span>
            {yearOptions.map((year) => (
              <button
                aria-pressed={year === selectedYear}
                className={cn(
                  "h-6 rounded px-2 font-mono text-[10px] tabular-nums text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground",
                  year === selectedYear &&
                    "bg-accent text-foreground shadow-sm",
                )}
                key={year}
                onClick={() => onYearChange?.(year)}
                type="button"
              >
                {year}
              </button>
            ))}
          </div>
        </div>
        <div
          aria-label="Intensity legend, less to more"
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
        >
          <span className="mr-1">Less</span>
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
          <span className="ml-1">More</span>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex min-w-0 justify-center pb-1">
          <div
            className="grid w-full max-w-[920px] grid-flow-col grid-rows-7 gap-[3px]"
            style={{
              gridAutoColumns: "clamp(9px, 1.08vw, 15px)",
            }}
          >
            {Array.from({ length: leadingBlanks }).map((_, index) => (
              <span
                aria-hidden
                className="size-[clamp(9px,1.08vw,15px)]"
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
                    "size-[clamp(9px,1.08vw,15px)] rounded-[3px] border border-border/45 transition duration-150 hover:scale-110 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
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
        <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <HeatmapInsight label="Current streak" value={`${streaks.current}d`} />
          <HeatmapInsight label="Best streak" value={`${streaks.longest}d`} />
          <HeatmapInsight
            label="Most active"
            value={
              mostActive && mostActive.minutes > 0
                ? `${formatShortDate(mostActive.date)} · ${formatHM(
                    mostActive.minutes,
                  )}`
                : "-"
            }
          />
          <HeatmapInsight label="Goal hit" value={`${goalHits} days`} />
        </dl>
      </div>
    </div>
  );
}

function HeatmapInsight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/30 px-2.5 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
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
