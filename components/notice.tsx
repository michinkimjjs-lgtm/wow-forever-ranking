import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function NoticeList({ items }: { items: ReactNode[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-xs text-muted">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden="true" className="text-accent">
            ·
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ title, body, className, children }: { title: string; body?: string; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-12 text-center", className)}>
      <p className="font-medium text-foreground">{title}</p>
      {body ? <p className="text-sm text-muted">{body}</p> : null}
      {children}
    </div>
  );
}
