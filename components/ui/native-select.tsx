import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** 자바스크립트 없이도 동작하는 GET 필터 폼용 기본 select */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-md border border-border-strong bg-background px-2 text-sm text-foreground focus-visible:border-accent",
        className,
      )}
      {...props}
    />
  );
}
