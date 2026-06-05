// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { draftKey } from "../lib/composer";
import { Composer } from "./Composer";
import { renderWithProviders as render } from "../test-utils";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Composer", () => {
  it("submits with Cmd+Enter and returns focus to the composer", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<Composer onSubmit={submit} taskId="task-a" />);

    const composer = screen.getByPlaceholderText(/What happened\?/);
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

    const composer = screen.getByPlaceholderText(/What happened\?/);
    fireEvent.change(composer, { target: { value: "Do not lose this" } });
    fireEvent.keyDown(composer, { key: "Enter", ctrlKey: true });

    await screen.findByText(/Draft retained/);
    expect(composer).toHaveValue("Do not lose this");
    expect(localStorage.getItem(draftKey("task-b"))).toBe("Do not lose this");
  });

  it("previews a pasted image and submits it with the entry", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<Composer onSubmit={submit} taskId="task-image" />);

    const composer = screen.getByPlaceholderText(/What happened\?/);
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

    fireEvent.change(screen.getByPlaceholderText(/What happened\?/), {
      target: {
        value: "Review https://github.com/example/taskline/issues/42",
      },
    });

    expect(screen.getByText("github.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/What happened\?/)).toHaveValue(
      "Review https://github.com/example/taskline/issues/42",
    );
  });

  it("switches the entry type via @-mention and strips it on submit", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<Composer onSubmit={submit} taskId="task-mention" />);

    const composer = screen.getByPlaceholderText(/What happened\?/);
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

    const composer = screen.getByPlaceholderText(/What happened\?/);
    fireEvent.change(composer, { target: { value: "@" } });

    expect(
      screen.getByRole("option", { name: /Progress/ }),
    ).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("option", { name: /Blocker/ }));

    await waitFor(() => expect(composer).toHaveFocus());
    expect(composer).toHaveValue("");
    expect(
      screen.queryByLabelText("Entry type suggestions"),
    ).not.toBeInTheDocument();
  });
});
