export const LONG_ENTRY_LENGTH = 700;

const URL_PATTERN = /https?:\/\/[^\s<>()]+/gi;

export interface LinkPreview {
  url: string;
  host: string;
  label: string;
}

export function extractLinkPreviews(markdown: string): LinkPreview[] {
  const unique = new Set<string>();
  for (const match of markdown.match(URL_PATTERN) ?? []) {
    unique.add(match.replace(/[.,;!?]+$/, ""));
  }
  return [...unique].flatMap((url) => {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return [];
      return [
        {
          url,
          host: parsed.hostname.replace(/^www\./, ""),
          label: decodeURIComponent(
            parsed.pathname.split("/").filter(Boolean).at(-1) ?? "",
          ),
        },
      ];
    } catch {
      return [];
    }
  });
}

export function isLongEntry(markdown: string) {
  return (
    markdown.length > LONG_ENTRY_LENGTH || markdown.split("\n").length > 12
  );
}

export async function fileToPendingImage(file: File) {
  if (!file.type.startsWith("image/"))
    throw new Error("Only images can be pasted.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Images must be 10 MB or smaller.");

  const previewUrl = await readFile(file);
  return {
    id: crypto.randomUUID(),
    name: file.name || `pasted-image-${Date.now()}.png`,
    mediaType: file.type,
    base64Data: previewUrl.slice(previewUrl.indexOf(",") + 1),
    previewUrl,
  };
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}
