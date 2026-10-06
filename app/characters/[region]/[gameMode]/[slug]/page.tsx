import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataFreshness } from "@/components/data-freshness";
import { ClassLabel, FactionLabel, GuildLink, ItemName, VerificationBadge } from "@/components/game-labels";
import { NoticeList } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStaleAfterDays } from "@/lib/config";
import { normalizeSlugParam } from "@/lib/domain/names";
import { formatAverageItemLevel, formatKstDateTime, formatPercent, formatRelativeTime } from "@/lib/format";
import { getMessages, labelOf, t } from "@/lib/i18n";
import type { CharacterDetail } from "@/lib/queries/characters";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import { loadCharacterBySlug } from "@/lib/server/services";

type Params = Promise<{ region: string; gameMode: string; slug: string }>;

async function load(params: Params) {
  const { region, gameMode, slug } = await params;
  return loadCharacterBySlug({ region, gameMode, slug: normalizeSlugParam(slug) });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { character } = await load(params);
  const m = getMessages().seo;
  if (!character) return { title: { absolute: m.notFound.title } };
  return pageMetadata({
    title: t(m.character.title, { name: character.characterName }),
    description: t(m.character.description, { name: character.characterName }),
    path: routes.character(character),
  });
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function RankSummary({ character }: { character: CharacterDetail }) {
  const m = getMessages().characters.ranks;
  const days = getStaleAfterDays(character.dataEnvironment);
  return (
    <ul className="flex flex-col gap-1">
      {character.ranks.map((r) => (
        <li key={r.type} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{m[r.type]}</span>
          {r.rank !== null ? (
            <span className="tabular font-semibold text-accent">{t(m.value, { rank: r.rank })}</span>
          ) : (
            <span className="text-xs text-subtle">{r.exclusion ? t(m.exclusions[r.exclusion], { days }) : "-"}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function CharacterPage({ params }: { params: Params }) {
  const { ctx, character } = await load(params);
  if (!character) notFound();
  const m = getMessages();
  const d = m.characters.detail;
  const g = m.characters.gear;
  const none = m.common.status.none;
  const profile = character.gearProfile;

  const gearNotices: string[] = [];
  if (!profile) gearNotices.push(g.profilePending);
  else {
    if (!profile.meetsCoverage) gearNotices.push(g.insufficient);
    if (profile.status === "PROVISIONAL") gearNotices.push(g.provisional);
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{character.characterName}</h1>
          <VerificationBadge status={character.verificationStatus} />
          {character.isStale ? <Badge>{m.common.status.excluded}</Badge> : null}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <span>{t(m.home.levelShort, { level: character.level })}</span>
          <span className="text-subtle">·</span>
          <span>{labelOf(m.game.races, character.raceCode)}</span>
          <ClassLabel code={character.classCode} />
          <span className="text-subtle">·</span>
          <FactionLabel code={character.factionCode} />
          {character.guild ? (
            <>
              <span className="text-subtle">·</span>
              <GuildLink guild={character.guild} region={character.region} gameMode={character.gameMode} />
            </>
          ) : null}
        </p>
        <DataFreshness lastUpdatedAt={character.lastSeenAt} now={ctx.now} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{d.profile}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <InfoItem label={d.name}>{character.characterName}</InfoItem>
                <InfoItem label={d.level}>
                  <span className="tabular font-semibold">{character.level}</span>
                </InfoItem>
                <InfoItem label={d.race}>{labelOf(m.game.races, character.raceCode)}</InfoItem>
                <InfoItem label={d.class}>
                  <ClassLabel code={character.classCode} />
                </InfoItem>
                <InfoItem label={d.faction}>
                  <FactionLabel code={character.factionCode} />
                </InfoItem>
                <InfoItem label={d.guild}>
                  <GuildLink guild={character.guild} region={character.region} gameMode={character.gameMode} />
                </InfoItem>
                <InfoItem label={d.averageItemLevel}>
                  <span className="tabular font-semibold">
                    {profile ? formatAverageItemLevel(character.averageItemLevel) : g.profilePending}
                  </span>
                </InfoItem>
                <InfoItem label={d.highestItemLevel}>
                  <span className="tabular font-semibold">
                    {profile ? (character.highestItemLevel ?? none) : g.profilePending}
                  </span>
                </InfoItem>
                <InfoItem label={d.lastChecked}>
                  <time dateTime={character.lastSeenAt.toISOString()} title={formatKstDateTime(character.lastSeenAt)}>
                    {formatRelativeTime(character.lastSeenAt, ctx.now)}
                  </time>
                </InfoItem>
                <InfoItem label={d.firstSeen}>{formatKstDateTime(character.firstSeenAt)}</InfoItem>
                <InfoItem label={d.dataSource}>{m.game.dataSources[character.dataSource]}</InfoItem>
                <InfoItem label={d.verification}>
                  <VerificationBadge status={character.verificationStatus} />
                </InfoItem>
                <InfoItem label={d.region}>{labelOf(m.game.regions, character.region)}</InfoItem>
                <InfoItem label={d.gameMode}>{labelOf(m.game.gameModes, character.gameMode)}</InfoItem>
                <InfoItem label={d.currentLevelReached}>
                  {character.currentLevel ? formatKstDateTime(character.currentLevel.effectiveReachedAt) : none}
                </InfoItem>
                <InfoItem label={d.timingBasis}>
                  {character.currentLevel ? m.game.timingBases[character.currentLevel.timingBasis] : none}
                </InfoItem>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{d.currentRank}</CardTitle>
            </CardHeader>
            <CardContent>
              <RankSummary character={character} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{d.equipment}</CardTitle>
            {character.gearCoverage !== null ? (
              <span className="text-xs text-muted">
                {d.gearCoverage} {t(g.coverageValue, { percent: formatPercent(character.gearCoverage) })}
              </span>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <NoticeList items={gearNotices} />
            {character.equipment.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{m.common.status.noData}</p>
            ) : (
              <ul className="grid gap-x-4 sm:grid-cols-2">
                {character.equipment.map((slot) => (
                  <li key={slot.slotCode} className="flex items-baseline gap-3 border-b border-border/60 py-2 text-sm">
                    <span className="w-20 shrink-0 text-xs text-muted">{labelOf(m.game.slots, slot.slotCode)}</span>
                    {slot.item ? (
                      <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                        <span className="truncate">
                          <ItemName name={slot.item.name} quality={slot.item.qualityCode} />
                        </span>
                        <span className="tabular shrink-0 text-xs text-muted">
                          {slot.item.itemLevel !== null ? t(g.itemLevel, { n: slot.item.itemLevel }) : g.unknownItemLevel}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-subtle">{g.emptySlot}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
