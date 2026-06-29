import * as React from "react";
import { cn } from "@/lib/utils";

export interface ListItemProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  selected?: boolean;
  interactive?: boolean;
}

const ListItem = React.forwardRef<HTMLDivElement, ListItemProps>(
  (
    {
      className,
      leading,
      trailing,
      title,
      subtitle,
      selected,
      interactive = true,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors duration-fast",
        interactive && "cursor-pointer hover:bg-accent/60",
        selected && "bg-accent text-accent-foreground",
        className,
      )}
      {...props}
    >
      {leading && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
          {leading}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium leading-tight">{title}</div>
        {subtitle && (
          <div className="truncate text-xs leading-tight text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      {trailing && (
        <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity duration-fast group-hover:opacity-100 [&:has([data-always-visible])]:opacity-100">
          {trailing}
        </div>
      )}
    </div>
  ),
);
ListItem.displayName = "ListItem";

export { ListItem };
