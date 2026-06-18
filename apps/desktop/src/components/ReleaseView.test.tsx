// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ReleaseView } from "./ReleaseView";
import type { Folder, Release, Task } from "@/lib/types";
import { renderWithProviders as render } from "@/test-utils";

vi.mock("@/lib/api", () => ({
  api: {
    deleteRelease: vi.fn(),
    updateRelease: vi.fn(),
  },
}));

import { api } from "@/lib/api";

const zeroRect: DOMRect = {
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
  x: 0,
  y: 0,
  toJSON: () => ({}),
};

beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => zeroRect;
  Range.prototype.getClientRects = () =>
    ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {
        return;
      },
    }) as DOMRectList;
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
});

function releaseNotesEditor() {
  return screen.getByLabelText("Release notes");
}

const release: Release = {
  name: "v0.3",
  version: "0.3.0",
  descriptionMarkdown: "",
  releaseStatus: "draft",
  releasedAt: null,
  folderId: null,
  createdAt: "2026-06-05T00:00:00Z",
  updatedAt: "2026-06-05T00:00:00Z",
};

const folder: Folder = {
  id: "folder-a",
  name: "UI",
  releaseName: null,
  createdAt: "2026-06-05T00:00:00Z",
  updatedAt: "2026-06-05T00:00:00Z",
};

const task: Task = {
  id: "task-a",
  title: "Refine release notes",
  descriptionMarkdown: "",
  status: "active",
  nextStep: null,
  estimatedMinutes: null,
  folderId: "folder-a",
  releaseName: "v0.3",
  createdAt: "2026-06-05T00:00:00Z",
  updatedAt: "2026-06-05T00:00:00Z",
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
describe("ReleaseView template persistence", () => {
  it("loads the template from the release on mount and persists saves", async () => {
    const onReleasesChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <ReleaseView
        folders={[folder]}
        onReleasesChanged={onReleasesChanged}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[release]}
        tasks={[task]}
      />,
    );

    // Default tab is Tasks. Switch to Notes to access the editor.
    fireEvent.click(screen.getByRole("tab", { name: /Notes/ }));

    fireEvent.click(screen.getByLabelText("Insert release variable"));
    fireEvent.click(screen.getByText("{{name}}"));

    await waitFor(() =>
      expect(api.updateRelease).toHaveBeenCalledWith("v0.3", {
        descriptionMarkdown: "{{name}}",
      }),
    );
    await waitFor(() => expect(onReleasesChanged).toHaveBeenCalled());
  });

  it("refreshes releases on mount so saved templates are always loaded", async () => {
    const onReleasesChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <ReleaseView
        folders={[folder]}
        onReleasesChanged={onReleasesChanged}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[{ ...release, descriptionMarkdown: "# Saved template" }]}
        tasks={[task]}
      />,
    );

    await waitFor(() => expect(onReleasesChanged).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("tab", { name: /Notes/ }));

    await waitFor(() =>
      expect(releaseNotesEditor()).toHaveTextContent("# Saved template"),
    );
  });

  it("loads the saved template content into the editor from release data", async () => {
    const onReleasesChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={onReleasesChanged}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[
          {
            ...release,
            descriptionMarkdown: "# My persistent template\n- Item 1",
          },
        ]}
        tasks={[]}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Notes/ }));

    await waitFor(() =>
      expect(releaseNotesEditor()).toHaveTextContent(
        "# My persistent template- Item 1",
      ),
    );
  });
});

