import type { ReactNode } from "react";

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border pb-4">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {description ? <p className="text-sm text-muted">{description}</p> : null}
      {children}
    </div>
  );
}
