import type { LinkMetadata } from "./types";

export type QuickLinkProvider =
  | "figma"
  | "jira"
  | "confluence"
  | "sheet"
  | "doc"
  | "office"
  | "github"
  | "web";

export interface QuickLinkDraft {
  url: string;
  title: string;
  domain: string;
  provider: QuickLinkProvider;
}

export function quickLinkDraftFromUrl(
  value: string,
  metadata?: LinkMetadata | null,
): QuickLinkDraft | null {
  const url = normalizeWebUrl(metadata?.url || value);
  if (!url) return null;
  const parsed = new URL(url);
  const domain = cleanDomain(parsed.hostname);
  const provider = detectQuickLinkProvider(parsed);
  const title =
    cleanTitle(metadata?.title) || defaultQuickLinkTitle(provider, domain);
  return { url, title, domain, provider };
}

export function normalizeWebUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return isWebUrl(parsed) ? parsed.toString() : null;
  } catch {
    try {
      const parsed = new URL(`https://${trimmed}`);
      return isWebUrl(parsed) ? parsed.toString() : null;
    } catch {
      return null;
    }
  }
}

function detectQuickLinkProvider(url: URL): QuickLinkProvider {
  const host = cleanDomain(url.hostname);
  const path = url.pathname.toLowerCase();
  if (host === "figma.com" || host.endsWith(".figma.com")) return "figma";
  if (host === "github.com" || host.endsWith(".github.com")) return "github";
  if (host.includes("atlassian.net")) {
    return path.startsWith("/wiki") ? "confluence" : "jira";
  }
  if (host.includes("confluence")) return "confluence";
  if (host.includes("jira")) return "jira";
  if (host === "docs.google.com") {
    if (path.startsWith("/spreadsheets")) return "sheet";
    return "doc";
  }
  if (
    host.endsWith("sharepoint.com") ||
    host === "office.com" ||
    host.endsWith(".office.com") ||
    host === "onedrive.live.com"
  ) {
    return "office";
  }
  return "web";
}

function defaultQuickLinkTitle(provider: QuickLinkProvider, domain: string) {
  if (provider === "figma") return "Figma";
  if (provider === "jira") return "Jira";
  if (provider === "confluence") return "Confluence";
  if (provider === "sheet") return "Spreadsheet";
  if (provider === "doc") return "Document";
  if (provider === "office") return "Office file";
  if (provider === "github") return "GitHub";
  return domain;
}

function cleanDomain(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function cleanTitle(value?: string | null) {
  const clean = value?.trim();
  return clean || null;
}

function isWebUrl(url: URL) {
  return url.protocol === "https:" || url.protocol === "http:";
}
