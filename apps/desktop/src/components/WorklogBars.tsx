import { useMemo } from "react";
import { formatDuration } from "@/lib/duration";

export interface WorklogBarItem {
  label: string;
  minutes: number;
}

export interface WorklogBarsProps {
  title: string;
  items: ReadonlyArray<WorklogBarItem>;
}

export function WorklogBars({ title, items }: WorklogBarsProps) {
  const max = useMemo(
    () => Math.max(1, ...items.map((item) => item.minutes)),
    [items],
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="mt-4 space-y-2">
        {items.slice(-8).map((item) => (
          <div
            className="grid grid-cols-[74px_minmax(0,1fr)_56px] items-center gap-2 text-xs"
            key={item.label}
          >
            <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {item.label}
            </span>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(4, (item.minutes / max) * 100)}%` }}
              />
            </div>
            <span className="text-right font-mono text-[10px] text-foreground">
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
