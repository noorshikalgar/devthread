// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App, { TaskHeader } from "./App";
import type { Task } from "./lib/types";
import { renderWithProviders as render } from "./test-utils";

vi.mock("./lib/api", () => ({
  api: {
    listTasks: vi.fn(),
    listFolders: vi.fn(),
    listEntries: vi.fn(),
    listAttachments: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    listRevisions: vi.fn(),
    restoreRevision: vi.fn(),
    trashEntry: vi.fn(),
    restoreEntry: vi.fn(),
    createFolder: vi.fn(),
    renameFolder: vi.fn(),
    moveTask: vi.fn(),
    deleteTask: vi.fn(),
    createAttachment: vi.fn(),
    fetchLinkPreview: vi.fn(),
  },
}));

import { api } from "./lib/api";

const task: Task = {
  id: "task-a",
  title: "Keep context",
  descriptionMarkdown: "",
  status: "active",
  nextStep: null,
  folderId: null,
  createdAt: "2026-06-05T00:00:00Z",
  updatedAt: "2026-06-05T00:00:00Z",
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = "";
  vi.clearAllMocks();
});

function mockAppApi() {
  vi.mocked(api.listTasks).mockResolvedValue([task]);
  vi.mocked(api.listFolders).mockResolvedValue([]);
  vi.mocked(api.listEntries).mockResolvedValue([]);
  vi.mocked(api.listAttachments).mockResolvedValue([]);
}

describe("TaskHeader", () => {
  it("persists a next step when the field loses focus", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    render(<TaskHeader entriesLoaded={0} onUpdate={update} task={task} />);

    const field = screen.getByLabelText("Next");
    fireEvent.change(field, {
      target: { value: "Verify restart persistence" },
    });
    fireEvent.blur(field);

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        ...task,
        nextStep: "Verify restart persistence",
      }),
    );
  });

  it("supports inline title editing by clicking the title and pressing Enter", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    render(<TaskHeader entriesLoaded={0} onUpdate={update} task={task} />);

    fireEvent.click(screen.getByLabelText("Edit task title"));
    const titleField = screen.getByLabelText("Task title") as HTMLInputElement;
    fireEvent.change(titleField, { target: { value: "Refined heading" } });
    fireEvent.keyDown(titleField, { key: "Enter" });

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        ...task,
        title: "Refined heading",
      }),
    );
  });

  it("cancels inline title editing with Escape without saving", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    render(<TaskHeader entriesLoaded={0} onUpdate={update} task={task} />);

    fireEvent.click(screen.getByLabelText("Edit task title"));
    const titleField = screen.getByLabelText("Task title") as HTMLInputElement;
    fireEvent.change(titleField, { target: { value: "Throwaway draft" } });
    fireEvent.keyDown(titleField, { key: "Escape" });

    expect(update).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Task title")).not.toBeInTheDocument();
  });

  it("shows task metadata as compact header chips", () => {
    render(<TaskHeader entriesLoaded={6} onUpdate={vi.fn()} task={task} />);

    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
    expect(screen.getByText("Updates")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("keeps only functional task header actions", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    render(<TaskHeader entriesLoaded={0} onUpdate={update} task={task} />);

    expect(screen.queryByLabelText("More actions")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Pause work session"));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ ...task, status: "paused" }),
    );
  });

  it("hides the work-session quick action for done tasks", () => {
    render(
      <TaskHeader
        entriesLoaded={0}
        onUpdate={vi.fn()}
        task={{ ...task, status: "done" }}
      />,
    );

    expect(
      screen.queryByLabelText("Start work session"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Pause work session"),
    ).not.toBeInTheDocument();
  });

  it("closes the status picker after selecting a status", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    render(<TaskHeader entriesLoaded={0} onUpdate={update} task={task} />);

    fireEvent.click(screen.getByLabelText("Status: Active. Click to change."));
    expect(screen.getByText("Done")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Done"));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ ...task, status: "done" }),
    );
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });

  it("resizes the sidebar with a bounded drag handle and resets on double click", async () => {
    mockAppApi();
    render(<App />);

    const handle = await screen.findByLabelText("Resize task sidebar");
    const shell = handle.parentElement;
    expect(shell).toHaveStyle({ width: "280px" });

    fireEvent.mouseDown(handle, { clientX: 280 });
    fireEvent.mouseMove(window, { clientX: 1200 });
    fireEvent.mouseUp(window);

    expect(shell).toHaveStyle({ width: "420px" });
    expect(localStorage.getItem("devthread:sidebar-width")).toBe("420");

    fireEvent.doubleClick(handle);
    expect(shell).toHaveStyle({ width: "280px" });
  });

  it("toggles the task sidebar from the app rail", async () => {
    mockAppApi();
    render(<App />);

    fireEvent.click(await screen.findByLabelText("Hide task sidebar"));

    expect(
      screen.queryByLabelText("Resize task sidebar"),
    ).not.toBeInTheDocument();
    const open = screen.getByLabelText("Show task sidebar");
    expect(open).toBeInTheDocument();

    fireEvent.click(open);

    expect(
      await screen.findByLabelText("Hide task sidebar"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Resize task sidebar")).toBeInTheDocument();
  });

  it("opens settings from the app rail and changes theme", async () => {
    mockAppApi();
    Element.prototype.scrollIntoView = vi.fn();
    render(<App />);

    fireEvent.click(screen.getByLabelText("Open settings"));
    fireEvent.click(screen.getByRole("combobox", { name: "Theme" }));
    fireEvent.click(await screen.findByText("Tokyo Night Light"));

    expect(localStorage.getItem("devthread:theme")).toBe("tokyo-night-light");
    expect(document.documentElement).toHaveClass("theme-tokyo-night-light");
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
