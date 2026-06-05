import { describe, expect, it } from "vitest";
import { extractLinkPreviews, isLongEntry } from "./content";

describe("extractLinkPreviews", () => {
  it("extracts unique safe web links", () => {
    expect(
      extractLinkPreviews(
        "Review https://github.com/example/taskline/issues/42 and https://github.com/example/taskline/issues/42.",
      ),
    ).toEqual([
      {
        url: "https://github.com/example/taskline/issues/42",
        host: "github.com",
        label: "42",
      },
    ]);
  });
});

describe("isLongEntry", () => {
  it("identifies long text for inline collapsing", () => {
    expect(isLongEntry("short update")).toBe(false);
    expect(isLongEntry("x".repeat(701))).toBe(true);
  });
});
