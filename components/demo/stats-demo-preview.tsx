import type { ReactNode } from "react";
import { DemoPageBanner, DemoSection, DistributionBars } from "@/components/demo/demo-common";
import { DEMO_CLASS_STYLE, DemoPortrait } from "@/components/home/demo-portrait";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  demoDistribution,
  demoFactionCounts,
  demoGuilds,
  demoLevelBuckets,
  demoSummary,
  homeDemoFixture,
} from "@/lib/demo/home-preview-fixture";
import { formatAverageItemLevel, formatInteger } from "@/lib/format";
import { getMessages, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * 통계 화면 미리보기 (실제 데이터 설정이 확인되지 않은 배포에서만)
 *
 * - 모든 수치는 lib/demo/home-preview-fixture.ts의 샘플 캐릭터 12명만 센 값이다. 실제 통계 계산·DB를 쓰지 않는다.
 */
export function StatsDemoPreview() {
  const s = getMessages().demo.stats;
  const d = getMessages().home.demo;
  const total = homeDemoFixture.characters.length;
  const summary = demoSummary();
  const chars = homeDemoFixture.characters;
  const tiles = [
    { label: s.summary.characters, value: formatInteger(summary.characters) },
    { label: s.summary.guilds, value: formatInteger(summary.guilds) },
    { label: s.summary.topLevel, value: formatInteger(Math.max(...chars.map((c) => c.level))) },
    { label: s.summary.averageItemLevel, value: formatAverageItemLevel(Math.max(...chars.map((c) => c.averageItemLevel))) },
  ];
  const { classes, races } = demoDistribution();
  const factions = demoFactionCounts();
  const buckets = demoLevelBuckets();
  const guilds = demoGuilds();

  return (
    <div className="flex flex-col gap-10">
      <DemoPageBanner />
      <DemoSection title={s.title} subtitle={t(s.subtitle, { total })}>
        <dl data-demo-stats-summary="true" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-4 py-3">
              <dt className="flex items-center justify-between gap-2 text-xs text-subtle">
                {tile.label}
                <Badge>{d.sampleTag}</Badge>
              </dt>
              <dd className="tabular text-2xl font-semibold text-foreground">{tile.value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-4 lg:grid-cols-2">
          <StatCard title={s.levelBuckets} kind="levels">
            <DistributionBars
              rows={buckets.map((b) => ({
                key: String(b.from),
                label: t(s.levelBucketLabel, { from: b.from, to: b.to }),
                count: b.count,
                icon: null,
                labelClass: "text-foreground",
                barClass: "bg-accent",
              }))}
            />
          </StatCard>

          <StatCard title={s.factions} kind="factions">
            <div className="flex flex-col gap-3">
              <div className="flex h-3 overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
                <span className="bg-alliance" style={{ width: `${(factions.alliance / total) * 100}%` }} />
                <span className="bg-horde" style={{ width: `${(factions.horde / total) * 100}%` }} />
              </div>
              <ul className="grid grid-cols-2 gap-3">
                {(["alliance", "horde"] as const).map((f) => (
                  <li key={f} data-demo-faction-count={f} className="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2">
                    <span className={cn("text-sm font-semibold", f === "alliance" ? "text-alliance" : "text-horde")}>
                      {getMessages().demo.factions[f]}
                    </span>
                    <span className="tabular text-sm text-muted">
                      {t(s.count, { count: factions[f] })} · {t(s.percent, { percent: Math.round((factions[f] / total) * 100) })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </StatCard>

          <StatCard title={s.classes} kind="classes">
            <DistributionBars
              rows={classes.map((row) => ({
                key: row.key,
                label: d.classes[row.key],
                count: row.count,
                icon: null,
                labelClass: DEMO_CLASS_STYLE[row.key].text,
                barClass: DEMO_CLASS_STYLE[row.key].bar,
              }))}
            />
          </StatCard>

          <StatCard title={s.races} kind="races">
            <DistributionBars
              rows={races.map((row) => ({
                key: row.key,
                label: d.races[row.key],
                count: row.count,
                icon: <DemoPortrait demoRace={row.key} size="sm" />,
                labelClass: "text-foreground",
                barClass: "bg-muted/60",
              }))}
            />
          </StatCard>

          <StatCard title={s.guildSizes} kind="guilds">
            <DistributionBars
              rows={guilds.map((g) => ({
                key: g.name,
                label: g.name,
                count: g.members.length,
                icon: null,
                labelClass: g.faction === "alliance" ? "text-alliance" : "text-horde",
                barClass: g.faction === "alliance" ? "bg-alliance" : "bg-horde",
              }))}
            />
          </StatCard>
        </div>
      </DemoSection>
    </div>
  );
}

function StatCard({ title, kind, children }: { title: string; kind: string; children: ReactNode }) {
  const d = getMessages().home.demo;
  return (
    <Card data-demo-stat={kind}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge variant="accent">{d.badge}</Badge>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
