import { useMemo } from "react";
import { Flame } from "lucide-react";
import { computeStreaks } from "@/lib/worklogStreaks";
import { readChartColor } from "@/lib/chartColors";
import type { WorklogDay } from "@/lib/worklog";
import { cn } from "@/lib/utils";

export interface WorklogHeatmapProps {
  days: ReadonlyArray<WorklogDay>;
  range: "7d" | "4w" | "12w" | "12m";
  selectedDay: string | null;
  onSelectDay: (key: string | null) => void;
}

/**
 * Five intensity buckets, cut on absolute minutes per day so the
 * same daily total always lands on the same shade. Each bucket
 * gets:
 *   - a fill alpha for the theme's --chart-1 accent, and
 *   - a diagonal hatch density that gets tighter as the bucket
 *     climbs, so the difference between "1h" and "9h" is visible
 *     even at a glance.
 */
type Bucket = {
  /** Cell background alpha (0 = transparent muted, 1 = solid accent). */
  alpha: number;
  /** Diagonal stripe width in pixels. Smaller = denser hatch. */
  stripe: number;
  /** Stripe colour (theme accent at the matching alpha). */
  stripeAlpha: number;
};

function bucketFor(minutes: number): Bucket | null {
  if (minutes <= 0) return null;
  if (minutes < 30) return { alpha: 0.22, stripe: 6, stripeAlpha: 0.18 };
  if (minutes < 60) return { alpha: 0.45, stripe: 5, stripeAlpha: 0.28 };
  if (minutes < 120) return { alpha: 0.65, stripe: 4, stripeAlpha: 0.4 };
  if (minutes < 240) return { alpha: 0.85, stripe: 3, stripeAlpha: 0.55 };
  return { alpha: 1, stripe: 2.5, stripeAlpha: 0.7 };
}

const BUCKET_SWATCHES: ReadonlyArray<Bucket> = [
  { alpha: 0.22, stripe: 6, stripeAlpha: 0.18 },
  { alpha: 0.45, stripe: 5, stripeAlpha: 0.28 },
  { alpha: 0.65, stripe: 4, stripeAlpha: 0.4 },
  { alpha: 0.85, stripe: 3, stripeAlpha: 0.55 },
  { alpha: 1, stripe: 2.5, stripeAlpha: 0.7 },
];

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
  // The accent follows the active theme's --chart-1, so a
  // Gruvbox / Zed user sees amber cells, Tokyo Night sees blue,
  // Rosé Pine sees purple, etc. The hatched texture on top is
  // always the same accent at a denser stripe, so the visual
  // signature stays the same across themes.
  const accent = readChartColor("--chart-1");

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
                ? "text-foreground"
                : "bg-muted text-muted-foreground",
            )}
            data-testid="worklog-streak-pill"
            style={
              streaks.current > 0
                ? {
                    backgroundColor: accent,
                    opacity: 0.18,
                    color: accent,
                  }
                : undefined
            }
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
        <div
          aria-label="Intensity legend, less to more"
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
        >
          <span className="mr-1">Less</span>
          {BUCKET_SWATCHES.map((bucket, i) => (
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-sm border border-border/40"
              key={i}
              style={{
                backgroundColor: accent,
                opacity: bucket.alpha,
                backgroundImage: `repeating-linear-gradient(45deg, ${accent} ${bucket.stripe}px, transparent ${bucket.stripe}px, transparent ${bucket.stripe * 2}px)`,
                backgroundBlendMode: bucket.alpha < 1 ? "overlay" : undefined,
              }}
            />
          ))}
          <span className="ml-1">More</span>
        </div>
      </div>
      <div
        className="grid grid-flow-col grid-rows-7 gap-1.5"
        style={{
          gridAutoColumns: `minmax(0, ${range === "12m" ? "1fr" : "18px"})`,
        }}
      >
        {days.map((day) => {
          const isSelected = selectedDay === day.key;
          const bucket = bucketFor(day.minutes);
          return (
            <button
              aria-label={`${day.key} ${formatHM(day.minutes)}`}
              className={cn(
                "group relative h-7 w-full min-w-0 overflow-hidden rounded-[3px] border border-border/40 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                range !== "12m" && "w-[18px]",
                !bucket && "bg-muted/40",
                isSelected && "ring-2 ring-primary",
              )}
              data-testid="heatmap-cell"
              key={day.key}
              onClick={() =>
                onSelectDay(isSelected ? null : day.key)
              }
              style={
                bucket
                  ? {
                      backgroundColor: accent,
                      opacity: bucket.alpha,
                      // The diagonal hatch on top of the fill gives
                      // the cell a textured, chart-like quality.
                      // The stripe is half transparent so it sits
                      // on top of the base fill without overwhelming
                      // it.
                      backgroundImage: `repeating-linear-gradient(45deg, ${accent} ${bucket.stripe}px, transparent ${bucket.stripe}px, transparent ${bucket.stripe * 2}px)`,
                    }
                  : undefined
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
