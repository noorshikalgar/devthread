import {
  Archive,
  ArchiveRestore,
  BarChart3,
  Check,
  Clock4,
  Copy,
  Download,
  ExternalLink,
  Filter,
  GripVertical,
  Info,
  ListTodo,
  Moon,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  check,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CommandPalette } from "@/components/CommandPalette";
import { Composer } from "@/components/Composer";
import { TaskHeader } from "@/components/TaskHeader";
import { TaskSidebar } from "@/components/TaskSidebar";
import { Timeline } from "@/components/Timeline";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import devthreadMark from "@/assets/devthread-mark.svg";
import { APP_THEMES, isAppTheme, type AppThemeId } from "@/lib/themes";
import { formatDuration } from "@/lib/duration";
import { openExternalUrl, safeExternalUrl } from "@/lib/openExternal";
import { quickLinkDraftFromUrl } from "@/lib/quickLinks";
import { STATUS_LABEL } from "@/lib/status";
import {
  DEFAULT_SUMMARY_ORDER,
  DEFAULT_SUMMARY_TEMPLATE,
  loadSummaryOrder,
  loadSummaryTemplate,
  saveSummaryOrder,
  saveSummaryTemplate,
  SUMMARY_TEMPLATE_FIELDS,
  type SummaryFieldKey,
  type SummaryTemplate,
} from "@/lib/summaryTemplate";
import { formatTaskSummary } from "@/lib/taskSummary";
import { copyFolderSummary, type FolderSummaryTask } from "@/lib/folderSummary";
import { copyFolderCsv } from "@/lib/csv";
import {
  type Attachment,
  type EntryType,
  type Folder,
  type PendingImage,
  type Task,
  type TaskQuickLink,
  type TaskStatus,
  type Visibility,
  type WorkLogEntry,
  type WorklogMetricEntry,
  type WorkLogRevision,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const SELECTED_TASK_KEY = "devthread:selected-task";
const SIDEBAR_WIDTH_KEY = "devthread:sidebar-width";
const THEME_KEY = "devthread:theme";
const DEFAULT_TASK_TITLE = "Untitled task";
const PAGE_SIZE = 100;
const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 420;
const APP_VERSION = "0.1.0";

type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "none"
  | "downloading"
  | "installed"
  | "error";
type WorkspaceMode = "tasks" | "archive" | "worklog";
type WorklogRange = "7d" | "4w" | "12w" | "12m";
interface AppContextMenuState {
  x: number;
  y: number;
  selectedText: string;
  linkUrl: string | null;
}

export { TaskHeader } from "@/components/TaskHeader";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    localStorage.getItem(SELECTED_TASK_KEY),
  );
  const [pendingTitleEdit, setPendingTitleEdit] = useState(false);
  const [entries, setEntries] = useState<WorkLogEntry[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [quickLinks, setQuickLinks] = useState<TaskQuickLink[]>([]);

  const totalMinutes = useMemo(
    () =>
      entries
        .filter((entry) => entry.entryType === "worklog")
        .reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0),
    [entries],
  );
  const [revisions, setRevisions] = useState<WorkLogRevision[]>([]);
  const [historyEntryId, setHistoryEntryId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clampSidebarWidth(Number(localStorage.getItem(SIDEBAR_WIDTH_KEY))),
  );
  const [theme, setTheme] = useState<AppThemeId>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return isAppTheme(saved) ? saved : "default-dark";
  });
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [error, setError] = useState("");
  const [entryTypeFilter, setEntryTypeFilter] = useState<EntryType | "all">(
    "all",
  );
  const [timelineSearch, setTimelineSearch] = useState("");
  const [timelineRegex, setTimelineRegex] = useState(false);
  const [timelineCompact, setTimelineCompact] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [summaryTemplate, setSummaryTemplate] = useState<SummaryTemplate>(() =>
    loadSummaryTemplate(),
  );
  const [summaryOrder, setSummaryOrder] = useState<
    ReadonlyArray<SummaryFieldKey>
  >(() => loadSummaryOrder());
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("tasks");
  const [update, setUpdate] = useState<Update | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateMessage, setUpdateMessage] = useState(
    "Check GitHub Releases when you want. Updates never run automatically.",
  );
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [worklogRange, setWorklogRange] = useState<WorklogRange>("12w");
  const [worklogMetrics, setWorklogMetrics] = useState<WorklogMetricEntry[]>(
    [],
  );
  const [worklogLoading, setWorklogLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<AppContextMenuState | null>(
    null,
  );
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedId) ?? null,
    [selectedId, tasks],
  );
  const sidebarTasks = useMemo(
    () => tasks.filter((task) => task.status !== "archived"),
    [tasks],
  );
  const archivedTasks = useMemo(
    () => tasks.filter((task) => task.status === "archived"),
    [tasks],
  );

  useEffect(() => {
    void loadTasks();
    void loadFolders();
    void checkForUpdates({ quiet: true });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const selectedTheme = APP_THEMES.find((option) => option.id === theme);
    localStorage.setItem(THEME_KEY, theme);
    root.classList.toggle("dark", selectedTheme?.dark ?? true);
    for (const option of APP_THEMES) {
      root.classList.toggle(`theme-${option.id}`, option.id === theme);
    }

    return () => {
      for (const option of APP_THEMES) {
        root.classList.remove(`theme-${option.id}`);
      }
    };
  }, [theme]);

  useEffect(() => {
    saveSummaryTemplate(summaryTemplate);
  }, [summaryTemplate]);

  useEffect(() => {
    saveSummaryOrder(summaryOrder);
  }, [summaryOrder]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    function close() {
      setContextMenu(null);
    }

    function handleContextMenu(event: globalThis.MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-radix-popper-content-wrapper]")) return;
      const selectedText = window.getSelection()?.toString().trim() ?? "";
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      const linkUrl = safeExternalUrl(link?.getAttribute("href"));

      event.preventDefault();
      if (!selectedText && !linkUrl) {
        setContextMenu(null);
        return;
      }
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        selectedText,
        linkUrl,
      });
    }

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("click", close);
    window.addEventListener("blur", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("click", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("scroll", close, true);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setEntries([]);
      setAttachments([]);
      setQuickLinks([]);
      return;
    }
    localStorage.setItem(SELECTED_TASK_KEY, selectedId);
    setEntries([]);
    setAttachments([]);
    setQuickLinks([]);
    void loadEntries(selectedId);
    void loadQuickLinks(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (workspaceMode !== "worklog") return;
    void loadWorklogMetrics(worklogRange);
  }, [workspaceMode, worklogRange]);

  const visibleEntries = useMemo(() => {
    const term = timelineSearch.trim();
    const normalizedTerm = term.toLowerCase();
    const regex =
      timelineRegex && term
        ? safelyCompileRegex(term)
        : { valid: !timelineRegex || !term, pattern: null };

    return entries.filter((entry) => {
      if (entryTypeFilter !== "all" && entry.entryType !== entryTypeFilter) {
        return false;
      }
      if (!term) return true;
      if (regex.pattern) return regex.pattern.test(entry.contentMarkdown);
      if (!regex.valid) return false;
      return entry.contentMarkdown.toLowerCase().includes(normalizedTerm);
    });
  }, [entries, entryTypeFilter, timelineRegex, timelineSearch]);

  async function loadTasks() {
    try {
      const next = await api.listTasks();
      setTasks(next);
      const saved = localStorage.getItem(SELECTED_TASK_KEY);
      if (!selectedId || !next.some((task) => task.id === selectedId)) {
        setSelectedId(
          next.find((task) => task.id === saved)?.id ?? next[0]?.id ?? null,
        );
      }
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function loadFolders() {
    try {
      setFolders(await api.listFolders());
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function loadEntries(taskId: string) {
    try {
      const next = await api.listEntries(taskId, PAGE_SIZE, 0);
      const nextAttachments = await api.listAttachments(taskId);
      setEntries(next);
      setAttachments(nextAttachments);
      setHasMore(next.length === PAGE_SIZE);
      setHistoryEntryId(null);
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function loadQuickLinks(taskId: string) {
    try {
      setQuickLinks(await api.listQuickLinks(taskId));
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function loadWorklogMetrics(range: WorklogRange) {
    setWorklogLoading(true);
    try {
      const { startAt, endAt } = worklogRangeBounds(range);
      setWorklogMetrics(await api.listWorklogMetrics(startAt, endAt));
    } catch (cause) {
      setError(String(cause));
    } finally {
      setWorklogLoading(false);
    }
  }

  async function createTask(folderId?: string | null) {
    const created = await api.createTask(DEFAULT_TASK_TITLE);
    const task =
      folderId && !created.folderId
        ? await api.moveTask(created.id, folderId)
        : created;
    setTasks((current) => [task, ...current]);
    setSelectedId(task.id);
    setPendingTitleEdit(true);
  }

  async function updateTask(task: Task) {
    const updated = await api.updateTask(task);
    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      ),
    );
  }

  async function updateTaskStatus(task: Task, status: TaskStatus) {
    if (task.status === status) return;
    const previousStatus = task.status;
    const updated = await api.updateTask({ ...task, status });
    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      ),
    );

    try {
      const entry = await api.createEntry(
        task.id,
        "status",
        `Status changed from ${STATUS_LABEL[previousStatus]} to ${STATUS_LABEL[status]}.`,
        "private",
      );
      if (selectedId === task.id) {
        setEntries((current) => [entry, ...current]);
      }
    } catch (cause) {
      setError(`Status changed, but the timeline log failed: ${cause}`);
    }
  }

  async function updateTaskEstimate(task: Task, minutes: number | null) {
    if (task.estimatedMinutes === minutes) return;
    const previous = task.estimatedMinutes;
    const updated = await api.updateTask({
      ...task,
      estimatedMinutes: minutes,
    });
    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      ),
    );

    try {
      const entry = await api.createEntry(
        task.id,
        "estimate",
        estimateChangeMessage(previous, minutes),
        "private",
        minutes,
      );
      if (selectedId === task.id) {
        setEntries((current) => [entry, ...current]);
      }
    } catch (cause) {
      setError(`Estimate changed, but the timeline log failed: ${cause}`);
    }
  }

  async function resolveQuickLinkDraft(url: string) {
    const normalized = quickLinkDraftFromUrl(url);
    if (!normalized) {
      throw new Error("Paste a valid web URL.");
    }

    let draft = normalized;
    try {
      const metadata = await api.fetchLinkPreview(normalized.url);
      draft = quickLinkDraftFromUrl(normalized.url, metadata) ?? normalized;
    } catch {
      draft = normalized;
    }
    return draft;
  }

  async function createQuickLink(url: string) {
    if (!selectedId) return;
    const draft = await resolveQuickLinkDraft(url);
    const saved = await api.createQuickLink(
      selectedId,
      draft.url,
      draft.title,
      draft.domain,
      draft.provider,
    );
    setQuickLinks((current) => {
      const withoutDuplicate = current.filter((link) => link.id !== saved.id);
      return [...withoutDuplicate, saved].slice(0, 3);
    });
  }

  async function updateQuickLink(id: string, url: string) {
    const draft = await resolveQuickLinkDraft(url);
    const saved = await api.updateQuickLink(
      id,
      draft.url,
      draft.title,
      draft.domain,
      draft.provider,
    );
    setQuickLinks((current) =>
      current.map((link) => (link.id === saved.id ? saved : link)),
    );
  }

  async function deleteQuickLink(id: string) {
    await api.deleteQuickLink(id);
    setQuickLinks((current) => current.filter((link) => link.id !== id));
  }

  async function createEntry(
    type: EntryType,
    content: string,
    visibility: Visibility,
    images: PendingImage[],
    durationMinutes: number | null = null,
  ) {
    if (!selectedId) return;
    const entry = await api.createEntry(
      selectedId,
      type,
      content,
      visibility,
      durationMinutes,
    );
    const savedImages: Attachment[] = [];
    for (const image of images) {
      try {
        savedImages.push(
          await api.createAttachment(
            entry.id,
            image.name,
            image.mediaType,
            image.base64Data,
          ),
        );
      } catch (cause) {
        setError(
          `Entry saved, but ${image.name} could not be attached: ${cause}`,
        );
      }
    }
    setEntries((current) => [entry, ...current]);
    setAttachments((current) => [...current, ...savedImages]);
    await loadTasks();
  }

  async function logTime(input: {
    occurredAt: string;
    durationMinutes: number;
    contentMarkdown: string;
    visibility: Visibility;
  }) {
    if (!selectedId) return;
    const entry = await api.createEntry(
      selectedId,
      "worklog",
      input.contentMarkdown,
      input.visibility,
      input.durationMinutes,
    );
    const stamped = { ...entry, occurredAt: input.occurredAt };
    setEntries((current) => {
      const next = [stamped, ...current];
      next.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      return next;
    });
    await loadTasks();
  }

  async function updateEntry(
    id: string,
    type: EntryType,
    content: string,
    visibility: Visibility,
  ) {
    const updated = await api.updateEntry(id, type, content, visibility);
    replaceEntry(updated);
  }

  async function showHistory(entryId: string) {
    if (historyEntryId === entryId) {
      setHistoryEntryId(null);
      return;
    }
    setRevisions(await api.listRevisions(entryId));
    setHistoryEntryId(entryId);
  }

  async function restoreRevision(revisionId: string) {
    const updated = await api.restoreRevision(revisionId);
    replaceEntry(updated);
    setRevisions(await api.listRevisions(updated.id));
  }

  async function trashEntry(entryId: string) {
    await api.trashEntry(entryId);
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    toast("Entry moved to trash.", {
      description: "You can restore it from the trash view.",
      action: {
        label: "Undo",
        onClick: () => void undoTrash(entryId),
      },
    });
  }

  async function undoTrash(entryId: string) {
    if (!selectedId) return;
    await api.restoreEntry(entryId);
    await loadEntries(selectedId);
  }

  async function loadMore() {
    if (!selectedId) return;
    const next = await api.listEntries(selectedId, PAGE_SIZE, entries.length);
    setEntries((current) => [...current, ...next]);
    setHasMore(next.length === PAGE_SIZE);
  }

  async function createFolder(name: string) {
    const folder = await api.createFolder(name);
    setFolders((current) => [...current, folder]);
  }

  async function renameFolder(folderId: string, name: string) {
    const folder = await api.renameFolder(folderId, name);
    setFolders((current) =>
      current.map((candidate) =>
        candidate.id === folder.id ? folder : candidate,
      ),
    );
  }

  async function copyFolder(
    folder: Folder,
    format: "markdown" | "csv",
    template = summaryTemplate,
    order = summaryOrder,
  ) {
    const folderTasks = tasks.filter(
      (candidate) => candidate.folderId === folder.id,
    );
    if (!folderTasks.length) {
      toast.error(`${folder.name} is empty`);
      return;
    }
    const summaries: FolderSummaryTask[] = await Promise.all(
      folderTasks.map(async (task) => {
        const [entries, quickLinks] = await Promise.all([
          api.listEntries(task.id, 1000, 0),
          api.listQuickLinks(task.id),
        ]);
        return {
          task,
          context: {
            entries,
            quickLinks,
            totalMinutes: entries.reduce(
              (total, entry) => total + (entry.durationMinutes ?? 0),
              0,
            ),
          },
        };
      }),
    );
    try {
      if (format === "csv") {
        await copyFolderCsv(folder, summaries, template, order);
        toast.success(`${folder.name} copied as CSV`);
      } else {
        await copyFolderSummary(folder, summaries, template, order);
        toast.success(`${folder.name} copied as Markdown`);
      }
    } catch (cause) {
      toast.error(`Could not copy ${folder.name}: ${String(cause)}`);
    }
  }

  async function moveTask(taskId: string, folderId: string | null) {
    const updated = await api.moveTask(taskId, folderId);
    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      ),
    );
  }

  async function deleteTask(taskId: string) {
    await api.deleteTask(taskId);
    setTasks((current) => current.filter((task) => task.id !== taskId));
    if (selectedId === taskId) {
      const next = tasks.find((task) => task.id !== taskId) ?? null;
      setSelectedId(next?.id ?? null);
    }
  }

  async function checkForUpdates(options: { quiet?: boolean } = {}) {
    setUpdateState("checking");
    if (!options.quiet) setUpdateMessage("Checking GitHub Releases...");
    setDownloadProgress(0);
    try {
      const next = await check({ timeout: 30_000 });
      if (!next) {
        setUpdate(null);
        setUpdateState("none");
        setUpdateMessage("You are already on the latest available version.");
        return;
      }
      setUpdate(next);
      setUpdateState("available");
      setUpdateMessage(
        `Version ${next.version} is available. Review it before installing.`,
      );
    } catch (cause) {
      setUpdate(null);
      setUpdateState("error");
      setUpdateMessage(
        options.quiet
          ? "Could not check for updates automatically."
          : `Could not check for updates: ${String(cause)}`,
      );
    }
  }

  async function installUpdate() {
    if (!update) return;
    setUpdateState("downloading");
    setUpdateMessage("Downloading update...");
    setDownloadProgress(0);

    let downloaded = 0;
    let total = 0;
    const onEvent = (event: DownloadEvent) => {
      if (event.event === "Started") {
        downloaded = 0;
        total = event.data.contentLength ?? 0;
        setDownloadProgress(0);
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        if (total > 0) {
          setDownloadProgress(
            Math.min(100, Math.round((downloaded / total) * 100)),
          );
        }
      } else {
        setDownloadProgress(100);
      }
    };

    try {
      await update.downloadAndInstall(onEvent, { timeout: 120_000 });
      setUpdateState("installed");
      setUpdateMessage(
        "Update installed. Restart when you are ready; your local DevThread data stays in the app-data folder.",
      );
    } catch (cause) {
      setUpdateState("error");
      setUpdateMessage(`Could not install update: ${String(cause)}`);
    }
  }

  function selectFolder(folderId: string | null) {
    if (!sidebarOpen) setSidebarOpen(true);
    const firstTask = tasks.find((task) => task.folderId === folderId);
    if (firstTask) setSelectedId(firstTask.id);
  }

  function selectEntry(taskId: string, entryId: string) {
    if (selectedId !== taskId) {
      setSelectedId(taskId);
    }
    setTimeout(() => {
      const node = document.querySelector(`[data-entry-id="${entryId}"]`);
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }

  function replaceEntry(updated: WorkLogEntry) {
    setEntries((current) =>
      current.map((entry) => (entry.id === updated.id ? updated : entry)),
    );
  }

  function startSidebarResize(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    setResizingSidebar(true);

    function move(pointer: globalThis.MouseEvent) {
      const nextWidth = clampSidebarWidth(
        startWidth + pointer.clientX - startX,
      );
      setSidebarWidth(nextWidth);
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(nextWidth));
    }

    function stop() {
      setResizingSidebar(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    }

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  }

  const statusCounts = useMemo(
    () => ({
      active: tasks.filter((task) => task.status === "active").length,
      planned: tasks.filter((task) => task.status === "planned").length,
      done: tasks.filter((task) => task.status === "done").length,
    }),
    [tasks],
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background text-foreground">
      <div className="flex min-h-0 flex-1 border-t border-border">
        <AppRail
          archiveActive={workspaceMode === "archive"}
          onArchiveToggle={() => {
            setWorkspaceMode((mode) =>
              mode === "archive" ? "tasks" : "archive",
            );
          }}
          onSearchOpen={() => setPaletteOpen(true)}
          onSettingsOpen={() => setSettingsOpen(true)}
          onTaskToggle={() => {
            if (workspaceMode !== "tasks") {
              setWorkspaceMode("tasks");
              setSidebarOpen(true);
              return;
            }
            setSidebarOpen((open) => !open);
          }}
          onWorklogOpen={() => setWorkspaceMode("worklog")}
          tasksActive={workspaceMode === "tasks"}
          tasksOpen={sidebarOpen}
          updateAvailable={updateState === "available"}
          worklogActive={workspaceMode === "worklog"}
        />

        <div
          className={cn(
            "relative h-full shrink-0 overflow-hidden border-r border-border transition-[width] duration-200 ease-out",
            resizingSidebar && "transition-none",
          )}
          style={{
            width: workspaceMode === "tasks" && sidebarOpen ? sidebarWidth : 0,
          }}
        >
          <div className="h-full" style={{ width: sidebarWidth }}>
            <TaskSidebar
              folders={folders}
              onCopyFolder={copyFolder}
              onCreate={createTask}
              onCreateFolder={createFolder}
              onDeleteTask={deleteTask}
              onMoveTask={moveTask}
              onRenameFolder={renameFolder}
              onSelect={setSelectedId}
              selectedId={selectedId}
              tasks={sidebarTasks}
            />
          </div>
          {workspaceMode === "tasks" && sidebarOpen && (
            <button
              aria-label="Resize task sidebar"
              className="absolute right-0 top-0 z-20 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40 focus-visible:bg-primary/50 focus-visible:outline-none"
              onDoubleClick={() => {
                setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
                localStorage.setItem(
                  SIDEBAR_WIDTH_KEY,
                  String(DEFAULT_SIDEBAR_WIDTH),
                );
              }}
              onMouseDown={startSidebarResize}
              type="button"
            />
          )}
        </div>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {error && (
            <Alert
              className="m-4 flex items-start gap-3 border-destructive/30 bg-destructive/5"
              variant="destructive"
            >
              <Info />
              <div className="flex-1">
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </div>
              <Button onClick={() => setError("")} size="sm" variant="ghost">
                Dismiss
              </Button>
            </Alert>
          )}
          {workspaceMode === "archive" ? (
            <ArchiveView
              folders={folders}
              onDeleteTask={deleteTask}
              onRestoreTask={(task) => updateTaskStatus(task, "planned")}
              tasks={archivedTasks}
            />
          ) : workspaceMode === "worklog" ? (
            <WorklogMetricsView
              entries={worklogMetrics}
              loading={worklogLoading}
              onRangeChange={setWorklogRange}
              range={worklogRange}
            />
          ) : selectedTask ? (
            <>
              <TaskHeader
                key={selectedTask.id}
                compactTimeline={timelineCompact}
                onCreateQuickLink={createQuickLink}
                onDelete={deleteTask}
                onDeleteQuickLink={deleteQuickLink}
                onUpdateQuickLink={updateQuickLink}
                onCompactTimelineChange={setTimelineCompact}
                onLogTime={logTime}
                onEstimateChange={(minutes) =>
                  updateTaskEstimate(selectedTask, minutes)
                }
                onPendingTitleEditConsumed={() => setPendingTitleEdit(false)}
                onStatusChange={(status) =>
                  updateTaskStatus(selectedTask, status)
                }
                onUpdate={updateTask}
                pendingTitleEdit={pendingTitleEdit}
                quickLinks={quickLinks}
                task={selectedTask}
                totalMinutes={totalMinutes}
              />
              <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1">
                <ThreadColumn
                  entryTypeFilter={entryTypeFilter}
                  onEntryTypeFilterChange={setEntryTypeFilter}
                  onRegexChange={setTimelineRegex}
                  onSearchChange={setTimelineSearch}
                  regex={timelineRegex}
                  search={timelineSearch}
                >
                  <Composer onSubmit={createEntry} taskId={selectedTask.id} />
                  <Timeline
                    attachments={attachments}
                    compact={timelineCompact}
                    entries={visibleEntries}
                    hasMore={hasMore}
                    historyEntryId={historyEntryId}
                    onEdit={updateEntry}
                    onHistory={showHistory}
                    onLoadMore={loadMore}
                    onRestoreRevision={restoreRevision}
                    onTrash={trashEntry}
                    revisions={revisions}
                  />
                </ThreadColumn>
              </div>
            </>
          ) : (
            <EmptyState onCreateTask={createTask} />
          )}
        </main>
      </div>
      <StatusBar counts={statusCounts} selectedTask={selectedTask} />
      <CommandPalette
        entries={entries}
        folders={folders}
        onOpenChange={setPaletteOpen}
        onSelectEntry={selectEntry}
        onSelectFolder={selectFolder}
        onSelectTask={setSelectedId}
        open={paletteOpen}
        tasks={tasks}
      />
      <SettingsDialog
        appVersion={APP_VERSION}
        downloadProgress={downloadProgress}
        onCheckForUpdates={() => checkForUpdates()}
        onInstallUpdate={installUpdate}
        onOpenChange={setSettingsOpen}
        onRestart={() => relaunch()}
        onSummaryTemplateChange={setSummaryTemplate}
        onSummaryTemplateReset={() => {
          setSummaryTemplate({ ...DEFAULT_SUMMARY_TEMPLATE });
          setSummaryOrder([...DEFAULT_SUMMARY_ORDER]);
        }}
        onSummaryOrderChange={setSummaryOrder}
        onThemeChange={setTheme}
        open={settingsOpen}
        summaryOrder={summaryOrder}
        summaryTemplate={summaryTemplate}
        theme={theme}
        update={update}
        updateMessage={updateMessage}
        updateState={updateState}
      />
      <AppContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
    </div>
  );
}

function AppRail({
  tasksActive,
  tasksOpen,
  archiveActive,
  onTaskToggle,
  onSearchOpen,
  onArchiveToggle,
  onWorklogOpen,
  onSettingsOpen,
  updateAvailable,
  worklogActive,
}: {
  tasksActive: boolean;
  tasksOpen: boolean;
  archiveActive: boolean;
  onTaskToggle: () => void;
  onSearchOpen: () => void;
  onArchiveToggle: () => void;
  onWorklogOpen: () => void;
  onSettingsOpen: () => void;
  updateAvailable: boolean;
  worklogActive: boolean;
}) {
  return (
    <aside className="flex h-full w-12 shrink-0 flex-col items-center border-r border-border bg-card py-3 text-card-foreground">
      <RailButton
        active={tasksActive}
        icon={ListTodo}
        label={
          tasksActive && tasksOpen ? "Hide task sidebar" : "Show task sidebar"
        }
        onClick={onTaskToggle}
        tooltip="Tasks"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="Open global search"
            className="mt-1 rounded-md"
            onClick={onSearchOpen}
            size="icon-sm"
            variant="ghost"
          >
            <Search />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Search</TooltipContent>
      </Tooltip>

      <div className="mt-auto flex flex-col gap-1">
        <RailButton
          active={worklogActive}
          icon={BarChart3}
          label="Open worklog metrics"
          onClick={onWorklogOpen}
          tooltip="Worklog"
        />
        <RailButton
          active={archiveActive}
          icon={Archive}
          label={archiveActive ? "Hide archived tasks" : "Show archived tasks"}
          onClick={onArchiveToggle}
          tooltip="Archive"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={
                updateAvailable
                  ? "Open settings. Update available."
                  : "Open settings"
              }
              className="relative"
              onClick={onSettingsOpen}
              size="icon-sm"
              variant="ghost"
            >
              <Settings />
              {updateAvailable && (
                <span
                  aria-hidden
                  className="absolute right-1 top-1 size-1.5 rounded-full bg-destructive ring-2 ring-card"
                />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {updateAvailable ? "Settings · update available" : "Settings"}
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}

function AppContextMenu({
  menu,
  onClose,
}: {
  menu: AppContextMenuState | null;
  onClose: () => void;
}) {
  if (!menu) return null;

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    onClose();
  }

  return (
    <div
      className="fixed z-50 min-w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
      onClick={(event) => event.stopPropagation()}
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.linkUrl && (
        <>
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
            onClick={() => {
              void openExternalUrl(menu.linkUrl);
              onClose();
            }}
            type="button"
          >
            <ExternalLink className="size-3.5 text-muted-foreground" />
            Open link
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
            onClick={() => void copy(menu.linkUrl!)}
            type="button"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            Copy link
          </button>
        </>
      )}
      {menu.selectedText && (
        <button
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
          onClick={() => void copy(menu.selectedText)}
          type="button"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          Copy
        </button>
      )}
    </div>
  );
}

function ArchiveView({
  folders,
  tasks,
  onRestoreTask,
  onDeleteTask,
}: {
  folders: Folder[];
  tasks: Task[];
  onRestoreTask: (task: Task) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);

  const folderNames = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders],
  );
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return tasks;
    return tasks.filter((task) =>
      `${task.title} ${folderNames.get(task.folderId ?? "") ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [folderNames, query, tasks]);
  const selectedTask =
    filtered.find((task) => task.id === selectedId) ?? filtered[0] ?? null;
  const selectedForRestore = tasks.filter((task) => checkedIds.has(task.id));

  useEffect(() => {
    if (selectedTask) setSelectedId(selectedTask.id);
    else setSelectedId(null);
  }, [selectedTask?.id]);

  async function restoreMany() {
    if (!selectedForRestore.length || busy) return;
    setBusy(true);
    try {
      await Promise.all(selectedForRestore.map((task) => onRestoreTask(task)));
      setCheckedIds(new Set());
    } finally {
      setBusy(false);
    }
  }

  async function restoreOne(task: Task) {
    if (busy) return;
    setBusy(true);
    try {
      await onRestoreTask(task);
      setCheckedIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid min-h-0 flex-1 grid-cols-[minmax(280px,380px)_minmax(0,1fr)] bg-background">
      <div className="flex min-h-0 flex-col border-r border-border bg-card/60">
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-sm font-semibold">Archive</h1>
              <p className="text-xs text-muted-foreground">
                {tasks.length} archived {tasks.length === 1 ? "task" : "tasks"}
              </p>
            </div>
            <Button
              disabled={!selectedForRestore.length || busy}
              onClick={() => void restoreMany()}
              size="sm"
              type="button"
              variant="outline"
            >
              <ArchiveRestore className="size-3.5" />
              Restore selected
            </Button>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search archived tasks"
              className="h-8 pl-7 text-xs"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search archive"
              value={query}
            />
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-2">
            {filtered.map((task) => {
              const selected = selectedTask?.id === task.id;
              return (
                <div
                  className={cn(
                    "group flex min-w-0 items-center gap-2 rounded-md border border-transparent px-2 py-2 hover:bg-accent/60",
                    selected &&
                      "border-border bg-accent text-accent-foreground",
                  )}
                  key={task.id}
                >
                  <input
                    aria-label={`Select ${task.title}`}
                    checked={checkedIds.has(task.id)}
                    className="size-3.5 shrink-0 accent-primary"
                    onChange={(event) => {
                      setCheckedIds((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(task.id);
                        else next.delete(task.id);
                        return next;
                      });
                    }}
                    type="checkbox"
                  />
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelectedId(task.id)}
                    type="button"
                  >
                    <span className="block truncate text-sm font-medium">
                      {task.title}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {folderNames.get(task.folderId ?? "") ?? "No folder"} ·{" "}
                      archived {formatShortDate(task.updatedAt)}
                    </span>
                  </button>
                </div>
              );
            })}
            {!filtered.length && (
              <div className="px-3 py-10 text-center text-xs text-muted-foreground">
                {query.trim()
                  ? "No archived tasks match this search."
                  : "No archived tasks yet."}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex min-h-0 flex-col">
        {selectedTask ? (
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-8 py-8">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Archived task
                </p>
                <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight">
                  {selectedTask.title}
                </h2>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  <ArchiveMetaChip
                    label="Folder"
                    value={
                      folderNames.get(selectedTask.folderId ?? "") ??
                      "No folder"
                    }
                  />
                  <ArchiveMetaChip
                    label="Created"
                    value={formatShortDate(selectedTask.createdAt)}
                  />
                  <ArchiveMetaChip
                    label="Archived"
                    value={formatShortDateTime(selectedTask.updatedAt)}
                  />
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  disabled={busy}
                  onClick={() => void restoreOne(selectedTask)}
                  size="sm"
                  type="button"
                >
                  <ArchiveRestore className="size-3.5" />
                  Restore
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => setTaskToDelete(selectedTask)}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </div>
            <div className="grid flex-1 place-items-center text-center text-sm text-muted-foreground">
              <div>
                <Archive className="mx-auto mb-3 size-8 opacity-60" />
                <p>
                  Restore this task to bring it back to the active workspace.
                </p>
                <p className="mt-1 text-xs">
                  Delete only when you are sure the local timeline is no longer
                  needed.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 place-items-center px-8 text-center text-sm text-muted-foreground">
            <div>
              <Archive className="mx-auto mb-3 size-8 opacity-60" />
              <p>No archived task selected.</p>
            </div>
          </div>
        )}
      </div>

      <DeleteArchiveTaskDialog
        onConfirm={async () => {
          if (!taskToDelete) return;
          await onDeleteTask(taskToDelete.id);
          setCheckedIds((current) => {
            const next = new Set(current);
            next.delete(taskToDelete.id);
            return next;
          });
          setTaskToDelete(null);
        }}
        onOpenChange={(open) => {
          if (!open) setTaskToDelete(null);
        }}
        task={taskToDelete}
      />
    </section>
  );
}

function DeleteArchiveTaskDialog({
  task,
  onOpenChange,
  onConfirm,
}: {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!task) setDeleting(false);
  }, [task]);

  if (!task) return null;

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete archived task?</DialogTitle>
          <DialogDescription>
            This permanently removes the task and timeline from this local
            workspace. Restoring keeps the history intact.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          {task.title}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={deleting}
            onClick={() => {
              setDeleting(true);
              void onConfirm().finally(() => setDeleting(false));
            }}
            type="button"
            variant="destructive"
          >
            {deleting ? "Deleting..." : "Delete task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorklogMetricsView({
  entries,
  loading,
  range,
  onRangeChange,
}: {
  entries: WorklogMetricEntry[];
  loading: boolean;
  range: WorklogRange;
  onRangeChange: (range: WorklogRange) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const days = useMemo(
    () => buildWorklogDays(range, entries),
    [entries, range],
  );
  const maxDayMinutes = Math.max(1, ...days.map((day) => day.minutes));
  const totalMinutes = entries.reduce(
    (sum, entry) => sum + entry.durationMinutes,
    0,
  );
  const loggedDays = days.filter((day) => day.minutes > 0);
  const bestDay = loggedDays.reduce<WorklogDay | null>(
    (best, day) => (!best || day.minutes > best.minutes ? day : best),
    null,
  );
  const recentEntries = selectedDay
    ? entries.filter((entry) => dayKey(entry.occurredAt) === selectedDay)
    : entries.slice(0, 12);
  const weekly = aggregateWorklog(entries, "week");
  const monthly = aggregateWorklog(entries, "month");

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-8 py-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Worklog metrics
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Time spent across tasks
          </h1>
        </div>
        <div className="flex rounded-md border border-border bg-card p-0.5">
          {WORKLOG_RANGES.map((option) => (
            <Button
              aria-pressed={range === option.value}
              className="h-7 px-2.5 text-xs"
              key={option.value}
              onClick={() => {
                setSelectedDay(null);
                onRangeChange(option.value);
              }}
              size="sm"
              type="button"
              variant={range === option.value ? "secondary" : "ghost"}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total" value={formatDuration(totalMinutes)} />
            <MetricCard
              label="Daily avg"
              value={formatDuration(
                loggedDays.length
                  ? Math.round(totalMinutes / loggedDays.length)
                  : 0,
              )}
            />
            <MetricCard
              label="Best day"
              value={bestDay ? formatDuration(bestDay.minutes) : "0m"}
              detail={bestDay ? formatShortDate(bestDay.date) : undefined}
            />
            <MetricCard label="Logged days" value={String(loggedDays.length)} />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">Daily heatmap</h2>
              <span className="text-xs text-muted-foreground">
                Darker means more logged time
              </span>
            </div>
            <div
              className="grid grid-flow-col grid-rows-7 gap-1"
              style={{
                gridAutoColumns: `minmax(0, ${range === "12m" ? "1fr" : "16px"})`,
              }}
            >
              {days.map((day) => (
                <button
                  aria-label={`${formatShortDate(day.date)} ${formatDuration(day.minutes)}`}
                  className={cn(
                    "aspect-square w-full min-w-0 rounded-[3px] border border-border/50 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    range !== "12m" && "size-4",
                    heatClass(day.minutes, maxDayMinutes),
                    selectedDay === day.key && "ring-2 ring-primary",
                  )}
                  key={day.key}
                  onClick={() =>
                    setSelectedDay((current) =>
                      current === day.key ? null : day.key,
                    )
                  }
                  title={`${formatShortDate(day.date)} · ${formatDuration(day.minutes)}`}
                  type="button"
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <WorklogBars title="Weekly totals" items={weekly} />
            <WorklogBars title="Monthly totals" items={monthly} />
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium">
                {selectedDay
                  ? `Logs on ${formatShortDate(selectedDay)}`
                  : "Recent worklogs"}
              </h2>
              {loading && (
                <span className="text-xs text-muted-foreground">
                  Loading...
                </span>
              )}
            </div>
            <div className="divide-y divide-border">
              {recentEntries.map((entry) => (
                <div
                  className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[120px_minmax(0,1fr)_auto]"
                  key={entry.id}
                >
                  <time className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {formatShortDate(entry.occurredAt)}
                  </time>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.taskTitle}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.folderName ?? "No folder"} ·{" "}
                      {stripOneLine(entry.contentMarkdown)}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-foreground">
                    {formatDuration(entry.durationMinutes)}
                  </span>
                </div>
              ))}
              {!recentEntries.length && (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No logged time in this range.
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function WorklogBars({
  title,
  items,
}: {
  title: string;
  items: { label: string; minutes: number }[];
}) {
  const max = Math.max(1, ...items.map((item) => item.minutes));
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="mt-4 space-y-2">
        {items.slice(-8).map((item) => (
          <div
            className="grid grid-cols-[74px_minmax(0,1fr)_56px] items-center gap-2 text-xs"
            key={item.label}
          >
            <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {item.label}
            </span>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(4, (item.minutes / max) * 100)}%` }}
              />
            </div>
            <span className="text-right font-mono text-[10px] text-foreground">
              {formatDuration(item.minutes)}
            </span>
          </div>
        ))}
        {!items.length && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No logged time yet.
          </p>
        )}
      </div>
    </div>
  );
}