describe("ReleaseView tasks tab", () => {
  const availableTask: Task = {
    ...task,
    id: "task-b",
    title: "Polish sidebar",
    releaseName: null,
  };
  const anotherAvailable: Task = {
    ...task,
    id: "task-c",
    title: "Refactor composer",
    releaseName: null,
  };

  it("lists tagged tasks under Selected and unassigned tasks under Available", () => {
    const onTagTask = vi.fn().mockResolvedValue(undefined);
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={onTagTask}
        releases={[release]}
        tasks={[task, availableTask, anotherAvailable]}
      />,
    );

    const selectedToggle = screen.getByRole("button", {
      name: /Selected For Release 01/,
    });
    const availableToggle = screen.getByRole("button", {
      name: /Available Tasks 02/,
    });
    expect(selectedToggle).toHaveAttribute("aria-expanded", "false");
    expect(availableToggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(selectedToggle);

    // The selected (tagged) task is rendered with a checked checkbox.
    const removeCheckboxes = screen.getAllByRole("checkbox", {
      name: /Remove from release/,
    });
    expect(removeCheckboxes).toHaveLength(1);
    expect(removeCheckboxes[0]).toBeChecked();

    // The two unassigned tasks are rendered with unchecked add checkboxes.
    const addCheckboxes = screen.getAllByRole("checkbox", {
      name: /Add to release/,
    });
    expect(addCheckboxes).toHaveLength(2);
    addCheckboxes.forEach((box) => expect(box).not.toBeChecked());
  });

  it("filters only available tasks by the search term", () => {
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[release]}
        tasks={[task, availableTask, anotherAvailable]}
      />,
    );

    const selectedToggle = screen.getByRole("button", {
      name: /Selected For Release 01/,
    });
    fireEvent.click(selectedToggle);

    const search = screen.getByLabelText(
      "Search available tasks",
    ) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "sidebar" } });

    expect(screen.getByText("Refine release notes")).toBeInTheDocument();
    expect(screen.getByText("Polish sidebar")).toBeInTheDocument();
    expect(screen.queryByText("Refactor composer")).not.toBeInTheDocument();
  });

  it("does not offer tasks that already belong to another release", () => {
    const assignedElsewhere: Task = {
      ...task,
      id: "task-d",
      title: "Already in another release",
      releaseName: "v0.4",
    };
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[release, { ...release, name: "v0.4" }]}
        tasks={[task, availableTask, assignedElsewhere]}
      />,
    );

    expect(screen.getByRole("button", { name: /Available Tasks 01/ }));
    expect(screen.getByText("Polish sidebar")).toBeInTheDocument();
    expect(
      screen.queryByText("Already in another release"),
    ).not.toBeInTheDocument();

    const addCheckboxes = screen.getAllByRole("checkbox", {
      name: /Add to release/,
    });
    expect(addCheckboxes).toHaveLength(1);
  });

  it("toggles a tag from Available via the add checkbox", async () => {
    const onTagTask = vi.fn().mockResolvedValue(undefined);
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={onTagTask}
        releases={[release]}
        tasks={[task, availableTask]}
      />,
    );

    const addCheckboxes = screen.getAllByRole("checkbox", {
      name: /Add to release/,
    });
    fireEvent.click(addCheckboxes[0]);

    await waitFor(() =>
      expect(onTagTask).toHaveBeenCalledWith("task-b", "v0.3"),
    );
  });

  it("toggles selection when the row body or title text is clicked", async () => {
    const onTagTask = vi.fn().mockResolvedValue(undefined);
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={onTagTask}
        releases={[release]}
        tasks={[task, availableTask]}
      />,
    );

    // Clicking the title text of an untagged row should tag it (the whole
    // row is a <label> that wraps the checkbox).
    fireEvent.click(screen.getByText("Polish sidebar"));
    await waitFor(() =>
      expect(onTagTask).toHaveBeenCalledWith("task-b", "v0.3"),
    );
  });

  it("shows an error chip when the regex pattern is invalid", () => {
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[release]}
        tasks={[task, availableTask]}
      />,
    );

    // Turn on regex.
    fireEvent.click(
      screen.getByRole("button", { name: /Enable regex search/ }),
    );

    const search = screen.getByLabelText(
      "Search available tasks",
    ) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "[unclosed" } });

    expect(screen.getByText("Invalid regex pattern.")).toBeInTheDocument();
  });

  it("navigates to a task only via the per-row Open link, not the row itself", async () => {
    const onSelectTask = vi.fn();
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={onSelectTask}
        onTagTask={vi.fn()}
        releases={[release]}
        tasks={[task, availableTask]}
      />,
    );

    // Clicking the title text or the row body must NOT navigate.
    fireEvent.click(screen.getByText("Refine release notes"));
    fireEvent.click(screen.getByText("Polish sidebar"));
    expect(onSelectTask).not.toHaveBeenCalled();

    // The Open link on the tagged row is the only path to the task view.
    const openLinks = screen.getAllByTestId("open-task-link");
    fireEvent.click(openLinks[0]);
    expect(onSelectTask).toHaveBeenCalledWith("task-a");
  });

  it("does not show available tasks for a released release", () => {
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[
          {
            ...release,
            releaseStatus: "released",
            releasedAt: "2026-06-10T00:00:00Z",
          },
        ]}
        tasks={[task, availableTask]}
      />,
    );

    expect(screen.queryByLabelText("Search available tasks")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Available Tasks/ }),
    ).toBeNull();
    expect(screen.queryByLabelText(/Add to release/)).toBeNull();
  });

  it("persists the active tab across remounts via localStorage", () => {
    const { unmount } = render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[release]}
        tasks={[]}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Notes/ }));
    expect(localStorage.getItem("devthread:release-active-tab")).toBe("notes");

    unmount();
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[release]}
        tasks={[]}
      />,
    );

    expect(screen.getByLabelText("Release notes")).toBeInTheDocument();
  });

  it("shows release variables only while editing notes", () => {
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[release]}
        tasks={[]}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Notes/ }));
    expect(
      screen.getByLabelText("Insert release variable"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.queryByLabelText("Insert release variable")).toBeNull();
  });

  it("shows released notes as preview only and copies markdown", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[
          {
            ...release,
            descriptionMarkdown: "## Released notes\n\nHello",
            releaseStatus: "released",
            releasedAt: "2026-06-10T00:00:00Z",
          },
        ]}
        tasks={[]}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Notes/ }));

    expect(screen.queryByLabelText("Release notes")).toBeNull();
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.queryByText("Preview")).toBeNull();
    expect(screen.getByText("Released notes")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Copy release notes markdown"));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("## Released notes\n\nHello"),
    );
  });

  it("shows why a pre-release cannot be released yet", () => {
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[{ ...release, releaseStatus: "pre_release" }]}
        tasks={[task]}
      />,
    );

    expect(screen.getByText("Final review")).toBeInTheDocument();
    expect(
      screen.getByText("Release blocked: 1 task not done"),
    ).toBeInTheDocument();
  });
});

