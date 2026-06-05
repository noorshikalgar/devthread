import { convertFileSrc } from "@tauri-apps/api/core";
import { ExternalLink, History, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { extractLinkPreviews, isLongEntry } from "@/lib/content";
import {
  type Attachment,
  type EntryType,
  type LinkMetadata,
  type Visibility,
  type WorkLogEntry,
  type WorkLogRevision,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  entries: WorkLogEntry[];
  attachments: Attachment[];
  revisions: WorkLogRevision[];
  historyEntryId: string | null;
  hasMore: boolean;
  onEdit: (
    id: string,
    type: EntryType,
    content: string,
    visibility: Visibility,
  ) => Promise<void>;
  onHistory: (id: string) => Promise<void>;
  onRestoreRevision: (id: string) => Promise<void>;
  onTrash: (id: string) => Promise<void>;
  onLoadMore: () => Promise<void>;
}

const ENTRY_LABELS: Record<EntryType, string> = {
  note: "Note",
  progress: "Progress",
  finding: "Finding",
  blocker: "Blocker",
  decision: "Decision",
  next_step: "Next step",
};

const TYPE_BADGE: Record<
  EntryType,
  "default" | "secondary" | "outline" | "success" | "warning" | "info"
> = {
  progress: "default",
  next_step: "info",
  finding: "success",
  blocker: "warning",
  decision: "secondary",
  note: "outline",
};

const TYPE_DOT: Record<EntryType, string> = {
  progress: "bg-sky-500",
  next_step: "bg-sky-500",
  finding: "bg-emerald-500",
  blocker: "bg-amber-500",
  decision: "bg-violet-500",
  note: "bg-muted-foreground",
};

export function Timeline({
  entries,
  attachments,
  revisions,
  historyEntryId,
  hasMore,
  onEdit,
  onHistory,
  onRestoreRevision,
  onTrash,
  onLoadMore,
}: Props) {
  if (!entries.length) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <p className="font-medium text-foreground">No updates yet.</p>
        <p>Record the first thing that happened.</p>
      </div>
    );
  }

  const groups = groupByDate(entries);

  return (
    <section aria-label="Task timeline" className="flex flex-col gap-8 pt-6">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {group.label}
            </h2>
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10px] text-muted-foreground/70">
              {group.items.length}
            </span>
          </div>
          <ol className="flex flex-col gap-1">
            {group.items.map((entry) => (
              <TimelineEntry
                attachments={attachments.filter(
                  (attachment) => attachment.workLogEntryId === entry.id,
                )}
                entry={entry}
                historyOpen={historyEntryId === entry.id}
                key={entry.id}
                onEdit={onEdit}
                onHistory={onHistory}
                onRestoreRevision={onRestoreRevision}
                onTrash={onTrash}
                revisions={historyEntryId === entry.id ? revisions : []}
              />
            ))}
          </ol>
        </div>
      ))}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button onClick={() => void onLoadMore()} size="sm" variant="outline">
            Load older updates
          </Button>
        </div>
      )}
    </section>
  );
}

interface EntryProps {
  entry: WorkLogEntry;
  attachments: Attachment[];
  revisions: WorkLogRevision[];
  historyOpen: boolean;
  onEdit: Props["onEdit"];
  onHistory: Props["onHistory"];
  onRestoreRevision: Props["onRestoreRevision"];
  onTrash: Props["onTrash"];
}

