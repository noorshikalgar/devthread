import { describe, expect, it } from "vitest";
import { quickLinkDraftFromUrl } from "./quickLinks";

describe("quick links", () => {
  it("normalizes bare URLs and detects common task resource providers", () => {
    expect(quickLinkDraftFromUrl("figma.com/file/demo")?.provider).toBe(
      "figma",
    );
    expect(
      quickLinkDraftFromUrl("https://team.atlassian.net/browse/DES-242")
        ?.provider,
    ).toBe("jira");
    expect(
      quickLinkDraftFromUrl("https://team.atlassian.net/wiki/spaces/UX")
        ?.provider,
    ).toBe("confluence");
    expect(
      quickLinkDraftFromUrl("https://docs.google.com/spreadsheets/d/demo")
        ?.provider,
    ).toBe("sheet");
  });

  it("uses fetched metadata title and final URL when available", () => {
    const draft = quickLinkDraftFromUrl("https://short.test/a", {
      url: "https://github.com/noorshikalgar/taskline",
      title: "Taskline repo",
      description: null,
      imageUrl: null,
      siteName: "GitHub",
    });

    expect(draft).toMatchObject({
      domain: "github.com",
      provider: "github",
      title: "Taskline repo",
      url: "https://github.com/noorshikalgar/taskline",
    });
  });
});
