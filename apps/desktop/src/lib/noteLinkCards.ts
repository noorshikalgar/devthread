import { isValidElement, type ReactNode } from "react";
import { safeExternalUrl } from "./openExternal";

export interface NoteLink {
  url: string;
  host: string;
  path: string;
  label: string;
}

const BARE_URL = /^(https?:\/\/[^\s<>()]+)$/i;

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:!?)]+$/g, "");
}

function deriveLink(rawUrl: string): NoteLink {
  const url = trimTrailingPunctuation(rawUrl);
  let host = "";
  let path = "";
  let label = url;
  try {
    const parsed = new URL(url);
    host = parsed.hostname.replace(/^www\./, "");
    path = parsed.pathname === "/" ? "" : parsed.pathname;
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    label = lastSegment
      ? decodeURIComponent(lastSegment).replace(/[-_]+/g, " ").trim()
      : host || url;
  } catch {
    host = url;
  }
  return { url, host, path, label };
}

function collectText(node: ReactNode): string {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (isValidElement(node)) return collectText((node.props as { children?: ReactNode }).children);
  return "";
}

export interface BareLinkMatch {
  url: string;
  link: NoteLink;
}

export function findBareLinkInParagraph(children: ReactNode): BareLinkMatch | null {
  let anchorChild: ReactNode | null = null;
  let otherCount = 0;
  const childList = Array.isArray(children) ? children : [children];
  for (const child of childList) {
    if (child == null || child === false || child === true) continue;
    if (typeof child === "string" && child.trim() === "") continue;
    if (isValidElement(child)) {
      const elementName =
        typeof child.type === "string"
          ? child.type
          : ((child.type as { displayName?: string; name?: string }).displayName ??
            (child.type as { name?: string }).name ??
            "");
      if (elementName === "a") {
        if (anchorChild != null) {
          otherCount += 1;
          continue;
        }
        anchorChild = child;
        continue;
      }
    }
    otherCount += 1;
  }
  if (!anchorChild || !isValidElement(anchorChild) || otherCount > 0) return null;
  const props = anchorChild.props as { href?: unknown; children?: ReactNode };
  const href = typeof props.href === "string" ? props.href : null;
  if (!href || !BARE_URL.test(href)) return null;
  const text = collectText(props.children).trim();
  const trimmedHref = trimTrailingPunctuation(href);
  if (text !== href && text !== trimmedHref) return null;
  return { url: href, link: deriveLink(href) };
}

export { safeExternalUrl };