const WORKLOG_RANGES: { value: WorklogRange; label: string; days: number }[] = [
  { value: "7d", label: "7D", days: 7 },
  { value: "4w", label: "4W", days: 28 },
  { value: "12w", label: "12W", days: 84 },
  { value: "12m", label: "12M", days: 365 },
];

interface WorklogDay {
  key: string;
  date: string;
  minutes: number;
}

function worklogRangeBounds(range: WorklogRange) {
  const days =
    WORKLOG_RANGES.find((option) => option.value === range)?.days ?? 84;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function buildWorklogDays(
  range: WorklogRange,
  entries: WorklogMetricEntry[],
): WorklogDay[] {
  const { startAt, endAt } = worklogRangeBounds(range);
  const start = new Date(startAt);
  const end = new Date(endAt);
  const minutes = new Map<string, number>();
  for (const entry of entries) {
    const key = dayKey(entry.occurredAt);
    minutes.set(key, (minutes.get(key) ?? 0) + entry.durationMinutes);
  }
  const days: WorklogDay[] = [];
  for (
    const date = new Date(start);
    date <= end;
    date.setDate(date.getDate() + 1)
  ) {
    const key = dayKey(date.toISOString());
    days.push({ key, date: key, minutes: minutes.get(key) ?? 0 });
  }
  return days;
}

function aggregateWorklog(
  entries: WorklogMetricEntry[],
  unit: "week" | "month",
) {
  const buckets = new Map<string, number>();
  for (const entry of entries) {
    const label =
      unit === "week"
        ? weekLabel(entry.occurredAt)
        : monthLabel(entry.occurredAt);
    buckets.set(label, (buckets.get(label) ?? 0) + entry.durationMinutes);
  }
  return [...buckets.entries()]
    .map(([label, minutes]) => ({ label, minutes }))
    .reverse();
}

function heatClass(minutes: number, max: number) {
  if (minutes <= 0) return "bg-muted/40";
  const ratio = minutes / max;
  if (ratio > 0.75) return "bg-emerald-500";
  if (ratio > 0.45) return "bg-emerald-500/70";
  if (ratio > 0.2) return "bg-emerald-500/45";
  return "bg-emerald-500/20";
}

function dayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function weekLabel(value: string) {
  const date = new Date(value);
  const monday = new Date(date);
  const day = (date.getDay() + 6) % 7;
  monday.setDate(date.getDate() - day);
  return `${monday.getMonth() + 1}/${monday.getDate()}`;
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "2-digit",
  }).format(new Date(value));
}

