import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataFreshness } from "@/components/data-freshness";
import { CharacterLink, ClassLabel, FactionLabel, RelativeTime, VerificationBadge } from "@/components/game-labels";
import { EmptyState } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { normalizeSlugParam } from "@/lib/domain/names";
import { formatAverageItemLevel, formatKstDateTime } from "@/lib/format";
import { getMessages, labelOf, t } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import { loadGuildBySlug } from "@/lib/server/services";

type Params = Promise<{ region: string; gameMode: string; slug: string }>;

async function load(params: Params) {
  const { region, gameMode, slug } = await params;
  return loadGuildBySlug({ region, gameMode, slug: normalizeSlugParam(slug) });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { guild } = await load(params);
  const m = getMessages().seo;
  if (!guild) return { title: { absolute: m.notFound.title } };
  return pageMetadata({
    title: t(m.guild.title, { name: guild.name }),
    description: t(m.guild.description, { name: guild.name }),
    path: routes.guild(guild),
  });
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-4 py-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="tabular text-lg font-semibold">{value}</span>
      {sub ? <span className="text-xs text-subtle">{sub}</span> : null}
    </div>
  );
}

export default async function GuildPage({ params }: { params: Params }) {
  const { ctx, guild } = await load(params);
  if (!guild) notFound();
  const m = getMessages();
  const gm = m.guilds;
  const c = m.rankings.columns;
  const none = m.common.status.none;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{guild.name}</h1>
          <VerificationBadge status={guild.verificationStatus} />
        </div>
        <p className="flex flex-wrap gap-x-2 text-sm">
          <FactionLabel code={guild.factionCode} />
          <span className="text-subtle">·</span>
          <span className="text-muted">{labelOf(m.game.gameModes, guild.gameMode)}</span>
        </p>
        <DataFreshness lastUpdatedAt={guild.lastSeenAt} now={ctx.now} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label={gm.memberCount} value={t(gm.memberCountValue, { n: guild.memberCount })} />
        <Stat
          label={gm.representative}
          value={guild.representative ? <CharacterLink character={guild.representative} /> : none}
          sub={guild.representative ? gm.representativeNote : undefined}
        />
        <Stat label={gm.maxLevel} value={guild.maxLevel ?? none} />
        <Stat label={gm.maxAverageItemLevel} value={formatAverageItemLevel(guild.maxAverageItemLevel)} />
        <Stat
          label={gm.lastUpdated}
          value={guild.lastSeenAt ? <RelativeTime date={guild.lastSeenAt} now={ctx.now} /> : none}
          sub={guild.lastSeenAt ? formatKstDateTime(guild.lastSeenAt) : undefined}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{gm.members}</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {guild.members.length === 0 ? (
            <EmptyState title={gm.noMembers} className="m-4" />
          ) : (
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>{c.character}</TableHead>
                  <TableHead className="text-right">{c.level}</TableHead>
                  <TableHead>{c.class}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{c.averageItemLevel}</TableHead>
                  <TableHead className="hidden md:table-cell">{c.lastChecked}</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {guild.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <CharacterLink character={member} />
                        {member.isStale ? <Badge>{m.common.status.excluded}</Badge> : null}
                      </span>
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold">{member.level}</TableCell>
                    <TableCell>
                      <ClassLabel code={member.classCode} />
                    </TableCell>
                    <TableCell className="tabular hidden text-right sm:table-cell">
                      {formatAverageItemLevel(member.averageItemLevel)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <RelativeTime date={member.lastSeenAt} now={ctx.now} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
