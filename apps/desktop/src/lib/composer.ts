import type { EntryType } from "./types";

const COMMANDS: Record<string, EntryType> = {
  "/note": "note",
  "/progress": "progress",
  "/finding": "finding",
  "/blocker": "blocker",
  "/decision": "decision",
  "/next": "next_step",
};

export const MENTION_ALIASES: Record<string, EntryType> = {
  note: "note",
  notes: "note",
  progress: "progress",
  finding: "finding",
  findings: "finding",
  blocker: "blocker",
  blockers: "blocker",
  decision: "decision",
  decisions: "decision",
  next: "next_step",
  nextstep: "next_step",
  "next-step": "next_step",
};

export function parseSlashCommand(
  content: string,
  fallback: EntryType,
): { content: string; entryType: EntryType } {
  const firstSpace = content.indexOf(" ");
  const command = (firstSpace === -1 ? content : content.slice(0, firstSpace))
    .trim()
    .toLowerCase();
  const entryType = COMMANDS[command];
  if (!entryType) return { content, entryType: fallback };
  return {
    content: content.slice(command.length).trimStart(),
    entryType,
  };
}

export interface MentionMatch {
  active: boolean;
  query: string;
  anchor: number;
}

export function detectMention(text: string, cursor: number): MentionMatch {
  if (cursor <= 0) return { active: false, query: "", anchor: -1 };
  for (let i = cursor - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "@") {
      const before = i === 0 ? " " : text[i - 1];
      if (/\s/.test(before)) {
        const query = text.slice(i + 1, cursor);
        if (!/\s/.test(query)) {
          return { active: true, query, anchor: i };
        }
      }
      return { active: false, query: "", anchor: -1 };
    }
    if (/\s/.test(ch)) {
      return { active: false, query: "", anchor: -1 };
    }
  }
  return { active: false, query: "", anchor: -1 };
}

export function resolveMentionType(
  query: string,
  fallback: EntryType,
): EntryType | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;
  return MENTION_ALIASES[normalized] ?? null;
}

const MENTION_PATTERN = /(^|\s)(@\w+(?:-\w+)?)(\s|$)/g;

export interface MentionResolution {
  type: EntryType | null;
  cleaned: string;
}

export function resolveMentionsInContent(
  content: string,
  fallback: EntryType,
): MentionResolution {
  let type: EntryType | null = null;
  const cleaned = content.replace(MENTION_PATTERN, (match, prefix, mention) => {
    const alias = mention.slice(1).toLowerCase();
    if (MENTION_ALIASES[alias]) {
      if (type === null) type = MENTION_ALIASES[alias];
      return prefix;
    }
    return match;
  });
  return {
    type,
    cleaned: cleaned.replace(/\s+/g, " ").trim(),
  };
}

export function stripMentions(content: string): string {
  return content.replace(MENTION_PATTERN, (match, prefix, mention) => {
    const alias = mention.slice(1).toLowerCase();
    if (MENTION_ALIASES[alias]) {
      return prefix;
    }
    return match;
  });
}

export function draftKey(taskId: string) {
  return `devthread:draft:${taskId}`;
}
