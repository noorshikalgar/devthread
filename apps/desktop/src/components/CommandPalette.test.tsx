// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";
import { renderWithProviders as render } from "../test-utils";
import type { Folder as FolderModel, Task, WorkLogEntry } from "@/lib/types";

afterEach(cleanup);

const folders: FolderModel[] = [
  {
    id: "f-1",
    name: "Backlog",
    releaseName: null,
    createdAt: "",
    updatedAt: "",
  },
  { id: "f-2", name: "Bugs", releaseName: null, createdAt: "", updatedAt: "" },
];

const tasks: Task[] = [
  {
    id: "t-1",
    title: "Ship dark mode",
    descriptionMarkdown: "",
    status: "active",
    nextStep: "Review palette",
    estimatedMinutes: null,
    folderId: "f-1",
    releaseName: null,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "t-2",
    title: "Investigate flaky test",
    descriptionMarkdown: "",
    status: "planned",
    nextStep: null,
    estimatedMinutes: null,
    folderId: "f-2",
    releaseName: null,
    createdAt: "",
    updatedAt: "",
  },
];

const entries: WorkLogEntry[] = [
  {
    id: "e-1",
    taskId: "t-1",
    entryType: "progress",
    contentMarkdown: "Rolled out the dark mode toggle",
    visibility: "private",
    occurredAt: "",
    createdAt: "",
    updatedAt: "",
    durationMinutes: null,
  },
  {
    id: "e-2",
    taskId: "t-2",
    entryType: "blocker",
    contentMarkdown: "CI fails on macOS runners",
    visibility: "private",
    occurredAt: "",
    createdAt: "",
    updatedAt: "",
    durationMinutes: null,
  },
];

describe("CommandPalette", () => {
  it("renders task, folder, and entry results for a query", () => {
    const onSelectTask = vi.fn();
    const onSelectFolder = vi.fn();
    const onSelectEntry = vi.fn();
    render(
      <CommandPalette
        entries={entries}
        folders={folders}
        onOpenChange={() => {}}
        onSelectEntry={onSelectEntry}
        onSelectFolder={onSelectFolder}
        onSelectTask={onSelectTask}
        open
        tasks={tasks}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Search tasks/), {
      target: { value: "dark" },
    });

    expect(screen.getByText("Ship dark mode")).toBeInTheDocument();
    expect(
      screen.getByText("Rolled out the dark mode toggle"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Backlog")).not.toBeInTheDocument();
  });

  it("invokes onSelectTask with the chosen task id", () => {
    const onSelectTask = vi.fn();
    render(
      <CommandPalette
        entries={entries}
        folders={folders}
        onOpenChange={() => {}}
        onSelectEntry={() => {}}
        onSelectFolder={() => {}}
        onSelectTask={onSelectTask}
        open
        tasks={tasks}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Search tasks/), {
      target: { value: "flaky" },
    });
    fireEvent.click(screen.getByText("Investigate flaky test"));

    expect(onSelectTask).toHaveBeenCalledWith("t-2");
  });

  it("shows folders when the query matches the folder name", () => {
    render(
      <CommandPalette
        entries={entries}
        folders={folders}
        onOpenChange={() => {}}
        onSelectEntry={() => {}}
        onSelectFolder={() => {}}
        onSelectTask={() => {}}
        open
        tasks={tasks}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Search tasks/), {
      target: { value: "bugs" },
    });

    expect(screen.getByText("Bugs")).toBeInTheDocument();
    expect(screen.queryByText("Backlog")).not.toBeInTheDocument();
  });

  it("supports regex matching from the command palette", () => {
    render(
      <CommandPalette
        entries={entries}
        folders={folders}
        onOpenChange={() => {}}
        onSelectEntry={() => {}}
        onSelectFolder={() => {}}
        onSelectTask={() => {}}
        open
        tasks={tasks}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /regular expression/i }),
    );
    fireEvent.change(screen.getByPlaceholderText(/Search tasks/), {
      target: { value: "Ship.*mode" },
    });

    expect(screen.getByText("Ship dark mode")).toBeInTheDocument();
    expect(
      screen.queryByText("Investigate flaky test"),
    ).not.toBeInTheDocument();
  });

  it("scrolls the active result into view during keyboard navigation", async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const manyTasks: Task[] = Array.from({ length: 20 }, (_, index) => ({
      ...tasks[0],
      id: `scroll-${index}`,
      title: `Scroll target ${index}`,
    }));

    try {
      render(
        <CommandPalette
          entries={[]}
          folders={[]}
          onOpenChange={() => {}}
          onSelectEntry={() => {}}
          onSelectFolder={() => {}}
          onSelectTask={() => {}}
          open
          tasks={manyTasks}
        />,
      );

      const input = screen.getByPlaceholderText(/Search tasks/);
      fireEvent.change(input, { target: { value: "scroll" } });
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
      scrollIntoView.mockClear();

      fireEvent.keyDown(input, { key: "ArrowDown" });

      await waitFor(() =>
        expect(scrollIntoView).toHaveBeenCalledWith({
          block: "nearest",
          inline: "nearest",
        }),
      );
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      });
    }
  });
});
