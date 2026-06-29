// Shared class strings for every menu-like surface (ContextMenu,
// DropdownMenu, and App.tsx's free-text fallback menu) so they can't
// visually drift from each other. Change spacing/sizing here once.

export const menuContentClass =
  "z-50 min-w-[11rem] overflow-hidden rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";

export const menuSubContentClass =
  "z-50 min-w-[9rem] overflow-hidden rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";

// gap-2.5 + size-3.5 icons gives icon and text room to breathe without
// the row feeling icon-heavy; rounded-sm matches the content shell's
// rounded-md at one step down, same scale used across ui/select.tsx etc.
export const menuItemClass =
  "relative flex cursor-pointer select-none items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-xs leading-none outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0";

export const menuLabelClass = "px-2.5 py-1.5 text-xs font-semibold";

export const menuSeparatorClass = "-mx-1.5 my-1.5 h-px bg-border";

export const menuIndicatorWrapperClass =
  "absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center";

export const menuInsetClass = "pl-8";
