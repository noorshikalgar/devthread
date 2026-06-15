// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";
import {
  clearComposerDraft,
  getComposerDraft,
} from "../lib/composerDraftStore";
import { renderWithProviders as render } from "../test-utils";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Composer", () => {
  it("shows a command-style placeholder and inline entry type hint", () => {
    render(<Composer onSubmit={vi.fn()} taskId="task-placeholder" />);

    expect(
      screen.getByPlaceholderText("Type an update, blocker, note, progress..."),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Hint: Type @ to change the content type (progress, blocker, etc)",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Type @ to switch entry type/),
    ).not.toBeInTheDocument();
  });

  it("presents image attach as a composer tool", () => {
    render(<Composer onSubmit={vi.fn()} taskId="task-tools" />);

    expect(
      screen.getByRole("button", { name: "Attach images" }),
    ).toHaveTextContent("Attach image");
  });

  it("keeps the add action compact", () => {
    render(<Composer onSubmit={vi.fn()} taskId="task-add" />);

    expect(screen.getByRole("button", { name: /Add/i })).toBeInTheDocument();
  });

  it("keeps entry type menu labels compact", () => {
    render(<Composer onSubmit={vi.fn()} taskId="task-entry-types" />);

    fireEvent.click(screen.getByLabelText("Entry type"));

    expect(screen.getAllByText("Note").length).toBeGreaterThan(0);
    expect(screen.getByText("Progress")).toBeInTheDocument();
    expect(screen.getByText("Blocker")).toBeInTheDocument();
    expect(screen.queryByText(/general update/)).not.toBeInTheDocument();
  });

  it("keeps visibility private without showing a visibility control", () => {
    render(<Composer onSubmit={vi.fn()} taskId="task-visibility" />);

    expect(screen.queryByLabelText("Visibility")).not.toBeInTheDocument();
    expect(screen.queryByText("Report eligible")).not.toBeInTheDocument();
  });

  it("shows a clear draft tool when there is content", () => {
    render(<Composer onSubmit={vi.fn()} taskId="task-clear-draft" />);

    const composer = screen.getByLabelText("What happened?");
    expect(screen.queryByLabelText("Clear draft")).not.toBeInTheDocument();

    fireEvent.change(composer, { target: { value: "Draft to remove" } });
    fireEvent.click(screen.getByLabelText("Clear draft"));

    expect(composer).toHaveValue("");
    expect(screen.queryByLabelText("Clear draft")).not.toBeInTheDocument();
  });

  it("submits with Cmd+Enter and returns focus to the composer", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<Composer onSubmit={submit} taskId="task-a" />);

    const composer = screen.getByLabelText("What happened?");
    fireEvent.change(composer, {
      target: { value: "/finding Durable drafts" },
    });
    fireEvent.keyDown(composer, { key: "Enter", metaKey: true });

    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        "finding",
        "Durable drafts",
        "private",
        [],
      ),
    );
    await waitFor(() => expect(composer).toHaveFocus());
    expect(composer).toHaveValue("");
  });

  it("retains content and the local draft when saving fails", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("write failed"));
    render(<Composer onSubmit={submit} taskId="task-b" />);

    const composer = screen.getByLabelText("What happened?");
    fireEvent.change(composer, { target: { value: "Do not lose this" } });
    fireEvent.keyDown(composer, { key: "Enter", ctrlKey: true });

    await screen.findByText(/Draft retained/);
    expect(composer).toHaveValue("Do not lose this");
    // The unsent draft stays in the per-task store so the
    // sidebar's status dot can show a ring on the next visit.
    expect(getComposerDraft("task-b")?.content).toBe("Do not lose this");
    clearComposerDraft("task-b");
  });

  it("previews a pasted image and submits it with the entry", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<Composer onSubmit={submit} taskId="task-image" />);

    const composer = screen.getByLabelText("What happened?");
    const image = new File(["image-bytes"], "clipboard.png", {
      type: "image/png",
    });
    fireEvent.paste(composer, {
      clipboardData: { files: [image] },
    });

    await screen.findByAltText("clipboard.png");
    fireEvent.keyDown(composer, { key: "Enter", metaKey: true });

    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit.mock.calls[0][3][0]).toMatchObject({
      name: "clipboard.png",
      mediaType: "image/png",
    });
  });

  it("previews pasted URLs without interrupting text entry", () => {
    render(<Composer onSubmit={vi.fn()} taskId="task-link" />);

    fireEvent.change(screen.getByLabelText("What happened?"), {
      target: {
        value: "Review https://github.com/example/devthread/issues/42",
      },
    });

    expect(screen.getByText("github.com")).toBeInTheDocument();
    expect(screen.getByLabelText("What happened?")).toHaveValue(
      "Review https://github.com/example/devthread/issues/42",
    );
  });

  it("switches the entry type via @-mention and strips it on submit", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<Composer onSubmit={submit} taskId="task-mention" />);

    const composer = screen.getByLabelText("What happened?");
    fireEvent.change(composer, {
      target: { value: "shipped @progress the new filter" },
    });
    fireEvent.keyDown(composer, { key: "Enter", metaKey: true });

    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        "progress",
        "shipped the new filter",
        "private",
        [],
      ),
    );
  });

  it("opens all entry types for bare @ and removes the trigger after selection", async () => {
    render(<Composer onSubmit={vi.fn()} taskId="task-picker" />);

    const composer = screen.getByLabelText("What happened?");
    fireEvent.change(composer, { target: { value: "@" } });

    expect(
      screen.getByRole("option", { name: /Progress/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Decision/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Entry type suggestions")).toHaveClass(
      "absolute",
    );

    fireEvent.mouseDown(screen.getByRole("option", { name: /Blocker/ }));

    await waitFor(() => expect(composer).toHaveFocus());
    expect(composer).toHaveValue("");
    expect(
      screen.queryByLabelText("Entry type suggestions"),
    ).not.toBeInTheDocument();
  });

  it("navigates the @-mention list with arrow keys and scrolls the active option into view", () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      render(<Composer onSubmit={vi.fn()} taskId="task-arrow" />);

      const composer = screen.getByLabelText("What happened?");
      fireEvent.change(composer, { target: { value: "@" } });

      const first = screen.getByRole("option", { name: /Note/ });
      const second = screen.getByRole("option", { name: /Progress/ });
      expect(first).toHaveAttribute("aria-selected", "true");
      expect(second).toHaveAttribute("aria-selected", "false");

      fireEvent.keyDown(composer, { key: "ArrowDown" });
      expect(second).toHaveAttribute("aria-selected", "true");

      fireEvent.keyDown(composer, { key: "ArrowUp" });
      expect(first).toHaveAttribute("aria-selected", "true");

      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
