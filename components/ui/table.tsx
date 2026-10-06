import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** 좁은 화면에서는 표 영역 안에서만 가로 스크롤한다. (페이지 전체 가로 스크롤 방지) */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("border-b border-border bg-surface-raised/60", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-surface-raised/50", className)} {...props} />;
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn("whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("whitespace-nowrap px-3 py-2.5 align-middle", className)} {...props} />;
}
