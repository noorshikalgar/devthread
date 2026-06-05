import { describe, expect, it } from "vitest";
import {
  detectMention,
  draftKey,
  parseSlashCommand,
  resolveMentionType,
  resolveMentionsInContent,
  stripMentions,
} from "./composer";

describe("parseSlashCommand", () => {
  it("turns a leading command into an entry type", () => {
    expect(
      parseSlashCommand("/blocker Waiting for API access", "note"),
    ).toEqual({
      entryType: "blocker",
      content: "Waiting for API access",
    });
  });

  it("keeps unknown commands as content", () => {
    expect(parseSlashCommand("/unknown context", "finding")).toEqual({
      entryType: "finding",
      content: "/unknown context",
    });
  });
});

describe("detectMention", () => {
  it("opens suggestions for a bare @ trigger", () => {
    expect(detectMention("@", 1)).toEqual({
      active: true,
      query: "",
      anchor: 0,
    });
  });

  it("detects an @ at the start of input", () => {
    expect(detectMention("@pro", 4)).toEqual({
      active: true,
      query: "pro",
      anchor: 0,
    });
  });

  it("detects an @ after whitespace", () => {
    expect(detectMention("text @prog", 10)).toEqual({
      active: true,
      query: "prog",
      anchor: 5,
    });
  });

  it("ignores an @ inside a word (email-like)", () => {
    expect(detectMention("user@email", 10)).toEqual({
      active: false,
      query: "",
      anchor: -1,
    });
  });

  it("returns the closest @ to the cursor when several appear", () => {
    const text = "first @note and then @find";
    expect(detectMention(text, text.length)).toEqual({
      active: true,
      query: "find",
      anchor: text.lastIndexOf("@"),
    });
  });

  it("closes when the cursor crosses the trailing whitespace", () => {
    expect(detectMention("text @prog rest", 11)).toEqual({
      active: false,
      query: "",
      anchor: -1,
    });
  });
});

describe("resolveMentionType", () => {
  it("maps known aliases to entry types", () => {
    expect(resolveMentionType("progress", "note")).toBe("progress");
    expect(resolveMentionType("findings", "note")).toBe("finding");
    expect(resolveMentionType("next-step", "note")).toBe("next_step");
  });

  it("returns null for unknown aliases", () => {
    expect(resolveMentionType("random", "note")).toBeNull();
  });
});

describe("stripMentions", () => {
  it("strips a leading mention", () => {
    expect(stripMentions("@progress shipped the new filter")).toBe(
      "shipped the new filter",
    );
  });

  it("strips a mention in the middle", () => {
    expect(stripMentions("shipped @progress the new filter")).toBe(
      "shipped the new filter",
    );
  });

  it("strips multiple mentions without producing double spaces", () => {
    expect(stripMentions("@note hello @progress world")).toBe("hello world");
  });

  it("strips a mention at the end", () => {
    expect(stripMentions("almost done @decision").trim()).toBe("almost done");
  });

  it("does not strip email-like @ inside a word", () => {
    expect(stripMentions("ping user@example.com later")).toBe(
      "ping user@example.com later",
    );
  });

  it("does not strip unknown @ aliases", () => {
    expect(stripMentions("hello @random here")).toBe("hello @random here");
  });

  it("strips a hyphenated mention alias", () => {
    expect(stripMentions("todo @next-step write tests")).toBe(
      "todo write tests",
    );
  });
});

describe("draftKey", () => {
  it("keeps drafts isolated by task", () => {
    expect(draftKey("task-a")).not.toEqual(draftKey("task-b"));
  });
});

describe("resolveMentionsInContent", () => {
  it("detects a leading mention and strips it", () => {
    expect(
      resolveMentionsInContent("@progress shipped the new filter", "note"),
    ).toEqual({ type: "progress", cleaned: "shipped the new filter" });
  });

  it("detects an inline mention and strips it", () => {
    expect(
      resolveMentionsInContent("shipped @progress the new filter", "note"),
    ).toEqual({ type: "progress", cleaned: "shipped the new filter" });
  });

  it("returns the fallback when no mention is present", () => {
    expect(resolveMentionsInContent("just a plain update", "finding")).toEqual({
      type: null,
      cleaned: "just a plain update",
    });
  });

  it("ignores email-like and unknown mentions", () => {
    expect(
      resolveMentionsInContent("ping user@example.com about @random", "note"),
    ).toEqual({
      type: null,
      cleaned: "ping user@example.com about @random",
    });
  });

  it("picks the first known mention when several are present", () => {
    expect(
      resolveMentionsInContent("@note first @progress second", "note"),
    ).toEqual({ type: "note", cleaned: "first second" });
  });
});
