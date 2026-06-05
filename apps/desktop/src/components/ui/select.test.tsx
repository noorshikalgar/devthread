// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

describe("SelectContent", () => {
  it("renders the portal above sticky thread surfaces", () => {
    Element.prototype.scrollIntoView = () => undefined;
    render(
      <Select open value="note">
        <SelectTrigger aria-label="Entry type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="note">note</SelectItem>
          <SelectItem value="progress">progress</SelectItem>
        </SelectContent>
      </Select>,
    );

    const popup = document.querySelector<HTMLElement>(".select-content");
    expect(popup).toBeInTheDocument();
    expect(popup).toHaveStyle({ zIndex: "1000" });
  });
});
