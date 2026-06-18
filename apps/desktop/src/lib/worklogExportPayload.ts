import { formatDuration } from "@/lib/duration";
import { effectiveDailyGoalMinutes } from "@/lib/worklogSettings";
import type { WorklogSettings } from "@/lib/worklogSettings";
import type { WorklogMetricEntry } from "@/lib/types";
import type { WorklogDay } from "@/lib/worklog";
import {
  buildWorkbook,
  styles,
  type ExportSheet,
  type SheetCell,
} from "@/lib/worklogExport";

export interface WorklogExportPayload {
  year: number;
  settings: WorklogSettings;
  entries: WorklogMetricEntry[];
}

export function buildWorklogFilename(
  year: number,
  now: Date = new Date(),
): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `worklog-${year}-${yyyy}${mm}${dd}-${hh}${mi}.xlsx`;
}

interface Bucket {
  key: string;
  label: string;
  minutes: number;
}

function weekStartOf(value: string): string {
  const date = new Date(value);
  const day = (date.getUTCDay() + 6) % 7;
  const monday = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - day,
    ),
  );
  return monday.toISOString().slice(0, 10);
}

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function formatWeekLabel(monday: string): string {
  const [yyyy, mm, dd] = monday.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return `Week of ${MONTH_SHORT[mm - 1]} ${dd}`;
}

function formatMonthLabel(year: number, monthIndex: number): string {
  return `${MONTH_LONG[monthIndex]} ${year}`;
}

function formatExportDate(iso: string): string {
  // "2026-06-15" or "2026-06-15T..." → "Jun 15, 2026"
  const [yyyy, mm, dd] = iso.slice(0, 10).split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return `${MONTH_SHORT[mm - 1]} ${dd}, ${yyyy}`;
}

