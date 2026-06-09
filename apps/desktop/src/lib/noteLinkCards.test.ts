import { describe, expect, it } from "vitest";
import { createElement, type ReactNode } from "react";
import { findBareLinkInParagraph } from "./noteLinkCards";

function anchor(href: string, text: string): ReactNode {
  return createElement("a", { href }, text);
}

function paragraph(children: ReactNode): ReactNode {
  return createElement("p", null, children);
}

describe("findBareLinkInParagraph", () => {
  it("matches a single bare-URL paragraph", () => {
    const result = findBareLinkInParagraph(
      anchor("https://example.com/page", "https://example.com/page"),
    );
    expect(result).not.toBeNull();
    expect(result?.link.url).toBe("https://example.com/page");
    expect(result?.link.host).toBe("example.com");
    expect(result?.link.path).toBe("/page");
    expect(result?.link.label).toBe("page");
  });

  it("strips trailing punctuation from the URL", () => {
    const result = findBareLinkInParagraph(
      anchor("https://example.com/page.", "https://example.com/page."),
    );
    expect(result).not.toBeNull();
    expect(result?.link.url).toBe("https://example.com/page");
  });

  it("derives a host when the URL has no path", () => {
    const result = findBareLinkInParagraph(
      anchor("https://example.com", "https://example.com"),
    );
    expect(result?.link.host).toBe("example.com");
    expect(result?.link.path).toBe("");
    expect(result?.link.label).toBe("example.com");
  });

  it("strips www. prefix from the host", () => {
    const result = findBareLinkInParagraph(
      anchor("https://www.example.com/post", "https://www.example.com/post"),
    );
    expect(result?.link.host).toBe("example.com");
  });

  it("rejects a paragraph with text + link", () => {
    const match = findBareLinkInParagraph([
      "Read more at ",
      anchor("https://example.com", "example.com"),
    ]);
    expect(match).toBeNull();
  });

  it("rejects a paragraph with two links", () => {
    const match = findBareLinkInParagraph([
      anchor("https://a.example.com", "https://a.example.com"),
      anchor("https://b.example.com", "https://b.example.com"),
    ]);
    expect(match).toBeNull();
  });

  it("rejects a link whose text differs from the href", () => {
    const match = findBareLinkInParagraph(
      anchor("https://example.com", "click here"),
    );
    expect(match).toBeNull();
  });

  it("ignores empty and whitespace children", () => {
    const match = findBareLinkInParagraph([
      "",
      "   ",
      anchor("https://example.com", "https://example.com"),
    ]);
    expect(match).not.toBeNull();
    expect(match?.link.url).toBe("https://example.com");
  });

  it("returns null for non-http URLs", () => {
    const match = findBareLinkInParagraph(
      anchor("javascript:alert(1)", "javascript:alert(1)"),
    );
    expect(match).toBeNull();
  });

  it("replaces dashes and underscores with spaces in the label", () => {
    const match = findBareLinkInParagraph(
      anchor(
        "https://example.com/some_post-name",
        "https://example.com/some_post-name",
      ),
    );
    expect(match?.link.label).toBe("some post name");
  });
});

describe("paragraph shape helper", () => {
  it("returns a paragraph node containing the link", () => {
    const node = paragraph(
      anchor("https://example.com", "https://example.com"),
    );
    expect(node).toBeTruthy();
  });
});