function stripOneLine(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_~>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ArchiveMetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-muted/30 px-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-foreground">{value}</span>
    </span>
  );
}

function RailButton({
  active,
  label,
  tooltip,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  tooltip: string;
  icon: typeof ListTodo;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "relative rounded-md",
            active &&
              "bg-secondary text-secondary-foreground before:absolute before:left-[-9px] before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary",
          )}
          onClick={onClick}
          size="icon-sm"
          variant="ghost"
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function StatusBar({
  counts,
  selectedTask,
}: {
  counts: { active: number; planned: number; done: number };
  selectedTask: Task | null;
}) {
  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-card px-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-foreground/80">Local-first</span>
        <span>v0.1.0</span>
        {selectedTask && (
          <span className="hidden min-w-0 truncate sm:inline">
            {selectedTask.title}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span>Active {counts.active}</span>
        <span>Todo {counts.planned}</span>
        <span>Done {counts.done}</span>
      </div>
    </footer>
  );
}

const SAMPLE_SUMMARY_TASK = {
  id: "sample-task",
  title: "Ship the summary template",
  descriptionMarkdown: "",
  status: "active" as const,
  nextStep: null,
  estimatedMinutes: 8 * 60,
  folderId: null,
  createdAt: "2025-01-01T09:00:00Z",
  updatedAt: "2025-01-02T12:30:00Z",
};

const SAMPLE_SUMMARY_ENTRIES = [
  { contentMarkdown: "Implemented the template schema", durationMinutes: 90 },
  { contentMarkdown: "Wired up the live preview", durationMinutes: 45 },
  { contentMarkdown: "Reviewed with the team", durationMinutes: 30 },
];

const SAMPLE_SUMMARY_LINKS = [
  {
    id: "link-sample",
    taskId: "sample-task",
    url: "https://figma.com/file/abc",
    title: "Header mockup",
    domain: "figma.com",
    provider: "figma",
    createdAt: "2025-01-01T10:00:00Z",
    updatedAt: "2025-01-01T10:00:00Z",
  },
];

function SummaryTab({
  template,
  order,
  onChange,
  onOrderChange,
  onReset,
}: {
  template: SummaryTemplate;
  order: ReadonlyArray<SummaryFieldKey>;
  onChange: (template: SummaryTemplate) => void;
  onOrderChange: (order: ReadonlyArray<SummaryFieldKey>) => void;
  onReset: () => void;
}) {
  const dragRef = useRef<{
    pointerId: number;
    fromIndex: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const [dragView, setDragView] = useState<{
    fromIndex: number | null;
    toIndex: number | null;
    active: boolean;
  } | null>(null);

  const preview = formatTaskSummary(
    SAMPLE_SUMMARY_TASK,
    {
      totalMinutes: 4 * 60 + 30,
      entries: SAMPLE_SUMMARY_ENTRIES,
      quickLinks: SAMPLE_SUMMARY_LINKS,
    },
    template,
    order,
  );

  function moveItem(from: number, to: number) {
    if (from === to || to < 0 || to >= order.length) return;
    const next = [...order];
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    onOrderChange(next);
  }

  function handlePointerDown(index: number) {
    return (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        fromIndex: index,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
      };
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.active && Math.hypot(dx, dy) < 4) return;
    const element = document.elementFromPoint(
      event.clientX,
      event.clientY,
    ) as HTMLElement | null;
    const row = element?.closest("[data-field-index]") as HTMLElement | null;
    const rawIndex = row
      ? Number.parseInt(row.dataset.fieldIndex ?? "-1", 10)
      : -1;
    if (rawIndex !== drag.fromIndex || drag.active) {
      drag.active = true;
    }
    const next = {
      fromIndex: drag.fromIndex,
      toIndex: rawIndex,
      active: true,
    };
    if (
      dragView?.fromIndex !== next.fromIndex ||
      dragView?.toIndex !== next.toIndex ||
      dragView?.active !== next.active
    ) {
      setDragView(next);
    }
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.active) {
      const view = dragView;
      if (
        view &&
        view.toIndex !== null &&
        view.toIndex >= 0 &&
        view.fromIndex !== view.toIndex
      ) {
        const targetIndex =
          view.toIndex > drag.fromIndex ? view.toIndex - 1 : view.toIndex;
        moveItem(drag.fromIndex, targetIndex);
      }
    }
    dragRef.current = null;
    setDragView(null);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Summary</DialogTitle>
        <DialogDescription>
          Choose which fields go into a copied task or folder summary. Drag to
          reorder — the order is also applied to folder output and CSV columns.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-6 grid min-h-0 flex-1 grid-cols-2 gap-4">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md">
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {order.map((key, index) => {
                const field = SUMMARY_TEMPLATE_FIELDS.find(
                  (candidate) => candidate.key === key,
                );
                if (!field) return null;
                const checked = template[key];
                const disabled = key === "worklogEntries" && !template.worklog;
                const isDragging =
                  dragView?.active && dragView.fromIndex === index;
                const dropTarget =
                  dragView?.active && dragView.toIndex === index;
                return (
                  <div
                    className={cn(
                      "cursor-grab touch-none rounded-md border border-transparent select-none active:cursor-grabbing",
                      dropTarget && "border-primary/60 bg-primary/5",
                      isDragging && "opacity-50",
                    )}
                    data-field-index={index}
                    key={key}
                    onPointerCancel={endDrag}
                    onPointerDown={handlePointerDown(index)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                  >
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md py-1.5 pr-2.5 select-none",
                        disabled && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <GripVertical
                        aria-hidden
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border bg-background">
                        <input
                          aria-label={field.label}
                          checked={checked}
                          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded disabled:cursor-not-allowed"
                          disabled={disabled}
                          onChange={(event) =>
                            onChange({
                              ...template,
                              [key]: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                        <Check
                          aria-hidden
                          className="pointer-events-none size-3 text-primary opacity-0 peer-checked:opacity-100"
                          strokeWidth={3}
                        />
                      </span>
                      <span className="min-w-0 truncate text-xs font-medium leading-5">
                        {field.label}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card/40">
          <div className="border-b border-border bg-card/60 px-3 py-2 text-xs font-medium text-muted-foreground">
            Preview
          </div>
          <pre
            aria-label="Summary preview"
            className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-5 text-foreground"
          >
            {preview}
          </pre>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={onReset} size="sm" type="button" variant="ghost">
          Reset to defaults
        </Button>
      </div>
    </>
  );
}

function SettingsDialog({
  appVersion,
  downloadProgress,
  open,
  summaryOrder,
  summaryTemplate,
  theme,
  update,
  updateMessage,
  updateState,
  onCheckForUpdates,
  onInstallUpdate,
  onOpenChange,
  onRestart,
  onSummaryOrderChange,
  onSummaryTemplateChange,
  onSummaryTemplateReset,
  onThemeChange,
}: {
  appVersion: string;
  downloadProgress: number;
  open: boolean;
  summaryOrder: ReadonlyArray<SummaryFieldKey>;
  summaryTemplate: SummaryTemplate;
  theme: AppThemeId;
  update: Update | null;
  updateMessage: string;
  updateState: UpdateState;
  onCheckForUpdates: () => Promise<void>;
  onInstallUpdate: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onRestart: () => Promise<void>;
  onSummaryOrderChange: (order: ReadonlyArray<SummaryFieldKey>) => void;
  onSummaryTemplateChange: (template: SummaryTemplate) => void;
  onSummaryTemplateReset: () => void;
  onThemeChange: (theme: AppThemeId) => void;
}) {
  const [tab, setTab] = useState<"general" | "summary" | "about">("general");
  const busy = updateState === "checking" || updateState === "downloading";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="grid h-[580px] w-[min(860px,calc(100vw-32px))] max-w-none grid-cols-[180px_minmax(0,1fr)] gap-0 overflow-hidden p-0">
        <aside className="border-r border-border bg-card/60 p-3">
          <DialogTitle className="px-2 py-2 text-base">Settings</DialogTitle>
          <div className="mt-3 space-y-1">
            <SettingsTabButton
              active={tab === "general"}
              label="General"
              onClick={() => setTab("general")}
            />
            <SettingsTabButton
              active={tab === "summary"}
              label="Summary"
              onClick={() => setTab("summary")}
            />
            <SettingsTabButton
              active={tab === "about"}
              label="About"
              marker={updateState === "available"}
              onClick={() => setTab("about")}
            />
          </div>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col p-6">
          {tab === "general" ? (
            <>
              <DialogHeader>
                <DialogTitle>General</DialogTitle>
                <DialogDescription>
                  Workspace preferences stored locally on this device.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-6 max-w-sm space-y-2">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="theme-select"
                >
                  Theme
                </label>
                <Select
                  onValueChange={(value) => {
                    if (isAppTheme(value)) onThemeChange(value);
                  }}
                  value={theme}
                >
                  <SelectTrigger id="theme-select">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Dark</SelectLabel>
                      {APP_THEMES.filter((option) => option.dark).map(
                        (option) => {
                          const Icon = Moon;
                          return (
                            <SelectItem key={option.id} value={option.id}>
                              <span className="inline-flex items-center gap-2">
                                <Icon className="size-3.5 text-muted-foreground" />
                                {option.label}
                              </span>
                            </SelectItem>
                          );
                        },
                      )}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Light</SelectLabel>
                      {APP_THEMES.filter((option) => !option.dark).map(
                        (option) => {
                          const Icon = Sun;
                          return (
                            <SelectItem key={option.id} value={option.id}>
                              <span className="inline-flex items-center gap-2">
                                <Icon className="size-3.5 text-muted-foreground" />
                                {option.label}
                              </span>
                            </SelectItem>
                          );
                        },
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : tab === "summary" ? (
            <SummaryTab
              onChange={onSummaryTemplateChange}
              onOrderChange={onSummaryOrderChange}
              onReset={onSummaryTemplateReset}
              order={summaryOrder}
              template={summaryTemplate}
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>About DevThread</DialogTitle>
                <DialogDescription>
                  Local-first work journal, currently in alpha.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-6 flex items-start gap-4">
                <img
                  alt=""
                  className="h-14 w-14 shrink-0"
                  src={devthreadMark}
                />
                <div className="min-w-0 space-y-1">
                  <h3 className="text-base font-semibold">DevThread</h3>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Version {appVersion}
                  </p>
                  <p className="max-w-md text-xs leading-5 text-muted-foreground">
                    Your task history and work logs stay on this machine.
                    Updates replace the app bundle only, not your local SQLite
                    workspace data.
                  </p>
                </div>
              </div>
              <div className="mt-8 rounded-md border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-sm font-medium">Updates</h3>
                    <p className="max-w-md text-xs leading-5 text-muted-foreground">
                      Optional signed releases from GitHub. You decide when to
                      install and restart.
                    </p>
                  </div>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      if (updateState === "available") {
                        void onInstallUpdate();
                      } else if (updateState === "installed") {
                        void onRestart();
                      } else {
                        void onCheckForUpdates();
                      }
                    }}
                    size="sm"
                    type="button"
                    variant={
                      updateState === "available" ? "default" : "outline"
                    }
                  >
                    {updateState === "checking" && (
                      <RefreshCw className="size-3.5 animate-spin" />
                    )}
                    {updateState === "available" && (
                      <Download className="size-3.5" />
                    )}
                    {updateState === "installed" && (
                      <RotateCcw className="size-3.5" />
                    )}
                    {updateActionLabel(updateState, update?.version)}
                  </Button>
                </div>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  {updateMessage}
                </p>
                {update?.body && updateState === "available" && (
                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground">
                    {update.body}
                  </p>
                )}
                {updateState === "downloading" && (
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function SettingsTabButton({
  active,
  label,
  marker,
  onClick,
}: {
  active: boolean;
  label: string;
  marker?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "relative flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
        active && "bg-secondary text-secondary-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      {marker && (
        <span
          aria-hidden
          className="ml-auto size-1.5 rounded-full bg-destructive"
        />
      )}
    </button>
  );
}

function updateActionLabel(state: UpdateState, version?: string) {
  if (state === "checking") return "Checking...";
  if (state === "downloading") return "Downloading...";
  if (state === "available") return `Update to ${version ?? "new version"}`;
  if (state === "installed") return "Restart DevThread";
  if (state === "error") return "Check again";
  return "Check for updates";
}

function estimateChangeMessage(previous: number | null, next: number | null) {
  if (previous && next) {
    return `Estimate changed from ${formatDuration(previous)} to ${formatDuration(next)}.`;
  }
  if (next) return `Estimate set to ${formatDuration(next)}.`;
  if (previous) return `Estimate cleared from ${formatDuration(previous)}.`;
  return "Estimate cleared.";
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function safelyCompileRegex(
  value: string,
): { valid: true; pattern: RegExp } | { valid: false; pattern: null } {
  try {
    return { valid: true, pattern: new RegExp(value, "i") };
  } catch {
    return { valid: false, pattern: null };
  }
}

function clampSidebarWidth(value: number) {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SIDEBAR_WIDTH;
  const viewportLimit =
    typeof window === "undefined"
      ? MAX_SIDEBAR_WIDTH
      : Math.min(MAX_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.42));
  return Math.min(Math.max(value, MIN_SIDEBAR_WIDTH), viewportLimit);
}

function ThreadColumn({
  children,
  search,
  regex,
  onSearchChange,
  onRegexChange,
  entryTypeFilter,
  onEntryTypeFilterChange,
}: {
  children: React.ReactNode;
  search: string;
  regex: boolean;
  onSearchChange: (value: string) => void;
  onRegexChange: (value: boolean) => void;
  entryTypeFilter: EntryType | "all";
  onEntryTypeFilterChange: (value: EntryType | "all") => void;
}) {
  const FILTERS: { value: EntryType | "all"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "worklog", label: "Worklog" },
    { value: "status", label: "Status" },
    { value: "progress", label: "Progress" },
    { value: "finding", label: "Findings" },
    { value: "estimate", label: "Estimate" },
    { value: "blocker", label: "Blockers" },
    { value: "decision", label: "Decisions" },
  ];
  const primaryFilters = FILTERS.slice(0, 4);
  const moreFilters = FILTERS.slice(4);
  const activeMoreFilter = moreFilters.find(
    (filter) => filter.value === entryTypeFilter,
  );
  const regexInvalid =
    regex && !!search.trim() && !safelyCompileRegex(search).valid;

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-background/45 px-6 py-2.5">
        <div className="relative min-w-[220px] max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search timeline"
            aria-invalid={regexInvalid}
            className={cn(
              "h-8 rounded-md pl-7 text-xs",
              search ? "pr-16" : "pr-10",
              regexInvalid &&
                "border-destructive focus-visible:ring-destructive",
            )}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search timeline…"
            value={search}
          />
          <Button
            aria-label={regex ? "Disable regex search" : "Enable regex search"}
            aria-pressed={regex}
            className={cn(
              "absolute top-1/2 h-6 -translate-y-1/2 px-1.5 font-mono text-[10px]",
              search ? "right-7" : "right-1",
              regex && "bg-secondary text-secondary-foreground",
            )}
            onClick={() => onRegexChange(!regex)}
            size="sm"
            variant={regex ? "secondary" : "ghost"}
          >
            .*
          </Button>
          {search && (
            <Button
              aria-label="Clear timeline search"
              className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground"
              onClick={() => onSearchChange("")}
              size="icon-sm"
              variant="ghost"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1">
          {primaryFilters.map((filter) => {
            const active = entryTypeFilter === filter.value;
            return (
              <Button
                aria-pressed={active}
                className={cn(
                  "h-8 rounded-md px-3 text-[11px] font-medium",
                  active && "bg-secondary text-secondary-foreground",
                )}
                key={filter.value}
                onClick={() => onEntryTypeFilterChange(filter.value)}
                size="sm"
                variant={active ? "secondary" : "ghost"}
              >
                {filter.label}
              </Button>
            );
          })}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="More timeline filters"
                className={cn(
                  "h-8 gap-1.5 rounded-md px-3 text-[11px] font-medium",
                  activeMoreFilter && "bg-secondary text-secondary-foreground",
                )}
                size="sm"
                variant={activeMoreFilter ? "secondary" : "ghost"}
              >
                <Filter className="size-3.5" />
                {activeMoreFilter?.label ?? "More"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Timeline filters</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {moreFilters.map((filter) => {
                const active = entryTypeFilter === filter.value;
                return (
                  <DropdownMenuItem
                    className={cn(active && "bg-accent")}
                    key={filter.value}
                    onSelect={() => onEntryTypeFilterChange(filter.value)}
                  >
                    <span>{filter.label}</span>
                    {active && (
                      <span className="ml-auto size-1.5 rounded-full bg-primary" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-[920px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}

function EmptyState({ onCreateTask }: { onCreateTask: () => Promise<void> }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <img alt="" className="h-12 w-12" src={devthreadMark} />
      <div className="space-y-1">
        <h1 className="text-balance text-xl font-semibold tracking-tight">
          Keep your work moving in DevThread.
        </h1>
        <p className="text-sm text-muted-foreground">
          Create a task to start capturing context, or press{" "}
          <span className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">
            ⌘K
          </span>{" "}
          to search.
        </p>
      </div>
      <Button onClick={() => void onCreateTask()} size="sm" variant="outline">
        Create new task
      </Button>
    </div>
  );
}
