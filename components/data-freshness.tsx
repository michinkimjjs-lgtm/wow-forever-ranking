import { formatKstDateTime, formatRelativeTime } from "@/lib/format";
import { getMessages, t } from "@/lib/i18n";

/** 데이터 최신 시각 (명세서 §20): "데이터 갱신: 2026년 10월 6일 오후 3:42 · 마지막 확인: 2분 전" */
export function DataFreshness({ lastUpdatedAt, now }: { lastUpdatedAt: Date | null; now: Date }) {
  const m = getMessages().common;
  if (!lastUpdatedAt) {
    return (
      <p className="text-xs text-muted">
        {m.status.dataUpdated}: {m.status.noData}
      </p>
    );
  }
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      <span>{t(m.freshness.updated, { time: formatKstDateTime(lastUpdatedAt) })}</span>
      <span aria-hidden="true" className="hidden text-subtle sm:inline">
        ·
      </span>
      <time dateTime={lastUpdatedAt.toISOString()}>
        {t(m.freshness.checked, { relative: formatRelativeTime(lastUpdatedAt, now) })}
      </time>
    </p>
  );
}
