import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    variant: {
      default: "border-border-strong bg-surface-raised text-muted",
      accent: "border-accent/40 bg-accent/10 text-accent",
      success: "border-success/40 bg-success/10 text-success",
      warning: "border-warning/40 bg-warning/10 text-warning",
      info: "border-info/40 bg-info/10 text-info",
      danger: "border-danger/40 bg-danger/10 text-danger",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
