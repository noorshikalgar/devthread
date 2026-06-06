import { openUrl } from "@tauri-apps/plugin-opener";

const EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function safeExternalUrl(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    return EXTERNAL_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
  } catch {
    if (/^[\w.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(trimmed)) {
      try {
        return new URL(`https://${trimmed}`).toString();
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function openExternalUrl(value?: string | null) {
  const url = safeExternalUrl(value);
  if (!url) return;
  await openUrl(url);
}
