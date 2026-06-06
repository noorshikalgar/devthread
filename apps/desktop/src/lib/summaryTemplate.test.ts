// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SUMMARY_TEMPLATE,
  loadSummaryTemplate,
  saveSummaryTemplate,
  type SummaryTemplate,
} from "./summaryTemplate";

const STORAGE_KEY = "devthread:summary-template";

afterEach(() => {
  localStorage.clear();
});

describe("loadSummaryTemplate", () => {
  it("returns defaults when localStorage is empty", () => {
    expect(loadSummaryTemplate()).toEqual(DEFAULT_SUMMARY_TEMPLATE);
  });

  it("returns the stored value when present", () => {
    const stored: SummaryTemplate = {
      status: false,
      estimate: true,
      worklog: false,
      worklogEntries: true,
      quickLinks: true,
      createdDate: true,
      updatedDate: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    expect(loadSummaryTemplate()).toEqual(stored);
  });

  it("merges stored partial value with defaults for missing fields", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: false }));
    expect(loadSummaryTemplate()).toEqual({
      ...DEFAULT_SUMMARY_TEMPLATE,
      status: false,
    });
  });

  it("returns defaults when stored JSON is malformed", () => {
    localStorage.setItem(STORAGE_KEY, "{ not json");
    expect(loadSummaryTemplate()).toEqual(DEFAULT_SUMMARY_TEMPLATE);
  });

  it("returns defaults when stored value is not an object", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify("nope"));
    expect(loadSummaryTemplate()).toEqual(DEFAULT_SUMMARY_TEMPLATE);
  });

  it("falls back to default for fields with wrong type", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ status: "yes", worklog: 1, quickLinks: null }),
    );
    expect(loadSummaryTemplate()).toEqual(DEFAULT_SUMMARY_TEMPLATE);
  });
});

describe("saveSummaryTemplate", () => {
  it("writes the template to localStorage", () => {
    const template: SummaryTemplate = {
      ...DEFAULT_SUMMARY_TEMPLATE,
      quickLinks: true,
    };
    saveSummaryTemplate(template);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(template));
  });
});
