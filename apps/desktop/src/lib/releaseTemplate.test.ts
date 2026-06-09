import { describe, expect, it } from "vitest";
import {
  buildReleaseContext,
  defaultReleaseTemplate,
  isTruthy,
  renderReleaseTemplate,
  type ReleaseRenderContext,
} from "./releaseTemplate";
import type { Folder, Release, Task } from "./types";

const FIXED_DATE = new Date("2025-06-08T12:00:00Z");
const FIXED_RELEASE_AT = "2025-06-01T09:30:00Z";

const baseRelease: Release = {
  name: "Jun 2026 Refresh",
  version: "0.2.0",
  descriptionMarkdown: "## Highlights\n- New feature",
  releasedAt: FIXED_RELEASE_AT,
  folderId: null,
  createdAt: FIXED_RELEASE_AT,
  updatedAt: FIXED_RELEASE_AT,
};

const baseTask: Task = {
  id: "task-1",
  title: "Ship the new UI",
  descriptionMarkdown: "",
  status: "done",
  nextStep: null,
  estimatedMinutes: 120,
  folderId: "folder-1",
  releaseName: "Jun 2026 Refresh",
  createdAt: FIXED_RELEASE_AT,
  updatedAt: FIXED_RELEASE_AT,
};

const baseFolder: Folder = {
  id: "folder-1",
  name: "Q1 Roadmap",
  releaseName: null,
  createdAt: FIXED_RELEASE_AT,
  updatedAt: FIXED_RELEASE_AT,
};

function buildContext(
  partial: {
    release?: Partial<Release>;
    notes?: string;
    tasks?: Task[];
    folders?: Folder[];
    taskTableMd?: string;
  } = {},
): ReleaseRenderContext {
  const folderNames = new Map(
    (partial.folders ?? [baseFolder]).map((f) => [f.id, f.name]),
  );
  return buildReleaseContext({
    release: { ...baseRelease, ...(partial.release ?? {}) },
    notes: partial.notes ?? "",
    taskTableMd:
      partial.taskTableMd ??
      "| Task | Status |\n| --- | --- |\n| Ship the new UI | done |",
    tasks: partial.tasks ?? [baseTask],
    folderNames,
    generatedAt: FIXED_DATE,
  });
}

describe("isTruthy", () => {
  it("treats empty strings, 0, and null as falsy", () => {
    expect(isTruthy("")).toBe(false);
    expect(isTruthy(null)).toBe(false);
    expect(isTruthy(undefined)).toBe(false);
    expect(isTruthy(0)).toBe(false);
    expect(isTruthy([])).toBe(false);
    expect(isTruthy({})).toBe(false);
  });

  it("treats non-empty strings, non-zero numbers, and non-empty arrays as truthy", () => {
    expect(isTruthy("x")).toBe(true);
    expect(isTruthy(1)).toBe(true);
    expect(isTruthy([0])).toBe(true);
    expect(isTruthy({ a: 1 })).toBe(true);
  });
});

