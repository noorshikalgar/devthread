import {
  type ClipboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  Image as ImageIcon,
  NotebookPen,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { fileToPendingImage } from "@/lib/content";
import type { Folder, Note, NoteAttachment } from "@/lib/types";
import { NoteMarkdownView } from "@/components/NoteMarkdownView";

const ALL_FOLDERS = "__all__";
const UNFILED = "__unfiled__";

interface NotesViewProps {
  folders: Folder[];
  onFoldersChanged: () => void;
  onCreateFolder: () => void;
}

function uniqueAttachmentName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").slice(0, 32) || "image";
  return `${base}.png`;
}

export function NotesView({
  folders,
  onFoldersChanged,
  onCreateFolder,
}: NotesViewProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scope, setScope] = useState<string>(ALL_FOLDERS);
  const [query, setQuery] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await api.listNotes();
        if (cancelled) return;
        setNotes(list);
      } catch (cause) {
        toast.error(`Could not load notes: ${String(cause)}`);
      } finally {
        if (!cancelled) {
          setLoading(false);
          initialLoadRef.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setDraftTitle("");
      setDraftBody("");
      setAttachments([]);
      setDirty(false);
      return;
    }
    setDraftTitle(selected.title);
    setDraftBody(selected.bodyMarkdown);
    setDirty(false);
    void (async () => {
      try {
        const list = await api.listNoteAttachments(selected.id);
        setAttachments(list);
      } catch (cause) {
        toast.error(`Could not load note attachments: ${String(cause)}`);
      }
    })();
  }, [selected?.id]);

  useEffect(() => {
    if (!selected || !dirty) return;
    const handle = window.setTimeout(() => {
      void saveDraft();
    }, 600);
    return () => window.clearTimeout(handle);
  }, [dirty, draftTitle, draftBody, selected?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((note) => {
      if (scope === ALL_FOLDERS) {
        // include all
      } else if (scope === UNFILED) {
        if (note.folderId != null) return false;
      } else if (note.folderId !== scope) {
        return false;
      }
      if (!q) return true;
      return (
        note.title.toLowerCase().includes(q) ||
        note.bodyMarkdown.toLowerCase().includes(q)
      );
    });
  }, [notes, scope, query]);

  const folderGroups = useMemo(() => {
    const groups = new Map<string | null, Note[]>();
    for (const note of filtered) {
      const key = note.folderId;
      const list = groups.get(key) ?? [];
      list.push(note);
      groups.set(key, list);
    }
    return groups;
  }, [filtered]);

  async function createNote(folderId: string | null) {
    try {
      const note = await api.createNote({
        title: "Untitled note",
        folderId,
      });
      setNotes((current) => [note, ...current]);
      setSelectedId(note.id);
      setDirty(true);
    } catch (cause) {
      toast.error(`Could not create note: ${String(cause)}`);
    }
  }

  async function saveDraft() {
    if (!selected) return;
    const title = draftTitle.trim() || "Untitled note";
    if (title === selected.title && draftBody === selected.bodyMarkdown) {
      setDirty(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateNote({
        ...selected,
        title,
        bodyMarkdown: draftBody,
      });
      setNotes((current) =>
        current.map((note) => (note.id === updated.id ? updated : note)),
      );
      setDirty(false);
    } catch (cause) {
      toast.error(`Could not save note: ${String(cause)}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurrent() {
    if (!selected) return;
    try {
      await api.deleteNote(selected.id);
      setNotes((current) => current.filter((note) => note.id !== selected.id));
      setSelectedId(null);
      toast.success("Note deleted");
    } catch (cause) {
      toast.error(`Could not delete note: ${String(cause)}`);
    }
  }

  async function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const imageFiles = [...event.clipboardData.files].filter((file) =>
      file.type.startsWith("image/"),
    );
    if (imageFiles.length > 0) {
      event.preventDefault();
      if (!selected) {
        const note = await api.createNote({
          title: "Untitled note",
        });
        setNotes((current) => [note, ...current]);
        setSelectedId(note.id);
        setDirty(true);
        await uploadImages(note.id, imageFiles);
        return;
      }
      await uploadImages(selected.id, imageFiles);
      return;
    }
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    const trimmed = text.trim();
    if (/^https?:\/\/\S+$/i.test(trimmed)) {
      event.preventDefault();
      insertAtCursor(`\n${trimmed}\n`);
    }
  }

  async function uploadImages(noteId: string, files: File[]) {
    try {
      const pending = await Promise.all(files.map(fileToPendingImage));
      const created: NoteAttachment[] = [];
      for (const image of pending) {
        const attachment = await api.createNoteAttachment(
          noteId,
          uniqueAttachmentName(image.name),
          image.mediaType,
          image.base64Data,
        );
        created.push(attachment);
      }
      setAttachments((current) => [...current, ...created]);
      const altNames = created.map((a) => a.originalName).join(", ");
      insertAtCursor(`\n![${altNames}](${altNames})\n`);
    } catch (cause) {
      toast.error(`Image upload failed: ${String(cause)}`);
    }
  }

  function insertAtCursor(snippet: string) {
    const element = textareaRef.current;
    if (!element) {
      setDraftBody((current) => current + snippet);
      setDirty(true);
      return;
    }
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    const next =
      element.value.slice(0, start) + snippet + element.value.slice(end);
    setDraftBody(next);
    setDirty(true);
    requestAnimationFrame(() => {
      element.focus();
      const caret = start + snippet.length;
      element.setSelectionRange(caret, caret);
    });
  }

  function selectScope(value: string) {
    setScope(value);
    setSelectedId(null);
  }

  if (loading && !initialLoadRef.current) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading notes…
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-[260px_1fr_1fr] divide-x divide-border">
      <aside className="flex h-full min-w-0 flex-col">
        <div className="border-b border-border p-3">
          <div className="flex items-center gap-2">
            <NotebookPen className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Notes</h2>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {notes.length}
            </span>
          </div>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-7 text-xs"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes"
              value={query}
            />
          </div>
          <Button
            className="mt-2 w-full"
            onClick={() => {
              const folderId =
                scope === ALL_FOLDERS || scope === UNFILED ? null : scope;
              void createNote(folderId);
            }}
            size="sm"
            type="button"
          >
            <Plus className="mr-1 size-3.5" /> New note
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 text-sm">
          <FolderRow
            active={scope === ALL_FOLDERS}
            count={notes.length}
            icon={<NotebookPen className="size-3.5" />}
            label="All notes"
            onClick={() => selectScope(ALL_FOLDERS)}
          />
          <FolderRow
            active={scope === UNFILED}
            count={notes.filter((n) => n.folderId == null).length}
            icon={<FileText className="size-3.5" />}
            label="Unfiled"
            onClick={() => selectScope(UNFILED)}
          />
          {folders.map((folder) => (
            <FolderRow
              active={scope === folder.id}
              count={notes.filter((n) => n.folderId === folder.id).length}
              icon={<FolderIcon className="size-3.5" />}
              key={folder.id}
              label={folder.name}
              onClick={() => selectScope(folder.id)}
            />
          ))}
          <Button
            className="mt-1 w-full justify-start gap-1 text-[11px]"
            onClick={onCreateFolder}
            size="sm"
            type="button"
            variant="ghost"
          >
            <FolderPlus className="size-3" /> New folder
          </Button>
          <div className="mt-3 space-y-3">
            {Array.from(folderGroups.entries()).map(([folderId, list]) => {
              const folder = folders.find((f) => f.id === folderId);
              return (
                <div key={folderId ?? "unfiled"}>
                  <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {folder?.name ?? "Unfiled"}
                  </div>
                  {list.map((note) => (
                    <button
                      className={[
                        "block w-full truncate rounded-md px-2 py-1 text-left text-xs",
                        selectedId === note.id
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      ].join(" ")}
                      key={note.id}
                      onClick={() => setSelectedId(note.id)}
                      type="button"
                    >
                      {note.title || "Untitled note"}
                    </button>
                  ))}
                </div>
              );
            })}
            {filtered.length === 0 ? (
              <p className="px-1 text-[11px] text-muted-foreground">
                {notes.length === 0
                  ? "No notes yet. Create your first one."
                  : "No notes match this filter."}
              </p>
            ) : null}
          </div>
        </div>
      </aside>

      <section className="flex h-full min-w-0 flex-col">
        {selected ? (
          <>
            <div className="flex items-center gap-2 border-b border-border p-3">
              <Input
                className="h-9 flex-1 border-transparent bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
                onBlur={() => {
                  if (dirty) void saveDraft();
                  onFoldersChanged();
                }}
                onChange={(event) => {
                  setDraftTitle(event.target.value);
                  setDirty(true);
                }}
                placeholder="Note title"
                value={draftTitle}
              />
              <span className="text-[10px] text-muted-foreground">
                {saving ? "Saving…" : dirty ? "Edited" : "Saved"}
              </span>
              <Button
                aria-label="Open external link"
                disabled={!draftBody}
                onClick={() => {
                  const match = /https?:\/\/\S+/.exec(draftBody);
                  if (match) {
                    window.open(match[0], "_blank", "noopener,noreferrer");
                  }
                }}
                size="icon-sm"
                title="Open first link in body"
                type="button"
                variant="ghost"
              >
                <ExternalLink className="size-3.5" />
              </Button>
              <Button
                aria-label="Delete note"
                onClick={() => void deleteCurrent()}
                size="icon-sm"
                title="Delete note"
                type="button"
                variant="ghost"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[10px] text-muted-foreground">
              <ImageIcon className="size-3" />
              <span>
                {attachments.length} attachment
                {attachments.length === 1 ? "" : "s"}
              </span>
              <span className="ml-auto">
                {draftBody.length.toLocaleString()} chars
              </span>
            </div>
            <Textarea
              className="h-full min-h-0 flex-1 resize-none rounded-none border-0 p-4 font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0"
              onChange={(event) => {
                setDraftBody(event.target.value);
                setDirty(true);
              }}
              onPaste={handlePaste}
              placeholder="Write in Markdown. Paste a URL or an image…"
              ref={textareaRef}
              value={draftBody}
            />
          </>
        ) : (
          <EmptyState onCreate={() => void createNote(null)} />
        )}
      </section>

      <section className="flex h-full min-w-0 flex-col bg-muted/20">
        <div className="border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Preview
        </div>
        {selected ? (
          <div className="flex-1 overflow-y-auto p-4">
            <h1 className="mb-3 text-2xl font-semibold tracking-tight">
              {draftTitle || "Untitled note"}
            </h1>
            <NoteMarkdownView
              attachments={attachments}
              source={draftBody || "_Empty note_"}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Select a note on the left to start writing.
          </div>
        )}
      </section>
    </div>
  );
}

function FolderRow({
  active,
  count,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs",
        active
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      {active ? (
        <ChevronDown className="size-3" />
      ) : (
        <ChevronRight className="size-3" />
      )}
      {icon}
      <span className="truncate">{label}</span>
      <span className="ml-auto text-[10px] text-muted-foreground">{count}</span>
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
      <NotebookPen className="size-8 text-primary" />
      <p>No note selected.</p>
      <Button onClick={onCreate} size="sm" type="button" variant="outline">
        <Plus className="mr-1 size-3.5" /> Create a new note
      </Button>
    </div>
  );
}