describe("ReleaseView sidebar", () => {
  it("uses the compact release sidebar shell with searchable rows", () => {
    const quietRelease: Release = {
      ...release,
      name: "Quiet shell",
      version: "0.4.0",
    };
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[release, quietRelease]}
        tasks={[]}
      />,
    );

    expect(screen.getByLabelText("New release")).toBeInTheDocument();
    expect(screen.getByLabelText("Search releases")).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "Releases" });
    expect(within(nav).getByText("All Drafts")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search releases"), {
      target: { value: "quiet" },
    });

    expect(within(nav).getByText("Draft results")).toBeInTheDocument();
    expect(within(nav).getByText("Quiet shell")).toBeInTheDocument();
    expect(within(nav).queryByText("v0.3")).not.toBeInTheDocument();
  });

  it("keeps released releases collapsed at the bottom until expanded", () => {
    const releasedRelease: Release = {
      ...release,
      name: "Released June 2026",
      releaseStatus: "released",
      releasedAt: "2026-06-10T00:00:00Z",
    };
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[release, releasedRelease]}
        tasks={[]}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Releases" });
    expect(within(nav).getByText("v0.3")).toBeInTheDocument();
    expect(screen.queryByText("Released June 2026")).not.toBeInTheDocument();

    const releasedToggle = screen.getByRole("button", { name: "Released" });
    expect(releasedToggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(releasedToggle);

    expect(releasedToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Released June 2026")).toBeInTheDocument();
  });

  it("resizes and resets the release sidebar width", () => {
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[release]}
        tasks={[]}
      />,
    );

    const resizer = screen.getByLabelText("Resize release sidebar");
    const sidebarShell = resizer.parentElement as HTMLElement;
    expect(sidebarShell).toHaveStyle({ width: "280px" });

    fireEvent.mouseDown(resizer, { clientX: 280 });
    fireEvent.mouseMove(window, { clientX: 340 });
    fireEvent.mouseUp(window);

    expect(sidebarShell).toHaveStyle({ width: "340px" });
    expect(localStorage.getItem("devthread:release-sidebar-width")).toBe("340");

    fireEvent.doubleClick(resizer);

    expect(sidebarShell).toHaveStyle({ width: "280px" });
    expect(localStorage.getItem("devthread:release-sidebar-width")).toBe("280");
  });

  it("honors shell-controlled release sidebar visibility", () => {
    const { rerender } = render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[release]}
        sidebarOpen={false}
        tasks={[]}
      />,
    );

    expect(screen.queryByRole("navigation", { name: "Releases" })).toBeNull();

    rerender(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[release]}
        sidebarOpen
        tasks={[]}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "Releases" }),
    ).toBeInTheDocument();
  });

  it("pins releases into a pinned section", () => {
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={vi.fn().mockResolvedValue(undefined)}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[release]}
        tasks={[]}
      />,
    );

    fireEvent.click(screen.getByLabelText("Pin v0.3"));

    expect(localStorage.getItem("devthread:pinned-releases")).toBe(
      JSON.stringify(["v0.3"]),
    );
    expect(
      screen.getByRole("button", { name: /Pinned releases/ }),
    ).toBeInTheDocument();
  });

  it("deletes only the release from the sidebar and keeps tasks detached", async () => {
    const onReleasesChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <ReleaseView
        folders={[]}
        onReleasesChanged={onReleasesChanged}
        onRemoveTaskTag={vi.fn()}
        onSelectTask={vi.fn()}
        onTagTask={vi.fn()}
        releases={[release]}
        tasks={[task]}
      />,
    );

    fireEvent.click(screen.getByLabelText("Delete v0.3"));

    expect(screen.getByText("Delete release")).toBeInTheDocument();
    expect(
      screen.getByText(/Tagged tasks will stay in DevThread/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(api.deleteRelease).toHaveBeenCalledWith("v0.3"));
    await waitFor(() => expect(onReleasesChanged).toHaveBeenCalled());
  });
});
