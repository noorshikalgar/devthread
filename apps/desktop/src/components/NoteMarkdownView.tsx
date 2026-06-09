import { type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { openExternalUrl, safeExternalUrl } from "@/lib/openExternal";
import { convertFileSrc } from "@tauri-apps/api/core";
import { findBareLinkInParagraph, type NoteLink } from "@/lib/noteLinkCards";

interface NoteMarkdownViewProps {
  source: string;
  attachments: ReadonlyArray<{
    id: string;
    path: string;
    originalName: string;
  }>;
  className?: string;
}

function NoteLinkCard({ link }: { link: NoteLink }) {
  return (
    <a
      className="note-link-card"
      href={safeExternalUrl(link.url) ?? "#"}
      onClick={(event) => {
        event.preventDefault();
        void openExternalUrl(link.url);
      }}
      rel="noreferrer"
      target="_blank"
    >
      <div className="note-link-card__host">{link.host || link.url}</div>
      <div className="note-link-card__label">{link.label}</div>
      {link.path ? (
        <div className="note-link-card__path">{link.path}</div>
      ) : null}
    </a>
  );
}

function resolveAttachmentUrl(attachmentPath: string): string {
  if (/^https?:/i.test(attachmentPath)) return attachmentPath;
  if (attachmentPath.startsWith("data:")) return attachmentPath;
  try {
    return convertFileSrc(attachmentPath);
  } catch {
    return attachmentPath;
  }
}

function buildImageComponents(
  attachments: ReadonlyArray<{
    id: string;
    path: string;
    originalName: string;
  }>,
): Partial<Components>["img"] {
  return (props: ImgHTMLAttributes<HTMLImageElement>) => {
    const alt = props.alt ?? "";
    const src = props.src ?? "";
    if (!src) return null;
    const attachment = attachments.find((item) => item.originalName === alt);
    const resolved = attachment ? resolveAttachmentUrl(attachment.path) : src;
    return (
      <img
        alt={alt}
        className="my-2 max-h-96 w-auto rounded-md border border-border"
        loading="lazy"
        src={resolved}
      />
    );
  };
}

export function NoteMarkdownView({
  source,
  attachments,
  className,
}: NoteMarkdownViewProps) {
  const components: Partial<Components> = {
    a: ({
      href,
      children,
      ...rest
    }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a
        {...rest}
        href={safeExternalUrl(href ?? "") ?? "#"}
        onClick={(event) => {
          if (!href) return;
          event.preventDefault();
          void openExternalUrl(href);
        }}
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </a>
    ),
    img: buildImageComponents(attachments),
    p: ({ children }) => {
      const match = findBareLinkInParagraph(children);
      if (match) {
        return <NoteLinkCard link={match.link} />;
      }
      return <p>{children}</p>;
    },
  };

  return (
    <div className={["markdown", className].filter(Boolean).join(" ")}>
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
