// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SUMMARY_ORDER,
  DEFAULT_SUMMARY_TEMPLATE,
  getSummaryFieldOrder,
  loadSummaryOrder,
  loadSummaryTemplate,
  saveSummaryOrder,
  saveSummaryTemplate,
  type SummaryFieldKey,
  type SummaryTemplate,
} from "./summaryTemplate";

const STORAGE_KEY = "devthread:summary-template";
const ORDER_KEY = "devthread:summary-template-order";

afterEach(() => {
  localStorage.clear();
});

describe("loadSummaryTemplate", () => {
  it("returns defaults when localStorage is empty", () => {
    expect(loadSummaryTemplate()).toEqual(DEFAULT_SUMMARY_TEMPLATE);
  });

  it("returns the stored value when present", () => {
    const stored: SummaryTemplate = {
      title: true,
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

describe("loadSummaryOrder", () => {
  it("returns the default order when localStorage is empty", () => {
    expect(loadSummaryOrder()).toEqual(DEFAULT_SUMMARY_ORDER);
  });

  it("returns the stored order when present", () => {
    const stored: SummaryFieldKey[] = [
      "updatedDate",
      "createdDate",
      "worklog",
      "status",
      "title",
      "estimate",
      "worklogEntries",
      "quickLinks",
    ];
    localStorage.setItem(ORDER_KEY, JSON.stringify(stored));
    expect(loadSummaryOrder()).toEqual(stored);
  });

  it("de-duplicates entries in the stored order", () => {
    localStorage.setItem(
      ORDER_KEY,
      JSON.stringify(["status", "status", "estimate"]),
    );
    expect(loadSummaryOrder()).toEqual([
      "status",
      "estimate",
      "title",
      "worklog",
      "worklogEntries",
      "quickLinks",
      "createdDate",
      "updatedDate",
    ]);
  });

  it("drops unknown keys and appends missing defaults", () => {
    localStorage.setItem(
      ORDER_KEY,
      JSON.stringify(["status", "bogus", "estimate"]),
    );
    expect(loadSummaryOrder()).toEqual([
      "status",
      "estimate",
      "title",
      "worklog",
      "worklogEntries",
      "quickLinks",
      "createdDate",
      "updatedDate",
    ]);
  });

  it("falls back to defaults when stored JSON is malformed", () => {
    localStorage.setItem(ORDER_KEY, "{ not json");
    expect(loadSummaryOrder()).toEqual(DEFAULT_SUMMARY_ORDER);
  });

  it("falls back to defaults when stored value is not an array", () => {
    localStorage.setItem(ORDER_KEY, JSON.stringify({ status: "first" }));
    expect(loadSummaryOrder()).toEqual(DEFAULT_SUMMARY_ORDER);
  });
});

describe("saveSummaryOrder", () => {
  it("writes the order to localStorage", () => {
    const order: SummaryFieldKey[] = [
      "estimate",
      "title",
      "status",
      "worklog",
      "worklogEntries",
      "quickLinks",
      "createdDate",
      "updatedDate",
    ];
    saveSummaryOrder(order);
    expect(localStorage.getItem(ORDER_KEY)).toBe(JSON.stringify(order));
  });

  it("throws on unknown keys", () => {
    expect(() => saveSummaryOrder(["bogus" as SummaryFieldKey])).toThrow();
  });
});

describe("getSummaryFieldOrder", () => {
  it("returns the provided order when supplied", () => {
    expect(getSummaryFieldOrder(["status", "title"])).toEqual([
      "status",
      "title",
    ]);
  });

  it("loads from storage when no order is supplied", () => {
    localStorage.setItem(ORDER_KEY, JSON.stringify(["updatedDate", "status"]));
    expect(getSummaryFieldOrder()).toEqual([
      "updatedDate",
      "status",
      "title",
      "estimate",
      "worklog",
      "worklogEntries",
      "quickLinks",
      "createdDate",
    ]);
  });
});
