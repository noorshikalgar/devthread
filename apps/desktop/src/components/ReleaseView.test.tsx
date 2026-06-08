// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReleaseView } from "./ReleaseView";
import type { Folder, Release, Task } from "@/lib/types";
import { renderWithProviders as render } from "@/test-utils";

vi.mock("@/lib/api", () => ({
  api: {
    updateRelease: vi.fn(),
  },
}));

import { api } from "@/lib/api";

const release: Release = {
  name: "v0.3",
  version: "0.3.0",
  descriptionMarkdown: "",
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

    // Default tab is Tasks. Switch to Release notes to access the editor.
    fireEvent.click(screen.getByRole("button", { name: /Release notes/ }));

    const editor = screen.getByLabelText(
      "Release notes template",
    ) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "# {{name}}\n\nMy notes" } });

    const saveButton = screen.getByTestId("save-template-button");
    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(api.updateRelease).toHaveBeenCalledWith("v0.3", {
        descriptionMarkdown: "# {{name}}\n\nMy notes",
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
        releases={[
          { ...release, descriptionMarkdown: "# Saved template" },
        ]}
        tasks={[task]}
      />,
    );

    await waitFor(() => expect(onReleasesChanged).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Release notes/ }));

    const editor = screen.getByLabelText(
      "Release notes template",
    ) as HTMLTextAreaElement;
    await waitFor(() =>
      expect(editor.value).toBe("# Saved template"),
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

    fireEvent.click(screen.getByRole("button", { name: /Release notes/ }));

    const editor = screen.getByLabelText(
      "Release notes template",
    ) as HTMLTextAreaElement;
    await waitFor(() =>
      expect(editor.value).toBe("# My persistent template\n- Item 1"),
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

  it("lists tagged tasks under Selected and untagged tasks under Other", () => {
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

    expect(
      screen.getByText("Selected for this release"),
    ).toBeInTheDocument();
    expect(screen.getByText("Other tasks")).toBeInTheDocument();

    // The selected (tagged) task is rendered with a checked checkbox.
    const removeCheckboxes = screen.getAllByRole("checkbox", {
      name: /Remove from release/,
    });
    expect(removeCheckboxes).toHaveLength(1);
    expect(removeCheckboxes[0]).toBeChecked();

    // The other two tasks are rendered with unchecked add checkboxes.
    const addCheckboxes = screen.getAllByRole("checkbox", {
      name: /Add to release/,
    });
    expect(addCheckboxes).toHaveLength(2);
    addCheckboxes.forEach((box) => expect(box).not.toBeChecked());
  });

  it("filters both lists by the search term", () => {
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

    const search = screen.getByLabelText("Search tasks") as HTMLInputElement;
    fireEvent.change(search, { target: { value: "sidebar" } });

    // Only the sidebar task should remain visible in "Other tasks".
    expect(
      screen.queryByText("Refine release notes"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Polish sidebar")).toBeInTheDocument();
    expect(
      screen.queryByText("Refactor composer"),
    ).not.toBeInTheDocument();
  });

  it("toggles a tag from Other via the add checkbox", async () => {
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

    const search = screen.getByLabelText("Search tasks") as HTMLInputElement;
    fireEvent.change(search, { target: { value: "[unclosed" } });

    expect(screen.getByText("Invalid regex pattern.")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: /Release notes/ }));
    expect(localStorage.getItem("devthread:release-active-tab")).toBe(
      "notes",
    );

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

    // After remount the Release notes tab should be the active one, so the
    // save button's aria-label is reachable immediately.
    expect(
      screen.getByLabelText("Save release notes template"),
    ).toBeInTheDocument();
  });
});
