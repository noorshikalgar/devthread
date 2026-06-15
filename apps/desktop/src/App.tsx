import {
  Archive,
  ArchiveRestore,
  BarChart3,
  Calendar,
  Check,
  Clock4,
  Copy,
  Download,
  ExternalLink,
  GripVertical,
  Info,
  ListTodo,
  Moon,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sun,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  check,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useShortcuts } from "@/hooks/useShortcuts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { CommandPalette } from "@/components/CommandPalette";
import { Composer } from "@/components/Composer";
import { ReleaseView } from "@/components/ReleaseView";
import { TaskHeader } from "@/components/TaskHeader";
import { TaskSidebar } from "@/components/TaskSidebar";
import { Timeline, type TimelineViewMode } from "@/components/Timeline";
import { ShortcutsTab } from "@/components/ShortcutsTab";
import { WorklogHoursChart } from "@/components/WorklogHoursChart";
import { WorklogHeatmap } from "@/components/WorklogHeatmap";
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
import {
  BREAK_MINUTES_MAX,
  BREAK_MINUTES_MIN,
  DAILY_HOURS_MAX,
  DAILY_HOURS_MIN,
  effectiveDailyGoalMinutes,
  loadWorklogSettings,
  saveWorklogSettings,
  type WorklogSettings,
} from "@/lib/worklogSettings";
import type { WorklogDay } from "@/lib/worklog";
import { aggregateByBucket } from "@/lib/worklogAggregates";
import { copyTaskSummary, formatTaskSummary } from "@/lib/taskSummary";
import { copyFolderSummary } from "@/lib/folderSummary";
import { copyFolderCsv, copyTaskCsv, type FolderSummaryTask } from "@/lib/csv";
import {
  type Attachment,
  type EntryType,
  type Folder,
  type PendingImage,
  type Release,
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
const UPDATE_AUTO_CHECK_KEY = "devthread:update-auto-check";
const UPDATE_CHECK_INTERVAL_KEY = "devthread:update-check-interval";
const UPDATE_LAST_CHECK_KEY = "devthread:update-last-check";
const DEFAULT_TASK_TITLE = "Untitled task";
const PAGE_SIZE = 100;
const UPDATE_INTERVAL_OPTIONS = [
  { value: "12h", label: "Every 12 hours", ms: 12 * 60 * 60 * 1000 },
  { value: "24h", label: "Every 24 hours", ms: 24 * 60 * 60 * 1000 },
] as const;
type UpdateInterval = (typeof UPDATE_INTERVAL_OPTIONS)[number]["value"];
const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 420;
const APP_VERSION = __APP_VERSION__;

type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "none"
  | "downloading"
  | "installed"
  | "error";
type WorkspaceMode = "tasks" | "archive" | "worklog" | "releases";
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
  const quickLinksRef = useRef<TaskQuickLink[]>([]);
  useEffect(() => {
    quickLinksRef.current = quickLinks;
  }, [quickLinks]);

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
  const [timelineViewMode, setTimelineViewMode] =
    useState<TimelineViewMode>("normal");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [taskStatusOpen, setTaskStatusOpen] = useState(false);
  const [taskLogTimeOpen, setTaskLogTimeOpen] = useState(false);
  const composerVisibilityToggleRef = useRef<(() => void) | null>(null);
  const newFolderDialogRef = useRef<(() => void) | null>(null);
  const timelineSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [summaryTemplate, setSummaryTemplate] = useState<SummaryTemplate>(() =>
    loadSummaryTemplate(),
  );
  const [summaryOrder, setSummaryOrder] = useState<
    ReadonlyArray<SummaryFieldKey>
  >(() => loadSummaryOrder());
  const [worklogSettings, setWorklogSettings] = useState<WorklogSettings>(() =>
    loadWorklogSettings(),
  );
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("tasks");
  const [update, setUpdate] = useState<Update | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateMessage, setUpdateMessage] = useState(
    "Check GitHub Releases when you want. Updates never run automatically.",
  );
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateAutoCheck, setUpdateAutoCheck] = useState<boolean>(
    () => localStorage.getItem(UPDATE_AUTO_CHECK_KEY) === "true",
  );
  const [updateInterval, setUpdateInterval] = useState<UpdateInterval>(() => {
    const stored = localStorage.getItem(UPDATE_CHECK_INTERVAL_KEY);
    return stored === "12h" ? "12h" : "24h";
  });
  const [updateLastCheck, setUpdateLastCheck] = useState<number | null>(() => {
    const stored = localStorage.getItem(UPDATE_LAST_CHECK_KEY);
    return stored ? Number(stored) : null;
  });
  const [worklogYear, setWorklogYear] = useState(() =>
    new Date().getUTCFullYear(),
  );
  const [worklogMetrics, setWorklogMetrics] = useState<WorklogMetricEntry[]>(
    [],
  );
  const [worklogHeatmapMetrics, setWorklogHeatmapMetrics] = useState<
    WorklogMetricEntry[]
  >([]);
  const [worklogLoading, setWorklogLoading] = useState(false);
  const [releases, setReleases] = useState<Release[]>([]);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
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
    void loadReleases();
  }, []);

  useEffect(() => {
    if (!updateAutoCheck) return;
    const intervalMs =
      UPDATE_INTERVAL_OPTIONS.find((option) => option.value === updateInterval)
        ?.ms ?? 24 * 60 * 60 * 1000;
    const lastCheck = updateLastCheck ?? 0;
    if (Date.now() - lastCheck < intervalMs) return;
    void checkForUpdates({ quiet: true });
    // Intentionally run only on mount — next scheduled check is on the
    // next app launch (or triggered manually from Settings).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(UPDATE_AUTO_CHECK_KEY, String(updateAutoCheck));
  }, [updateAutoCheck]);

  useEffect(() => {
    localStorage.setItem(UPDATE_CHECK_INTERVAL_KEY, updateInterval);
  }, [updateInterval]);

  useEffect(() => {
    saveWorklogSettings(worklogSettings);
  }, [worklogSettings]);

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
    setTimelineSearch("");
    setTimelineRegex(false);
    setEntryTypeFilter("all");
  }, [selectedId]);

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
    void loadWorklogMetrics(worklogYear);
  }, [workspaceMode, worklogYear]);

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

  async function loadReleases() {
    try {
      setReleases(await api.listReleases());
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function handleTagTask(taskId: string, name: string) {
    try {
      await api.tagTaskRelease(taskId, name);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, releaseName: name } : t)),
      );
    } catch (cause) {
      setError(String(cause));
      throw cause;
    }
  }

  async function handleRemoveTaskTag(taskId: string) {
    try {
      await api.removeTaskRelease(taskId);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, releaseName: null } : t)),
      );
    } catch (cause) {
      setError(String(cause));
      throw cause;
    }
  }

  async function handleTagFolderRelease(folderId: string, name: string) {
    try {
      await api.tagFolderRelease(folderId, name);
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, releaseName: name } : f)),
      );
    } catch (cause) {
      setError(String(cause));
      throw cause;
    }
  }

  async function handleRemoveFolderReleaseTag(folderId: string) {
    try {
      await api.removeFolderRelease(folderId);
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, releaseName: null } : f)),
      );
    } catch (cause) {
      setError(String(cause));
      throw cause;
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

  async function loadWorklogMetrics(year: number) {
    setWorklogLoading(true);
    try {
      const yearBounds = worklogCalendarYearBounds(year);
      const metrics = await api.listWorklogMetrics(
        yearBounds.startAt,
        yearBounds.endAt,
      );
      setWorklogMetrics(metrics);
      setWorklogHeatmapMetrics(metrics);
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

  async function enrichQuickLinkInBackground(
    taskId: string,
    linkId: string,
    url: string,
  ) {
    try {
      const metadata = await api.fetchLinkPreview(url);
      const enriched = quickLinkDraftFromUrl(url, metadata);
      if (!enriched) return;
      const current = quickLinksRef.current.find((link) => link.id === linkId);
      if (!current) return;
      if (
        current.title === enriched.title &&
        current.domain === enriched.domain &&
        current.provider === enriched.provider
      ) {
        return;
      }
      const saved = await api.updateQuickLink(
        linkId,
        enriched.url,
        enriched.title,
        enriched.domain,
        enriched.provider,
      );
      if (selectedId !== taskId) return;
      setQuickLinks((existing) =>
        existing.map((link) => (link.id === saved.id ? saved : link)),
      );
    } catch (cause) {
      console.warn("quick link preview enrichment failed", cause);
    }
  }

  async function createQuickLink(url: string) {
    if (!selectedId) return;
    const normalized = quickLinkDraftFromUrl(url);
    if (!normalized) {
      throw new Error("Paste a valid web URL.");
    }
    const saved = await api.createQuickLink(
      selectedId,
      normalized.url,
      normalized.title,
      normalized.domain,
      normalized.provider,
    );
    setQuickLinks((current) => {
      const withoutDuplicate = current.filter((link) => link.id !== saved.id);
      return [...withoutDuplicate, saved].slice(0, 3);
    });
    void enrichQuickLinkInBackground(selectedId, saved.id, saved.url);
  }

  async function updateQuickLink(id: string, url: string) {
    const normalized = quickLinkDraftFromUrl(url);
    if (!normalized) {
      throw new Error("Paste a valid web URL.");
    }
    const saved = await api.updateQuickLink(
      id,
      normalized.url,
      normalized.title,
      normalized.domain,
      normalized.provider,
    );
    setQuickLinks((current) =>
      current.map((link) => (link.id === saved.id ? saved : link)),
    );
    const taskId = saved.taskId;
    void enrichQuickLinkInBackground(taskId, saved.id, saved.url);
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
      input.occurredAt,
    );
    setEntries((current) => {
      const next = [entry, ...current];
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

  async function deleteFolder(folderId: string, mode: "cascade" | "unassign") {
    if (mode === "cascade") {
      await api.deleteFolderCascade(folderId);
      setTasks((current) =>
        current.filter((task) => task.folderId !== folderId),
      );
    } else {
      await api.unassignFolderTasks(folderId);
      await api.deleteFolder(folderId);
      setTasks((current) =>
        current.map((task) =>
          task.folderId === folderId ? { ...task, folderId: null } : task,
        ),
      );
    }
    setFolders((current) => current.filter((folder) => folder.id !== folderId));
    if (selectedId) {
      const remaining = tasks.find((task) => task.id === selectedId);
      if (!remaining || remaining.folderId === folderId) {
        setSelectedId(null);
      }
    }
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
      const now = Date.now();
      setUpdateLastCheck(now);
      localStorage.setItem(UPDATE_LAST_CHECK_KEY, String(now));
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

  useShortcuts({
    isTaskOpen: !!selectedTask,
    onTogglePalette: () => setPaletteOpen((o) => !o),
    onToggleSettings: () => setSettingsOpen((o) => !o),
    onNewTask: () => void createTask(),
    onNewFolder: () => newFolderDialogRef.current?.(),
    onToggleSidebar: () => setSidebarOpen((o) => !o),
    onToggleArchive: () =>
      setWorkspaceMode((m) => (m === "archive" ? "tasks" : "archive")),
    onOpenWorklog: () => setWorkspaceMode("worklog"),
    onEditTitle: () => {
      if (selectedTask) setPendingTitleEdit(true);
    },
    onOpenLogTime: () => {
      if (selectedTask) setTaskLogTimeOpen(true);
    },
    onCopyMarkdown: () => {
      if (selectedTask) void copyTaskSummary(selectedTask, { totalMinutes });
    },
    onCopyCsv: () => {
      if (selectedTask) void copyTaskCsv(selectedTask, { totalMinutes });
    },
    onArchiveToggle: () => {
      if (!selectedTask) return;
      const next = selectedTask.status === "archived" ? "planned" : "archived";
      void updateTaskStatus(selectedTask, next);
    },
    onDeleteTask: () => {
      if (selectedTask) setTaskToDelete(selectedTask);
    },
    onToggleComposerVisibility: () => composerVisibilityToggleRef.current?.(),
    onFocusSearch: () => {
      timelineSearchInputRef.current?.focus();
      timelineSearchInputRef.current?.select();
    },
    onNextTask: () => {
      const list = workspaceMode === "archive" ? archivedTasks : sidebarTasks;
      if (!list.length) return;
      const currentIndex = selectedId
        ? list.findIndex((t) => t.id === selectedId)
        : -1;
      const next = list[(currentIndex + 1) % list.length];
      setSelectedId(next.id);
    },
    onPrevTask: () => {
      const list = workspaceMode === "archive" ? archivedTasks : sidebarTasks;
      if (!list.length) return;
      const currentIndex = selectedId
        ? list.findIndex((t) => t.id === selectedId)
        : -1;
      const prev = list[(currentIndex - 1 + list.length) % list.length];
      setSelectedId(prev.id);
    },
  });

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background text-foreground select-none">
      <div className="flex min-h-0 flex-1 border-t border-border">
        <AppRail
          archiveActive={workspaceMode === "archive"}
          onArchiveToggle={() => {
            setWorkspaceMode((mode) =>
              mode === "archive" ? "tasks" : "archive",
            );
          }}
          onReleasesOpen={() => setWorkspaceMode("releases")}
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
          releasesActive={workspaceMode === "releases"}
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
          <div className="h-full select-none" style={{ width: sidebarWidth }}>
            <TaskSidebar
              folders={folders}
              newFolderDialogRef={newFolderDialogRef}
              onCopyFolder={copyFolder}
              onCreate={createTask}
              onCreateFolder={createFolder}
              onDeleteFolder={deleteFolder}
              onDeleteTask={deleteTask}
              onMoveTask={moveTask}
              onRemoveFolderRelease={handleRemoveFolderReleaseTag}
              onRemoveTaskRelease={handleRemoveTaskTag}
              onRenameFolder={renameFolder}
              onSelect={setSelectedId}
              onTagFolderRelease={handleTagFolderRelease}
              onTagTaskRelease={handleTagTask}
              releases={releases}
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

        <main className="flex min-h-0 min-w-0 flex-1 select-none flex-col">
          {error && (
            <Alert
              className="m-4 flex flex-wrap items-start gap-3 border-destructive/30 bg-destructive/5"
              variant="destructive"
            >
              <Info className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1 break-words">
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription className="break-words">
                  {error}
                </AlertDescription>
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
              heatmapEntries={worklogHeatmapMetrics}
              loading={worklogLoading}
              onSelectTask={(id) => {
                setSelectedId(id);
                setWorkspaceMode("tasks");
                setSidebarOpen(true);
              }}
              selectedYear={worklogYear}
              onYearChange={setWorklogYear}
              worklogSettings={worklogSettings}
            />
          ) : workspaceMode === "releases" ? (
            <ReleaseView
              folders={folders}
              onReleasesChanged={loadReleases}
              onRemoveTaskTag={handleRemoveTaskTag}
              onSelectTask={(id: string) => {
                setSelectedId(id);
                setWorkspaceMode("tasks");
                setSidebarOpen(true);
              }}
              onTagTask={handleTagTask}
              releases={releases}
              tasks={sidebarTasks}
            />
          ) : selectedTask ? (
            <>
              <TaskHeader
                key={selectedTask.id}
                timelineViewMode={timelineViewMode}
                logTimeOpen={taskLogTimeOpen}
                onCreateQuickLink={createQuickLink}
                onDelete={deleteTask}
                onDeleteQuickLink={deleteQuickLink}
                onLogTimeOpenChange={setTaskLogTimeOpen}
                onUpdateQuickLink={updateQuickLink}
                onTimelineViewModeChange={setTimelineViewMode}
                onLogTime={logTime}
                onEstimateChange={(minutes) =>
                  updateTaskEstimate(selectedTask, minutes)
                }
                onPendingTitleEditConsumed={() => setPendingTitleEdit(false)}
                onStatusChange={(status) =>
                  updateTaskStatus(selectedTask, status)
                }
                onRemoveReleaseTag={() => handleRemoveTaskTag(selectedTask.id)}
                onStatusOpenChange={setTaskStatusOpen}
                onTagRelease={(name) => handleTagTask(selectedTask.id, name)}
                onUpdate={updateTask}
                pendingTitleEdit={pendingTitleEdit}
                quickLinks={quickLinks}
                releases={releases}
                statusOpen={taskStatusOpen}
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
                  searchInputRef={timelineSearchInputRef}
                >
                  <Composer
                    onSubmit={createEntry}
                    taskId={selectedTask.id}
                    visibilityToggleRef={composerVisibilityToggleRef}
                  />
                  <Timeline
                    attachments={attachments}
                    entries={visibleEntries}
                    hasMore={hasMore}
                    historyEntryId={historyEntryId}
                    onEdit={updateEntry}
                    onHistory={showHistory}
                    onLoadMore={loadMore}
                    onRestoreRevision={restoreRevision}
                    onTrash={trashEntry}
                    revisions={revisions}
                    viewMode={timelineViewMode}
                  />
                </ThreadColumn>
              </div>
            </>
          ) : (
            <EmptyState onCreateTask={createTask} />
          )}
        </main>
      </div>
      <StatusBar
        appVersion={APP_VERSION}
        counts={statusCounts}
        selectedTask={selectedTask}
      />
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
        onUpdateAutoCheckChange={setUpdateAutoCheck}
        onUpdateIntervalChange={setUpdateInterval}
        onWorklogSettingsChange={setWorklogSettings}
        open={settingsOpen}
        summaryOrder={summaryOrder}
        summaryTemplate={summaryTemplate}
        theme={theme}
        update={update}
        updateAutoCheck={updateAutoCheck}
        updateInterval={updateInterval}
        updateLastCheck={updateLastCheck}
        updateMessage={updateMessage}
        updateState={updateState}
        worklogSettings={worklogSettings}
      />
      <AppContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
    </div>
  );
}

function AppRail({
  archiveActive,
  onArchiveToggle,
  onReleasesOpen,
  onSearchOpen,
  onSettingsOpen,
  onTaskToggle,
  onWorklogOpen,
  releasesActive,
  tasksActive,
  tasksOpen,
  updateAvailable,
  worklogActive,
}: {
  archiveActive: boolean;
  onArchiveToggle: () => void;
  onReleasesOpen: () => void;
  onSearchOpen: () => void;
  onSettingsOpen: () => void;
  onTaskToggle: () => void;
  onWorklogOpen: () => void;
  releasesActive: boolean;
  tasksActive: boolean;
  tasksOpen: boolean;
  updateAvailable: boolean;
  worklogActive: boolean;
}) {
  return (
    <aside className="flex h-full w-12 shrink-0 select-none flex-col items-center border-r border-border bg-card py-3 text-card-foreground">
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
          active={releasesActive}
          icon={Tag}
          label="Open releases"
          onClick={onReleasesOpen}
          tooltip="Releases"
        />
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
  heatmapEntries,
  loading,
  onSelectTask,
  onYearChange,
  selectedYear,
  worklogSettings,
}: {
  entries: WorklogMetricEntry[];
  heatmapEntries: WorklogMetricEntry[];
  loading: boolean;
  onSelectTask: (id: string) => void;
  onYearChange: (year: number) => void;
  selectedYear: number;
  worklogSettings: WorklogSettings;
}) {
  // Default the drill-down to the current week so the inspector and
  // period breakdown are anchored to "now" on first paint. The
  // inspector further refines to today if today has logs.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<{
    kind: "week" | "month";
    key: string;
    label: string;
  } | null>(() => {
    const today = new Date().toISOString();
    const key = weekKeyOf(today);
    return { kind: "week", key, label: weekLabel(today) };
  });
  const [periodMode, setPeriodMode] = useState<"weeks" | "months">("weeks");
  const [periodExpanded, setPeriodExpanded] = useState(false);

  // Year is a global control. Reset the drill-down selection so the
  // inspector doesn't keep pointing at a day/week/month that the new
  // year's data would no longer contain.
  const resetSelection = useCallback(() => {
    setSelectedDay(null);
    setSelectedPeriod(null);
  }, []);

  const days = useMemo(
    () => buildWorklogDays(entries, selectedYear),
    [entries, selectedYear],
  );
  const heatmapDays = useMemo(
    () => buildWorklogDays(heatmapEntries, selectedYear),
    [heatmapEntries, selectedYear],
  );
  const totalMinutes = entries.reduce(
    (sum, entry) => sum + entry.durationMinutes,
    0,
  );
  const loggedDays = days.filter((day) => day.minutes > 0);
  const bestDay = loggedDays.reduce<WorklogDay | null>(
    (best, day) => (!best || day.minutes > best.minutes ? day : best),
    null,
  );
  const latestLoggedDay = loggedDays.at(-1)?.key ?? null;
  const dailyGoalMinutes = effectiveDailyGoalMinutes(worklogSettings);
  const taskTotals = buildTaskWorklogTotals(entries);
  const goalHitDays = loggedDays.filter(
    (day) => day.minutes >= dailyGoalMinutes,
  ).length;
  const averageActiveDayMinutes = loggedDays.length
    ? Math.round(totalMinutes / loggedDays.length)
    : 0;
  const goalCoveragePercent = dailyGoalMinutes
    ? Math.min(
        100,
        Math.round((averageActiveDayMinutes / dailyGoalMinutes) * 100),
      )
    : 0;
  const remainingGapMinutes = Math.max(
    0,
    dailyGoalMinutes - averageActiveDayMinutes,
  );

  const weekly = useMemo(
    () => aggregateByBucket(entries, weekLabel, weekKeyOf),
    [entries],
  );
  const monthly = useMemo(
    () => aggregateByBucket(entries, monthLabel, monthKeyOf),
    [entries],
  );

  // The "active" selection for the inspector: an explicit week/month
  // selection wins, otherwise the selected day, otherwise the most
  // recent logged day. Falling back to "no selection" means the
  // inspector renders an empty hint.
  const inspector = useMemo(() => {
    if (selectedPeriod?.kind === "week") {
      return {
        kind: "week" as const,
        key: selectedPeriod.key,
        label: selectedPeriod.label,
        entries: entries.filter(
          (entry) => weekKeyOf(entry.occurredAt) === selectedPeriod.key,
        ),
      };
    }
    if (selectedPeriod?.kind === "month") {
      return {
        kind: "month" as const,
        key: selectedPeriod.key,
        label: selectedPeriod.label,
        entries: entries.filter(
          (entry) => monthKeyOf(entry.occurredAt) === selectedPeriod.key,
        ),
      };
    }
    const day = selectedDay ?? latestLoggedDay;
    return {
      kind: "day" as const,
      key: day,
      label: day ? formatWorklogLongDate(day) : "No day selected",
      entries: day
        ? entries.filter((entry) => dayKey(entry.occurredAt) === day)
        : [],
    };
  }, [selectedDay, selectedPeriod, latestLoggedDay, entries]);

  const yearOptions = useMemo(() => {
    const current = new Date().getUTCFullYear();
    return [current, current - 1, current - 2];
  }, []);

  function selectPeriodRow(item: { label: string; key: string }) {
    setSelectedDay(null);
    setSelectedPeriod((current) =>
      current?.key === item.key && current.kind === periodMode.slice(0, -1)
        ? null
        : {
            kind: periodMode === "weeks" ? "week" : "month",
            key: item.key,
            label: item.label,
          },
    );
  }

  function copySummaryToClipboard() {
    const lines = [
      `Worklog ${selectedYear}`,
      `Total ${formatDuration(totalMinutes)}`,
      `Logged days ${loggedDays.length}`,
      `Avg active day ${formatDuration(averageActiveDayMinutes)}`,
      bestDay
        ? `Best day ${formatWorklogDayShort(bestDay.date)} · ${formatDuration(bestDay.minutes)}`
        : "Best day —",
      `Goal hit ${goalHitDays} day${goalHitDays === 1 ? "" : "s"}`,
    ];
    void navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => toast.success("Worklog summary copied"))
      .catch((cause) =>
        toast.error(`Could not copy summary: ${String(cause)}`),
      );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-background">
      <WorklogMetricsHeader
        loading={loading}
        onCopySummary={copySummaryToClipboard}
        onYearChange={(year) => {
          resetSelection();
          onYearChange(year);
        }}
        selectedYear={selectedYear}
        yearOptions={yearOptions}
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-8 py-5 pb-16">
          <WorklogSummaryStrip
            bestDay={bestDay}
            goalHitDays={goalHitDays}
            loggedDaysCount={loggedDays.length}
            taskCount={taskTotals.length}
            totalMinutes={totalMinutes}
            year={selectedYear}
          />

          <WorklogHeatmap
            days={heatmapDays}
            goalMinutes={dailyGoalMinutes}
            onSelectDay={(day) => {
              setSelectedPeriod(null);
              setSelectedDay(day);
            }}
            range="12m"
            selectedDay={
              inspector.kind === "day" && inspector.key ? inspector.key : null
            }
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <WorklogHoursChart
              days={days}
              onSelectDay={(day) => {
                setSelectedPeriod(null);
                setSelectedDay(day);
              }}
              settings={worklogSettings}
            />
            <WorklogTaskBreakdown
              emptyHint="Only one task has logged time this year."
              items={taskTotals}
              onSelectTask={onSelectTask}
            />
          </div>

          <WorklogGoalRow
            averageActiveDayMinutes={averageActiveDayMinutes}
            bestDay={bestDay}
            dailyGoalMinutes={dailyGoalMinutes}
            goalCoveragePercent={goalCoveragePercent}
            goalHitDays={goalHitDays}
            loggedDaysCount={loggedDays.length}
            remainingGapMinutes={remainingGapMinutes}
            totalMinutes={totalMinutes}
          />

          <WorklogPeriodBreakdown
            dailyGoalMinutes={dailyGoalMinutes}
            expanded={periodExpanded}
            mode={periodMode}
            monthly={monthly}
            onExpandedChange={setPeriodExpanded}
            onModeChange={(mode) => {
              setPeriodExpanded(false);
              setPeriodMode(mode);
              // Auto-select the current period of the new mode so the
              // inspector and the row highlight track the switch
              // instead of falling back to a stale day selection.
              const today = new Date().toISOString();
              setSelectedPeriod(
                mode === "weeks"
                  ? {
                      kind: "week",
                      key: weekKeyOf(today),
                      label: weekLabel(today),
                    }
                  : {
                      kind: "month",
                      key: monthKeyOf(today),
                      label: monthLabel(today),
                    },
              );
              setSelectedDay(null);
            }}
            onSelect={selectPeriodRow}
            selectedKey={
              inspector.kind === periodMode.slice(0, -1) ? inspector.key : null
            }
            weekly={weekly}
          />

          <WorklogInspector
            inspection={inspector}
            loading={loading}
            onSelectTask={onSelectTask}
          />
        </div>
      </ScrollArea>
    </section>
  );
}

function WorklogMetricsHeader({
  loading,
  onCopySummary,
  onYearChange,
  selectedYear,
  yearOptions,
}: {
  loading: boolean;
  onCopySummary: () => void;
  onYearChange: (year: number) => void;
  selectedYear: number;
  yearOptions: ReadonlyArray<number>;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between gap-4 bg-card/70 px-6 backdrop-blur supports-[backdrop-filter]:bg-card/55">
      <div className="flex min-w-0 items-center gap-2">
        <BarChart3 className="size-4 shrink-0 text-foreground/80" />
        <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
          WorkLog
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Select
          onValueChange={(value) => onYearChange(Number.parseInt(value, 10))}
          value={String(selectedYear)}
        >
          <SelectTrigger
            aria-label="Select worklog year"
            className="h-7 w-[96px] text-xs"
          >
            <Calendar className="mr-1 size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Year</SelectLabel>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          aria-label="Copy worklog summary"
          className="h-7 gap-1.5 px-2.5 text-xs"
          disabled={loading}
          onClick={onCopySummary}
          size="sm"
          type="button"
          variant="outline"
        >
          <Download className="size-3.5" />
          Export
        </Button>
      </div>
    </header>
  );
}

function WorklogSummaryStrip({
  bestDay,
  goalHitDays,
  loggedDaysCount,
  taskCount,
  totalMinutes,
  year,
}: {
  bestDay: WorklogDay | null;
  goalHitDays: number;
  loggedDaysCount: number;
  taskCount: number;
  totalMinutes: number;
  year: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label={`Total · ${year}`}
        value={formatDuration(totalMinutes)}
      />
      <MetricCard
        label="Avg active day"
        value={formatDuration(
          loggedDaysCount ? Math.round(totalMinutes / loggedDaysCount) : 0,
        )}
      />
      <MetricCard
        label="Best day"
        value={
          bestDay
            ? `${formatWorklogDayShort(bestDay.date)} · ${formatDuration(
                bestDay.minutes,
              )}`
            : "—"
        }
      />
      <MetricCard
        label="Logged"
        value={`${loggedDaysCount} day${loggedDaysCount === 1 ? "" : "s"} · ${taskCount} task${
          taskCount === 1 ? "" : "s"
        }`}
      />
      {/*
        The Goal-hit figure is computed but reserved for the inspector
        goal context. Keeping it out of the summary strip prevents the
        four metric cards from competing with each other for attention.
      */}
      <span className="sr-only">
        {goalHitDays} day{goalHitDays === 1 ? "" : "s"} hit goal
      </span>
    </div>
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
    <div className="flex min-h-[92px] flex-col justify-center rounded-md border border-border/55 bg-card/70 px-4 py-3 shadow-sm">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 line-clamp-2 break-words text-xl font-semibold leading-tight tracking-tight">
        {value}
      </p>
      {detail && (
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {detail}
        </p>
      )}
    </div>
  );
}

interface WorklogTaskTotal {
  taskId: string;
  taskTitle: string;
  folderName: string | null;
  minutes: number;
}

function WorklogGoalRow({
  averageActiveDayMinutes,
  bestDay,
  dailyGoalMinutes,
  goalCoveragePercent,
  goalHitDays,
  loggedDaysCount,
  remainingGapMinutes,
  totalMinutes,
}: {
  averageActiveDayMinutes: number;
  bestDay: WorklogDay | null;
  dailyGoalMinutes: number;
  goalCoveragePercent: number;
  goalHitDays: number;
  loggedDaysCount: number;
  remainingGapMinutes: number;
  totalMinutes: number;
}) {
  return (
    <div className="rounded-md border border-border/55 bg-card/70 p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Goal context</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            How the year stacks up against the daily{" "}
            {formatDuration(dailyGoalMinutes)} target.
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Goal {formatDuration(dailyGoalMinutes)}/day
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Daily goal"
          value={formatDuration(dailyGoalMinutes)}
          detail="Target per workday"
        />
        <MetricCard
          label="Avg active day"
          value={formatDuration(averageActiveDayMinutes)}
          detail={`${goalCoveragePercent}% of daily goal`}
        />
        <MetricCard
          label="Best day"
          value={
            bestDay
              ? `${formatWorklogDayShort(bestDay.date)} · ${formatDuration(
                  bestDay.minutes,
                )}`
              : "—"
          }
          detail={
            bestDay
              ? `${Math.round((bestDay.minutes / dailyGoalMinutes) * 100)}% of goal`
              : "No logs yet"
          }
        />
        <MetricCard
          label="Goal hit"
          value={`${goalHitDays} day${goalHitDays === 1 ? "" : "s"}`}
          detail={
            loggedDaysCount
              ? `of ${loggedDaysCount} active day${loggedDaysCount === 1 ? "" : "s"}`
              : "No active days yet"
          }
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <div className="min-w-[240px] flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-muted/45">
            <div
              className="h-full rounded-full bg-primary/60"
              style={{ width: `${goalCoveragePercent}%` }}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {loggedDaysCount
            ? `You average ${goalCoveragePercent}% of your daily goal on active days. Avg gap is ${formatDuration(remainingGapMinutes)}/day.`
            : "Log time to start measuring against your daily goal."}
        </p>
      </div>
      {totalMinutes > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Total {formatDuration(totalMinutes)} tracked this year.
        </p>
      )}
    </div>
  );
}

function WorklogTaskBreakdown({
  emptyHint,
  items,
  onSelectTask,
}: {
  emptyHint: string;
  items: WorklogTaskTotal[];
  onSelectTask: (id: string) => void;
}) {
  const visible = items.slice(0, 5);
  const max = Math.max(1, ...items.map((item) => item.minutes));
  return (
    <div className="flex h-full min-h-[300px] flex-col rounded-md border border-border/55 bg-card/70 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Time by task</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Top {visible.length}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Tasks consuming the most time this year.
      </p>
      <div className="mt-3 flex-1 space-y-1.5">
        {visible.map((item) => {
          const token = taskToken(item.taskTitle);
          const title = token
            ? item.taskTitle.replace(new RegExp(`^${token}\\s*`), "")
            : item.taskTitle;
          return (
            <button
              className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/40"
              key={item.taskId}
              onClick={() => onSelectTask(item.taskId)}
              type="button"
            >
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  {token && (
                    <span className="shrink-0 rounded border border-border bg-muted/35 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {token}
                    </span>
                  )}
                  <span className="truncate text-xs font-medium text-foreground">
                    {title}
                  </span>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted/45">
                  <span
                    className="block h-full rounded-full bg-primary/55"
                    style={{
                      width: `${Math.max(4, (item.minutes / max) * 100)}%`,
                    }}
                  />
                </span>
              </span>
              <span className="font-mono text-xs text-foreground">
                {formatDuration(item.minutes)}
              </span>
            </button>
          );
        })}
        {items.length > 1 && items.length <= 5 && (
          <p className="px-2 pt-1 text-xs text-muted-foreground">{emptyHint}</p>
        )}
        {!items.length && (
          <p className="grid h-full place-items-center py-6 text-center text-xs text-muted-foreground">
            No task time in this range.
          </p>
        )}
      </div>
    </div>
  );
}

interface WorklogPeriodItem {
  key: string;
  label: string;
  minutes: number;
}

function WorklogPeriodBreakdown({
  dailyGoalMinutes,
  expanded,
  mode,
  monthly,
  onExpandedChange,
  onModeChange,
  onSelect,
  selectedKey,
  weekly,
}: {
  dailyGoalMinutes: number;
  expanded: boolean;
  mode: "weeks" | "months";
  monthly: WorklogPeriodItem[];
  onExpandedChange: (expanded: boolean) => void;
  onModeChange: (mode: "weeks" | "months") => void;
  onSelect: (item: { key: string; label: string }) => void;
  selectedKey: string | null;
  weekly: WorklogPeriodItem[];
}) {
  const activeItems = mode === "weeks" ? weekly : monthly;

  // When viewing weeks, default to the weeks that fall inside the
  // current calendar month (4–6 depending on the month). Every Monday
  // in that range is rendered even if the week has zero logged
  // minutes — otherwise the current week disappears until the user
  // logs their first entry of the week. "View all" shows every
  // week/month in the year with internal scroll.
  const visibleItems = useMemo(() => {
    const today = new Date();
    const itemsByKey = new Map(activeItems.map((item) => [item.key, item]));

    if (mode === "weeks") {
      const currentMondayKey = weekKeyOf(today.toISOString());

      if (expanded) {
        // Walk every Monday from the start of the year up to and
        // including the current week, newest first, so an empty
        // current week is never lost when the user expands the list.
        const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
        const cursor = new Date(yearStart);
        const daysBack = (cursor.getUTCDay() + 6) % 7;
        cursor.setUTCDate(cursor.getUTCDate() - daysBack);
        const mondayKeys: string[] = [];
        while (cursor.toISOString().slice(0, 10) <= currentMondayKey) {
          mondayKeys.push(cursor.toISOString().slice(0, 10));
          cursor.setUTCDate(cursor.getUTCDate() + 7);
        }
        return mondayKeys.reverse().map((key) => {
          const existing = itemsByKey.get(key);
          return existing ?? { key, label: weekLabel(key), minutes: 0 };
        });
      }

      // Default: weeks of the current month whose Monday has
      // already passed, newest first. Future weeks of the month
      // are hidden — they get added as the week starts.
      const year = today.getUTCFullYear();
      const month = today.getUTCMonth();
      const monthStart = new Date(Date.UTC(year, month, 1));
      const monthEnd = new Date(Date.UTC(year, month + 1, 0));
      const cursor = new Date(monthStart);
      const daysBack = (cursor.getUTCDay() + 6) % 7;
      cursor.setUTCDate(cursor.getUTCDate() - daysBack);
      const mondayKeys: string[] = [];
      while (cursor <= monthEnd) {
        const key = cursor.toISOString().slice(0, 10);
        if (key <= currentMondayKey) mondayKeys.push(key);
        cursor.setUTCDate(cursor.getUTCDate() + 7);
      }
      return mondayKeys.reverse().map((key) => {
        const existing = itemsByKey.get(key);
        return existing ?? { key, label: weekLabel(key), minutes: 0 };
      });
    }

    // Months: default to the current month and the 4 previous
    // months (5 rows), newest first. The current month is always
    // rendered, even if it has no entries yet, so the user can
    // click into it from the breakdown.
    const currentMonthKey = monthKeyOf(today.toISOString());
    const [year, monthNum] = currentMonthKey.split("-").map(Number);
    const monthKeys: string[] = [];
    for (let offset = 0; offset < 5; offset += 1) {
      const d = new Date(Date.UTC(year, monthNum - 1 - offset, 1));
      monthKeys.push(monthKeyOf(d.toISOString()));
    }
    const baseItems = monthKeys
      .reverse()
      .map(
        (key) =>
          itemsByKey.get(key) ?? { key, label: monthLabel(key), minutes: 0 },
      );

    if (!expanded) return baseItems;

    // Expanded: every month from January up to and including the
    // current month, newest first, with synthetic 0-minute rows
    // for any month that has no entries yet.
    const allKeys: string[] = [];
    for (let m = 0; m < monthNum; m += 1) {
      allKeys.push(monthKeyOf(new Date(Date.UTC(year, m, 1)).toISOString()));
    }
    allKeys.push(currentMonthKey);
    return allKeys.reverse().map((key) => {
      return itemsByKey.get(key) ?? { key, label: monthLabel(key), minutes: 0 };
    });
  }, [activeItems, expanded, mode]);

  // The bar and the percent both measure "share of the
  // week/month goal". A week counts 5 workdays, a month 20.
  const goalMinutes =
    mode === "weeks" ? dailyGoalMinutes * 5 : dailyGoalMinutes * 20;

  return (
    <div className="flex flex-col rounded-md border border-border/55 bg-card/70 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Period breakdown</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Logged time per {mode === "weeks" ? "week" : "month"}. The bar shows
            share of the {formatDuration(goalMinutes)}{" "}
            {mode === "weeks" ? "weekly" : "monthly"} goal. Click a row to
            inspect.
          </p>
        </div>
        <div
          aria-label="Period mode"
          className="flex rounded-md border border-border/60 bg-muted/20 p-0.5"
          role="tablist"
        >
          {(["weeks", "months"] as const).map((option) => (
            <button
              aria-pressed={mode === option}
              className={cn(
                "h-7 rounded px-2.5 text-xs capitalize text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground",
                mode === option && "bg-accent text-foreground shadow-sm",
              )}
              key={option}
              onClick={() => onModeChange(option)}
              role="tab"
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div
        className={cn(
          "mt-3 space-y-1",
          expanded && "max-h-[260px] overflow-y-auto pr-1",
        )}
      >
        {visibleItems.map((item) => {
          // Clamp the visual fill at 100% so a week that overshoots
          // the goal doesn't run off the track, but keep the raw
          // percent in the label so the user can see they beat it.
          // Zero minutes = no fill, not the 4% floor — an empty bar
          // honestly reads as "no progress this week".
          const rawPercent = goalMinutes
            ? Math.round((item.minutes / goalMinutes) * 100)
            : 0;
          const hasProgress = item.minutes > 0;
          const fillPercent = hasProgress
            ? Math.max(4, Math.min(100, rawPercent))
            : 0;
          const hitGoal = item.minutes >= goalMinutes && goalMinutes > 0;
          const selected = item.key === selectedKey;
          return (
            <button
              aria-pressed={selected}
              className={cn(
                "grid w-full grid-cols-[132px_minmax(80px,1fr)_84px_44px] items-center gap-3 rounded-md px-2 py-1.5 text-xs transition-colors",
                selected
                  ? "bg-accent/45 text-foreground"
                  : "hover:bg-accent/30",
                !hasProgress && "text-muted-foreground",
              )}
              key={item.key}
              onClick={() => onSelect(item)}
              type="button"
            >
              <span className="truncate text-left">{item.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-muted/45">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    hitGoal ? "bg-emerald-400/70" : "bg-primary/55",
                  )}
                  style={{ width: `${fillPercent}%` }}
                />
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-right font-mono text-xs tabular-nums",
                  hasProgress ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {formatDuration(item.minutes)}
              </span>
              <span
                className={cn(
                  "text-right font-mono text-[10px] tabular-nums",
                  hitGoal
                    ? "text-emerald-400"
                    : rawPercent >= 75
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {rawPercent}%
              </span>
            </button>
          );
        })}
        {!activeItems.length && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No logged time yet.
          </p>
        )}
      </div>
      {!!activeItems.length && activeItems.length > 5 && (
        <button
          className="mt-2 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => onExpandedChange(!expanded)}
          type="button"
        >
          {expanded
            ? mode === "weeks"
              ? "Show this month"
              : "Show less"
            : "View all"}
        </button>
      )}
    </div>
  );
}

interface WorklogInspection {
  kind: "day" | "week" | "month";
  key: string | null;
  label: string;
  entries: WorklogMetricEntry[];
}

function WorklogInspector({
  inspection,
  loading,
  onSelectTask,
}: {
  inspection: WorklogInspection;
  loading: boolean;
  onSelectTask: (id: string) => void;
}) {
  const { kind, label, entries: scopedEntries } = inspection;
  const minutes = scopedEntries.reduce(
    (sum, entry) => sum + entry.durationMinutes,
    0,
  );
  const taskCount = new Set(scopedEntries.map((entry) => entry.taskId)).size;
  const periodKindLabel =
    kind === "day" ? "day" : kind === "week" ? "week" : "month";

  // Cap the visible logs so a busy day doesn't push the page
  // around. Internal scroll takes over beyond 10 rows, matching the
  // period breakdown's behaviour.
  const MAX_VISIBLE_LOGS = 10;
  const visibleLogs = scopedEntries.slice(0, MAX_VISIBLE_LOGS);
  const logsScrollable = scopedEntries.length > MAX_VISIBLE_LOGS;

  return (
    <div className="rounded-md border border-border/55 bg-card/70 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="shrink-0 text-sm font-medium">Inspector</h2>
          <span className="text-muted-foreground/50">·</span>
          <p className="truncate text-sm text-foreground">{label}</p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {formatDuration(minutes)} logged · {taskCount} task
          {taskCount === 1 ? "" : "s"}
          {loading && " · Loading…"}
        </p>
      </div>

      {/* Logs: single-column rows that grow with content and cap at
          10 before an internal scroll takes over. Each row holds
          time, task chip, title, folder, and duration on one line. */}
      <div className={cn(logsScrollable && "max-h-[360px] overflow-y-auto")}>
        {visibleLogs.map((entry) => {
          const token = taskToken(entry.taskTitle);
          const title = token
            ? entry.taskTitle.replace(new RegExp(`^${token}\\s*`), "")
            : entry.taskTitle;
          return (
            <button
              className="grid w-full grid-cols-[68px_minmax(0,1fr)_minmax(0,160px)_72px] items-center gap-3 border-b border-border/60 px-4 py-1.5 text-left text-sm transition-colors hover:bg-accent/35 last:border-b-0"
              key={entry.id}
              onClick={() => onSelectTask(entry.taskId)}
              type="button"
            >
              <time className="font-mono text-xs tabular-nums text-foreground/70">
                {formatWorklogTime(entry.occurredAt)}
              </time>
              <span className="flex min-w-0 items-center gap-2">
                {token && (
                  <span className="shrink-0 rounded border border-border bg-muted/35 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {token}
                  </span>
                )}
                <span className="truncate text-sm font-medium text-foreground">
                  {title}
                </span>
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {entry.folderName ?? "No folder"}
              </span>
              <span className="whitespace-nowrap text-right font-mono text-xs tabular-nums text-foreground">
                {formatDuration(entry.durationMinutes)}
              </span>
            </button>
          );
        })}
        {!scopedEntries.length && (
          <div className="grid place-items-center px-4 py-10 text-center text-sm text-muted-foreground">
            {kind === "day"
              ? "Select a day from the heatmap or chart to inspect logged work."
              : `No logged time in this ${periodKindLabel}.`}
          </div>
        )}
      </div>
    </div>
  );
}

function daysInMonth(monthKey: string | null): number {
  if (!monthKey) return 0;
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function worklogCalendarYearBounds(reference: Date | number = new Date()) {
  const year =
    typeof reference === "number" ? reference : reference.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function buildWorklogDays(
  entries: WorklogMetricEntry[],
  year: number,
): WorklogDay[] {
  const { startAt, endAt } = worklogCalendarYearBounds(year);
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
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const key = dayKey(date.toISOString());
    days.push({ key, date: key, minutes: minutes.get(key) ?? 0 });
  }
  return days;
}

function dayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function weekStart(value: string) {
  const date = new Date(value);
  const day = (date.getDay() + 6) % 7;
  const monday = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - day,
    ),
  );
  return monday.toISOString().slice(0, 10);
}

function monthStart(value: string) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function weekLabel(value: string) {
  return `Week of ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(weekStart(value)))}`;
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function weekKeyOf(value: string) {
  return weekStart(value);
}

function monthKeyOf(value: string) {
  return monthStart(value);
}

function buildTaskWorklogTotals(
  entries: WorklogMetricEntry[],
): WorklogTaskTotal[] {
  const totals = new Map<string, WorklogTaskTotal>();
  for (const entry of entries) {
    const current = totals.get(entry.taskId);
    if (current) {
      current.minutes += entry.durationMinutes;
    } else {
      totals.set(entry.taskId, {
        taskId: entry.taskId,
        taskTitle: entry.taskTitle,
        folderName: entry.folderName,
        minutes: entry.durationMinutes,
      });
    }
  }
  return [...totals.values()].sort((a, b) => b.minutes - a.minutes);
}

function taskToken(value: string) {
  return value.match(/\b[A-Z]{2,}-\d+\b/)?.[0] ?? null;
}

function formatWorklogDayShort(value: string) {
  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfValue = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfValue.getTime()) / 86_400_000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  const weekday = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
  }).format(date);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${weekday} · ${day}/${month}`;
}

function formatWorklogLongDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatWorklogTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
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
  appVersion,
  counts,
  selectedTask,
}: {
  appVersion: string;
  counts: { active: number; planned: number; done: number };
  selectedTask: Task | null;
}) {
  const selectedTaskToken = selectedTask?.title.match(/\b[A-Z]{2,}-\d+\b/)?.[0];
  const selectedTaskTitle =
    selectedTask && selectedTaskToken
      ? selectedTask.title.replace(new RegExp(`^${selectedTaskToken}\\s*`), "")
      : selectedTask?.title;

  return (
    <footer className="flex h-7 shrink-0 select-none items-center justify-between gap-3 border-t border-border bg-card px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 text-foreground/85">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/45" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          Local-first
        </span>
        <span className="text-muted-foreground/80">v{appVersion}</span>
        {selectedTask && (
          <>
            {selectedTaskToken && (
              <span className="hidden rounded bg-muted/70 px-1.5 py-0.5 text-[10px] text-foreground/80 sm:inline">
                {selectedTaskToken}
              </span>
            )}
            <span className="hidden min-w-0 truncate text-muted-foreground/90 md:inline">
              {selectedTaskTitle}
            </span>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2.5 text-[10px] sm:text-[11px]">
        <span className="text-foreground/85">Active {counts.active}</span>
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
  releaseName: null,
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
  // Markdown collapses single newlines into spaces, so for the preview
  // we walk line-by-line and insert a blank line on both sides of any
  // non-list line. Consecutive list items stay glued together so the
  // worklog / quick-links lists render as a single <ul>, and a
  // non-list line that follows a list gets a blank line before it
  // (otherwise Markdown treats it as a lazy continuation of the last
  // list item and renders it inline).
  const previewBlocks = preview
    ? preview
        .split("\n")
        .reduce<string[]>((acc, line) => {
          const isList = line.startsWith("- ");
          const prev = acc.length ? acc[acc.length - 1] : "";
          const prevIsList = prev.startsWith("- ");
          if (!isList && prevIsList) acc.push("");
          acc.push(line);
          if (!isList) acc.push("");
          return acc;
        }, [])
        .join("\n")
    : "";
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
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      dragRef.current = {
        pointerId,
        fromIndex: index,
        startX,
        startY,
        active: false,
      };

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const drag = dragRef.current;
        if (!drag) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!drag.active && Math.hypot(dx, dy) < 4) return;
        if (!drag.active) {
          drag.active = true;
        }
        const element = document.elementFromPoint(
          ev.clientX,
          ev.clientY,
        ) as HTMLElement | null;
        const row = element?.closest(
          "[data-field-index]",
        ) as HTMLElement | null;
        const rawIndex = row
          ? Number.parseInt(row.dataset.fieldIndex ?? "-1", 10)
          : -1;
        setDragView({
          fromIndex: drag.fromIndex,
          toIndex: rawIndex,
          active: true,
        });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        const drag = dragRef.current;
        if (!drag) return;
        if (drag.active) {
          setDragView((view) => {
            if (
              view &&
              view.active &&
              view.toIndex !== null &&
              view.toIndex >= 0 &&
              view.fromIndex !== view.toIndex
            ) {
              moveItem(drag.fromIndex, view.toIndex);
            }
            return null;
          });
        }
        dragRef.current = null;
        setDragView(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    };
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
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
              Toggle which items to include in the copy
            </div>
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
                    onPointerDown={handlePointerDown(index)}
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
            Markdown preview
          </div>
          <div
            aria-label="Summary preview"
            className="markdown min-h-0 flex-1 overflow-auto p-3 text-xs leading-5"
          >
            {previewBlocks ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {previewBlocks}
              </ReactMarkdown>
            ) : (
              <p className="text-muted-foreground">
                No fields selected — the copy would be empty.
              </p>
            )}
          </div>
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
  updateAutoCheck,
  updateInterval,
  updateLastCheck,
  updateMessage,
  updateState,
  worklogSettings,
  onCheckForUpdates,
  onInstallUpdate,
  onOpenChange,
  onRestart,
  onSummaryOrderChange,
  onSummaryTemplateChange,
  onSummaryTemplateReset,
  onThemeChange,
  onUpdateAutoCheckChange,
  onUpdateIntervalChange,
  onWorklogSettingsChange,
}: {
  appVersion: string;
  downloadProgress: number;
  open: boolean;
  summaryOrder: ReadonlyArray<SummaryFieldKey>;
  summaryTemplate: SummaryTemplate;
  theme: AppThemeId;
  update: Update | null;
  updateAutoCheck: boolean;
  updateInterval: UpdateInterval;
  updateLastCheck: number | null;
  updateMessage: string;
  updateState: UpdateState;
  worklogSettings: WorklogSettings;
  onCheckForUpdates: () => Promise<void>;
  onInstallUpdate: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onRestart: () => Promise<void>;
  onSummaryOrderChange: (order: ReadonlyArray<SummaryFieldKey>) => void;
  onSummaryTemplateChange: (template: SummaryTemplate) => void;
  onSummaryTemplateReset: () => void;
  onThemeChange: (theme: AppThemeId) => void;
  onUpdateAutoCheckChange: (enabled: boolean) => void;
  onUpdateIntervalChange: (interval: UpdateInterval) => void;
  onWorklogSettingsChange: (settings: WorklogSettings) => void;
}) {
  const [tab, setTab] = useState<
    "general" | "summary" | "shortcuts" | "updates" | "about"
  >("general");
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
              active={tab === "shortcuts"}
              label="Shortcuts"
              onClick={() => setTab("shortcuts")}
            />
            <SettingsTabButton
              active={tab === "updates"}
              label="Updates"
              marker={updateState === "available"}
              onClick={() => setTab("updates")}
            />
            <SettingsTabButton
              active={tab === "about"}
              label="About"
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

              <div className="mt-8 max-w-sm space-y-2 border-t border-border pt-6">
                <h3 className="text-sm font-medium">Worklog</h3>
                <p className="text-xs leading-5 text-muted-foreground">
                  Used by the worklog charts. Set your target hours per workday
                  and subtract any non-billable break time.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor="worklog-daily-hours"
                    >
                      Hours per day
                    </label>
                    <Input
                      aria-label="Hours per day"
                      className="h-8 text-xs"
                      id="worklog-daily-hours"
                      max={DAILY_HOURS_MAX}
                      min={DAILY_HOURS_MIN}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        if (Number.isFinite(next)) {
                          onWorklogSettingsChange({
                            ...worklogSettings,
                            dailyHours: next,
                          });
                        }
                      }}
                      step="0.5"
                      type="number"
                      value={worklogSettings.dailyHours}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor="worklog-break-minutes"
                    >
                      Break (minutes)
                    </label>
                    <Input
                      aria-label="Break minutes"
                      className="h-8 text-xs"
                      id="worklog-break-minutes"
                      max={BREAK_MINUTES_MAX}
                      min={BREAK_MINUTES_MIN}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        if (Number.isFinite(next)) {
                          onWorklogSettingsChange({
                            ...worklogSettings,
                            breakMinutes: next,
                          });
                        }
                      }}
                      step="5"
                      type="number"
                      value={worklogSettings.breakMinutes}
                    />
                  </div>
                </div>
                <p className="pt-1 font-mono text-[10px] text-muted-foreground">
                  Effective goal:{" "}
                  {formatDuration(effectiveDailyGoalMinutes(worklogSettings))} /
                  day
                </p>
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
          ) : tab === "shortcuts" ? (
            <ShortcutsTab />
          ) : tab === "updates" ? (
            <>
              <DialogHeader>
                <DialogTitle>Updates</DialogTitle>
                <DialogDescription>
                  Optional signed releases from GitHub. You decide when to
                  install and restart.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-6 space-y-4">
                <div className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-sm font-medium">Automatic checks</h3>
                      <p className="max-w-md text-xs leading-5 text-muted-foreground">
                        Periodically contact GitHub for a new release. Nothing
                        downloads or installs without your approval.
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-xs">
                      <input
                        checked={updateAutoCheck}
                        onChange={(event) =>
                          onUpdateAutoCheckChange(event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>{updateAutoCheck ? "Enabled" : "Disabled"}</span>
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Check every</span>
                    <Select
                      disabled={!updateAutoCheck}
                      onValueChange={(value) => {
                        if (value === "12h" || value === "24h") {
                          onUpdateIntervalChange(value);
                        }
                      }}
                      value={updateInterval}
                    >
                      <SelectTrigger className="h-7 w-[140px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UPDATE_INTERVAL_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                      {formatLastCheck(updateLastCheck)}
                    </span>
                  </div>
                </div>
                <div className="rounded-md border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-sm font-medium">Current status</h3>
                      <p
                        className={cn(
                          "max-w-md text-xs leading-5",
                          updateState === "error"
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {updateMessage}
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
                  {update?.body && updateState === "available" && (
                    <p className="mt-4 line-clamp-6 whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground">
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
              </div>
            </>
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

function formatLastCheck(timestamp: number | null): string {
  if (timestamp === null) return "Never checked";
  const date = new Date(timestamp);
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Checked just now";
  if (minutes < 60) return `Checked ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Checked ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Checked ${days}d ago`;
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
  searchInputRef,
}: {
  children: React.ReactNode;
  search: string;
  regex: boolean;
  onSearchChange: (value: string) => void;
  onRegexChange: (value: boolean) => void;
  entryTypeFilter: EntryType | "all";
  onEntryTypeFilterChange: (value: EntryType | "all") => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
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
      <div className="flex flex-wrap items-center gap-2 bg-card/45 px-6 py-2.5">
        <div className="relative min-w-[220px] max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search timeline"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={regexInvalid}
            className={cn(
              "h-8 rounded-md pl-7 text-xs",
              search ? "pr-16" : "pr-10",
              regexInvalid &&
                "border-destructive focus-visible:ring-destructive",
            )}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search timeline…"
            ref={searchInputRef}
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
                <MoreHorizontal
                  className="size-4 opacity-80"
                  strokeWidth={1.75}
                />
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
  const isMac = /Mac|iPhone|iPad/i.test(navigator.platform);
  const shortcut = isMac ? "⌘K" : "Ctrl + K";
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
            {shortcut}
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
