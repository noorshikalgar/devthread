// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskSidebar } from "./TaskSidebar";
import type { Folder, Task } from "@/lib/types";
import { renderWithProviders as render } from "../test-utils";

const baseTask: Task = {
  id: "task-1",
  title: "Refine sidebar",
  descriptionMarkdown: "",
  status: "active",
  nextStep: null,
  estimatedMinutes: null,
  folderId: null,
  createdAt: "2026-06-05T00:00:00Z",
  updatedAt: "2026-06-05T00:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TaskSidebar", () => {
  it("creates a new task immediately when the new task button is pressed", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskSidebar
        folders={[]}
        onCreate={create}
        onCreateFolder={vi.fn()}
        onCopyFolder={vi.fn()}
        onDeleteTask={vi.fn()}
        onDeleteFolder={vi.fn()}
        onMoveTask={vi.fn()}
        onRenameFolder={vi.fn()}
        onSelect={() => undefined}
        selectedId={null}
        tasks={[]}
      />,
    );

    fireEvent.click(screen.getByLabelText("New task"));

    await waitFor(() => expect(create).toHaveBeenCalledOnce());
  });

  it("asks for a folder name before creating a folder", async () => {
    const createFolder = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskSidebar
        folders={[]}
        onCreate={vi.fn()}
        onCreateFolder={createFolder}
        onCopyFolder={vi.fn()}
        onDeleteTask={vi.fn()}
        onDeleteFolder={vi.fn()}
        onMoveTask={vi.fn()}
        onRenameFolder={vi.fn()}
        onSelect={() => undefined}
        selectedId={null}
        tasks={[]}
      />,
    );

    fireEvent.click(screen.getByLabelText("New folder"));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Frontend polish" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(createFolder).toHaveBeenCalledWith("Frontend polish"),
    );
  });

  it("groups tasks under their folder and falls back to ungrouped", () => {
    const folders: Folder[] = [
      {
        id: "folder-a",
        name: "In progress with a very long folder name",
        createdAt: "2026-06-05T00:00:00Z",
        updatedAt: "2026-06-05T00:00:00Z",
      },
    ];
    const tasks: Task[] = [
      {
        ...baseTask,
        id: "t-1",
        title: "Grouped task with a very long readable title",
        folderId: "folder-a",
        status: "planned",
      },
      { ...baseTask, id: "t-2", title: "Loose", status: "planned" },
    ];

    render(
      <TaskSidebar
        folders={folders}
        onCreate={vi.fn()}
        onCreateFolder={vi.fn()}
        onCopyFolder={vi.fn()}
        onDeleteTask={vi.fn()}
        onDeleteFolder={vi.fn()}
        onMoveTask={vi.fn()}
        onRenameFolder={vi.fn()}
        onSelect={() => undefined}
        selectedId={null}
        tasks={tasks}
      />,
    );

    expect(
      screen.getAllByText("In progress with a very long folder name"),
    ).toHaveLength(1);
    expect(
      screen.getByRole("button", {
        name: /In progress with a very long folder name/,
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText("Grouped task with a very long readable title"),
    ).toHaveClass("truncate");
    expect(screen.getByText("Loose")).toBeInTheDocument();
  });

  it("collapses and expands a folder without selecting a task", () => {
    const select = vi.fn();
    const folders: Folder[] = [
      {
        id: "folder-a",
        name: "UI",
        createdAt: "2026-06-05T00:00:00Z",
        updatedAt: "2026-06-05T00:00:00Z",
      },
    ];

    render(
      <TaskSidebar
        folders={folders}
        onCreate={vi.fn()}
        onCreateFolder={vi.fn()}
        onCopyFolder={vi.fn()}
        onDeleteTask={vi.fn()}
        onDeleteFolder={vi.fn()}
        onMoveTask={vi.fn()}
        onRenameFolder={vi.fn()}
        onSelect={select}
        selectedId={null}
        tasks={[
          {
            ...baseTask,
            id: "t-1",
            title: "Testing the UI",
            folderId: "folder-a",
            status: "planned",
          },
        ]}
      />,
    );

    const folder = screen
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-expanded") === "true");
    expect(folder).toBeDefined();
    if (!folder) return;

    fireEvent.click(folder);

    expect(folder).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Testing the UI")).not.toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();

    fireEvent.click(folder);
    expect(folder).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Testing the UI")).toBeInTheDocument();
  });

  it("renames folders from the folder context menu", async () => {
    const renameFolder = vi.fn().mockResolvedValue(undefined);
    const folders: Folder[] = [
      {
        id: "folder-a",
        name: "Backlog",
        createdAt: "2026-06-05T00:00:00Z",
        updatedAt: "2026-06-05T00:00:00Z",
      },
    ];

    render(
      <TaskSidebar
        folders={folders}
        onCreate={vi.fn()}
        onCreateFolder={vi.fn()}
        onCopyFolder={vi.fn()}
        onDeleteTask={vi.fn()}
        onDeleteFolder={vi.fn()}
        onMoveTask={vi.fn()}
        onRenameFolder={renameFolder}
        onSelect={() => undefined}
        selectedId={null}
        tasks={[]}
      />,
    );

    fireEvent.contextMenu(screen.getByText("Backlog"));
    fireEvent.click(screen.getByText("Rename folder"));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Product polish" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() =>
      expect(renameFolder).toHaveBeenCalledWith("folder-a", "Product polish"),
    );
  });

  it("creates a task directly in a folder from the folder context menu", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const folders: Folder[] = [
      {
        id: "folder-a",
        name: "Backlog",
        createdAt: "2026-06-05T00:00:00Z",
        updatedAt: "2026-06-05T00:00:00Z",
      },
    ];

    render(
      <TaskSidebar
        folders={folders}
        onCreate={create}
        onCreateFolder={vi.fn()}
        onCopyFolder={vi.fn()}
        onDeleteTask={vi.fn()}
        onDeleteFolder={vi.fn()}
        onMoveTask={vi.fn()}
        onRenameFolder={vi.fn()}
        onSelect={() => undefined}
        selectedId={null}
        tasks={[]}
      />,
    );

    fireEvent.contextMenu(screen.getByText("Backlog"));
    fireEvent.click(screen.getByText("New task in folder"));

    await waitFor(() => expect(create).toHaveBeenCalledWith("folder-a"));
  });

  it("copies a task summary from the task context menu", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <TaskSidebar
        folders={[]}
        onCreate={vi.fn()}
        onCreateFolder={vi.fn()}
        onCopyFolder={vi.fn()}
        onDeleteTask={vi.fn()}
        onDeleteFolder={vi.fn()}
        onMoveTask={vi.fn()}
        onRenameFolder={vi.fn()}
        onSelect={() => undefined}
        selectedId={null}
        tasks={[{ ...baseTask, estimatedMinutes: 120, status: "planned" }]}
      />,
    );

    fireEvent.contextMenu(screen.getByText("Refine sidebar"));
    fireEvent.click(screen.getByText("Copy summary"));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        ["**Status:** Planned", "**Estimate:** 2h"].join("\n"),
      ),
    );
  });

  it("copies the folder as Markdown or CSV from the folder context menu", async () => {
    const onCopyFolder = vi.fn();
    const folders: Folder[] = [
      {
        id: "folder-a",
        name: "Backlog",
        createdAt: "2026-06-05T00:00:00Z",
        updatedAt: "2026-06-05T00:00:00Z",
      },
    ];
    const tasks = [
      {
        ...baseTask,
        id: "t-1",
        title: "Refine sidebar",
        folderId: "folder-a",
        status: "planned" as const,
        estimatedMinutes: 120,
      },
    ];

    render(
      <TaskSidebar
        folders={folders}
        onCreate={vi.fn()}
        onCreateFolder={vi.fn()}
        onCopyFolder={onCopyFolder}
        onDeleteTask={vi.fn()}
        onDeleteFolder={vi.fn()}
        onMoveTask={vi.fn()}
        onRenameFolder={vi.fn()}
        onSelect={() => undefined}
        selectedId={null}
        tasks={tasks}
      />,
    );

    fireEvent.contextMenu(screen.getByText("Backlog"));
    fireEvent.click(screen.getByText("Copy"));
    fireEvent.click(screen.getByText("Copy as Markdown"));
    expect(onCopyFolder).toHaveBeenLastCalledWith(folders[0], "markdown");

    fireEvent.contextMenu(screen.getByText("Backlog"));
    fireEvent.click(screen.getByText("Copy"));
    fireEvent.click(screen.getByText("Copy as CSV"));
    expect(onCopyFolder).toHaveBeenLastCalledWith(folders[0], "csv");
  });
});
