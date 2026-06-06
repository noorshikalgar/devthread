// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App, { TaskHeader } from "./App";
import type { Task, TaskQuickLink } from "./lib/types";
import { renderWithProviders as render } from "./test-utils";

vi.mock("./lib/api", () => ({
  api: {
    listTasks: vi.fn(),
    listFolders: vi.fn(),
    listEntries: vi.fn(),
    listAttachments: vi.fn(),
    listQuickLinks: vi.fn(),
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
    createQuickLink: vi.fn(),
    updateQuickLink: vi.fn(),
    deleteQuickLink: vi.fn(),
    fetchLinkPreview: vi.fn(),
  },
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn().mockResolvedValue(null),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn().mockResolvedValue(undefined),
}));

import { api } from "./lib/api";

const task: Task = {
  id: "task-a",
  title: "Keep context",
  descriptionMarkdown: "",
  status: "active",
  nextStep: null,
  estimatedMinutes: null,
  folderId: null,
  createdAt: "2026-06-05T00:00:00Z",
  updatedAt: "2026-06-05T00:00:00Z",
};

const quickLink: TaskQuickLink = {
  id: "quick-link-a",
  taskId: "task-a",
  url: "https://figma.com/file/devthread",
  title: "DevThread flow",
  domain: "figma.com",
  provider: "figma",
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
  vi.mocked(api.listQuickLinks).mockResolvedValue([]);
}

