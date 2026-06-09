// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Pager } from "./Pager";

afterEach(() => {
  cleanup();
});

describe("Pager", () => {
  it("renders Prev/Next and the current page number", () => {
    const onPageChange = vi.fn();
    render(
      <Pager
        onPageChange={onPageChange}
        page={2}
        pageSize={8}
        totalItems={32}
        totalPages={4}
      />,
    );

    expect(screen.getByText(/Showing 9–16 of 32/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("hides itself when the items list is empty", () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <Pager
        onPageChange={onPageChange}
        page={1}
        pageSize={8}
        totalItems={0}
        totalPages={1}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("hides itself when there is only one page", () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <Pager
        onPageChange={onPageChange}
        page={1}
        pageSize={8}
        totalItems={4}
        totalPages={1}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("marks the current page as active via aria-current", () => {
    const onPageChange = vi.fn();
    render(
      <Pager
        onPageChange={onPageChange}
        page={3}
        pageSize={8}
        totalItems={32}
        totalPages={4}
      />,
    );
    expect(screen.getByRole("button", { name: "Page 3" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("disables Prev on the first page and Next on the last page", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <Pager
        onPageChange={onPageChange}
        page={1}
        pageSize={8}
        totalItems={32}
        totalPages={4}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();

    rerender(
      <Pager
        onPageChange={onPageChange}
        page={4}
        pageSize={8}
        totalItems={32}
        totalPages={4}
      />,
    );
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("navigates when Prev/Next or a page button is clicked", () => {
    const onPageChange = vi.fn();
    render(
      <Pager
        onPageChange={onPageChange}
        page={2}
        pageSize={8}
        totalItems={32}
        totalPages={4}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "Page 4" }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
  });

  it("collapses long page lists with ellipses", () => {
    render(
      <Pager
        onPageChange={vi.fn()}
        page={5}
        pageSize={8}
        totalItems={200}
        totalPages={25}
      />,
    );
    // Page 5 with 25 total pages: the rendered buttons should
    // include 1, 2, an ellipsis, 5, ..., 24, 25.
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 24" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 25" })).toBeInTheDocument();
    // Buttons for the pages skipped by the ellipsis must not render.
    expect(
      screen.queryByRole("button", { name: "Page 3" }),
    ).not.toBeInTheDocument();
    // The ellipsis is rendered as a plain span, not a button.
    const nav = screen.getByRole("navigation", { name: /Pagination/ });
    expect(nav.textContent).toContain("…");
  });
});
