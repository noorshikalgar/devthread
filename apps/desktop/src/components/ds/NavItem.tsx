import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface NavItemProps extends React.HTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  active?: boolean;
  asChild?: boolean;
  badge?: React.ReactNode;
}

const NavItem = React.forwardRef<HTMLButtonElement, NavItemProps>(
  ({ className, icon, active, asChild, badge, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        data-active={active || undefined}
        className={cn(
          "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-muted-foreground transition-colors duration-fast hover:bg-accent/60 hover:text-foreground",
          "data-[active]:bg-accent data-[active]:text-foreground",
          "before:absolute before:left-0 before:top-1/2 before:h-0 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:transition-all before:duration-base before:ease-emphasized",
          "data-[active]:before:h-4",
          className,
        )}
        {...props}
      >
        {icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>}
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {badge && <span className="shrink-0">{badge}</span>}
      </Comp>
    );
  },
);
NavItem.displayName = "NavItem";

export { NavItem };
