export interface WorklogSettings {
  /** Target working hours per workday, used as the goal line on charts. */
  dailyHours: number;
  /** Break time excluded from logged work, in minutes per day. */
  breakMinutes: number;
}

export const DEFAULT_WORKLOG_SETTINGS: WorklogSettings = {
  dailyHours: 8,
  breakMinutes: 0,
};

const STORAGE_KEY = "devthread:worklog-settings";

/** Inclusive bounds for the daily working hours input. */
export const DAILY_HOURS_MIN = 0;
export const DAILY_HOURS_MAX = 24;
export const BREAK_MINUTES_MIN = 0;
export const BREAK_MINUTES_MAX = 60 * 12;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function normalizeWorklogSettings(value: unknown): WorklogSettings {
  if (!isObject(value)) return { ...DEFAULT_WORKLOG_SETTINGS };
  return {
    dailyHours: clampNumber(
      value.dailyHours,
      DEFAULT_WORKLOG_SETTINGS.dailyHours,
      DAILY_HOURS_MIN,
      DAILY_HOURS_MAX,
    ),
    breakMinutes: clampNumber(
      value.breakMinutes,
      DEFAULT_WORKLOG_SETTINGS.breakMinutes,
      BREAK_MINUTES_MIN,
      BREAK_MINUTES_MAX,
    ),
  };
}

export function loadWorklogSettings(): WorklogSettings {
  if (typeof localStorage === "undefined") {
    return { ...DEFAULT_WORKLOG_SETTINGS };
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_WORKLOG_SETTINGS };
  try {
    return normalizeWorklogSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_WORKLOG_SETTINGS };
  }
}

export function saveWorklogSettings(settings: WorklogSettings): void {
  if (typeof localStorage === "undefined") return;
  const normalized = normalizeWorklogSettings(settings);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

/**
 * Effective daily goal in minutes, after subtracting the configured break.
 * This is the threshold the chart uses to colour "over goal" segments.
 */
export function effectiveDailyGoalMinutes(settings: WorklogSettings): number {
  return Math.max(0, settings.dailyHours * 60 - settings.breakMinutes);
}