function formatExportTimestamp(date: Date): string {
  // "Jun 15, 2026 16:44" — local time, not ISO, so Excel doesn't
  // re-format it when the user's locale differs from UTC.
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = MONTH_SHORT[date.getMonth()];
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${mm} ${dd}, ${yyyy} ${hh}:${mi}`;
}

function aggregateByWeek(entries: WorklogMetricEntry[]): Bucket[] {
  const buckets = new Map<string, Bucket>();
  for (const entry of entries) {
    const monday = weekStartOf(entry.occurredAt);
    const current = buckets.get(monday);
    if (current) {
      current.minutes += entry.durationMinutes;
    } else {
      buckets.set(monday, {
        key: monday,
        label: formatWeekLabel(monday),
        minutes: entry.durationMinutes,
      });
    }
  }
  return [...buckets.values()].sort((a, b) => b.key.localeCompare(a.key));
}

function aggregateByMonth(entries: WorklogMetricEntry[]): Bucket[] {
  const buckets = new Map<string, Bucket>();
  for (const entry of entries) {
    const date = new Date(entry.occurredAt);
    const year = date.getUTCFullYear();
    const monthIndex = date.getUTCMonth();
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const current = buckets.get(key);
    if (current) {
      current.minutes += entry.durationMinutes;
    } else {
      buckets.set(key, {
        key,
        label: formatMonthLabel(year, monthIndex),
        minutes: entry.durationMinutes,
      });
    }
  }
  return [...buckets.values()].sort((a, b) => b.key.localeCompare(a.key));
}

interface TaskRow {
  rank: number;
  taskId: string;
  taskTitle: string;
  folderName: string | null;
  minutes: number;
  sessions: number;
  sharePercent: number;
  lastLogged: string;
}

function aggregateByTask(entries: WorklogMetricEntry[]): TaskRow[] {
  const totals = new Map<
    string,
    {
      minutes: number;
      taskTitle: string;
      folderName: string | null;
      sessions: number;
      lastLogged: string;
    }
  >();
  for (const entry of entries) {
    const current = totals.get(entry.taskId);
    if (current) {
      current.minutes += entry.durationMinutes;
      current.sessions += 1;
      if (entry.occurredAt > current.lastLogged) {
        current.lastLogged = entry.occurredAt;
      }
    } else {
      totals.set(entry.taskId, {
        minutes: entry.durationMinutes,
        taskTitle: entry.taskTitle,
        folderName: entry.folderName,
        sessions: 1,
        lastLogged: entry.occurredAt,
      });
    }
  }
  const sorted = [...totals.entries()]
    .map(([taskId, value]) => ({ taskId, ...value }))
    .sort((a, b) => b.minutes - a.minutes);
  const totalMinutes = sorted.reduce((sum, t) => sum + t.minutes, 0);
  return sorted.map((task, index) => ({
    rank: index + 1,
    ...task,
    sharePercent: totalMinutes
      ? Math.round((task.minutes / totalMinutes) * 100)
      : 0,
  }));
}

function buildDaysArray(
  entries: WorklogMetricEntry[],
  year: number,
): WorklogDay[] {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  const minutes = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.occurredAt.slice(0, 10);
    minutes.set(key, (minutes.get(key) ?? 0) + entry.durationMinutes);
  }
  const days: WorklogDay[] = [];
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    days.push({ key, date: key, minutes: minutes.get(key) ?? 0 });
  }
  return days;
}

function buildSummarySheet(payload: WorklogExportPayload): ExportSheet {
  const { year, settings, entries } = payload;
  const dailyGoal = effectiveDailyGoalMinutes(settings);
  const days = buildDaysArray(entries, year);
  const loggedDays = days.filter((d) => d.minutes > 0);
  const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0);
  const bestDay = days.reduce<WorklogDay | null>(
    (best, d) => (!best || d.minutes > best.minutes ? d : best),
    null,
  );
  const goalHitDays = days.filter((d) => d.minutes >= dailyGoal).length;
  const averageActiveDayMinutes = loggedDays.length
    ? Math.round(totalMinutes / loggedDays.length)
    : 0;
  const goalCoveragePercent = dailyGoal
    ? Math.min(100, Math.round((averageActiveDayMinutes / dailyGoal) * 100))
    : 0;

  const rows: SheetCell[][] = [
    [
      { value: "Worklog", style: styles.header },
      { value: year, style: styles.header },
    ],
    [{ value: "Generated" }, { value: formatExportTimestamp(new Date()) }],
    [{ value: "Daily goal (min)" }, { value: dailyGoal }],
    [{ value: "Daily goal" }, { value: formatDuration(dailyGoal) }],
    [{ value: "Total logged (min)" }, { value: totalMinutes }],
    [{ value: "Total logged" }, { value: formatDuration(totalMinutes) }],
    [{ value: "Average active day (min)" }, { value: averageActiveDayMinutes }],
    [
      { value: "Average active day" },
      { value: formatDuration(averageActiveDayMinutes) },
    ],
    [{ value: "Logged days" }, { value: loggedDays.length }],
    [
      { value: "Best day" },
      {
        value:
          bestDay && bestDay.minutes > 0
            ? `${formatExportDate(bestDay.key)} (${formatDuration(bestDay.minutes)})`
            : "—",
      },
    ],
    [{ value: "Goal-hit days" }, { value: goalHitDays }],
    [{ value: "Coverage" }, { value: `${goalCoveragePercent}%` }],
  ];
  return {
    name: "Summary",
    rows,
    columnWidths: [22, 22],
    tabColor: "1F2937", // dark slate
  };
}

function buildPeriodSheet(
  sheetName: string,
  periodColumn: string,
  items: Bucket[],
  dailyGoalMinutes: number,
  periodWorkdays: number,
  year: number,
): ExportSheet {
  const periodGoal = dailyGoalMinutes * periodWorkdays;
  const header: SheetCell[] = [
    { value: `${periodColumn} of ${year}`, style: styles.header },
    { value: "Hours", style: styles.header },
    { value: "Duration", style: styles.header },
    { value: "Goal (hours)", style: styles.header },
    { value: "% of goal", style: styles.header },
  ];
  const rows: SheetCell[][] = [header];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const hours = +(item.minutes / 60).toFixed(2);
    const goalHours = +(periodGoal / 60).toFixed(2);
    const pct = periodGoal ? Math.round((item.minutes / periodGoal) * 100) : 0;
    // Three-tier coloring maps the coverage % to a fill that the
    // eye can read at a glance — emerald when on target, amber when
    // close, sky when moderate. Zebra banding only applies to the
    // neutral rows (sparse progress, no tier) so the tier colors
    // always read as the loudest signal in the row.
    const tier =
      item.minutes === 0
        ? styles.muted
        : pct >= 100
          ? styles.goalHit
          : pct >= 70
            ? styles.nearGoal
            : pct >= 40
              ? styles.partial
              : styles.default;
    const rowStyle =
      tier === styles.default && i % 2 === 1 ? styles.banded : tier;
    rows.push([
      {
        value: item.label,
        style: item.minutes > 0 ? styles.default : styles.muted,
      },
      { value: hours, style: rowStyle },
      { value: formatDuration(item.minutes), style: rowStyle },
      { value: goalHours, style: rowStyle },
      { value: `${pct}%`, style: rowStyle },
    ]);
  }
  return {
    name: sheetName,
    rows,
    columnWidths: [22, 10, 14, 14, 14],
    freezeHeader: true,
    // Sky for weeks, violet for months — the summary stays slate.
    tabColor: sheetName === "Weeks" ? "38BDF8" : "A78BFA",
  };
}

function buildTasksSheet(entries: WorklogMetricEntry[]): ExportSheet {
  const tasks = aggregateByTask(entries);
  const header: SheetCell[] = [
    { value: "Rank", style: styles.header },
    { value: "Task title", style: styles.header },
    { value: "Folder", style: styles.header },
    { value: "Hours", style: styles.header },
    { value: "Duration", style: styles.header },
    { value: "Entries", style: styles.header },
    { value: "Share", style: styles.header },
    { value: "Last logged", style: styles.header },
  ];
  const rows: SheetCell[][] = [header];
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]!;
    const hours = +(task.minutes / 60).toFixed(2);
    const band = i % 2 === 1 ? styles.banded : styles.default;
    // Task title and folder can be long (project names, sub-folders),
    // so we wrap those cells. Numeric columns stay as-is.
    rows.push([
      { value: task.rank, style: band },
      { value: task.taskTitle, style: band, wrap: true },
      { value: task.folderName ?? "—", style: band, wrap: true },
      { value: hours, style: band },
      { value: formatDuration(task.minutes), style: band },
      { value: task.sessions, style: band },
      { value: `${task.sharePercent}%`, style: band },
      { value: formatExportDate(task.lastLogged), style: band },
    ]);
  }
  return {
    name: "Tasks",
    rows,
    // Title and folder are the two columns most likely to need to
    // wrap, so we widen them and rely on the per-cell `wrap` flag to
    // flow long text within the cell.
    columnWidths: [6, 48, 28, 10, 14, 10, 10, 14],
    freezeHeader: true,
    tabColor: "10B981", // emerald
  };
}

function buildGuideSheet(year: number): ExportSheet {
  const sections: Array<[string, string[]]> = [
    [
      "About this export",
      [
        `Worklog export for ${year}.`,
        "All four sheets are generated from the worklog entries you logged during the year. Times are stored in minutes and rendered as both raw hours (decimal) and human-readable durations like '1d 1h 30m'.",
      ],
    ],
    [
      "What each sheet contains",
      [
        "Summary — year-level totals, daily goal, best day, goal-hit count, and coverage percentage.",
        "Weeks — one row per ISO Monday, with hours, duration, weekly goal, and percentage of that goal.",
        "Months — same shape as Weeks, but bucketed by month, with a 20-workday monthly goal.",
        "Tasks — one row per task that received work this year, ranked by total time, with entry count, share, and last-logged date.",
      ],
    ],
    [
      "Why some columns look the way they do",
      [
        "Hours — total logged time divided by 60, rounded to two decimals. Use this for any math or charting.",
        "Duration — the same value in human form (e.g. 1d 1h 30m). Use this for reading at a glance.",
        "Entries — how many separate log entries the task has. A task with one 4h entry looks different from a task with four 1h entries, even though their totals match.",
        "Share — what fraction of your total logged time this task represents. Useful for spotting when a single task is eating most of your year.",
      ],
    ],
    [
      "Reading the colors",
      [
        "Rows in Weeks and Months are shaded by coverage of the period goal: emerald at 100% or more, amber at 70-99%, sky at 40-69%, plain below that.",
        "Alternating rows have a very light slate tint to make long lists easier to scan.",
        "Cells with zero time logged are muted, so empty weeks/months recede and busy ones pop.",
      ],
    ],
  ];
  const rows: SheetCell[][] = [
    [
      {
        value: "Worklog export guide",
        style: styles.guideSection,
        wrap: true,
      },
    ],
    [],
  ];
  for (const [heading, lines] of sections) {
    rows.push([{ value: heading, style: styles.guideSection, wrap: true }]);
    for (const line of lines) {
      // Each Guide line is free-form prose that can be long, so we
      // ask the writer to wrap it inside the cell rather than spill
      // across columns or get clipped.
      rows.push([{ value: line, wrap: true }]);
    }
    rows.push([]);
  }
  rows.push([{ value: "Generated", style: styles.guideSection, wrap: true }]);
  rows.push([{ value: formatExportTimestamp(new Date()), wrap: true }]);
  return {
    name: "Guide",
    rows,
    columnWidths: [120],
    tabColor: "94A3B8", // slate
  };
}

export function buildWorklogExportSheets(
  payload: WorklogExportPayload,
): ExportSheet[] {
  const { year, settings, entries } = payload;
  const dailyGoal = effectiveDailyGoalMinutes(settings);
  return [
    buildGuideSheet(year),
    buildSummarySheet(payload),
    buildPeriodSheet(
      "Weeks",
      "Week",
      aggregateByWeek(entries),
      dailyGoal,
      5,
      year,
    ),
    buildPeriodSheet(
      "Months",
      "Month",
      aggregateByMonth(entries),
      dailyGoal,
      20,
      year,
    ),
    buildTasksSheet(entries),
  ];
}

export function exportWorklogToExcel(payload: WorklogExportPayload): void {
  const sheets = buildWorklogExportSheets(payload);
  const bytes = buildWorkbook(sheets);
  const filename = buildWorklogFilename(payload.year);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
