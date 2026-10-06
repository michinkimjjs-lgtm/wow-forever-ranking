import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { getCodes, getGameScope } from "@/lib/config";
import { getRequestableEnvironments } from "@/lib/config/env";
import type { DataEnvironment } from "@/lib/domain/enums";
import { getMessages, labelOf } from "@/lib/i18n";
import type { GuildSummary } from "@/lib/queries/guilds";
import type { RankingFilters, RankingScope } from "@/lib/ranking/types";

/**
 * 랭킹 필터. 자바스크립트 없이 동작하는 GET 폼이다. 결과는 서버에서 필터링한다.
 */
export function RankingFiltersForm({
  action,
  appEnv,
  scope,
  filters,
  guilds,
}: {
  action: string;
  appEnv: DataEnvironment;
  scope: RankingScope;
  filters: RankingFilters;
  guilds: GuildSummary[];
}) {
  const m = getMessages();
  const f = m.rankings.filters;
  const gameScope = getGameScope(scope.dataEnvironment);
  const codes = getCodes(scope.dataEnvironment);
  const environments = getRequestableEnvironments(appEnv);
  const field = "flex flex-col gap-1 text-xs text-muted";

  return (
    <form method="get" action={action} className="rounded-lg border border-border bg-surface p-3">
      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <legend className="sr-only">{f.title}</legend>
        <label className={field}>
          {f.environment}
          <NativeSelect name="dataEnvironment" defaultValue={scope.dataEnvironment}>
            {environments.map((env) => (
              <option key={env} value={env}>
                {m.game.dataEnvironments[env]}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className={field}>
          {f.gameMode}
          <NativeSelect name="gameMode" defaultValue={scope.gameMode}>
            {gameScope?.gameModes.map((mode) => (
              <option key={mode.code} value={mode.code}>
                {labelOf(m.game.gameModes, mode.code)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className={field}>
          {f.class}
          <NativeSelect name="class" defaultValue={filters.classCode ?? ""}>
            <option value="">{f.all}</option>
            {codes?.classes.map((code) => (
              <option key={code} value={code}>
                {labelOf(m.game.classes, code)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className={field}>
          {f.faction}
          <NativeSelect name="faction" defaultValue={filters.factionCode ?? ""}>
            <option value="">{f.all}</option>
            {codes?.factions.map((code) => (
              <option key={code} value={code}>
                {labelOf(m.game.factions, code)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className={field}>
          {f.guild}
          <NativeSelect name="guild" defaultValue={filters.guildId ?? ""}>
            <option value="">{f.all}</option>
            {guilds.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        {gameScope && gameScope.regions.length > 1 ? (
          <label className={field}>
            {f.region}
            <NativeSelect name="region" defaultValue={filters.region ?? ""}>
              <option value="">{f.all}</option>
              {gameScope.regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {labelOf(m.game.regions, r.code)}
                </option>
              ))}
            </NativeSelect>
          </label>
        ) : null}
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-muted">
          <input
            type="checkbox"
            name="verifiedOnly"
            value="true"
            defaultChecked={filters.verifiedOnly}
            className="size-4 accent-[var(--color-accent)]"
          />
          {f.verifiedOnly}
        </label>
      </fieldset>
      <div className="mt-3 flex justify-end gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={action}>{m.common.actions.reset}</Link>
        </Button>
        <Button type="submit" size="sm">
          {m.common.actions.applyFilter}
        </Button>
      </div>
    </form>
  );
}
