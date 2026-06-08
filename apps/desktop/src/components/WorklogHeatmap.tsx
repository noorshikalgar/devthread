import { useMemo } from "react";
import { Flame } from "lucide-react";
import { computeStreaks } from "@/lib/worklogStreaks";
import { chartAccentBlend, readChartColor } from "@/lib/chartColors";
import type { WorklogDay } from "@/lib/worklog";
import { cn } from "@/lib/utils";

export interface WorklogHeatmapProps {
  days: ReadonlyArray<WorklogDay>;
  range: "7d" | "4w" | "12w" | "12m";
  selectedDay: string | null;
  onSelectDay: (key: string | null) => void;
}

/**
 * Five intensity buckets, cut on absolute minutes per day. Each
 * bucket maps to a ratio between the theme's --muted colour (the
 * "empty cell" tone) and the theme's --chart-1 accent (the
 * "busiest day" colour). We interpolate lightness (and a little
 * saturation) on that axis so adjacent buckets are clearly
 * different even on saturated dark-theme accents.
 *
 * The previous ladder used pure alpha opacity against a single
 * colour, which collapsed to a single shade on Gruvbox amber
 * (a 0.7 -> 1.0 amber against a 12% card looks the same). The
 * 5-step lightness ladder instead steps 20% of the way from
 * --muted to --chart-1 at every bucket, so a 2h cell and a 6h
 * cell are visibly different regardless of the theme.
 */
const BUCKET_RATIOS = [0.2, 0.4, 0.6, 0.8, 1] as const;
const BUCKET_STRIPES = [8, 4, 2.5, 1.5, 1] as const;

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
                ? "bg-background"
                : "bg-muted text-muted-foreground",
            )}
            data-testid="worklog-streak-pill"
            style={
              streaks.current > 0
                ? {
                    // A solid pill: the theme's --background is the
                    // canvas, the accent paints the text + 1px ring.
                    // That way the pill reads as "accent on dark" on
                    // dark themes and "accent on light" on light
                    // themes, with the text always contrasted against
                    // its own background.
                    backgroundColor: "var(--background)",
                    color: readChartColor("--chart-1"),
                    boxShadow: `inset 0 0 0 1px ${readChartColor("--chart-1")}`,
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
          {BUCKET_RATIOS.map((ratio, i) => (
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-sm border border-border/40"
              key={i}
              style={{
                backgroundColor: chartAccentBlend(ratio),
                backgroundImage: `repeating-linear-gradient(45deg, ${readChartColor(
                  "--chart-1",
                )} ${BUCKET_STRIPES[i]!}px, transparent ${
                  BUCKET_STRIPES[i]!
                }px, transparent ${BUCKET_STRIPES[i]! * 2}px)`,
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
          const hasTime = day.minutes > 0;
          const bucket = hasTime ? bucketIndex(day.minutes) : -1;
          const ratio = bucket >= 0 ? BUCKET_RATIOS[bucket]! : 0;
          const stripe = bucket >= 0 ? BUCKET_STRIPES[bucket]! : 0;
          return (
            <button
              aria-label={`${day.key} ${formatHM(day.minutes)}`}
              className={cn(
                "group relative h-7 w-full min-w-0 overflow-hidden rounded-[3px] border border-border/40 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                range !== "12m" && "w-[18px]",
                !hasTime && "bg-muted/40",
                isSelected && "ring-2 ring-primary",
              )}
              data-testid="heatmap-cell"
              key={day.key}
              onClick={() =>
                onSelectDay(isSelected ? null : day.key)
              }
              style={
                hasTime
                  ? {
                      backgroundColor: chartAccentBlend(ratio),
                      // The diagonal hatch on top of the fill gives
                      // the cell a textured, chart-like quality. The
                      // stripe is at the same lightness as the cell
                      // so the eye reads the hatch as a darker
                      // shading on top of the hue, not as a totally
                      // different colour.
                      backgroundImage: `repeating-linear-gradient(45deg, ${readChartColor(
                        "--chart-1",
                      )} ${stripe}px, transparent ${stripe}px, transparent ${
                        stripe * 2
                      }px)`,
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
