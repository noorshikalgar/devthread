import { useMemo } from "react";
import { Flame } from "lucide-react";
import { computeStreaks } from "@/lib/worklogStreaks";
import type { WorklogDay } from "@/lib/worklog";
import { cn } from "@/lib/utils";

export interface WorklogHeatmapProps {
  days: ReadonlyArray<WorklogDay>;
  range: "7d" | "4w" | "12w" | "12m";
  selectedDay: string | null;
  onSelectDay: (key: string | null) => void;
}

/**
 * GitHub-style intensity ladder for a single day. Five buckets from
 * "nothing logged" (muted) to "heavy day" (solid emerald), cut on
 * absolute minutes so the same value always lands on the same shade
 * — the user shouldn't lose a green cell because they had an
 * unusually productive day in the range.
 */
function heatClass(minutes: number): string {
  if (minutes <= 0) return "bg-muted/40";
  if (minutes < 30) return "bg-emerald-500/25";
  if (minutes < 60) return "bg-emerald-500/45";
  if (minutes < 120) return "bg-emerald-500/65";
  if (minutes < 240) return "bg-emerald-500/85";
  return "bg-emerald-500";
}

function streakLabel(value: number): string {
  if (value === 0) return "No streak";
  return `${value}-day streak`;
}

export function WorklogHeatmap({
  days,
  range,
  selectedDay,
  onSelectDay,
}: WorklogHeatmapProps) {
  const streaks = useMemo(() => computeStreaks(days), [days]);

  return (
    <div
      className="rounded-lg border border-border bg-card p-4"
      data-testid="worklog-heatmap"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium">Daily heatmap</h2>
          <span
            aria-label={streakLabel(streaks.current)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              streaks.current > 0
                ? "bg-emerald-500/15 text-emerald-500"
                : "bg-muted text-muted-foreground",
            )}
            data-testid="worklog-streak-pill"
            title={
              streaks.longest > streaks.current
                ? `Longest streak this range: ${streaks.longest} days`
                : undefined
            }
          >
            <Flame className="size-3" />
            {streaks.current > 0 ? `${streaks.current}d` : "0d"}
            {streaks.longest > streaks.current && streaks.longest > 0 && (
              <span className="text-muted-foreground">
                {" "}
                / best {streaks.longest}d
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Less</span>
          <span
            aria-hidden
            className="inline-block h-2 w-16 rounded-full bg-gradient-to-r from-muted/40 via-emerald-500/45 via-emerald-500/85 to-emerald-500"
          />
          <span>More</span>
        </div>
      </div>
      <div
        className="grid grid-flow-col grid-rows-7 gap-1"
        style={{
          gridAutoColumns: `minmax(0, ${range === "12m" ? "1fr" : "16px"})`,
        }}
      >
        {days.map((day) => {
          const isSelected = selectedDay === day.key;
          return (
            <button
              aria-label={`${day.key} ${formatHM(day.minutes)}`}
              className={cn(
                "group relative aspect-square w-full min-w-0 overflow-hidden rounded-[3px] border border-border/50 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                range !== "12m" && "size-4",
                heatClass(day.minutes),
                isSelected && "ring-2 ring-primary",
              )}
              data-testid="heatmap-cell"
              key={day.key}
              onClick={() =>
                onSelectDay(isSelected ? null : day.key)
              }
              title={`${day.key} · ${formatHM(day.minutes)}`}
              type="button"
            />
          );
        })}
      </div>
    </div>
  );
}

function formatHM(minutes: number): string {
  if (minutes === 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
