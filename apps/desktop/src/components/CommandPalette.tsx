import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Folder, ListTodo, Search } from "lucide-react";
import type { Folder as FolderModel, Task, WorkLogEntry } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Result {
  id: string;
  kind: "task" | "folder" | "entry";
  title: string;
  hint: string;
  group: string;
  onSelect: () => void;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  folders: FolderModel[];
  entries: WorkLogEntry[];
  onSelectTask: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onSelectEntry: (taskId: string, entryId: string) => void;
}

const MAX_RESULTS = 30;

export function CommandPalette({
  open,
  onOpenChange,
  tasks,
  folders,
  entries,
  onSelectTask,
  onSelectFolder,
  onSelectEntry,
}: Props) {
  const [query, setQuery] = useState("");
  const [regex, setRegex] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const taskById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const task of tasks) map.set(task.id, task);
    return map;
  }, [tasks]);

  const results = useMemo<Result[]>(() => {
    const term = query.trim();
    if (!term) return [];
    const matcher = createMatcher(term, regex);
    if (!matcher) return [];
    const out: Result[] = [];
    for (const task of tasks) {
      if (matcher(`${task.title} ${task.status} ${task.nextStep ?? ""}`)) {
        out.push({
          id: `task:${task.id}`,
          kind: "task",
          title: task.title,
          hint: `Task · ${task.status}`,
          group: "Tasks",
          onSelect: () => {
            onSelectTask(task.id);
            onOpenChange(false);
          },
        });
      }
    }
    for (const folder of folders) {
      if (matcher(folder.name)) {
        out.push({
          id: `folder:${folder.id}`,
          kind: "folder",
          title: folder.name,
          hint: "Folder",
          group: "Folders",
          onSelect: () => {
            onSelectFolder(folder.id);
            onOpenChange(false);
          },
        });
      }
    }
    for (const entry of entries) {
      if (matcher(entry.contentMarkdown)) {
        const task = taskById.get(entry.taskId);
        out.push({
          id: `entry:${entry.id}`,
          kind: "entry",
          title: truncate(entry.contentMarkdown, 80),
          hint: `Update · ${task?.title ?? "Unknown task"}`,
          group: "Timeline",
          onSelect: () => {
            onSelectEntry(entry.taskId, entry.id);
            onOpenChange(false);
          },
        });
      }
    }
    return out.slice(0, MAX_RESULTS);
  }, [
    query,
    regex,
    tasks,
    folders,
    entries,
    taskById,
    onSelectTask,
    onSelectFolder,
    onSelectEntry,
    onOpenChange,
  ]);

  const grouped = useMemo(() => {
    const map = new Map<string, Result[]>();
    for (const result of results) {
      const list = map.get(result.group) ?? [];
      list.push(result);
      map.set(result.group, list);
    }
    return map;
  }, [results]);

  useEffect(() => {
    if (selectedIndex >= results.length) setSelectedIndex(0);
  }, [results, selectedIndex]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) =>
        results.length ? (index + 1) % results.length : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) =>
        results.length ? (index - 1 + results.length) % results.length : 0,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = results[selectedIndex];
      result?.onSelect();
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-label="Command palette"
        className="max-w-xl gap-0 overflow-hidden p-0 sm:rounded-md"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search and open tasks, folders, or timeline updates.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-3.5 text-muted-foreground" />
          <Input
            aria-label="Search tasks, folders, or updates"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-10 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, folders, or updates…"
            ref={inputRef}
            value={query}
          />
          <Button
            aria-label="Use regular expression"
            aria-pressed={regex}
            className={cn(
              "h-6 w-8 shrink-0 px-0 font-mono text-[11px]",
              regex && "bg-secondary text-secondary-foreground",
            )}
            onClick={() => {
              setRegex((current) => !current);
              setSelectedIndex(0);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            .*
          </Button>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            esc
          </span>
        </div>
        <div className="max-h-80 overflow-auto p-1">
          {results.length === 0 && (
            <div className="flex flex-col items-center gap-1 px-3 py-8 text-center text-xs text-muted-foreground">
              <ListTodo className="size-4 opacity-60" />
              <span>
                {query.trim()
                  ? regex && !createMatcher(query.trim(), true)
                    ? "Regex pattern is not valid yet."
                    : `No matches for “${query.trim()}”.`
                  : "Type to search tasks, folders, or timeline updates."}
              </span>
            </div>
          )}
          {Array.from(grouped.entries()).map(([group, items]) => (
            <div className="flex flex-col gap-0.5" key={group}>
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              {items.map((result) => {
                const index = results.indexOf(result);
                const active = index === selectedIndex;
                return (
                  <button
                    className={cn(
                      "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-xs",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60",
                    )}
                    key={result.id}
                    onClick={result.onSelect}
                    onMouseEnter={() => setSelectedIndex(index)}
                    type="button"
                  >
                    {result.kind === "task" && (
                      <FileText className="mt-0.5 size-3.5 text-muted-foreground" />
                    )}
                    {result.kind === "folder" && (
                      <Folder className="mt-0.5 size-3.5 text-muted-foreground" />
                    )}
                    {result.kind === "entry" && (
                      <ListTodo className="mt-0.5 size-3.5 text-muted-foreground" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-medium text-foreground">
                        {result.title}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {result.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function truncate(value: string, length: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= length) return clean;
  return `${clean.slice(0, length - 1)}…`;
}

function createMatcher(query: string, regex: boolean) {
  if (!regex) {
    const lower = query.toLowerCase();
    return (value: string) => value.toLowerCase().includes(lower);
  }
  try {
    const expression = new RegExp(query, "i");
    return (value: string) => expression.test(value);
  } catch {
    return null;
  }
}
