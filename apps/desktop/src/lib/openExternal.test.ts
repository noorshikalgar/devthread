import { describe, expect, it, vi } from "vitest";
import { safeExternalUrl } from "./openExternal";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

describe("safeExternalUrl", () => {
  it("normalizes bare domains to https URLs", () => {
    expect(safeExternalUrl("google.com")).toBe("https://google.com/");
    expect(safeExternalUrl("docs.google.com/spreadsheets/d/abc")).toBe(
      "https://docs.google.com/spreadsheets/d/abc",
    );
  });

  it("rejects non-web protocols", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
  });
});
