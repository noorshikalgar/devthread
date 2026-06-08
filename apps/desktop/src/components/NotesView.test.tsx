// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note, NoteAttachment } from "@/lib/types";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `tauri://localhost/${path}`,
}));

const apiState = {
  listNotes: vi.fn(),
  listNoteAttachments: vi.fn(),
  updateNote: vi.fn(),
  createNote: vi.fn(),
  createNoteAttachment: vi.fn(),
  deleteNote: vi.fn(),
  moveNote: vi.fn(),
};

vi.mock("@/lib/api", () => ({
  api: apiState,
}));

const { NotesView } = await import("./NotesView");

const baseNote: Note = {
  id: "note-1",
  title: "Initial ideas",
  bodyMarkdown: "# Heading",
  folderId: null,
  createdAt: "2026-06-01T00:00:00Z",
  updatedAt: "2026-06-01T00:00:00Z",
};

const folder = {
  id: "folder-1",
  name: "Research",
  releaseName: null,
  createdAt: "2026-06-01T00:00:00Z",
  updatedAt: "2026-06-01T00:00:00Z",
};

function makeClipboardEvent(opts: {
  text?: string;
  files?: File[];
}): unknown {
  const fileDescriptors = (opts.files ?? []).map(
    (file) =>
      ({
        kind: "file",
        type: file.type,
        getAsFile: () => file,
      }) as const,
  );
  return {
    clipboardData: {
      files: opts.files ?? [],
      getData: (kind: string) => (kind === "text/plain" ? opts.text ?? "" : ""),
      items: fileDescriptors,
    },
    preventDefault: () => undefined,
  };
}

function makeImageFile(name: string): File {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  return new File([bytes], name, { type: "image/png" });
}

beforeEach(() => {
  apiState.listNotes.mockResolvedValue([baseNote]);
  apiState.listNoteAttachments.mockResolvedValue([]);
  apiState.updateNote.mockImplementation(async (note: Note) => ({
    ...note,
    updatedAt: "2026-06-01T00:00:01Z",
  }));
  apiState.createNote.mockImplementation(
    async (input: {
      title: string;
      bodyMarkdown?: string;
      folderId?: string | null;
    }) => ({
      id: "note-2",
      title: input.title,
      bodyMarkdown: input.bodyMarkdown ?? "",
      folderId: input.folderId ?? null,
      createdAt: "2026-06-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
    }),
  );
  apiState.createNoteAttachment.mockImplementation(
    async (noteId: string, originalName: string) =>
      ({
        id: `att-${originalName}`,
        noteId,
        originalName,
        mediaType: "image/png",
        path: `/abs/${originalName}`,
        byteSize: 4,
        createdAt: "2026-06-01T00:00:00Z",
      }) satisfies NoteAttachment,
  );
  apiState.deleteNote.mockResolvedValue(undefined);
  apiState.moveNote.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NotesView", () => {
  it("renders notes in the sidebar and previews the selected one", async () => {
    render(
      <NotesView
        folders={[folder]}
        onCreateFolder={() => undefined}
        onFoldersChanged={() => undefined}
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Initial ideas" }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Initial ideas" }));
    const textarea = await screen.findByPlaceholderText(
      /Write in Markdown/,
    ) as HTMLTextAreaElement;
    expect(textarea.value).toContain("# Heading");
  });

  it("pastes a URL onto its own line in the editor", async () => {
    render(
      <NotesView
        folders={[]}
        onCreateFolder={() => undefined}
        onFoldersChanged={() => undefined}
      />,
    );
    await waitFor(() =>
      screen.getByRole("button", { name: "Initial ideas" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Initial ideas" }));
    const textarea = (await screen.findByPlaceholderText(
      /Write in Markdown/,
    )) as HTMLTextAreaElement;
    fireEvent.paste(
      textarea,
      makeClipboardEvent({ text: "https://example.com" }) as unknown as React.ClipboardEvent<HTMLTextAreaElement>,
    );
    expect(textarea.value).toContain("https://example.com");
  });

  it("uploads a pasted image and inserts markdown for it", async () => {
    const image = makeImageFile("diagram.png");
    render(
      <NotesView
        folders={[]}
        onCreateFolder={() => undefined}
        onFoldersChanged={() => undefined}
      />,
    );
    await waitFor(() =>
      screen.getByRole("button", { name: "Initial ideas" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Initial ideas" }));
    const textarea = (await screen.findByPlaceholderText(
      /Write in Markdown/,
    )) as HTMLTextAreaElement;
    fireEvent.paste(
      textarea,
      makeClipboardEvent({ files: [image] }) as unknown as React.ClipboardEvent<HTMLTextAreaElement>,
    );
    await waitFor(() => {
      expect(apiState.createNoteAttachment).toHaveBeenCalled();
    });
    expect(textarea.value).toContain("![");
  });
});
