// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, { TaskHeader } from "./App";
import type { Task, TaskQuickLink } from "./lib/types";
import { clearTaskDataCache } from "./lib/taskDataCache";
import { clearWorklogCache } from "./lib/worklogCache";
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
  releaseName: null,
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
  // Reset module-level data stores so a prior test's cached task
  // data doesn't bleed into the next test's first load.
  clearTaskDataCache();
  clearWorklogCache();
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
        onLogTime={vi.fn()}
        onUpdate={vi.fn()}
        task={task}
        totalMinutes={0}
      />,
    );

    expect(screen.queryByLabelText("Next")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Log time/ }),
    ).toBeInTheDocument();
  });

  it("supports inline title editing by clicking the title and pressing Enter", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskHeader
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

  it("hides passive metadata chips and exposes them from the overflow menu", async () => {
    render(
      <TaskHeader
        onLogTime={vi.fn()}
        onUpdate={vi.fn()}
        task={task}
        totalMinutes={0}
      />,
    );

    expect(screen.queryByText("Created")).not.toBeInTheDocument();
    expect(screen.queryByText("Updated")).not.toBeInTheDocument();
    expect(screen.queryByText("Updates")).not.toBeInTheDocument();
    expect(screen.queryByText("ID")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("More task actions"));
    // The Copy task ID entry was removed — the overflow menu is now
    // only populated with state-changing actions (archive / delete).
    expect(
      screen.queryByRole("menuitem", { name: /Copy task ID/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps only functional task header actions", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskHeader
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

  it("shows the worklog duration inside the 'Log time' button in the task header", async () => {
    render(
      <TaskHeader
        onLogTime={vi.fn()}
        onUpdate={vi.fn()}
        task={task}
        totalMinutes={11 * 60 + 15}
      />,
    );

    const logTimeButton = screen.getByRole("button", { name: /Log time/ });
    expect(logTimeButton).toBeInTheDocument();
    expect(logTimeButton).toHaveTextContent("1d 3h 15m");
    fireEvent.click(logTimeButton);
    expect(
      await screen.findByRole("dialog", { name: /Log time/i }),
    ).toBeInTheDocument();
  });

  it("places the timeline view control in the task header", () => {
    const onTimelineViewModeChange = vi.fn();
    render(
      <TaskHeader
        onTimelineViewModeChange={onTimelineViewModeChange}
        onLogTime={vi.fn()}
        onUpdate={vi.fn()}
        task={task}
        totalMinutes={120}
      />,
    );

    expect(
      screen.getByRole("group", { name: "Timeline view" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Detailed" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    expect(onTimelineViewModeChange).toHaveBeenCalledWith("compact");
  });

  it("copies a task summary and shows quick links in the task header", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <TaskHeader
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
        "## Task: Keep context\n\n- **Status:** Active\n- **Estimate:** 1d\n- **Logged:** 2h",
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

  it("closes quick link tooltip when the quick link menu opens and closes", async () => {
    render(
      <TaskHeader
        onLogTime={vi.fn()}
        onUpdate={vi.fn()}
        quickLinks={[quickLink]}
        task={task}
        totalMinutes={0}
      />,
    );

    const trigger = screen.getByLabelText("Open quick link: DevThread flow");
    fireEvent.mouseEnter(trigger);
    expect(await screen.findByText("DevThread flow")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(await screen.findByRole("menuitem", { name: /Copy link/ }))
      .toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("DevThread flow")).not.toBeInTheDocument(),
    );

    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: /Copy link/ }))
        .not.toBeInTheDocument(),
    );
    expect(screen.queryByText("DevThread flow")).not.toBeInTheDocument();
  });

  it("hides the work-session quick action for done tasks", () => {
    render(
      <TaskHeader
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

  it("readOnly mode disables log time and estimate without removing them", () => {
    render(
      <TaskHeader
        onLogTime={vi.fn()}
        onUpdate={vi.fn()}
        readOnly
        task={task}
        totalMinutes={45}
      />,
    );
    // The log time and estimate buttons are still visible (showing
    // data is fine) but the click is a no-op — the tooltip changes
    // to "Read-only in archive".
    const logTime = screen.getByLabelText("Log time. 45m logged.");
    expect(logTime).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(logTime);
    // The pause/start work session quick action is hidden in readOnly.
    expect(
      screen.queryByLabelText("Pause work session"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Start work session"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("More task actions")).not.toBeInTheDocument();
  });

  it("readOnly mode replaces the status popover with a static chip", () => {
    render(
      <TaskHeader
        onLogTime={vi.fn()}
        onUpdate={vi.fn()}
        readOnly
        task={task}
        totalMinutes={0}
      />,
    );
    // The interactive status button is gone in readOnly; the static
    // span announces the current status without "Click to change".
    expect(
      screen.queryByLabelText("Status: Active. Click to change."),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Status: Active.")).toBeInTheDocument();
  });

  it("closes the status picker after selecting a status", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskHeader
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

  it("edits the summary template from settings and persists the choice", async () => {
    mockAppApi();
    render(<App />);

    fireEvent.click(screen.getByLabelText("Open settings"));
    fireEvent.click(screen.getByRole("button", { name: "Summary" }));

    const quickLinks = await screen.findByLabelText("Quick links");
    expect(quickLinks).not.toBeChecked();

    fireEvent.click(quickLinks);
    expect(quickLinks).toBeChecked();

    expect(localStorage.getItem("devthread:summary-template")).toContain(
      '"quickLinks":true',
    );
  });

  it("resets the summary template from settings", async () => {
    mockAppApi();
    localStorage.setItem(
      "devthread:summary-template",
      JSON.stringify({
        status: false,
        estimate: false,
        worklog: false,
        worklogEntries: true,
        quickLinks: true,
        createdDate: true,
        updatedDate: true,
      }),
    );
    render(<App />);

    fireEvent.click(screen.getByLabelText("Open settings"));
    fireEvent.click(screen.getByRole("button", { name: "Summary" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Reset to defaults" }),
    );

    const stored = JSON.parse(
      localStorage.getItem("devthread:summary-template") ?? "{}",
    );
    expect(stored).toEqual({
      title: false,
      status: true,
      estimate: true,
      worklog: true,
      worklogEntries: false,
      quickLinks: false,
      createdDate: false,
      updatedDate: false,
    });

    const storedOrder = JSON.parse(
      localStorage.getItem("devthread:summary-template-order") ?? "[]",
    );
    expect(storedOrder).toEqual([
      "title",
      "status",
      "estimate",
      "worklog",
      "worklogEntries",
      "quickLinks",
      "createdDate",
      "updatedDate",
    ]);
  });

  it("edits per-day work hours and break minutes in Settings → General", async () => {
    mockAppApi();
    render(<App />);

    fireEvent.click(screen.getByLabelText("Open settings"));

    const hours = screen.getByLabelText("Hours per day") as HTMLInputElement;
    const breakMinutes = screen.getByLabelText(
      "Break minutes",
    ) as HTMLInputElement;

    expect(hours.value).toBe("8");
    expect(breakMinutes.value).toBe("0");

    fireEvent.change(hours, { target: { value: "7.5" } });
    fireEvent.change(breakMinutes, { target: { value: "30" } });

    await waitFor(() => {
      const stored = JSON.parse(
        localStorage.getItem("devthread:worklog-settings") ?? "{}",
      );
      expect(stored).toMatchObject({
        dailyHours: 7.5,
        breakMinutes: 30,
      });
    });
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
    expect(screen.getByText(`v${__APP_VERSION__}`)).toBeInTheDocument();
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

describe("App workspace mode transitions", () => {
  const activeTask: Task = {
    id: "active-1",
    title: "Active pick",
    descriptionMarkdown: "",
    status: "active",
    nextStep: null,
    estimatedMinutes: null,
    folderId: null,
    releaseName: null,
    createdAt: "2026-06-05T00:00:00Z",
    updatedAt: "2026-06-05T00:00:00Z",
  };
  const archivedTask: Task = {
    ...activeTask,
    id: "archived-1",
    title: "Archived pick",
    status: "archived",
    updatedAt: "2026-06-04T00:00:00Z",
  };

  beforeEach(() => {
    vi.mocked(api.listTasks).mockResolvedValue([activeTask, archivedTask]);
    vi.mocked(api.listFolders).mockResolvedValue([]);
    vi.mocked(api.listEntries).mockResolvedValue([]);
    vi.mocked(api.listAttachments).mockResolvedValue([]);
    vi.mocked(api.listQuickLinks).mockResolvedValue([]);
  });

  it("restores the previous active selection after visiting the archive view", async () => {
    render(<App />);
    // Land in the task view, with the first (active) task selected.
    await waitFor(() =>
      expect(
        screen.getByLabelText("Status: Active. Click to change."),
      ).toBeInTheDocument(),
    );

    // Open the archive view and pick the archived task.
    fireEvent.click(screen.getByLabelText("Open archive"));
    await waitFor(() =>
      expect(
        screen.getByLabelText("Select Archived pick"),
      ).toBeInTheDocument(),
    );
    // Click the row body to open it in the read-only panel
    // (the checkbox is a separate multi-select target). The title
    // appears twice (sidebar + read-only header), so we click the
    // first occurrence in the sidebar nav.
    const archivedTitles = screen.getAllByText("Archived pick");
    fireEvent.click(archivedTitles[0]!);
    // The status chip in the archive view is the static read-only one.
    await waitFor(() =>
      expect(
        screen.getByLabelText("Status: Archived."),
      ).toBeInTheDocument(),
    );

    // Return to the task view — the active task should be re-selected,
    // not the archived one, and the interactive status chip should
    // reappear (no longer the read-only static span).
    fireEvent.click(screen.getByLabelText("Show task sidebar"));
    await waitFor(() =>
      expect(
        screen.getByLabelText("Status: Active. Click to change."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByLabelText("Status: Archived."),
    ).not.toBeInTheDocument();
  });

  it("moves selection off an active-list task after archiving it from task view", async () => {
    const doneTask: Task = {
      ...activeTask,
      id: "done-1",
      title: "Done pick",
      status: "done",
    };
    vi.mocked(api.listTasks).mockResolvedValue([
      doneTask,
      activeTask,
      archivedTask,
    ]);
    vi.mocked(api.updateTask).mockResolvedValue({
      ...doneTask,
      status: "archived",
    });
    vi.mocked(api.createEntry).mockResolvedValue({
      id: "status-entry",
      taskId: doneTask.id,
      entryType: "status",
      contentMarkdown: "Status changed from Done to Archived.",
      visibility: "private",
      occurredAt: "2026-06-05T00:00:00Z",
      createdAt: "2026-06-05T00:00:00Z",
      updatedAt: "2026-06-05T00:00:00Z",
      durationMinutes: null,
    });

    render(<App />);

    await waitFor(() =>
      expect(
        screen.getByLabelText("Status: Done. Click to change."),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByLabelText("More task actions"));
    fireEvent.click(screen.getByRole("menuitem", { name: /Archive task/ }));

    await waitFor(() =>
      expect(
        screen.getByLabelText("Status: Active. Click to change."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByLabelText("Status: Archived. Click to change."),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Status: Archived.")).not.toBeInTheDocument();
  });

  it("hydrates the active task from the per-task cache without re-fetching", async () => {
    // First load: listEntries + listQuickLinks + listAttachments fire.
    render(<App />);
    await waitFor(() =>
      expect(screen.getByLabelText("Status: Active. Click to change."))
        .toBeInTheDocument(),
    );
    expect(api.listEntries).toHaveBeenCalledTimes(1);
    expect(api.listQuickLinks).toHaveBeenCalledTimes(1);
    expect(api.listAttachments).toHaveBeenCalledTimes(1);

    // Visit the archive view, pick the archived task — entries/links
    // get fetched once for the archive task.
    fireEvent.click(screen.getByLabelText("Open archive"));
    await waitFor(() =>
      expect(screen.getByLabelText("Select Archived pick")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getAllByText("Archived pick")[0]!);
    await waitFor(() =>
      expect(screen.getByLabelText("Status: Archived.")).toBeInTheDocument(),
    );
    // Archive task: 1 more fetch each (entries + quickLinks; attachments
    // are not loaded for archive view, but the effect still tries).
    const afterArchiveLoads = vi.mocked(api.listEntries).mock.calls.length;

    // Return to the task view — the active task's cache should
    // hydrate without any new fetch.
    fireEvent.click(screen.getByLabelText("Show task sidebar"));
    await waitFor(() =>
      expect(screen.getByLabelText("Status: Active. Click to change."))
        .toBeInTheDocument(),
    );
    expect(vi.mocked(api.listEntries).mock.calls.length).toBe(
      afterArchiveLoads,
    );
    expect(vi.mocked(api.listQuickLinks).mock.calls.length).toBe(2);
  });

  it("clicking the archive rail icon a second time hides the sidebar, it does not bounce back to tasks", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByLabelText("Open archive")).toBeInTheDocument(),
    );

    // First click → archive view, sidebar visible (search input is
    // inside the sidebar and is reachable by label).
    fireEvent.click(screen.getByLabelText("Open archive"));
    await waitFor(() =>
      expect(screen.getByLabelText("Search archive")).toBeInTheDocument(),
    );
    // The button label flips to "Hide archive sidebar" once active.
    expect(
      screen.getByLabelText("Hide archive sidebar"),
    ).toBeInTheDocument();

    // Second click on the same icon — the search input should be
    // hidden (the parent sidebar collapses to width 0). We can
    // detect this by checking the visible style on the input.
    fireEvent.click(screen.getByLabelText("Hide archive sidebar"));
    const searchInput = screen.getByLabelText(
      "Search archive",
    ) as HTMLInputElement;
    await waitFor(() => {
      // The search input's parent <aside> is rendered inside two
      // wrapper <div>s: the inner one has a fixed `width: 280px`
      // and the outer one toggles to `width: 0` when hidden.
      // Walking up via `style` is the only way to observe the
      // toggle in jsdom (no layout).
      const aside = searchInput.closest("aside");
      const innerWrapper = aside?.parentElement;
      const outerWrapper = innerWrapper?.parentElement;
      expect(outerWrapper?.style.width).toBe("0px");
    });
    // The rail label flips to indicate "Show archive sidebar".
    expect(
      screen.getByLabelText("Show archive sidebar"),
    ).toBeInTheDocument();
    // The read-only header for the selected archived task is still
    // mounted — the archive view did not bounce back to tasks.
    expect(screen.getByLabelText("Status: Archived.")).toBeInTheDocument();

    // A third click should bring the sidebar back (width > 0) without
    // changing the workspace mode.
    fireEvent.click(screen.getByLabelText("Show archive sidebar"));
    await waitFor(() => {
      const aside = searchInput.closest("aside");
      const outerWrapper = aside?.parentElement?.parentElement;
      expect(outerWrapper?.style.width).toBe("280px");
    });
    // The rail label flips back to "Hide archive sidebar" because
    // the sidebar is now visible again.
    expect(
      screen.getByLabelText("Hide archive sidebar"),
    ).toBeInTheDocument();
  });
});
