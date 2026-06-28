import * as React from "react";
import { cn } from "@/lib/utils";

const SidebarRoot = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-full flex-col gap-1 overflow-y-auto border-r border-border bg-background px-2 py-3",
        className,
      )}
      {...props}
    />
  ),
);
SidebarRoot.displayName = "Sidebar";

const SidebarSection = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-0.5 py-1.5", className)} {...props} />
  ),
);
SidebarSection.displayName = "SidebarSection";

const SidebarLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70",
        className,
      )}
      {...props}
    />
  ),
);
SidebarLabel.displayName = "SidebarLabel";

export { SidebarRoot, SidebarSection, SidebarLabel };
