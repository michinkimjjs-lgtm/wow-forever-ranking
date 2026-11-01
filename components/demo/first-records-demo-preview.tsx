import type { ReactNode } from "react";
import { DemoCharacterIdentity, DemoFactionTag, DemoPageBanner, DemoSection, DemoCharacterName, demoFactionOf } from "@/components/demo/demo-common";
import { DEMO_CLASS_STYLE, DemoPortrait } from "@/components/home/demo-portrait";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEMO_CLASSES,
  DEMO_FIRST_LEVELS,
  demoFaction,
  demoFirst,
  demoGuilds,
  demoRecentFirsts,
  demoTopLevel,
  type DemoFirst,
} from "@/lib/demo/home-preview-fixture";
import { getMessages, t } from "@/lib/i18n";

/**
 * 최초 달성 기록 미리보기 (실제 데이터 설정이 확인되지 않은 배포에서만)
 *
 * - 기록은 가상 캐릭터의 예시 성장 기록에서 계산한 값이다(lib/demo/home-preview-fixture.ts). DB·랭킹 엔진·API를 쓰지 않는다.
 * - 가상 데이터이므로 공식 칭호(World First)나 검증 상태를 붙이지 않는다. 근거는 "최초 관측"으로만 표시한다.
 * - 부문은 명세서 §23의 first_records 분류(서버·직업·진영·길드)를 따른다.
 */
const CATEGORY_LEVEL = 40;

function whenText(hoursAgo: number): string {
  const f = getMessages().demo.firstRecords;
  const when = hoursAgo < 48 ? t(f.hoursAgo, { hours: hoursAgo }) : t(f.daysAgo, { days: Math.floor(hoursAgo / 24) });
  return t(f.when, { when });
}

export function FirstRecordsDemoPreview() {
  return (
    <div className="flex flex-col gap-10">
      <DemoPageBanner />
      <ServerFirsts />
      <CategoryFirsts />
      <Rules />
    </div>
  );
}

function ServerFirsts() {
  const f = getMessages().demo.firstRecords;
  const top = demoTopLevel();
  const cards = [
    ...DEMO_FIRST_LEVELS.map((level) => ({ key: `l${level}`, title: t(f.server.levelTitle, { level }), first: demoFirst(level) })),
    { key: "top", title: t(f.server.topTitle, { level: top }), first: demoFirst(top) },
  ];
  return (
    <DemoSection title={f.server.title} subtitle={f.server.subtitle}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.key} data-demo-first-server={card.key} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-accent">{card.title}</CardTitle>
              <Badge variant="accent">{getMessages().home.demo.badge}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {card.first ? <FirstBody first={card.first} /> : <p className="text-sm text-subtle">{f.categories.none}</p>}
            </CardContent>
          </Card>
        ))}
        <Card data-demo-first-server="max" className="flex flex-col border-dashed">
          <CardHeader>
            <CardTitle className="text-muted">{f.server.maxTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-subtle">{f.server.maxPending}</p>
          </CardContent>
        </Card>
      </div>
    </DemoSection>
  );
}

function FirstBody({ first }: { first: DemoFirst }) {
  const f = getMessages().demo.firstRecords;
  const d = getMessages().home.demo;
  return (
    <>
      <DemoCharacterIdentity character={first.character} extra={first.character.guild ?? d.rankings.noGuild} />
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span>{whenText(first.hoursAgo)}</span>
        <span aria-hidden="true" className="text-subtle">
          ·
        </span>
        <span className="text-subtle">{f.basis}</span>
      </p>
    </>
  );
}

function CategoryFirsts() {
  const f = getMessages().demo.firstRecords;
  const d = getMessages().home.demo;
  const level = CATEGORY_LEVEL;
  const classRows = DEMO_CLASSES.map((cls) => ({
    key: cls,
    label: <span className={DEMO_CLASS_STYLE[cls].text}>{d.classes[cls]}</span>,
    first: demoFirst(level, (c) => c.demoClass === cls),
  }));
  const factionRows = (["alliance", "horde"] as const).map((faction) => ({
    key: faction,
    label: <DemoFactionTag faction={faction} />,
    first: demoFirst(level, (c) => demoFaction(c.demoRace) === faction),
  }));
  const guildRows = demoGuilds().map((g) => ({
    key: g.name,
    label: <span className="text-foreground">{g.name}</span>,
    first: demoFirst(level, (c) => c.guild === g.name),
  }));
  return (
    <DemoSection title={t(f.categories.title, { level })} subtitle={t(f.categories.subtitle, { level })}>
      <div className="grid gap-4 lg:grid-cols-3">
        <CategoryCard kind="class" title={f.categories.class} rows={classRows} />
        <div className="flex flex-col gap-4">
          <CategoryCard kind="faction" title={f.categories.faction} rows={factionRows} />
          <CategoryCard kind="guild" title={f.categories.guild} rows={guildRows} />
        </div>
        <RecentList />
      </div>
    </DemoSection>
  );
}

function CategoryCard({
  kind,
  title,
  rows,
}: {
  kind: string;
  title: string;
  rows: { key: string; label: ReactNode; first: DemoFirst | null }[];
}) {
  const f = getMessages().demo.firstRecords;
  return (
    <Card data-demo-first-category={kind}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge variant="accent">{getMessages().home.demo.badge}</Badge>
      </CardHeader>
      <CardContent className="px-0 py-0">
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.key} data-demo-first-row={row.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="w-24 shrink-0 text-sm">{row.label}</span>
              {row.first ? (
                <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  <span className="flex min-w-0 flex-col items-end">
                    <DemoCharacterName character={row.first.character} className="text-sm" />
                    <span className="text-[11px] text-subtle">{whenText(row.first.hoursAgo)}</span>
                  </span>
                  <DemoPortrait demoRace={row.first.character.demoRace} demoClass={row.first.character.demoClass} size="sm" />
                </span>
              ) : (
                <span className="text-xs text-subtle">{f.categories.none}</span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** 최근 서버 최초 달성 소식 (부문별 카드 옆) */
function RecentList() {
  const f = getMessages().demo.firstRecords;
  const items = demoRecentFirsts(8, 30);
  return (
    <Card data-demo-first-recent="true">
      <CardHeader>
        <CardTitle>{f.recent.title}</CardTitle>
        <Badge variant="accent">{getMessages().home.demo.badge}</Badge>
      </CardHeader>
      <CardContent className="px-0 py-0">
        <ol className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.level} className="flex items-start gap-3 px-4 py-2.5">
              <span className="tabular mt-0.5 w-9 shrink-0 rounded border border-accent/30 bg-accent/10 px-1 py-0.5 text-center text-xs font-semibold text-accent">
                {item.level}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm text-foreground">{t(f.recent.line, { name: item.character.name, level: item.level })}</span>
                <span className="text-[11px] text-subtle">
                  {whenText(item.hoursAgo)} · <DemoFactionTag faction={demoFactionOf(item.character)} />
                </span>
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function Rules() {
  const r = getMessages().demo.firstRecords.rules;
  return (
    <section data-first-rules="true" className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-4">
      <h2 className="text-sm font-semibold text-foreground">{r.title}</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
        {r.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
