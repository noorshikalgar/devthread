import { useMemo, useState, useEffect } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { readChartColor } from "@/lib/chartColors";
import { effectiveDailyGoalMinutes } from "@/lib/worklogSettings";
import type { WorklogSettings } from "@/lib/worklogSettings";
import type { WorklogDay } from "@/lib/worklog";

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export interface WorklogHoursChartProps {
  days: ReadonlyArray<WorklogDay>;
  onSelectDay?: (key: string) => void;
  selectedDay?: string | null;
  settings: WorklogSettings;
}

interface ChartDatum {
  date: string;
  dateLabel: string;
  hours: number;
  isAboveGoal: boolean;
}

function formatHoursTick(value: number): string {
  if (value === 0) return "0";
  if (Number.isInteger(value)) return `${value}h`;
  return `${value.toFixed(1)}h`;
}

function formatHoursTooltip(value: number): string {
  if (value === 0) return "0h";
  if (Number.isInteger(value)) return `${value}h`;
  return `${value.toFixed(1)}h`;
}

/**
 * Tooltip formatter passed to Recharts. The first tuple element is the
 * rendered cell, the second is the series label. Recharts passes the
 * series's `name` as the second arg, so we forward it rather than
 * hardcoding "Logged" — otherwise the Above-goal series would also be
 * labelled "Logged" and the two rows in the tooltip would read
 * identically.
 */
