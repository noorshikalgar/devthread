import { openUrl } from "@tauri-apps/plugin-opener";

const EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function safeExternalUrl(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return EXTERNAL_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function openExternalUrl(value?: string | null) {
  const url = safeExternalUrl(value);
  if (!url) return;
  await openUrl(url);
}
