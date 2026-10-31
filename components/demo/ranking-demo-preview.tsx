import { DemoCharacterIdentity, DemoFactionTag, DemoPageBanner, DemoRankChip, DemoSection, demoFactionOf } from "@/components/demo/demo-common";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { demoCharacter, homeDemoFixture, type DemoCharacter } from "@/lib/demo/home-preview-fixture";
import { formatAverageItemLevel, formatInteger } from "@/lib/format";
import { getMessages, t } from "@/lib/i18n";
import type { RankingType } from "@/lib/ranking/types";
import { cn } from "@/lib/utils";

/**
 * 랭킹 화면 미리보기 (실제 데이터 설정이 확인되지 않은 배포에서만)
 *
 * - 순위는 lib/demo/home-preview-fixture.ts에 미리 정해 둔 예시 값이다. 랭킹 엔진·DB·API를 거치지 않는다.
 * - 가상 캐릭터는 캐릭터 페이지로 연결하지 않는다.
 */
export function RankingDemoPreview({ type }: { type: RankingType }) {
  const r = getMessages().demo.ranking;
  const keys = homeDemoFixture.rankingsFull[type === "highest-item" ? "highestItem" : type];
  return (
    <div className="flex flex-col gap-5">
      <DemoPageBanner />
      <DemoSection title={r.title[type]} subtitle={t(r.subtitle, { total: keys.length })}>
        <p className="text-xs text-subtle">{r.rule[type]}</p>
        <Card data-demo-ranking-page={type} className="overflow-hidden">
          <Table>
            <TableHeader>
              <tr>
                <TableHead className="w-12 text-center">{r.columns.rank}</TableHead>
                <TableHead>{r.columns.character}</TableHead>
                <TableHead className="hidden sm:table-cell">{r.columns.faction}</TableHead>
                <TableHead className="hidden md:table-cell">{r.columns.guild}</TableHead>
                <ScoreHeads type={type} />
                <TableHead className="hidden lg:table-cell">{r.columns.lastSeen}</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {keys.map((key, index) => {
                const c = demoCharacter(key);
                return (
                  <TableRow key={key} data-demo-row={key}>
                    <TableCell className="text-center">
                      <span className="flex justify-center">
                        <DemoRankChip rank={index + 1} />
                      </span>
                    </TableCell>
                    <TableCell>
                      <DemoCharacterIdentity character={c} extra={<span className="md:hidden">{c.guild ?? getMessages().home.demo.rankings.noGuild}</span>} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <DemoFactionTag faction={demoFactionOf(c)} />
                    </TableCell>
                    <TableCell className="hidden text-muted md:table-cell">{c.guild ?? getMessages().home.demo.rankings.noGuild}</TableCell>
                    <ScoreCells type={type} character={c} />
                    <TableCell className="hidden text-xs text-subtle lg:table-cell">
                      {t(getMessages().demo.lastSeen, { hours: homeDemoFixture.lastSeenHoursAgo[key] })}
                      <Badge className="ml-1.5">{getMessages().demo.lastSeenNote}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </DemoSection>
    </div>
  );
}

function ScoreHeads({ type }: { type: RankingType }) {
  const c = getMessages().demo.ranking.columns;
  if (type === "level") return <TableHead className="text-right">{c.level}</TableHead>;
  if (type === "gear") {
    return (
      <>
        <TableHead className="hidden text-right sm:table-cell">{c.level}</TableHead>
        <TableHead className="hidden text-right md:table-cell">{c.highestItem}</TableHead>
        <TableHead className="text-right">{c.averageItemLevel}</TableHead>
      </>
    );
  }
  return (
    <>
      <TableHead className="hidden text-right sm:table-cell">{c.averageItemLevel}</TableHead>
      <TableHead className="text-right">{c.highestItem}</TableHead>
    </>
  );
}

function ScoreCells({ type, character: c }: { type: RankingType; character: DemoCharacter }) {
  const main = "tabular text-right text-base font-semibold text-foreground";
  const sub = "tabular hidden text-right text-muted";
  if (type === "level") return <TableCell className={main}>{formatInteger(c.level)}</TableCell>;
  if (type === "gear") {
    return (
      <>
        <TableCell className={cn(sub, "sm:table-cell")}>{formatInteger(c.level)}</TableCell>
        <TableCell className={cn(sub, "md:table-cell")}>{formatInteger(c.highestItemLevel)}</TableCell>
        <TableCell className={main}>{formatAverageItemLevel(c.averageItemLevel)}</TableCell>
      </>
    );
  }
  return (
    <>
      <TableCell className={cn(sub, "sm:table-cell")}>{formatAverageItemLevel(c.averageItemLevel)}</TableCell>
      <TableCell className="text-right">
        <span className="flex flex-col items-end gap-0.5">
          <span className="tabular text-base font-semibold text-foreground">{formatInteger(c.highestItemLevel)}</span>
          <span className={cn("text-xs", c.highestItemQuality === "epic" ? "text-quality-epic" : "text-quality-rare")}>{c.highestItemName}</span>
        </span>
      </TableCell>
    </>
  );
}
