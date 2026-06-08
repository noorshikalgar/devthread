// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NoteMarkdownView } from "./NoteMarkdownView";

afterEach(cleanup);

describe("NoteMarkdownView", () => {
  it("renders headings, paragraphs, lists, and quotes", () => {
    render(
      <NoteMarkdownView
        attachments={[]}
        source={`# Title

A paragraph with **bold** and _italic_.

- One
- Two

> A quote

\`\`\`ts
const x = 1;
\`\`\`
`}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Title",
    );
    expect(screen.getByText(/A paragraph with/)).toBeInTheDocument();
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("A quote")).toBeInTheDocument();
  });

  it("renders a GFM table", () => {
    render(
      <NoteMarkdownView
        attachments={[]}
        source={`| Name | Value |
| --- | --- |
| foo | 1 |
| bar | 2 |
`}
      />,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.getByText("bar")).toBeInTheDocument();
  });

  it("renders a GFM checkbox list", () => {
    const { container } = render(
      <NoteMarkdownView
        attachments={[]}
        source={`- [x] Done
- [ ] Todo
`}
      />,
    );
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
  });

  it("renders a bare link as a link card", () => {
    const { container } = render(
      <NoteMarkdownView
        attachments={[]}
        source="https://example.com/some-page"
      />,
    );
    const card = container.querySelector(".note-link-card");
    expect(card).not.toBeNull();
    expect(card).toHaveTextContent("example.com");
    expect(card).toHaveTextContent("some page");
  });

  it("renders inline links as anchors, not link cards", () => {
    const { container } = render(
      <NoteMarkdownView
        attachments={[]}
        source="Read [the docs](https://example.com/docs) please."
      />,
    );
    const card = container.querySelector(".note-link-card");
    expect(card).toBeNull();
    const anchor = container.querySelector("a[href*='example.com']");
    expect(anchor).toHaveTextContent("the docs");
  });

  it("renders an empty state for empty input", () => {
    const { container } = render(
      <NoteMarkdownView attachments={[]} source="" />,
    );
    expect(container.querySelector(".markdown")).toBeInTheDocument();
  });
});
