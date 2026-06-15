import { useMemo } from "react";
import { formatDuration } from "@/lib/duration";

export interface WorklogBarItem {
  label: string;
  minutes: number;
}

export interface WorklogBarsProps {
  goalMinutes?: number;
  title: string;
  items: ReadonlyArray<WorklogBarItem>;
}

export function WorklogBars({ goalMinutes, title, items }: WorklogBarsProps) {
  const max = useMemo(
    () =>
      Math.max(
        1,
        goalMinutes ?? 0,
        ...items.map((item) => item.minutes),
      ),
    [goalMinutes, items],
  );
  const latest = items.at(-1);
  const latestPercent =
    latest && goalMinutes ? Math.round((latest.minutes / goalMinutes) * 100) : 0;

  return (
    <div className="rounded-md border border-border/55 bg-card/70 p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          {latest && goalMinutes && (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDuration(latest.minutes)} logged · {latestPercent}% of{" "}
              {formatDuration(goalMinutes)} goal
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {items.slice(-8).map((item) => (
          <div
            className="grid grid-cols-[76px_minmax(70px,1fr)_88px] items-center gap-3 text-sm"
            key={item.label}
          >
            <span className="truncate font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {item.label}
            </span>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/45">
              <div
                className="h-full rounded-full bg-primary/50"
                style={{ width: `${Math.max(4, (item.minutes / max) * 100)}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-right font-mono text-xs tabular-nums text-foreground">
              {formatDuration(item.minutes)}
            </span>
          </div>
        ))}
        {!items.length && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No logged time yet.
          </p>
        )}
      </div>
    </div>
  );
}
