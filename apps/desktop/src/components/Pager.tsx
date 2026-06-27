import {
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PagerProps {
  /** 1-based current page number. */
  page: number;
  /** Total number of pages (>= 1). */
  totalPages: number;
  /** Number of items in total (for the "X–Y of Z" range text). */
  totalItems: number;
  /** Items per page (for the "X–Y of Z" range text). */
  pageSize: number;
  onPageChange: (page: number) => void;
  /**
   * Optional override for the "Showing X–Y of Z" text. When the items
   * list is empty the pager hides itself, so callers don't need to
   * gate on the empty case themselves.
   */
  className?: string;
  /** Accessible label for the pager landmark. */
  ariaLabel?: string;
}

const FIRST_PAGES = 2;
const LAST_PAGES = 2;
const SIBLINGS = 1;

function pageNumbers(page: number, totalPages: number): Array<number | "…"> {
  if (totalPages <= 1) return [];
  const pages = new Set<number>([page]);
  for (let offset = 1; offset <= SIBLINGS; offset += 1) {
    pages.add(page - offset);
    pages.add(page + offset);
  }
  for (let p = 1; p <= FIRST_PAGES; p += 1) {
    pages.add(p);
  }
  for (let offset = 0; offset < LAST_PAGES; offset += 1) {
    pages.add(totalPages - offset);
  }
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const result: Array<number | "…"> = [];
  for (let index = 0; index < sorted.length; index += 1) {
    if (index > 0 && sorted[index] - sorted[index - 1] > 1) {
      result.push("…");
    }
    result.push(sorted[index]);
  }
  return result;
}

function rangeText(page: number, pageSize: number, totalItems: number): string {
  if (totalItems === 0) return "0 of 0";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return `${start}–${end} of ${totalItems}`;
}

export function Pager({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className,
  ariaLabel = "Pagination",
}: PagerProps) {
  if (totalItems === 0 || totalPages <= 1) {
    return null;
  }
  const numbers = pageNumbers(page, totalPages);
  const goPrev = () => onPageChange(Math.max(1, page - 1));
  const goNext = () => onPageChange(Math.min(totalPages, page + 1));

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="font-mono uppercase tracking-wider">
        Showing {rangeText(page, pageSize, totalItems)}
      </span>
      <div className="flex items-center gap-1">
        <Button
          aria-label="Previous page"
          className="h-7 w-7 p-0"
          disabled={page <= 1}
          onClick={goPrev}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        {numbers.map((value, index) =>
          value === "…" ? (
            <span
              aria-hidden
              className="px-1 text-muted-foreground"
              key={`ellipsis-${index}`}
            >
              …
            </span>
          ) : (
            <Button
              aria-current={value === page ? "page" : undefined}
              aria-label={`Page ${value}`}
              className="h-7 min-w-7 px-2 text-xs"
              key={value}
              onClick={() => onPageChange(value)}
              size="sm"
              type="button"
              variant={value === page ? "secondary" : "ghost"}
            >
              {value}
            </Button>
          ),
        )}
        <Button
          aria-label="Next page"
          className="h-7 w-7 p-0"
          disabled={page >= totalPages}
          onClick={goNext}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </nav>
  );
}