describe("TaskHeader", () => {
  it("keeps the next step field hidden from the task header", () => {
    render(
      <TaskHeader
        entriesLoaded={0}
        onLogTime={vi.fn()}
        onUpdate={vi.fn()}
        task={task}
        totalMinutes={0}
      />,
    );

    expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
    expect(screen.getByText("Worklog")).toBeInTheDocument();
  });

  it("supports inline title editing by clicking the title and pressing Enter", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskHeader
        entriesLoaded={0}
        onLogTime={vi.fn()}
        onUpdate={update}
        task={task}
        totalMinutes={0}
      />,
    );

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
    render(
      <TaskHeader
        entriesLoaded={0}
        onLogTime={vi.fn()}
        onUpdate={update}
        task={task}
        totalMinutes={0}
      />,
    );

    fireEvent.click(screen.getByLabelText("Edit task title"));
    const titleField = screen.getByLabelText("Task title") as HTMLInputElement;
    fireEvent.change(titleField, { target: { value: "Throwaway draft" } });
    fireEvent.keyDown(titleField, { key: "Escape" });

    expect(update).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Task title")).not.toBeInTheDocument();
  });

  it("shows task metadata as compact header chips", () => {
    render(
      <TaskHeader
        entriesLoaded={6}
        onLogTime={vi.fn()}
        onUpdate={vi.fn()}
        task={task}
        totalMinutes={0}
      />,
    );

    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
    expect(screen.getByText("Updates")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("keeps only functional task header actions", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskHeader
        entriesLoaded={0}
        onLogTime={vi.fn()}
        onUpdate={update}
        task={task}
        totalMinutes={0}
      />,
    );

    expect(screen.queryByLabelText("More actions")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Pause work session"));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ ...task, status: "paused" }),
    );
  });

  it("shows a time chip and a 'Log time' button in the task header", async () => {
    render(
      <TaskHeader
        entriesLoaded={2}
        onLogTime={vi.fn()}
        onUpdate={vi.fn()}
        task={task}
        totalMinutes={11 * 60 + 15}
      />,
    );

    expect(screen.getByText("1d 3h 15m")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Log time" }));
    expect(
      await screen.findByRole("dialog", { name: /Log time/i }),
    ).toBeInTheDocument();
  });

  it("places the compact timeline control in the task header", () => {
    const onCompactTimelineChange = vi.fn();
    render(
      <TaskHeader
        compactTimeline={false}
        entriesLoaded={2}
        onCompactTimelineChange={onCompactTimelineChange}
        onLogTime={vi.fn()}
        onUpdate={vi.fn()}
        task={task}
        totalMinutes={120}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Show compact timeline" }),
    );
    expect(onCompactTimelineChange).toHaveBeenCalledWith(true);
  });

  it("copies a task summary and shows quick links in the task header", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <TaskHeader
        entriesLoaded={5}
        onCreateQuickLink={vi.fn()}
        onDeleteQuickLink={vi.fn()}
        onLogTime={vi.fn()}
        onUpdate={vi.fn()}
        quickLinks={[quickLink]}
        task={{ ...task, estimatedMinutes: 480 }}
        totalMinutes={120}
      />,
    );

    fireEvent.click(screen.getByLabelText("Copy task summary"));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        [
          "Keep context",
          "Status: Active",
          "Estimate: 1d",
          "Logged: 2h",
          "Updates: 5",
        ].join("\n"),
      ),
    );

    expect(
      screen.getByLabelText("Open quick link: DevThread flow"),
    ).toBeInTheDocument();
  });

  it("exposes copy summary as an icon button and edits quick links from their menu", async () => {
    const updateQuickLink = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskHeader
        entriesLoaded={5}
        onCreateQuickLink={vi.fn()}
        onDeleteQuickLink={vi.fn()}
        onLogTime={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateQuickLink={updateQuickLink}
        quickLinks={[quickLink]}
        task={task}
        totalMinutes={120}
      />,
    );

    expect(screen.getByLabelText("Copy task summary")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Open quick link: DevThread flow"));
    fireEvent.click(await screen.findByText("Edit"));
    fireEvent.change(screen.getByLabelText("Link"), {
      target: { value: "https://docs.google.com/document/d/demo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save link" }));

    await waitFor(() =>
      expect(updateQuickLink).toHaveBeenCalledWith(
        "quick-link-a",
        "https://docs.google.com/document/d/demo",
      ),
    );
  });

  it("hides the work-session quick action for done tasks", () => {
    render(
      <TaskHeader
        entriesLoaded={0}
        onLogTime={vi.fn()}
        onUpdate={vi.fn()}
        task={{ ...task, status: "done" }}
        totalMinutes={0}
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
    render(
      <TaskHeader
        entriesLoaded={0}
        onLogTime={vi.fn()}
        onUpdate={update}
        task={task}
        totalMinutes={0}
      />,
    );

    fireEvent.click(screen.getByLabelText("Status: Active. Click to change."));
    expect(screen.getByText("Done")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Done"));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ ...task, status: "done" }),
    );
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });

  it("uses the status-change callback when present", async () => {
    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskHeader
        entriesLoaded={0}
        onLogTime={vi.fn()}
        onStatusChange={onStatusChange}
        onUpdate={vi.fn()}
        task={task}
        totalMinutes={0}
      />,
    );

    fireEvent.click(screen.getByLabelText("Status: Active. Click to change."));
    fireEvent.click(screen.getByText("Done"));

    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith("done"));
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
  });

  it("persists theme preference when changing it from settings", async () => {
    localStorage.setItem("devthread:theme", "zed-dark");
    render(<App />);

    expect(document.documentElement).toHaveClass("theme-zed-dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("theme-tokyo-night-dark");
    expect(document.documentElement).not.toHaveClass("theme-default-dark");

    fireEvent.click(screen.getByLabelText("Open settings"));
    fireEvent.click(screen.getByRole("combobox", { name: "Theme" }));
    fireEvent.click(await screen.findByText("Default Dark"));

    expect(localStorage.getItem("devthread:theme")).toBe("default-dark");
    const root = document.documentElement;
    expect(root).toHaveClass("theme-default-dark");
    expect(root).toHaveClass("dark");
    for (const stale of [
      "theme-zed-dark",
      "theme-zed-light",
      "theme-tokyo-night-dark",
      "theme-tokyo-night-light",
      "theme-default-light",
    ]) {
      expect(root).not.toHaveClass(stale);
    }
  });

  it("logs task status changes into the timeline", async () => {
    mockAppApi();
    vi.mocked(api.updateTask).mockResolvedValue({ ...task, status: "done" });
    vi.mocked(api.createEntry).mockResolvedValue({
      id: "status-entry",
      taskId: task.id,
      entryType: "status",
      contentMarkdown: "Status changed from Active to Done.",
      visibility: "private",
      occurredAt: "2026-06-05T00:00:00Z",
      createdAt: "2026-06-05T00:00:00Z",
      updatedAt: "2026-06-05T00:00:00Z",
      durationMinutes: null,
    });
    render(<App />);

    fireEvent.click(
      await screen.findByLabelText("Status: Active. Click to change."),
    );
    fireEvent.click(screen.getByText("Done"));

    await waitFor(() =>
      expect(api.createEntry).toHaveBeenCalledWith(
        task.id,
        "status",
        "Status changed from Active to Done.",
        "private",
      ),
    );
    expect((await screen.findAllByText("Status")).length).toBeGreaterThan(1);
    expect(
      screen.getByText("Status changed from Active to Done."),
    ).toBeInTheDocument();
  });

  it("shows a minimal workspace status bar", async () => {
    mockAppApi();
    render(<App />);

    expect(await screen.findByText("Local-first")).toBeInTheDocument();
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
    expect(screen.getByText("Active 1")).toBeInTheDocument();
    expect(screen.getByText("Todo 0")).toBeInTheDocument();
    expect(screen.getByText("Done 0")).toBeInTheDocument();
  });

  it("filters the timeline by entry type, including the new Worklog filter", async () => {
    vi.mocked(api.listTasks).mockResolvedValue([task]);
    vi.mocked(api.listFolders).mockResolvedValue([]);
    vi.mocked(api.listEntries).mockResolvedValue([
      {
        id: "e-note",
        taskId: task.id,
        entryType: "note",
        contentMarkdown: "A regular note",
        visibility: "private",
        occurredAt: "2026-06-05T10:00:00Z",
        createdAt: "2026-06-05T10:00:00Z",
        updatedAt: "2026-06-05T10:00:00Z",
        durationMinutes: null,
      },
      {
        id: "e-worklog",
        taskId: task.id,
        entryType: "worklog",
        contentMarkdown: "Logged 1d 3h on the sidebar.",
        visibility: "private",
        occurredAt: "2026-06-05T11:00:00Z",
        createdAt: "2026-06-05T11:00:00Z",
        updatedAt: "2026-06-05T11:00:00Z",
        durationMinutes: 8 * 60 + 3 * 60,
      },
      {
        id: "e-progress",
        taskId: task.id,
        entryType: "progress",
        contentMarkdown: "Filter shipped.",
        visibility: "private",
        occurredAt: "2026-06-05T12:00:00Z",
        createdAt: "2026-06-05T12:00:00Z",
        updatedAt: "2026-06-05T12:00:00Z",
        durationMinutes: null,
      },
    ]);
    vi.mocked(api.listAttachments).mockResolvedValue([]);
    Element.prototype.scrollIntoView = vi.fn();
    render(<App />);

    await screen.findByText("A regular note");
    expect(
      screen.getByText("Logged 1d 3h on the sidebar."),
    ).toBeInTheDocument();
    expect(screen.getByText("Filter shipped.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Worklog" }));

    await waitFor(() =>
      expect(screen.queryByText("A regular note")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Filter shipped.")).not.toBeInTheDocument();
    expect(
      screen.getByText("Logged 1d 3h on the sidebar."),
    ).toBeInTheDocument();
  });
});
