import { formatInteger, formatKstDate } from "@/lib/format";
import { getMessages, t } from "@/lib/i18n";
import { VERIFICATION_STATUSES } from "@/lib/domain/enums";
import type { RankingStage, ServerWideClaim } from "@/lib/ranking/community";
import type { DataCoverage } from "@/lib/ranking/coverage";

/**
 * 데이터 기준 / 범위 / 출처 / 검증 상태 안내 (docs/COMMUNITY-RANKING-PLAN.md §8)
 * 전체 서버 순위 표현은 evaluateServerWideClaim이 허용할 때만 쓴다.
 */
export function DataScopePanel({
  coverage,
  stage,
  claim,
  staleDays,
}: {
  coverage: DataCoverage;
  stage: RankingStage;
  claim: ServerWideClaim;
  staleDays: number;
}) {
  const m = getMessages();
  const s = m.rankings.dataScope;
  const origins = coverage.origins.map((o) => m.game.dataOrigins[o]).join(" / ");
  const statuses = VERIFICATION_STATUSES.filter((v) => coverage.byVerification[v] > 0)
    .map((v) => m.game.verificationStatuses[v])
    .join(" / ");
  const none = m.common.status.none;

  return (
    <section aria-label={s.label} className="rounded-lg border border-border bg-surface px-4 py-3 text-xs">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-accent">{m.rankings.stageBadges[stage]}</span>
        <span className="text-muted">{claim.allowed ? s.serverWideRankMeaning : s.observedRankMeaning}</span>
      </div>
      {coverage.activeCharacters === 0 ? (
        <p className="text-muted">{s.noData}</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr_auto_1fr]">
          <dt className="text-subtle">{s.basis}</dt>
          <dd className="text-foreground">{coverage.latestSeenAt ? formatKstDate(coverage.latestSeenAt) : none}</dd>
          <dt className="text-subtle">{s.range}</dt>
          <dd className="text-foreground">
            {t(s.rangeValue, { count: formatInteger(coverage.activeCharacters), days: staleDays })}
          </dd>
          <dt className="text-subtle">{s.source}</dt>
          <dd className="text-foreground">{origins || none}</dd>
          <dt className="text-subtle">{s.verification}</dt>
          <dd className="text-foreground">{statuses || none}</dd>
        </dl>
      )}
    </section>
  );
}
