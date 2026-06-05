// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkLogEntry } from "../lib/types";
import { Timeline } from "./Timeline";
import { renderWithProviders as render } from "../test-utils";

vi.mock("@/lib/api", () => ({
  api: {
    fetchLinkPreview: vi.fn().mockResolvedValue({
      url: "https://github.com/example/taskline/issues/42",
      title: "Issue 42",
      description: "Preview description",
      imageUrl: "https://github.com/preview.png",
      siteName: "GitHub",
    }),
  },
}));

const entry: WorkLogEntry = {
  id: "entry-a",
  taskId: "task-a",
  entryType: "finding",
  contentMarkdown: `## Finding

This is **important**. Review https://github.com/example/taskline/issues/42.

${"Long context. ".repeat(80)}`,
  visibility: "private",
  occurredAt: "2026-06-05T00:00:00Z",
  createdAt: "2026-06-05T00:00:00Z",
  updatedAt: "2026-06-05T00:00:00Z",
};

afterEach(cleanup);

describe("Timeline", () => {
  it("renders Markdown, link previews, images, and inline long-entry expansion", async () => {
    const { container } = render(
      <Timeline
        attachments={[]}
        entries={[entry]}
        hasMore={false}
        historyEntryId={null}
        onEdit={vi.fn()}
        onHistory={vi.fn()}
        onLoadMore={vi.fn()}
        onRestoreRevision={vi.fn()}
        onTrash={vi.fn()}
        revisions={[]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Finding" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("github.com").length).toBeGreaterThan(0);
    expect(await screen.findByText("Issue 42")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://github.com/preview.png",
    );
    const showMore = screen.getByText("Show more");
    fireEvent.click(showMore);
    expect(screen.getByText("Show less")).toBeInTheDocument();
  });
});
