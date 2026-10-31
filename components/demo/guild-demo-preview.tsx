import { DemoCharacterIdentity, DemoFactionTag, DemoPageBanner, DemoRankChip, DemoSection } from "@/components/demo/demo-common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { demoGuilds } from "@/lib/demo/home-preview-fixture";
import { formatAverageItemLevel, formatInteger } from "@/lib/format";
import { getMessages, t } from "@/lib/i18n";

/**
 * 길드 화면 미리보기 (실제 데이터 설정이 확인되지 않은 배포에서만)
 *
 * - 길드는 샘플 캐릭터의 길드 이름으로 묶은 예시다. DB·API를 거치지 않는다.
 * - 가상 길드·캐릭터는 실제 페이지로 연결하지 않는다.
 */
export function GuildDemoPreview() {
  const g = getMessages().demo.guilds;
  const d = getMessages().home.demo;
  const guilds = demoGuilds();
  const featured = guilds[0]!;
  const members = featured.members.slice().sort((a, b) => b.level - a.level || b.averageItemLevel - a.averageItemLevel);
  return (
    <div className="flex flex-col gap-10">
      <DemoPageBanner />
      <DemoSection title={g.title} subtitle={g.subtitle}>
        <Card data-demo-guilds="true" className="overflow-hidden">
          <Table>
            <TableHeader>
              <tr>
                <TableHead>{g.columns.name}</TableHead>
                <TableHead>{g.columns.faction}</TableHead>
                <TableHead className="text-right">{g.columns.members}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{g.columns.topLevel}</TableHead>
                <TableHead className="hidden text-right md:table-cell">{g.columns.averageLevel}</TableHead>
                <TableHead className="hidden text-right md:table-cell">{g.columns.averageItemLevel}</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {guilds.map((guild) => (
                <TableRow key={guild.name} data-demo-guild={guild.name}>
                  <TableCell className="font-medium text-foreground">{guild.name}</TableCell>
                  <TableCell>
                    <DemoFactionTag faction={guild.faction} />
                  </TableCell>
                  <TableCell className="tabular text-right">{t(g.memberCount, { n: guild.members.length })}</TableCell>
                  <TableCell className="tabular hidden text-right sm:table-cell">{formatInteger(guild.topLevel)}</TableCell>
                  <TableCell className="tabular hidden text-right text-muted md:table-cell">{guild.averageLevel.toFixed(1)}</TableCell>
                  <TableCell className="tabular hidden text-right text-muted md:table-cell">
                    {formatAverageItemLevel(guild.averageItemLevel)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </DemoSection>

      <DemoSection title={t(g.detailTitle, { name: featured.name })} subtitle={g.detailSubtitle}>
        <Card data-demo-guild-detail={featured.name}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {featured.name}
              <DemoFactionTag faction={featured.faction} />
            </CardTitle>
            <Badge variant="accent">{d.badge}</Badge>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <ol className="divide-y divide-border">
              {members.map((c, i) => (
                <li key={c.key} className="flex items-center gap-3 px-4 py-3">
                  <DemoRankChip rank={i + 1} />
                  <div className="min-w-0 flex-1">
                    <DemoCharacterIdentity
                      character={c}
                      extra={t(g.memberLine, { level: c.level, itemLevel: formatAverageItemLevel(c.averageItemLevel) })}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </DemoSection>
    </div>
  );
}
