import type { Metadata } from "next";
import Link from "next/link";
import { FactionLabel, RelativeTime } from "@/components/game-labels";
import { EmptyState } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMessages, labelOf, t } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import { loadGuildList } from "@/lib/server/services";

export function generateMetadata(): Metadata {
  const seo = getMessages().seo.guilds;
  return pageMetadata({ title: seo.title, description: seo.description, path: routes.guilds() });
}

export default async function GuildListPage() {
  const m = getMessages();
  const gm = m.guilds;
  const { ctx, guilds } = await loadGuildList();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={gm.listTitle} description={gm.listDescription} />
      {guilds.length === 0 ? (
        <EmptyState title={gm.empty} />
      ) : (
        <div className="rounded-lg border border-border bg-surface">
          <Table>
            <TableHeader>
              <tr>
                <TableHead>{gm.name}</TableHead>
                <TableHead>{gm.faction}</TableHead>
                <TableHead className="hidden sm:table-cell">{m.rankings.filters.gameMode}</TableHead>
                <TableHead className="text-right">{gm.memberCount}</TableHead>
                <TableHead className="hidden md:table-cell">{gm.lastUpdated}</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {guilds.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <Link href={routes.guild(g)} className="font-medium hover:text-accent hover:underline">
                      {g.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <FactionLabel code={g.factionCode} />
                  </TableCell>
                  <TableCell className="hidden text-muted sm:table-cell">{labelOf(m.game.gameModes, g.gameMode)}</TableCell>
                  <TableCell className="tabular text-right">{t(gm.memberCountValue, { n: g.memberCount })}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {g.lastSeenAt ? <RelativeTime date={g.lastSeenAt} now={ctx.now} /> : m.common.status.none}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
