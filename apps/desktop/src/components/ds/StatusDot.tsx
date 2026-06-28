import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusDotVariants = cva("inline-block rounded-full", {
  variants: {
    tone: {
      neutral: "bg-muted-foreground/50",
      primary: "bg-primary",
      success: "bg-success",
      warning: "bg-warning",
      info: "bg-info",
      destructive: "bg-destructive",
    },
    size: {
      sm: "h-1.5 w-1.5",
      md: "h-2 w-2",
      lg: "h-2.5 w-2.5",
    },
    pulse: {
      true: "animate-pulse-dot",
      false: "",
    },
  },
  defaultVariants: {
    tone: "neutral",
    size: "md",
    pulse: false,
  },
});

export interface StatusDotProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusDotVariants> {}

function StatusDot({ className, tone, size, pulse, ...props }: StatusDotProps) {
  return (
    <span
      className={cn(statusDotVariants({ tone, size, pulse }), className)}
      {...props}
    />
  );
}

export { StatusDot, statusDotVariants };