function TimelineEntry({
  entry,
  attachments,
  revisions,
  historyOpen,
  onEdit,
  onHistory,
  onRestoreRevision,
  onTrash,
}: EntryProps) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(entry.contentMarkdown);
  const [expanded, setExpanded] = useState(false);
  const [linkMetadata, setLinkMetadata] = useState<
    Record<string, LinkMetadata | null>
  >({});

  async function save() {
    await onEdit(entry.id, entry.entryType, content, entry.visibility);
    setEditing(false);
  }

  const edited = entry.updatedAt !== entry.createdAt;
  const long = isLongEntry(entry.contentMarkdown);
  const links = extractLinkPreviews(entry.contentMarkdown);

  useEffect(() => {
    let cancelled = false;
    const missing = links.filter((link) => !(link.url in linkMetadata));
    if (!missing.length) return;

    for (const link of missing) {
      void api
        .fetchLinkPreview(link.url)
        .then((metadata) => {
          if (cancelled) return;
          setLinkMetadata((current) => ({
            ...current,
            [link.url]: metadata,
          }));
        })
        .catch(() => {
          if (cancelled) return;
          setLinkMetadata((current) => ({
            ...current,
            [link.url]: null,
          }));
        });
    }

    return () => {
      cancelled = true;
    };
  }, [links, linkMetadata]);

  return (
    <li
      className={cn(
        "group relative grid grid-cols-[28px_56px_minmax(0,1fr)_auto] gap-3 rounded-md px-2 py-3 transition-colors hover:bg-accent/40",
      )}
      data-entry-id={entry.id}
    >
      <div className="relative flex justify-center pt-1.5">
        <span
          aria-hidden
          className={cn(
            "z-10 size-2 rounded-full ring-4 ring-background",
            TYPE_DOT[entry.entryType],
          )}
        />
        <span
          aria-hidden
          className="absolute top-4 bottom-[-1.25rem] w-px bg-border group-last:hidden"
        />
      </div>

      <time
        className="pt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
        dateTime={entry.occurredAt}
      >
        {formatTime(entry.occurredAt)}
      </time>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <Badge
            className="h-4 px-1 text-[9px] font-medium uppercase tracking-wider"
            variant={TYPE_BADGE[entry.entryType]}
          >
            {ENTRY_LABELS[entry.entryType]}
          </Badge>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium",
              entry.visibility === "report"
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            {entry.visibility === "report" ? "Report eligible" : "Private"}
          </span>
          {edited && (
            <span className="text-[10px] italic text-muted-foreground">
              edited {formatTime(entry.updatedAt)}
            </span>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Textarea
              autoFocus
              className="min-h-[120px] text-sm leading-6"
              onChange={(event) => setContent(event.target.value)}
              value={content}
            />
            <div className="flex items-center gap-2">
              <Button onClick={() => void save()} size="sm">
                Save
              </Button>
              <Button
                onClick={() => {
                  setContent(entry.contentMarkdown);
                  setEditing(false);
                }}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
              <span className="ml-auto hidden items-center gap-1 text-[10px] text-muted-foreground md:inline-flex">
                <span>Save with</span>
                <KbdInline>⌘</KbdInline>
                <KbdInline>↵</KbdInline>
              </span>
            </div>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "markdown",
                long && !expanded && "markdown--collapsed",
              )}
            >
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => (
                    <a href={safeUrl(href)} rel="noreferrer" target="_blank">
                      {children}
                    </a>
                  ),
                  img: ({ alt }) => (
                    <span className="remote-image-blocked">
                      Remote image blocked
                      {alt ? `: ${alt}` : ""}
                    </span>
                  ),
                }}
                remarkPlugins={[remarkGfm]}
              >
                {entry.contentMarkdown}
              </ReactMarkdown>
            </div>
            {long && (
              <button
                className="self-start text-xs font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setExpanded((current) => !current)}
                type="button"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}

            {!!attachments.length && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
                {attachments.map((attachment) => (
                  <a
                    className="block overflow-hidden rounded-md border border-border bg-muted transition-colors hover:border-foreground/40"
                    href={convertFileSrc(attachment.path)}
                    key={attachment.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <img
                      alt={attachment.originalName}
                      className="h-32 w-full object-cover"
                      loading="lazy"
                      src={convertFileSrc(attachment.path)}
                    />
                  </a>
                ))}
              </div>
            )}

            {!!links.length && (
              <div className="grid gap-1.5">
                {links.map((link) => (
                  <LinkPreviewCard
                    key={link.url}
                    link={link}
                    metadata={linkMetadata[link.url]}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {historyOpen && (
          <Card className="mt-1">
            <CardContent className="space-y-2 p-3">
              <p className="text-xs font-semibold text-foreground">
                Revision history
              </p>
              {!revisions.length && (
                <p className="text-xs text-muted-foreground">
                  No previous revisions.
                </p>
              )}
              {revisions.map((revision) => (
                <div
                  className="flex items-start justify-between gap-2 border-t border-border py-2 first:border-t-0 first:pt-0"
                  key={revision.id}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] text-muted-foreground">
                      #{revision.revisionNumber} ·{" "}
                      {formatDate(revision.changedAt)}
                    </p>
                    <p className="mt-1 line-clamp-3 text-xs text-foreground/90">
                      {revision.previousContentMarkdown}
                    </p>
                  </div>
                  <Button
                    aria-label="Restore revision"
                    onClick={() => void onRestoreRevision(revision.id)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <RotateCcw />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {!editing && (
        <div className="flex items-start gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <Button
            aria-label="Edit entry"
            onClick={() => setEditing(true)}
            size="icon-sm"
            variant="ghost"
          >
            <Pencil />
          </Button>
          <Button
            aria-label="Revision history"
            onClick={() => void onHistory(entry.id)}
            size="icon-sm"
            variant="ghost"
          >
            <History />
          </Button>
          <Button
            aria-label="Move entry to trash"
            onClick={() => void onTrash(entry.id)}
            size="icon-sm"
            variant="ghost"
          >
            <Trash2 />
          </Button>
        </div>
      )}
    </li>
  );
}

function KbdInline({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[9px] text-muted-foreground">
      {children}
    </kbd>
  );
}

function LinkPreviewCard({
  link,
  metadata,
}: {
  link: ReturnType<typeof extractLinkPreviews>[number];
  metadata: LinkMetadata | null | undefined;
}) {
  const title = metadata?.title || link.host;
  const subtitle = metadata?.description || link.label || link.url;
  const site = metadata?.siteName || link.host;
  const imageUrl = metadata?.imageUrl;

  return (
    <a
      className={cn(
        "group/link flex overflow-hidden rounded-md border border-border bg-muted/40 transition-colors hover:bg-accent",
        imageUrl ? "min-h-28" : "items-center justify-between gap-3 px-3 py-2",
      )}
      href={link.url}
      rel="noreferrer"
      target="_blank"
    >
      {imageUrl && (
        <span className="relative block w-36 shrink-0 overflow-hidden bg-secondary">
          <img
            alt=""
            className="h-full min-h-28 w-full object-cover transition-transform duration-200 group-hover/link:scale-[1.03]"
            loading="lazy"
            src={imageUrl}
          />
        </span>
      )}
      <span
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          imageUrl ? "justify-center gap-1.5 px-3 py-2.5" : "",
        )}
      >
        <span className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {site}
        </span>
        <span className="line-clamp-2 text-xs font-medium leading-5 text-foreground">
          {title}
        </span>
        <span className="line-clamp-2 text-[10px] leading-4 text-muted-foreground">
          {subtitle}
        </span>
      </span>
      <ExternalLink
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground",
          imageUrl ? "mr-3 mt-3" : "",
        )}
      />
    </a>
  );
}

function safeUrl(value?: string) {
  if (!value) return "#";
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? value : "#";
  } catch {
    return "#";
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

interface DateGroup {
  label: string;
  items: WorkLogEntry[];
}

function groupByDate(entries: WorkLogEntry[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const entry of entries) {
    const label = dateLabel(entry.occurredAt);
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(entry);
    else groups.push({ label, items: [entry] });
  }
  return groups;
}

function dateLabel(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startOfEntry = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfEntry.getTime()) / 86_400_000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) {
    return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}
