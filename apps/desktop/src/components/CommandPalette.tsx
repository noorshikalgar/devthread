import { useEffect, useMemo, useRef, useState } from "react";
import {
  Folder,
  ListChecks as ListTodo,
  MagnifyingGlass as Search,
} from "@phosphor-icons/react";
import type {
  Folder as FolderModel,
  Release,
  Task,
  WorkLogEntry,
} from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RELEASE_STATUS_DOT, STATUS_DOT } from "@/lib/status";
import { cn } from "@/lib/utils";

interface Result {
  id: string;
  kind: "task" | "folder" | "entry" | "release";
  title: string;
  meta?: string;
  dotColor?: string;
  group: string;
  onSelect: () => void;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  folders: FolderModel[];
  entries: WorkLogEntry[];
  releases: Release[];
  onSelectTask: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onSelectEntry: (taskId: string, entryId: string) => void;
  onSelectRelease: (name: string) => void;
}

const MAX_RESULTS = 30;
const MAX_RECENTS = 10;
const RECENT_TASKS_KEY = "devthread:command-palette-recent-tasks";

function loadRecentTaskIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_TASKS_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function pushRecentTaskId(id: string) {
  const current = loadRecentTaskIds().filter((existing) => existing !== id);
  current.unshift(id);
  localStorage.setItem(
    RECENT_TASKS_KEY,
    JSON.stringify(current.slice(0, MAX_RECENTS)),
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  tasks,
  folders,
  entries,
  releases,
  onSelectTask,
  onSelectFolder,
  onSelectEntry,
  onSelectRelease,
}: Props) {
  const [query, setQuery] = useState("");
  const [regex, setRegex] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentTaskIds, setRecentTaskIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setRecentTaskIds(loadRecentTaskIds());
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const taskById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const task of tasks) map.set(task.id, task);
    return map;
  }, [tasks]);

  const folderById = useMemo(() => {
    const map = new Map<string, FolderModel>();
    for (const folder of folders) map.set(folder.id, folder);
    return map;
  }, [folders]);

  const results = useMemo<Result[]>(() => {
    const term = query.trim();
    if (!term) {
      const out: Result[] = [];
      for (const id of recentTaskIds) {
        const task = taskById.get(id);
        if (!task) continue;
        out.push({
          id: `task:${task.id}`,
          kind: "task",
          title: task.title,
          meta: task.folderId ? folderById.get(task.folderId)?.name : undefined,
          dotColor: STATUS_DOT[task.status],
          group: "Recent",
          onSelect: () => {
            pushRecentTaskId(task.id);
            onSelectTask(task.id);
            onOpenChange(false);
          },
        });
      }
      return out;
    }
    const matcher = createMatcher(term, regex);
    if (!matcher) return [];
    const out: Result[] = [];
    for (const task of tasks) {
      if (matcher(`${task.title} ${task.status} ${task.nextStep ?? ""}`)) {
        out.push({
          id: `task:${task.id}`,
          kind: "task",
          title: task.title,
          meta: task.folderId ? folderById.get(task.folderId)?.name : undefined,
          dotColor: STATUS_DOT[task.status],
          group: "Tasks",
          onSelect: () => {
            pushRecentTaskId(task.id);
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
          meta: task?.title ?? "Unknown task",
          group: "Timeline",
          onSelect: () => {
            onSelectEntry(entry.taskId, entry.id);
            onOpenChange(false);
          },
        });
      }
    }
    for (const release of releases) {
      if (matcher(`${release.name} ${release.version ?? ""}`)) {
        out.push({
          id: `release:${release.name}`,
          kind: "release",
          title: release.name,
          meta: release.version,
          dotColor: RELEASE_STATUS_DOT[release.releaseStatus],
          group: "Releases",
          onSelect: () => {
            onSelectRelease(release.name);
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
    releases,
    folders,
    entries,
    taskById,
    folderById,
    recentTaskIds,
    onSelectTask,
    onSelectFolder,
    onSelectEntry,
    onSelectRelease,
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

  useEffect(() => {
    resultRefs.current = resultRefs.current.slice(0, results.length);
    resultRefs.current[selectedIndex]?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    });
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
              "h-5 w-7 shrink-0 rounded px-0 font-mono text-[10px]",
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
          <span className="rounded border border-border/70 px-1 py-0.5 font-mono text-[9px] uppercase leading-none text-muted-foreground">
            esc
          </span>
        </div>
        <div className="max-h-80 overflow-auto p-1.5">
          {results.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-xs text-muted-foreground">
              <div className="flex size-9 items-center justify-center rounded-full bg-muted/60">
                <ListTodo className="size-4 opacity-70" />
              </div>
              <span>
                {query.trim()
                  ? regex && !createMatcher(query.trim(), true)
                    ? "Regex pattern is not valid yet."
                    : `No matches for “${query.trim()}”.`
                  : "Type to search tasks, folders, or timeline updates. Tasks you open will show up here."}
              </span>
            </div>
          )}
          {Array.from(grouped.entries()).map(([group, items]) => (
            <div className="flex flex-col gap-0.5" key={group}>
              <p className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              {items.map((result) => {
                const index = results.indexOf(result);
                const active = index === selectedIndex;
                return (
                  <button
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left text-xs transition-colors duration-fast",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60",
                    )}
                    key={result.id}
                    onClick={result.onSelect}
                    onMouseEnter={() => setSelectedIndex(index)}
                    ref={(node) => {
                      resultRefs.current[index] = node;
                    }}
                    type="button"
                  >
                    {result.dotColor ? (
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          result.dotColor,
                        )}
                      />
                    ) : result.kind === "folder" ? (
                      <Folder className="size-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <ListTodo className="size-3 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                      {result.title}
                    </span>
                    {result.meta && (
                      <span className="max-w-[120px] shrink-0 truncate text-[10px] text-muted-foreground">
                        {result.meta}
                      </span>
                    )}
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
