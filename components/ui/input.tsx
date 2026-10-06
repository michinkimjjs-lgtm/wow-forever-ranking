import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-border-strong bg-background px-3 text-sm text-foreground placeholder:text-subtle focus-visible:border-accent",
        className,
      )}
      {...props}
    />
  );
}