export function tooltipValueFormatter(
  value: number | string,
  name: string | number,
): [string, string] {
  return [formatHoursTooltip(Number(value)), String(name)];
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string | number;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg">
      <p className="font-medium text-popover-foreground">{String(label)}</p>
      {payload.map((entry, index) => (
        <p
          className="mt-0.5 flex items-center gap-1.5 text-popover-foreground"
          key={`${entry.name ?? "value"}-${index}`}
        >
          <span
            aria-hidden
            className="inline-block size-2 rounded-sm"
            style={{ background: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="ml-auto font-mono tabular-nums">
            {formatHoursTooltip(Number(entry.value ?? 0))}
          </span>
        </p>
      ))}
    </div>
  );
}

function buildChartData(
  days: ReadonlyArray<WorklogDay>,
  goalHours: number,
): ChartDatum[] {
  return days.map((day) => {
    const hours = day.minutes / 60;
    return {
      date: day.date,
      dateLabel: formatShortDate(day.date),
      hours,
      isAboveGoal: hours > goalHours,
    };
  });
}

export function WorklogHoursChart({
  days,
  onSelectDay,
  selectedDay,
  settings,
}: WorklogHoursChartProps) {
  const goalHours = effectiveDailyGoalMinutes(settings) / 60;
  const data = useMemo(
    () => buildChartData(days, goalHours),
    [days, goalHours],
  );
  const selectedLabel = selectedDay
    ? (data.find((d) => d.date === selectedDay)?.dateLabel ?? null)
    : null;

  // The chart colours come from the active theme's --chart-* CSS
  // variables, so reading them on every render keeps them in sync if
  // the user changes theme while the chart is on screen.
  const [palette, setPalette] = useState(() => ({
    primary: readChartColor("--chart-1"),
    aboveGoal: readChartColor("--chart-2"),
    goalLine: readChartColor("--chart-4"),
    grid: readChartColor("--chart-grid"),
    text: readChartColor("--chart-4"),
  }));

  useEffect(() => {
    setPalette({
      primary: readChartColor("--chart-1"),
      aboveGoal: readChartColor("--chart-2"),
      goalLine: readChartColor("--chart-4"),
      grid: readChartColor("--chart-grid"),
      text: readChartColor("--chart-4"),
    });
  }, [settings.dailyHours, settings.breakMinutes]);

  const aboveDays = data.filter((d) => d.isAboveGoal).length;
  const loggedDays = days.filter((day) => day.minutes > 0);
  const maxHours = data.reduce((max, d) => Math.max(max, d.hours), goalHours);
  const yMax = Math.max(8, Math.ceil((maxHours + 1) * 2) / 2);

  if (!data.length) {
    return (
      <div className="flex h-full flex-col">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Daily hours</h2>
        </div>
        <p className="grid flex-1 place-items-center text-center text-xs text-foreground/70">
          No worklog entries in the selected range.
        </p>
      </div>
    );
  }

  return (
    <div
      aria-label={`Daily worklog hours, goal ${formatHoursTooltip(goalHours)} per day`}
      className="flex h-full flex-col"
      data-testid="worklog-hours-chart"
      role="figure"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Daily hours</h2>
          <p className="text-xs text-foreground/70">
            Year trend with a goal line at{" "}
            <span className="font-semibold text-foreground">
              {formatHoursTooltip(goalHours)}
            </span>{" "}
            per workday.
          </p>
        </div>
        <p className="text-xs text-foreground/70">
          <span className="font-semibold text-foreground">
            {loggedDays.length}
          </span>{" "}
          logged ·{" "}
          <span className="font-semibold text-foreground">{aboveDays}</span> day
          {aboveDays === 1 ? "" : "s"} above goal
        </p>
      </div>
      <div className="mt-3 h-[240px] w-full min-h-0 flex-1">
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
            onClick={(state: unknown) => {
              const payload = (
                state as {
                  activePayload?: Array<{ payload?: ChartDatum }>;
                }
              )?.activePayload?.[0]?.payload as ChartDatum | undefined;
              if (payload) onSelectDay?.(payload.date);
            }}
          >
            <defs>
              <linearGradient
                id="worklog-primary-fill"
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={palette.primary}
                  stopOpacity={0.45}
                />
                <stop
                  offset="100%"
                  stopColor={palette.primary}
                  stopOpacity={0.05}
                />
              </linearGradient>
              <linearGradient
                id="worklog-above-fill"
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={palette.aboveGoal}
                  stopOpacity={0.55}
                />
                <stop
                  offset="100%"
                  stopColor={palette.aboveGoal}
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke={palette.grid}
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              axisLine={false}
              dataKey="dateLabel"
              interval="preserveStartEnd"
              minTickGap={48}
              stroke={palette.text}
              tick={{ fontSize: 10 }}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              dataKey="hours"
              domain={[0, yMax]}
              stroke={palette.text}
              tick={{ fontSize: 10 }}
              tickFormatter={formatHoursTick}
              tickLine={false}
              width={36}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: palette.text, strokeOpacity: 0.25 }}
            />
            <ReferenceLine
              ifOverflow="extendDomain"
              label={{
                fill: palette.goalLine,
                fontSize: 10,
                position: "insideTopRight",
                value: `Goal ${formatHoursTooltip(goalHours)}`,
              }}
              stroke={palette.goalLine}
              strokeDasharray="6 4"
              y={goalHours}
            />
            {selectedLabel && (
              <ReferenceLine
                ifOverflow="extendDomain"
                stroke={palette.primary}
                strokeWidth={1.5}
                x={selectedLabel}
              />
            )}
            <Area
              activeDot={{ fill: palette.primary, r: 3, strokeWidth: 0 }}
              dataKey="hours"
              dot={false}
              fill="url(#worklog-primary-fill)"
              fillOpacity={1}
              isAnimationActive={false}
              name="Logged"
              stroke={palette.primary}
              strokeWidth={1.6}
              type="monotone"
            />
            <Line
              dataKey={(d: ChartDatum) => (d.isAboveGoal ? d.hours : null)}
              dot={false}
              isAnimationActive={false}
              name="Above goal"
              stroke={palette.aboveGoal}
              strokeWidth={2}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {loggedDays.length > 0 && loggedDays.length < 5 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {formatLowDataInsight(loggedDays)}
        </p>
      )}
    </div>
  );
}

function formatLowDataInsight(days: ReadonlyArray<WorklogDay>) {
  const best = days.reduce((current, day) =>
    day.minutes > current.minutes ? day : current,
  );
  return `You logged ${formatHM(best.minutes)} on ${formatShortDate(
    best.date,
  )}. Add more logs to build a trend.`;
}

function formatHM(minutes: number): string {
  if (minutes === 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
