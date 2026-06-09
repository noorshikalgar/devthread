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

export function WorklogHoursChart({ days, settings }: WorklogHoursChartProps) {
  const goalHours = effectiveDailyGoalMinutes(settings) / 60;
  const data = useMemo(
    () => buildChartData(days, goalHours),
    [days, goalHours],
  );

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
  const maxHours = data.reduce((max, d) => Math.max(max, d.hours), goalHours);
  const yMax = Math.max(8, Math.ceil((maxHours + 1) * 2) / 2);

  if (!data.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Daily hours</h2>
        </div>
        <p className="py-8 text-center text-xs text-muted-foreground">
          No worklog entries in the selected range.
        </p>
      </div>
    );
  }

  return (
    <div
      aria-label={`Daily worklog hours, goal ${formatHoursTooltip(goalHours)} per day`}
      className="rounded-lg border border-border bg-card p-4"
      data-testid="worklog-hours-chart"
      role="figure"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Daily hours</h2>
          <p className="text-xs text-muted-foreground">
            Hours logged per day, with a goal line at{" "}
            <span className="font-medium text-foreground">
              {formatHoursTooltip(goalHours)}
            </span>{" "}
            per workday.
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {aboveDays} day{aboveDays === 1 ? "" : "s"} above goal
        </p>
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
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
              minTickGap={32}
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
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--popover-foreground)",
                fontSize: 11,
              }}
              cursor={{ stroke: palette.text, strokeOpacity: 0.25 }}
              // Recharts 3's Formatter type is a complex union; the
              // exported helper has a tighter signature we can test
              // directly. The `as never` bridges the two without
              // re-declaring Recharts' full type at the call site.
              formatter={tooltipValueFormatter as never}
              labelFormatter={(label) => String(label)}
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
            <Area
              dataKey="hours"
              fill="url(#worklog-primary-fill)"
              fillOpacity={1}
              isAnimationActive={false}
              name="Logged"
              stroke={palette.primary}
              strokeWidth={1.5}
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
    </div>
  );
}
