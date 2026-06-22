// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogTimeDialog, type LogTimeInput } from "./LogTimeDialog";
import { renderWithProviders as render } from "../test-utils";

afterEach(() => {
  cleanup();
});

describe("LogTimeDialog", () => {
  const taskTitle = "Refine sidebar";

  it("submits with a parsed duration, chosen date, and entered note", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <LogTimeDialog
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
        open
        taskTitle={taskTitle}
      />,
    );

    const duration = screen.getByLabelText("Time spent");
    fireEvent.change(duration, { target: { value: "1d 3h" } });
    expect(screen.getByText(/^= 1d 3h/)).toBeInTheDocument();

    // Open the calendar popover and select day 5 (past, so not disabled)
    fireEvent.click(screen.getByRole("button", { name: /\d{4}/ }));
    fireEvent.click(screen.getByText("5"));

    fireEvent.change(screen.getByLabelText("Note (optional)"), {
      target: { value: "Punted the sidebar to v2." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Log time" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0][0] as LogTimeInput;
    expect(input.durationMinutes).toBe(8 * 60 + 3 * 60);
    expect(input.occurredAt).toMatch(/T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(input.occurredAt).toContain("-05T");
    expect(input.startedAt).toMatch(/T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(input.contentMarkdown).toContain("Punted the sidebar to v2.");
    expect(input.visibility).toBe("private");
  });

  it("rejects garbage and shows an error until the input parses", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <LogTimeDialog
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
        open
        taskTitle={taskTitle}
      />,
    );

    const duration = screen.getByLabelText("Time spent");
    fireEvent.change(duration, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Log time" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Enter a duration like 30m, 2h, 1d 30m, or 1w/),
    ).toBeInTheDocument();

    fireEvent.change(duration, { target: { value: "2h" } });
    expect(screen.queryByText(/Enter a duration like/)).not.toBeInTheDocument();
  });

  it("falls back to a default content line when the note is empty", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <LogTimeDialog
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
        open
        taskTitle={taskTitle}
      />,
    );

    fireEvent.change(screen.getByLabelText("Time spent"), {
      target: { value: "45m" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log time" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const input = onSubmit.mock.calls[0][0] as LogTimeInput;
    expect(input.contentMarkdown).toMatch(
      /^Logged 45m from .+ to .+ on Refine sidebar\.$/,
    );
  });

  it("back-calculates the start time from the current time and duration", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <LogTimeDialog
        now={() => new Date(2026, 5, 5, 16, 0, 0)}
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
        open
        taskTitle={taskTitle}
      />,
    );

    fireEvent.change(screen.getByLabelText("Time spent"), {
      target: { value: "3h" },
    });

    expect(screen.getByText("= 3h · starts 1:00 PM")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Log time" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0][0] as LogTimeInput;
    const startedAt = new Date(input.startedAt);
    expect(startedAt.getFullYear()).toBe(2026);
    expect(startedAt.getMonth()).toBe(5);
    expect(startedAt.getDate()).toBe(5);
    expect(startedAt.getHours()).toBe(13);
    expect(startedAt.getMinutes()).toBe(0);

    const occurredAt = new Date(input.occurredAt);
    expect(occurredAt.getFullYear()).toBe(2026);
    expect(occurredAt.getMonth()).toBe(5);
    expect(occurredAt.getDate()).toBe(5);
    expect(occurredAt.getHours()).toBe(16);
    expect(occurredAt.getMinutes()).toBe(0);
  });
});
