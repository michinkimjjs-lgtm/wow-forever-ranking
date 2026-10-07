import Link from "next/link";
import { DataFreshness } from "@/components/data-freshness";
import { EmptyState, NoticeList } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { InvalidQueryError, parseListParams, toURLSearchParams, type SearchParamsInput } from "@/lib/api/params";
import { formatPercent } from "@/lib/format";
import { getMessages, t } from "@/lib/i18n";
import type { RankingType } from "@/lib/ranking/types";
import { routes } from "@/lib/routes";
import { getServerContext } from "@/lib/server/context";
import { loadGuildOptions, loadRanking } from "@/lib/server/services";
import { resolveGearProfile } from "@/lib/config";
import { cn } from "@/lib/utils";
import { RankingFiltersForm } from "./ranking-filters";
import { RankingTable } from "./ranking-table";

function RankingTabs({ active }: { active: RankingType }) {
  const titles = getMessages().rankings.titles;
  const types: RankingType[] = ["level", "gear", "highest-item"];
  return (
    <div className="flex gap-1 overflow-x-auto" role="list">
      {types.map((type) => (
        <Link
          key={type}
          role="listitem"
          href={routes.ranking(type)}
          aria-current={type === active ? "page" : undefined}
          className={cn(
            "whitespace-nowrap rounded-md border px-3 py-1.5 text-sm",
            type === active
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-border text-muted hover:text-foreground",
          )}
        >
          {titles[type]}
        </Link>
      ))}
    </div>
  );
}

export async function RankingPageView({ type, searchParams }: { type: RankingType; searchParams: SearchParamsInput }) {
  const m = getMessages();
  const path = routes.ranking(type);
  const { appEnv, now } = await getServerContext();
  const query = toURLSearchParams(searchParams);

  let parsed;
  try {
    parsed = parseListParams(query, appEnv, { strict: false });
  } catch (error) {
    if (!(error instanceof InvalidQueryError)) throw error;
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={m.rankings.titles[type]} />
        <EmptyState title={m.common.invalidQuery.title} body={m.common.invalidQuery.body}>
          <Button asChild variant="outline" size="sm">
            <Link href={path}>{m.common.actions.reset}</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  const [{ result }, guildOptions] = await Promise.all([loadRanking(type, parsed), loadGuildOptions(parsed.scope)]);
  const staleDays = result.policy.staleAfterDays;
  const profile = resolveGearProfile(parsed.scope.dataEnvironment, parsed.scope.gameMode);

  const notices: string[] = [t(m.rankings.notices.staleRule, { days: staleDays })];
  if (type !== "level" && profile?.minimumCoverage.minRankableSlotRatio !== undefined) {
    notices.push(t(m.rankings.notices.gearRule, { percent: formatPercent(profile.minimumCoverage.minRankableSlotRatio) }));
  }
  if (type !== "level" && profile?.status === "DRAFT") notices.push(m.rankings.notices.provisionalProfile);
  if (parsed.scope.dataEnvironment !== "mock") notices.push(m.rankings.notices.submittedOnly);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={m.rankings.titles[type]} description={m.rankings.descriptions[type]}>
        <DataFreshness lastUpdatedAt={result.status === "ok" ? result.lastUpdatedAt : null} now={now} />
      </PageHeader>
      <RankingTabs active={type} />
      <RankingFiltersForm
        key={query.toString()}
        action={path}
        appEnv={appEnv}
        scope={parsed.scope}
        filters={parsed.filters}
        guilds={guildOptions}
      />
      <NoticeList items={notices} />
      {result.status === "unavailable" ? (
        <EmptyState title={m.rankings.unavailable.title} body={m.rankings.unavailable.body} />
      ) : result.rows.length === 0 ? (
        <EmptyState title={m.rankings.empty} />
      ) : (
        <div className="rounded-lg border border-border bg-surface">
          <RankingTable type={type} rows={result.rows} now={now} />
        </div>
      )}
      {result.status === "ok" && result.total > 0 ? (
        <Pagination
          path={path}
          query={query}
          page={parsed.pagination.page}
          pageSize={parsed.pagination.pageSize}
          total={result.total}
        />
      ) : null}
    </div>
  );
}
