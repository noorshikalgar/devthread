import { convertFileSrc } from "@tauri-apps/api/core";
import {
  CaretDown as ChevronDown,
  Clock as Clock4,
  ArrowSquareOut as ExternalLink,
  ClockCounterClockwise as History,
  ArrowCounterClockwise as RotateCcw,
  NotePencil as SquarePen,
  Trash as Trash2,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { formatDuration } from "@/lib/duration";
import { openExternalUrl, safeExternalUrl } from "@/lib/openExternal";
import { ImageViewerDialog } from "@/components/ImageViewerDialog";
import { extractLinkPreviews, isLongEntry } from "@/lib/content";
import { ENTRY_BG, ENTRY_DOT, ENTRY_LABEL } from "@/lib/status";
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
  onEdit?: (
    id: string,
    type: EntryType,
    content: string,
    visibility: Visibility,
  ) => Promise<void>;
  onHistory?: (id: string) => Promise<void>;
  onRestoreRevision?: (id: string) => Promise<void>;
  onTrash?: (id: string) => Promise<void>;
  onLoadMore?: () => Promise<void>;
  viewMode?: TimelineViewMode;
  readOnly?: boolean;
}

export type TimelineViewMode = "normal" | "compact";

const PROTECTED_ENTRY_TYPES = new Set<EntryType>([
  "progress",
  "worklog",
  "status",
  "estimate",
]);
const SYSTEM_FACT_ENTRY_TYPES = new Set<EntryType>([
  "worklog",
  "status",
  "estimate",
]);

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
  viewMode = "normal",
  readOnly = false,
}: Props) {
  if (!entries.length) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <p className="font-medium text-foreground">
          {readOnly ? "No archived history." : "No updates yet."}
        </p>
        <p>
          {readOnly
            ? "This task has no recorded timeline entries."
            : "Record the first thing that happened."}
        </p>
      </div>
    );
  }

  // `entries` arrives newest-first (the data layer sorts that way for
  // search/pagination), but the timeline reads top-to-bottom like a
  // chat log: oldest at the top, most recent right above the composer.
  // Reverse only for display — grouping itself still relies on same-day
  // entries being contiguous, which holds regardless of sort direction.
  const groups = groupByDate(entries)
    .map((group) => ({ ...group, items: [...group.items].reverse() }))
    .reverse();
  const compact = viewMode === "compact";

  return (
    <section aria-label="Task timeline" className="flex flex-col gap-5 pt-5">
      {hasMore && !readOnly && onLoadMore && (
        <div className="flex justify-center pb-2">
          <Button onClick={() => void onLoadMore()} size="sm" variant="outline">
            Load older updates
          </Button>
        </div>
      )}
      {groups.map((group) => (
        <div key={group.label} className="group/day flex flex-col gap-2">
          {compact ? (
            <div className="flex items-center gap-3">
              <h2 className="whitespace-nowrap text-[12px] font-semibold tracking-[0.02em] text-foreground">
                {compactDateGroupLabel(group)}
              </h2>
              <div className="min-w-0 flex-1 border-t border-dashed border-border/80" />
            </div>
          ) : (
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-2">
              <h2 className="whitespace-nowrap text-left text-[11px] font-semibold leading-4 tracking-[0.02em] text-muted-foreground">
                {group.label}
              </h2>
              <div className="min-w-0 border-t border-dashed border-border/80" />
            </div>
          )}
          <ol
            className={cn(
              "relative flex flex-col",
              compact ? "gap-0" : "gap-1",
            )}
          >
            {!compact && (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-2 top-2 z-0 border-l-2 border-dotted border-border/60 left-[9px]"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-2 top-2 z-0 origin-top scale-y-0 border-l-2 border-border opacity-0 transition-[opacity,transform] duration-300 group-hover/day:scale-y-100 group-hover/day:opacity-100 left-[9px]"
                />
              </>
            )}
            {group.items.map((entry) => (
              <TimelineItem
                attachments={attachments.filter(
                  (attachment) => attachment.workLogEntryId === entry.id,
                )}
                compact={compact}
                entry={entry}
                historyOpen={historyEntryId === entry.id}
                key={entry.id}
                onEdit={readOnly ? undefined : onEdit}
                onHistory={readOnly ? undefined : onHistory}
                onRestoreRevision={readOnly ? undefined : onRestoreRevision}
                onTrash={readOnly ? undefined : onTrash}
                revisions={historyEntryId === entry.id ? revisions : []}
              />
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

function TimelineItem({
  compact,
  ...props
}: EntryProps & {
  compact: boolean;
}) {
  if (compact) return <CompactTimelineEntry {...props} />;
  return <TimelineEntry {...props} />;
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

function CompactTimelineEntry({
  entry,
  attachments,
  revisions,
  historyOpen,
  onEdit,
  onHistory,
  onRestoreRevision,
  onTrash,
}: EntryProps) {
  const [expanded, setExpanded] = useState(false);
  const summary = compactSummary(entry.contentMarkdown, attachments.length);
  const hasDuration =
    entry.durationMinutes != null && entry.durationMinutes > 0;

  return (
    <li
      className={cn(
        "group relative grid min-h-7 min-w-0 cursor-pointer gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-accent/35",
        expanded
          ? "grid-cols-[16px_62px_minmax(0,1fr)] items-start"
          : hasDuration
            ? "grid-cols-[16px_62px_66px_max-content_minmax(0,1fr)_44px] items-center"
            : "grid-cols-[16px_62px_66px_minmax(0,1fr)_44px] items-center",
      )}
      data-entry-id={entry.id}
      onClick={() => setExpanded((current) => !current)}
    >
      <div
        className={cn(
          "relative flex justify-center",
          expanded ? "items-start pt-4" : "h-full items-center",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "z-10 size-2 rounded-full ring-[3px] ring-background transition-transform duration-150 group-hover:scale-110",
            ENTRY_DOT[entry.entryType],
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute bottom-[-0.5rem] w-px border-l border-border/35 group-last:hidden",
            expanded ? "top-5" : "top-1/2",
          )}
        />
      </div>

      <time
        className={cn(
          "whitespace-nowrap text-[11px] font-semibold tabular-nums tracking-[0.02em] text-foreground",
          expanded && "pt-3",
        )}
        dateTime={entry.occurredAt}
      >
        {formatMessageTimestamp(entry.occurredAt)}
      </time>

      {!expanded && (
        <>
          <span
            className={cn(
              "inline-flex h-[17px] min-w-0 items-center justify-center rounded border px-1.5 font-mono text-[9px] font-medium uppercase tracking-[0.03em]",
              ENTRY_BG[entry.entryType],
            )}
          >
            <span className="truncate">{ENTRY_LABEL[entry.entryType]}</span>
          </span>

          {hasDuration && (
            <span className="flex min-w-0 items-center justify-start">
              <span
                aria-label={`Time spent ${formatDuration(entry.durationMinutes)}`}
                className="inline-flex h-4 max-w-full items-center whitespace-nowrap rounded bg-muted/55 px-1.5 font-mono text-[9px] text-foreground/75"
              >
                {formatDuration(entry.durationMinutes)}
              </span>
            </span>
          )}

          <span
            className={cn(
              "min-w-0 truncate text-xs leading-5",
              summary.hasText ? "text-foreground" : "text-muted-foreground",
            )}
            title={summary.text}
          >
            {summary.text}
          </span>

          <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              aria-label="Expand entry"
              className="size-5 rounded text-muted-foreground hover:text-foreground [&_svg]:size-3"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded(true);
              }}
              size="icon-sm"
              variant="ghost"
            >
              <ChevronDown className="transition-transform duration-150" />
            </Button>
          </div>
        </>
      )}

      {expanded && (
        <TimelineEntryCard
          attachments={attachments}
          className="col-start-3 col-end-4"
          entry={entry}
          historyOpen={historyOpen}
          onCollapse={() => setExpanded(false)}
          onEdit={onEdit}
          onHistory={onHistory}
          onRestoreRevision={onRestoreRevision}
          onTrash={onTrash}
          revisions={revisions}
          showRailPointer={false}
        />
      )}
    </li>
  );
}

interface TimelineEntryCardProps extends EntryProps {
  className?: string;
  hideMeta?: boolean;
  inlineTimestamp?: string;
  onCollapse?: () => void;
  showRailPointer?: boolean;
  surface?: "card" | "inline";
}

function TimelineEntryCard({
  entry,
  attachments,
  revisions,
  historyOpen,
  onEdit,
  onHistory,
  onRestoreRevision,
  onTrash,
  className,
  hideMeta = false,
  inlineTimestamp,
  onCollapse,
  showRailPointer = true,
  surface = "card",
}: TimelineEntryCardProps) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(entry.contentMarkdown);
  const [expanded, setExpanded] = useState(false);
  const [viewingImage, setViewingImage] = useState<Attachment | null>(null);

  async function save() {
    if (!onEdit) return;
    await onEdit(entry.id, entry.entryType, content, entry.visibility);
    setEditing(false);
  }

  const edited = entry.updatedAt !== entry.createdAt;
  const long = isLongEntry(entry.contentMarkdown);
  const links = extractLinkPreviews(entry.contentMarkdown);
  const linkMetadata = useLinkMetadata(links);
  const canEdit = !SYSTEM_FACT_ENTRY_TYPES.has(entry.entryType) && !!onEdit;
  const canTrash = !PROTECTED_ENTRY_TYPES.has(entry.entryType) && !!onTrash;

  return (
    <>
      <div
        className={cn(
          "relative flex min-w-0 flex-col gap-2 transition-[background-color,border-color,box-shadow] duration-base ease-emphasized",
          surface === "card" &&
            "rounded-md border border-border/55 bg-card/70 px-3 py-2.5 pr-9 shadow-sm group-hover:border-border group-hover:bg-card group-hover:shadow-md",
          surface === "inline" && "py-1.5",
          showRailPointer &&
            surface === "card" &&
            "before:absolute before:left-[-5px] before:top-4 before:size-2 before:rotate-45 before:border-b before:border-l before:border-border/55 before:bg-card/70",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {surface === "inline" && inlineTimestamp ? (
          <div className="flex min-h-6 min-w-0 items-center justify-between gap-3 pr-20">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <time
                className="font-mono text-[11px] font-semibold leading-4 tabular-nums tracking-[0.02em] text-muted-foreground"
                dateTime={entry.occurredAt}
              >
                {inlineTimestamp}
              </time>
              <EntryMetaChips entry={entry} />
            </div>
          </div>
        ) : (
          !hideMeta && <EntryMetaChips entry={entry} />
        )}

        {editing ? (
          <div className="space-y-2">
            <Textarea
              autoCapitalize="off"
              autoCorrect="off"
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
                "markdown select-text",
                surface === "card" && "max-w-[78ch]",
                long && !expanded && "markdown--collapsed",
              )}
            >
              <EntryMarkdown content={entry.contentMarkdown} />
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
                  <button
                    aria-label={`View ${attachment.originalName}`}
                    className="block overflow-hidden rounded-md border border-border bg-muted text-left transition-colors hover:border-foreground/40"
                    key={attachment.id}
                    onClick={() => setViewingImage(attachment)}
                    type="button"
                  >
                    <img
                      alt={attachment.originalName}
                      className="h-32 w-full object-cover"
                      loading="lazy"
                      src={convertFileSrc(attachment.path)}
                    />
                  </button>
                ))}
              </div>
            )}

            {!!links.length && (
              <div className="flex flex-col items-start gap-1.5">
                {links.map((link) => (
                  <LinkPreviewCard
                    key={link.url}
                    link={link}
                    metadata={linkMetadata[link.url]}
                  />
                ))}
              </div>
            )}

            {edited && (
              <div className="flex justify-end">
                <span className="text-[10px] text-muted-foreground/75">
                  edited {formatTime(entry.updatedAt)}
                </span>
              </div>
            )}
          </>
        )}

        {canEdit && historyOpen && (
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
                    onClick={() => void onRestoreRevision?.(revision.id)}
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

        {!editing && (
          <div
            className={cn(
              "absolute flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
              surface === "card" ? "right-1.5 top-2" : "right-0 top-1.5",
            )}
            onClick={(event) => event.stopPropagation()}
          >
            {canEdit && (
              <Button
                aria-label="Edit entry"
                className="size-6 rounded-md bg-muted/45 text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
                onClick={() => setEditing(true)}
                size="icon-sm"
                variant="ghost"
              >
                <SquarePen />
              </Button>
            )}
            {canEdit && onHistory && (
              <Button
                aria-label="Revision history"
                className="size-6 rounded-md bg-muted/45 text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
                onClick={() => void onHistory(entry.id)}
                size="icon-sm"
                variant="ghost"
              >
                <History />
              </Button>
            )}
            {canTrash && onTrash && (
              <Button
                aria-label="Move entry to trash"
                className="size-6 rounded-md bg-muted/45 text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
                onClick={() => void onTrash(entry.id)}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2 />
              </Button>
            )}
            {onCollapse && (
              <Button
                aria-label="Collapse entry"
                className="size-6 rounded-md bg-muted/45 text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
                onClick={onCollapse}
                size="icon-sm"
                variant="ghost"
              >
                <ChevronDown className="rotate-180" />
              </Button>
            )}
          </div>
        )}
      </div>

      <ImageViewerDialog
        attachment={viewingImage}
        onOpenChange={(open) => {
          if (!open) setViewingImage(null);
        }}
      />
    </>
  );
}

function EntryMetaChips({ entry }: { entry: WorkLogEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      <span
        className={cn(
          "inline-flex h-5 items-center rounded border px-2 font-mono text-[10px] font-medium uppercase tracking-[0.08em]",
          ENTRY_BG[entry.entryType],
        )}
      >
        {ENTRY_LABEL[entry.entryType]}
      </span>
      {entry.durationMinutes != null && entry.durationMinutes > 0 && (
        <span
          aria-label={`Time spent ${formatDuration(entry.durationMinutes)}`}
          className="inline-flex h-5 min-w-[48px] items-center justify-center gap-1 rounded bg-muted/60 px-2 font-mono text-[10px] text-foreground"
        >
          <Clock4 className="size-2.5 text-muted-foreground" />
          {formatDuration(entry.durationMinutes)}
        </span>
      )}
      {entry.startedAt && (
        <span
          aria-label={`Started at ${formatMessageTimestamp(entry.startedAt)}`}
          className="inline-flex h-5 items-center justify-center rounded border border-border/70 px-2 font-mono text-[10px] text-foreground/80"
        >
          Started {formatMessageTimestamp(entry.startedAt)}
        </span>
      )}
    </div>
  );
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
  return (
    <li
      className={cn(
        "group relative grid grid-cols-[20px_minmax(0,1fr)] gap-2 rounded-md py-2 transition-colors hover:bg-accent/20",
      )}
      data-entry-id={entry.id}
    >
      <div className="relative z-10 flex h-9 items-center justify-center">
        <span
          aria-hidden
          className={cn(
            "z-10 size-2 rounded-full ring-[4px] ring-background transition-transform duration-150 group-hover:scale-125",
            ENTRY_DOT[entry.entryType],
          )}
        />
      </div>

      <div className="min-w-0">
        <TimelineEntryCard
          attachments={attachments}
          entry={entry}
          hideMeta
          historyOpen={historyOpen}
          inlineTimestamp={formatMessageTimestamp(entry.occurredAt)}
          onEdit={onEdit}
          onHistory={onHistory}
          onRestoreRevision={onRestoreRevision}
          onTrash={onTrash}
          revisions={revisions}
          showRailPointer={false}
          surface="inline"
        />
      </div>
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

function EntryMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        a: ({ href, children }) => (
          <a
            href={safeExternalUrl(href) ?? "#"}
            onClick={(event) => {
              event.preventDefault();
              void openExternalUrl(href);
            }}
            rel="noreferrer"
            target="_blank"
          >
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
      {content}
    </ReactMarkdown>
  );
}

function useLinkMetadata(
  links: ReturnType<typeof extractLinkPreviews>,
): Record<string, LinkMetadata | null> {
  const [linkMetadata, setLinkMetadata] = useState<
    Record<string, LinkMetadata | null>
  >({});

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

  return linkMetadata;
}

function LinkPreviewCard({
  link,
  metadata,
}: {
  link: ReturnType<typeof extractLinkPreviews>[number];
  metadata: LinkMetadata | null | undefined;
}) {
  const title = metadata?.title || link.host;
  const imageUrl = metadata?.imageUrl;
  const displayUrl = metadata?.url || link.url;

  return (
    <a
      className="group/link flex min-h-9 w-full max-w-[300px] min-w-0 items-center gap-2 rounded-md bg-muted/35 px-2 py-1.5 text-left transition-colors hover:bg-accent/70"
      href={safeExternalUrl(link.url) ?? "#"}
      onClick={(event) => {
        event.preventDefault();
        void openExternalUrl(link.url);
      }}
      rel="noreferrer"
      target="_blank"
    >
      {imageUrl && (
        <span className="flex size-8 shrink-0 overflow-hidden rounded bg-secondary">
          <img
            alt=""
            className="h-full w-full object-cover transition-transform duration-200 group-hover/link:scale-[1.03]"
            loading="lazy"
            src={imageUrl}
          />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[11px] font-medium leading-4 text-foreground">
          {title}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block truncate text-[9px] leading-3 text-muted-foreground">
              {formatShortUrl(displayUrl)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm break-all">
            {displayUrl}
          </TooltipContent>
        </Tooltip>
      </span>
      <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-70" />
    </a>
  );
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

function formatMessageTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCompactGroupDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function compactDateGroupLabel(group: DateGroup) {
  const count = group.items.length;
  const suffix = `${count} ${count === 1 ? "update" : "updates"}`;
  const date =
    group.label === "Today" || group.label === "Yesterday"
      ? ` · ${formatCompactGroupDate(group.items[0].occurredAt)}`
      : "";
  return `${group.label}${date} · ${suffix}`;
}

function formatShortUrl(value: string) {
  try {
    const url = new URL(value);
    const path = `${url.pathname}${url.search}`.replace(/\/$/, "");
    return `${url.hostname}${path || ""}`;
  } catch {
    return value.replace(/^https?:\/\//, "");
  }
}

function compactSummary(content: string, attachmentCount: number) {
  const text = stripMarkdown(content);
  const imageOnly =
    attachmentCount > 0 &&
    (!text ||
      /^attached\s+(?:an?\s+)?(?:\d+\s+)?images?\.?$/i.test(text.trim()));
  if (imageOnly) return { text: "[image]", hasText: false };
  if (!text) {
    return {
      text: attachmentCount > 0 ? "[image]" : "No text",
      hasText: false,
    };
  }
  return { text, hasText: true };
}

function stripMarkdown(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_~>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
  }).format(date);
}
