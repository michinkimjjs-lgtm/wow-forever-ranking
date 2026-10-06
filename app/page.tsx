import Link from "next/link";
import { DataFreshness } from "@/components/data-freshness";
import { CharacterLink, ClassLabel, RelativeTime } from "@/components/game-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireGameScope } from "@/lib/config";
import { formatAverageItemLevel, formatInteger, formatKstDateTime, formatRelativeTime } from "@/lib/format";
import { getMessages, labelOf, t } from "@/lib/i18n";
import type { RankingResult, RankingRow, RankingType } from "@/lib/ranking/types";
import { routes } from "@/lib/routes";
import { getServerContext } from "@/lib/server/context";
import { loadHome } from "@/lib/server/services";

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-4 py-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="tabular text-2xl font-bold text-accent">{value}</span>
      {sub ? <span className="text-xs text-subtle">{sub}</span> : null}
    </div>
  );
}

function TopList({
  title,
  type,
  result,
  value,
}: {
  title: string;
  type: RankingType;
  result: RankingResult;
  value: (row: RankingRow) => string;
}) {
  const m = getMessages();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Link href={routes.ranking(type)} className="text-xs text-accent hover:underline">
          {m.common.actions.viewAll}
        </Link>
      </CardHeader>
      <CardContent className="px-0 py-1">
        {result.status === "unavailable" ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{m.rankings.unavailable.title}</p>
        ) : result.rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{m.rankings.empty}</p>
        ) : (
          <ol className="divide-y divide-border">
            {result.rows.map((row) => (
              <li key={row.characterId} className="flex items-center gap-3 px-4 py-1.5 text-sm">
                <span className={`tabular w-5 text-right ${row.rank <= 3 ? "font-semibold text-accent" : "text-muted"}`}>
                  {row.rank}
                </span>
                <CharacterLink character={row} className="min-w-0 truncate" />
                <span className="hidden text-xs sm:inline">
                  <ClassLabel code={row.classCode} />
                </span>
                <span className="tabular ml-auto font-semibold">{value(row)}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export default async function HomePage() {
  const m = getMessages();
  const { appEnv, now } = await getServerContext();
  const gameScope = requireGameScope(appEnv);
  const { overview } = await loadHome({ dataEnvironment: appEnv, gameMode: gameScope.defaultGameMode });
  const { kpi } = overview;
  const none = m.common.status.none;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{m.home.title}</h1>
        <p className="text-sm text-muted">{m.home.subtitle}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
          <span>{t(m.home.scopeNote, { gameMode: labelOf(m.game.gameModes, overview.scope.gameMode) })}</span>
          <DataFreshness lastUpdatedAt={kpi.lastUpdatedAt} now={now} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Kpi label={m.home.kpi.topLevel} value={kpi.topLevel !== null ? String(kpi.topLevel) : none} />
        <Kpi label={m.home.kpi.topAverageItemLevel} value={formatAverageItemLevel(kpi.topAverageItemLevel)} />
        <Kpi label={m.home.kpi.topHighestItemLevel} value={kpi.topHighestItemLevel !== null ? String(kpi.topHighestItemLevel) : none} />
        <Kpi
          label={m.home.kpi.trackedCharacters}
          value={formatInteger(kpi.trackedCharacters)}
          sub={t(m.home.kpi.rankedCharacters, { n: formatInteger(kpi.rankedCharacters) })}
        />
        <Kpi
          label={m.home.kpi.lastUpdated}
          value={kpi.lastUpdatedAt ? formatRelativeTime(kpi.lastUpdatedAt, now) : none}
          sub={kpi.lastUpdatedAt ? formatKstDateTime(kpi.lastUpdatedAt) : undefined}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <TopList title={m.home.cards.level} type="level" result={overview.level} value={(r) => String(r.level)} />
        <TopList title={m.home.cards.gear} type="gear" result={overview.gear} value={(r) => formatAverageItemLevel(r.averageItemLevel)} />
        <TopList
          title={m.home.cards.highestItem}
          type="highest-item"
          result={overview.highestItem}
          value={(r) => (r.highestItemLevel !== null ? String(r.highestItemLevel) : none)}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{m.home.cards.recentlyUpdated}</CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-1">
            <ul className="divide-y divide-border">
              {overview.recentlyUpdated.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-1.5 text-sm">
                  <CharacterLink character={c} className="min-w-0 truncate" />
                  <span className="text-xs text-muted">{t(m.home.levelShort, { level: c.level })}</span>
                  <span className="ml-auto text-xs">
                    <RelativeTime date={c.lastSeenAt} now={now} />
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{m.home.cards.recentLevelUps}</CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-1">
            <ul className="divide-y divide-border">
              {overview.recentLevelUps.map((e) => (
                <li key={`${e.character.id}-${e.level}`} className="flex items-center gap-3 px-4 py-1.5 text-sm">
                  <CharacterLink character={e.character} className="min-w-0 truncate" />
                  <span className="text-xs text-accent">{t(m.home.levelUp, { level: e.level })}</span>
                  <span className="hidden text-xs text-subtle sm:inline">{m.game.timingBases[e.timingBasis]}</span>
                  <span className="ml-auto text-xs">
                    <RelativeTime date={e.effectiveReachedAt} now={now} />
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
