import Link from "next/link";
import { formatInteger } from "@/lib/format";
import { getMessages, t } from "@/lib/i18n";
import { withQuery } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function Pagination({
  path,
  query,
  page,
  pageSize,
  total,
}: {
  path: string;
  query: URLSearchParams;
  page: number;
  pageSize: number;
  total: number;
}) {
  const m = getMessages().common;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const linkClass = "rounded-md border border-border-strong px-3 py-1.5 text-sm hover:bg-surface-raised";
  const disabledClass = "rounded-md border border-border px-3 py-1.5 text-sm text-subtle";
  return (
    <nav aria-label={m.pagination.label} className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted">{t(m.pagination.total, { total: formatInteger(total) })}</span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link className={linkClass} href={withQuery(path, query, { page: String(page - 1) })} rel="prev">
            {m.actions.previous}
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            {m.actions.previous}
          </span>
        )}
        <span className="tabular px-1 text-muted">{t(m.pagination.status, { page, totalPages })}</span>
        {page < totalPages ? (
          <Link className={cn(linkClass)} href={withQuery(path, query, { page: String(page + 1) })} rel="next">
            {m.actions.next}
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            {m.actions.next}
          </span>
        )}
      </div>
    </nav>
  );
}