describe("renderReleaseTemplate", () => {
  it("substitutes simple variables", () => {
    const out = renderReleaseTemplate("Hello {{name}}!", buildContext());
    expect(out).toBe("Hello Jun 2026 Refresh!");
  });

  it("replaces empty version with empty string", () => {
    const out = renderReleaseTemplate(
      "{{name}}{{#if version}} ({{version}}){{/if}}",
      buildContext({ release: { version: null } }),
    );
    expect(out).toBe("Jun 2026 Refresh");
  });

  it("renders the version when present", () => {
    const out = renderReleaseTemplate(
      "{{name}}{{#if version}} ({{version}}){{/if}}",
      buildContext(),
    );
    expect(out).toBe("Jun 2026 Refresh (0.2.0)");
  });

  it("renders the released status as Released or Draft", () => {
    const released = renderReleaseTemplate("_{{releasedAt}}_", buildContext());
    expect(released).toMatch(/^_Released /);
    const draft = renderReleaseTemplate(
      "_{{releasedAt}}_",
      buildContext({ release: { releasedAt: null } }),
    );
    expect(draft).toBe("_Draft_");
  });

  it("applies the date filter with custom patterns", () => {
    const out = renderReleaseTemplate(
      "{{releasedAtDate|date:YYYY-MM-DD}}",
      buildContext(),
    );
    expect(out).toBe("2025-06-01");
  });

  it("applies the upper and lower filters", () => {
    expect(renderReleaseTemplate("{{name|upper}}", buildContext())).toBe(
      "JUN 2026 REFRESH",
    );
    expect(renderReleaseTemplate("{{name|lower}}", buildContext())).toBe(
      "jun 2026 refresh",
    );
  });

  it("hides conditional sections when the value is empty", () => {
    const out = renderReleaseTemplate(
      "{{#if notes}}## Notes\n\n{{notes}}{{/if}}",
      buildContext({ notes: "" }),
    );
    expect(out).toBe("");
  });

  it("shows conditional sections when the value is present", () => {
    const out = renderReleaseTemplate(
      "{{#if notes}}## Notes\n\n{{notes}}{{/if}}",
      buildContext({ notes: "Hello" }),
    );
    expect(out).toBe("## Notes\n\nHello");
  });

  it("supports else branches", () => {
    const empty = renderReleaseTemplate(
      "{{#if notes}}yes{{else}}no{{/if}}",
      buildContext({ notes: "" }),
    );
    expect(empty).toBe("no");
    const filled = renderReleaseTemplate(
      "{{#if notes}}yes{{else}}no{{/if}}",
      buildContext({ notes: "hi" }),
    );
    expect(filled).toBe("yes");
  });

  it("iterates over the task list", () => {
    const out = renderReleaseTemplate(
      "{{#each taskList}}- {{title}} — {{status}}\n{{/each}}",
      buildContext(),
    );
    expect(out).toBe("- Ship the new UI — done\n");
  });

  it("renders the default template when input is empty", () => {
    const out = renderReleaseTemplate("", buildContext());
    const defaultOut = renderReleaseTemplate(
      defaultReleaseTemplate(),
      buildContext(),
    );
    expect(out).toBe(defaultOut);
  });

  it("renders the default template by default", () => {
    const out = renderReleaseTemplate(
      defaultReleaseTemplate(),
      buildContext({ notes: "## Highlights\n- New feature" }),
    );
    expect(out).toContain("Jun 2026 Refresh");
    expect(out).toContain("0.2.0");
    expect(out).toContain("Highlights");
    expect(out).toContain("Ship the new UI");
  });

  it("falls back gracefully on unknown placeholders", () => {
    const out = renderReleaseTemplate("Hello {{unknown}}!", buildContext());
    expect(out).toBe("Hello !");
  });

  it("exposes all task fields inside #each", () => {
    const out = renderReleaseTemplate(
      "{{#each taskList}}{{title}} | {{status}} | {{folder}} | {{estimate}} | {{nextStep}} | {{createdAt}}\n{{/each}}",
      buildContext(),
    );
    expect(out).toContain("Ship the new UI");
    expect(out).toContain("done");
    expect(out).toContain("Q1 Roadmap");
    expect(out).toContain("2h");
    expect(out).toMatch(/(Jun.*1.*2025|1.*Jun.*2025)/);
  });

  it("renders the tasks table with custom fields via the fields filter", () => {
    const out = renderReleaseTemplate(
      "{{tasks|fields:task,status}}",
      buildContext({ taskTableMd: undefined }),
    );
    // Note: header should contain only the chosen columns
    expect(out).toContain("| Task | Status |");
    expect(out).not.toContain("| Est. |");
    expect(out).not.toContain("| Folder |");
  });

  it("ignores the fields filter on non-tasks placeholders", () => {
    const out = renderReleaseTemplate(
      "{{name|fields:title,status}}",
      buildContext(),
    );
    // The filter should not affect the name variable
    expect(out).toBe("Jun 2026 Refresh");
  });
});

describe("buildReleaseContext", () => {
  it("maps release fields to the context", () => {
    const ctx = buildContext();
    expect(ctx.name).toBe("Jun 2026 Refresh");
    expect(ctx.version).toBe("0.2.0");
    expect(ctx.releasedAtDate).toMatch(/(Jun.*1.*2025|1.*Jun.*2025)/);
    expect(ctx.taskCount).toBe(1);
    expect(ctx.taskList).toHaveLength(1);
    expect(ctx.taskList[0]?.title).toBe("Ship the new UI");
    expect(ctx.taskList[0]?.folder).toBe("Q1 Roadmap");
  });
});
