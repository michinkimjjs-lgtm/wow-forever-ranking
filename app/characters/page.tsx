import type { Metadata } from "next";
import Link from "next/link";
import { CharacterLink, RelativeTime, VerificationBadge } from "@/components/game-labels";
import { EmptyState } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  InvalidQueryError,
  parseSearchParams,
  SEARCH_QUERY_MAX_LENGTH,
  toURLSearchParams,
} from "@/lib/api/params";
import { GameScopeNotConfiguredError, getGameScope } from "@/lib/config";
import { SetupPending } from "@/components/setup-pending";
import { formatInteger } from "@/lib/format";
import { getMessages, labelOf, t } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import { getServerContext } from "@/lib/server/context";
import { loadCharacterSearch } from "@/lib/server/services";

export function generateMetadata(): Metadata {
  const seo = getMessages().seo.characterSearch;
  return pageMetadata({ title: seo.title, description: seo.description, path: routes.characters() });
}

export default async function CharacterSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const m = getMessages();
  const s = m.characters.search;
  const { appEnv, now } = await getServerContext();
  const query = toURLSearchParams(await searchParams);
  const path = routes.characters();
  const gameScope = getGameScope(appEnv);
  if (!gameScope) {
    // 지역·게임 모드 설정이 확정되지 않은 배포: 검색 대신 준비 중 화면
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={s.title} description={s.description} />
        <SetupPending dataEnvironment={appEnv} />
      </div>
    );
  }

  let parsed;
  try {
    parsed = parseSearchParams(query, appEnv, { strict: false, requireQuery: false });
  } catch (error) {
    if (!(error instanceof InvalidQueryError) && !(error instanceof GameScopeNotConfiguredError)) throw error;
    parsed = null;
  }

  const q = parsed?.q ?? "";
  const search =
    parsed && q
      ? await loadCharacterSearch(parsed, {
          q,
          gameMode: parsed.gameModeSpecified ? parsed.scope.gameMode : undefined,
        })
      : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={s.title} description={s.description} />
      <form key={query.toString()} method="get" action={path} role="search" className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="character-search">
          {s.label}
        </label>
        <Input
          id="character-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={s.placeholder}
          maxLength={SEARCH_QUERY_MAX_LENGTH}
          autoComplete="off"
          className="sm:max-w-md"
        />
        <label className="sr-only" htmlFor="character-search-mode">
          {m.rankings.filters.gameMode}
        </label>
        <NativeSelect
          id="character-search-mode"
          name="gameMode"
          defaultValue={parsed?.gameModeSpecified ? parsed.scope.gameMode : ""}
          className="sm:w-48"
        >
          <option value="">{`${m.rankings.filters.gameMode}: ${m.rankings.filters.all}`}</option>
          {gameScope?.gameModes.map((mode) => (
            <option key={mode.code} value={mode.code}>
              {labelOf(m.game.gameModes, mode.code)}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit">{m.common.actions.search}</Button>
      </form>

      {!parsed ? (
        <EmptyState title={m.common.invalidQuery.title} body={m.common.invalidQuery.body}>
          <Button asChild variant="outline" size="sm">
            <Link href={path}>{m.common.actions.reset}</Link>
          </Button>
        </EmptyState>
      ) : !search ? (
        <EmptyState title={s.prompt} />
      ) : search.result.rows.length === 0 ? (
        <EmptyState title={s.noResults} />
      ) : (
        <section className="flex flex-col gap-3" aria-label={s.resultTitle}>
          <h2 className="text-sm text-muted">{t(s.resultCount, { total: formatInteger(search.result.total) })}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {search.result.rows.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-4 py-3">
                <div className="flex items-center gap-2">
                  <CharacterLink character={c} className="text-base" />
                  {c.isStale ? <Badge>{m.common.status.excluded}</Badge> : null}
                  <span className="ml-auto">
                    <VerificationBadge status={c.verificationStatus} />
                  </span>
                </div>
                <p className="text-sm text-foreground/90">
                  {t(s.summary, {
                    level: c.level,
                    class: labelOf(m.game.classes, c.classCode),
                    faction: labelOf(m.game.factions, c.factionCode),
                  })}
                </p>
                <p className="flex flex-wrap gap-x-3 text-xs text-muted">
                  <span>{c.guild ? t(s.guildLine, { guild: c.guild.name }) : s.noGuild}</span>
                  <span>{labelOf(m.game.gameModes, c.gameMode)}</span>
                  <span>
                    {m.common.status.lastChecked} <RelativeTime date={c.lastSeenAt} now={now} />
                  </span>
                </p>
              </li>
            ))}
          </ul>
          <Pagination
            path={path}
            query={query}
            page={parsed.pagination.page}
            pageSize={parsed.pagination.pageSize}
            total={search.result.total}
          />
        </section>
      )}
    </div>
  );
}
