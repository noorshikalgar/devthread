// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  BREAK_MINUTES_MAX,
  BREAK_MINUTES_MIN,
  DAILY_HOURS_MAX,
  DAILY_HOURS_MIN,
  DEFAULT_WORKLOG_SETTINGS,
  effectiveDailyGoalMinutes,
  loadWorklogSettings,
  normalizeWorklogSettings,
  saveWorklogSettings,
} from "./worklogSettings";

describe("worklogSettings", () => {
  it("falls back to defaults when storage is empty", () => {
    localStorage.clear();
    expect(loadWorklogSettings()).toEqual(DEFAULT_WORKLOG_SETTINGS);
  });

  it("falls back to defaults when the stored value is corrupt", () => {
    localStorage.setItem("devthread:worklog-settings", "{not json");
    expect(loadWorklogSettings()).toEqual(DEFAULT_WORKLOG_SETTINGS);
  });

  it("round-trips through localStorage", () => {
    saveWorklogSettings({ dailyHours: 7.5, breakMinutes: 30 });
    expect(loadWorklogSettings()).toEqual({
      dailyHours: 7.5,
      breakMinutes: 30,
    });
  });

  it("clamps out-of-range daily hours on save", () => {
    saveWorklogSettings({ dailyHours: 99, breakMinutes: 0 });
    expect(loadWorklogSettings().dailyHours).toBe(DAILY_HOURS_MAX);

    saveWorklogSettings({ dailyHours: -3, breakMinutes: 0 });
    expect(loadWorklogSettings().dailyHours).toBe(DAILY_HOURS_MIN);
  });

  it("clamps out-of-range break minutes on save", () => {
    saveWorklogSettings({ dailyHours: 8, breakMinutes: 99999 });
    expect(loadWorklogSettings().breakMinutes).toBe(BREAK_MINUTES_MAX);

    saveWorklogSettings({ dailyHours: 8, breakMinutes: -10 });
    expect(loadWorklogSettings().breakMinutes).toBe(BREAK_MINUTES_MIN);
  });

  it("normalises stored values to known-good bounds", () => {
    const result = normalizeWorklogSettings({
      dailyHours: 100,
      breakMinutes: "30",
    });
    expect(result.dailyHours).toBe(DAILY_HOURS_MAX);
    expect(result.breakMinutes).toBe(DEFAULT_WORKLOG_SETTINGS.breakMinutes);
  });

  it("treats non-object input as defaults", () => {
    expect(normalizeWorklogSettings("nope")).toEqual(
      DEFAULT_WORKLOG_SETTINGS,
    );
    expect(normalizeWorklogSettings(null)).toEqual(
      DEFAULT_WORKLOG_SETTINGS,
    );
  });

  it("computes the effective daily goal in minutes", () => {
    expect(
      effectiveDailyGoalMinutes({ dailyHours: 8, breakMinutes: 60 }),
    ).toBe(7 * 60);
    expect(
      effectiveDailyGoalMinutes({ dailyHours: 8, breakMinutes: 0 }),
    ).toBe(8 * 60);
  });

  it("clamps the effective goal to zero when breaks exceed the day", () => {
    expect(
      effectiveDailyGoalMinutes({ dailyHours: 0, breakMinutes: 30 }),
    ).toBe(0);
  });
});
