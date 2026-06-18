// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Attachment, WorkLogEntry } from "../lib/types";
import { Timeline } from "./Timeline";
import { renderWithProviders as render } from "../test-utils";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `tauri://localhost/${path}`,
}));

vi.mock("@/lib/api", () => ({
  api: {
    fetchLinkPreview: vi.fn().mockResolvedValue({
      url: "https://github.com/example/devthread/issues/42",
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

This is **important**. Review https://github.com/example/devthread/issues/42.

${"Long context. ".repeat(80)}`,
  visibility: "private",
  occurredAt: "2026-06-05T00:00:00Z",
  createdAt: "2026-06-05T00:00:00Z",
  updatedAt: "2026-06-05T00:00:00Z",
  durationMinutes: null,
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

    expect(screen.getAllByText("Finding").length).toBeGreaterThan(0);
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

  it("opens a full-view dialog with a visible close button and zoom controls", async () => {
    const attachment: Attachment = {
      id: "att-a",
      workLogEntryId: "entry-a",
      originalName: "screenshot.png",
      mediaType: "image/png",
      path: "/tmp/screenshot.png",
      byteSize: 12_345,
      createdAt: "2026-06-05T00:00:00Z",
    };

    render(
      <Timeline
        attachments={[attachment]}
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

    const thumbnail = screen.getByRole("button", {
      name: "View screenshot.png",
    });
    fireEvent.click(thumbnail);

    const dialog = await screen.findByRole("dialog");
    const fullImage = dialog.querySelector("img");
    expect(fullImage).toHaveAttribute(
      "src",
      "tauri://localhost//tmp/screenshot.png",
    );

    const closeButton = screen.getByRole("button", {
      name: "Close image viewer",
    });
    expect(closeButton).toBeInTheDocument();

    expect(screen.getByText("100%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("125%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders a duration chip on entries that have a durationMinutes value", () => {
    const entryWithTime: WorkLogEntry = {
      ...entry,
      id: "entry-timed",
      durationMinutes: 11 * 60 + 15,
    };
    render(
      <Timeline
        attachments={[]}
        entries={[entry, entryWithTime]}
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

    expect(screen.getByLabelText("Time spent 1d 3h 15m")).toBeInTheDocument();
  });

  it("renders timeline rail dates as readable full labels without a year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T12:00:00Z"));

    render(
      <Timeline
        attachments={[]}
        entries={[
          {
            ...entry,
            occurredAt: "2025-11-25T12:00:00Z",
          },
        ]}
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

    expect(screen.getByText(/November 25$/)).toBeInTheDocument();
    expect(screen.queryByText(/2025/)).not.toBeInTheDocument();
  });

  it("toggles to a compact git-log style timeline with image markers", () => {
    const imageOnlyEntry: WorkLogEntry = {
      ...entry,
      id: "entry-image",
      entryType: "note",
      contentMarkdown: "Attached image.",
      durationMinutes: null,
    };
    const attachment: Attachment = {
      id: "att-compact",
      workLogEntryId: "entry-image",
      originalName: "capture.png",
      mediaType: "image/png",
      path: "/tmp/capture.png",
      byteSize: 2048,
      createdAt: "2026-06-05T00:00:00Z",
    };

    render(
      <Timeline
        attachments={[attachment]}
        entries={[entry, imageOnlyEntry]}
        hasMore={false}
        historyEntryId={null}
        onEdit={vi.fn()}
        onHistory={vi.fn()}
        onLoadMore={vi.fn()}
        onRestoreRevision={vi.fn()}
        onTrash={vi.fn()}
        revisions={[]}
        viewMode="compact"
      />,
    );

    expect(screen.queryByText("Private")).not.toBeInTheDocument();
    expect(screen.getByText("[image]")).toBeInTheDocument();
    expect(screen.queryByText("Show more")).not.toBeInTheDocument();

    const imageRow = screen.getByText("[image]").closest("li");
    expect(imageRow).not.toBeNull();
    fireEvent.click(imageRow!);
    expect(
      screen.getByRole("button", { name: "View capture.png" }),
    ).toBeInTheDocument();
  });

  it("pans the image on mouse drag and resets on the reset button", async () => {
    const attachment: Attachment = {
      id: "att-b",
      workLogEntryId: "entry-a",
      originalName: "wide.png",
      mediaType: "image/png",
      path: "/tmp/wide.png",
      byteSize: 4096,
      createdAt: "2026-06-05T00:00:00Z",
    };

    render(
      <Timeline
        attachments={[attachment]}
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

    fireEvent.click(screen.getByRole("button", { name: "View wide.png" }));
    const dialog = await screen.findByRole("dialog");
    const image = dialog.querySelector("img")!;

    expect(image.style.transform).toBe("translate(0px, 0px) scale(1)");

    fireEvent.mouseDown(image, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(image, { button: 0, clientX: 140, clientY: 80 });
    fireEvent.mouseUp(image);
    expect(image.style.transform).toBe("translate(40px, -20px) scale(1)");

    fireEvent.mouseDown(image, { button: 0, clientX: 140, clientY: 80 });
    fireEvent.mouseMove(image, { button: 0, clientX: 90, clientY: 130 });
    fireEvent.mouseUp(window);
    expect(image.style.transform).toBe("translate(-10px, 30px) scale(1)");

    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(image.style.transform).toBe("translate(0px, 0px) scale(1)");
  });
});
