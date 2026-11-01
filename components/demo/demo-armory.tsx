import { DemoFactionTag, demoFactionOf } from "@/components/demo/demo-common";
import { DemoEmptySlot, DemoItemIcon } from "@/components/demo/demo-item-icon";
import { DEMO_CLASS_STYLE, DemoPortrait } from "@/components/home/demo-portrait";
import { ItemName } from "@/components/game-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  demoCharacter,
  demoEquipment,
  demoMilestones,
  demoRanks,
  homeDemoFixture,
  type DemoCharacterKey,
  type DemoMilestone,
} from "@/lib/demo/home-preview-fixture";
import { formatAverageItemLevel, formatInteger } from "@/lib/format";
import { getMessages, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * 가상 캐릭터의 Armory 예시 (프로필, 장착 장비, 레벨 성장 그래프, 레벨 달성 기록)
 *
 * - 값은 lib/demo/home-preview-fixture.ts의 정적 값과 그 값으로 만든 예시 장비·기록뿐이다. DB·API를 거치지 않는다.
 * - 캐릭터 화면의 미리보기와 가상 캐릭터 상세 예시(/demo/characters/…)가 함께 쓴다.
 */
export function DemoArmory({ characterKey }: { characterKey: DemoCharacterKey }) {
  return (
    <div data-demo-armory={characterKey} className="flex flex-col gap-4">
      <ArmoryProfile characterKey={characterKey} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <EquipmentCard characterKey={characterKey} />
        <div className="flex flex-col gap-4">
          <GrowthChart characterKey={characterKey} />
          <MilestoneCard characterKey={characterKey} />
        </div>
      </div>
    </div>
  );
}

function ArmoryProfile({ characterKey }: { characterKey: DemoCharacterKey }) {
  const p = getMessages().demo.characters.profile;
  const d = getMessages().home.demo;
  const ch = demoCharacter(characterKey);
  const style = DEMO_CLASS_STYLE[ch.demoClass];
  const ranks = demoRanks(characterKey);
  const stats = [
    { label: p.level, value: formatInteger(ch.level) },
    { label: p.averageItemLevel, value: formatAverageItemLevel(ch.averageItemLevel) },
    { label: p.highestItemLevel, value: formatInteger(ch.highestItemLevel) },
  ];
  const rankRows = [
    { label: p.ranks.level, value: ranks.level },
    { label: p.ranks.gear, value: ranks.gear },
    { label: p.ranks.highestItem, value: ranks.highestItem },
  ];
  return (
    <Card>
      <CardContent className="flex flex-col gap-5 py-5">
        <div className="flex flex-wrap items-center gap-4">
          <DemoPortrait demoRace={ch.demoRace} demoClass={ch.demoClass} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={cn("text-2xl font-bold tracking-tight", style.text)}>{ch.name}</h2>
              <Badge variant="accent">{d.badge}</Badge>
            </div>
            <span className="flex flex-wrap items-center gap-x-1.5 text-sm">
              <span className="text-muted">{t(d.rankings.levelValue, { level: ch.level })}</span>
              <span aria-hidden="true" className="text-subtle">
                ·
              </span>
              <span className={style.text}>{d.classes[ch.demoClass]}</span>
              <span aria-hidden="true" className="text-subtle">
                ·
              </span>
              <span className="text-muted">{d.races[ch.demoRace]}</span>
              <span aria-hidden="true" className="text-subtle">
                ·
              </span>
              <DemoFactionTag faction={demoFactionOf(ch)} />
            </span>
            <span className="text-sm text-muted">
              {p.guild}: {ch.guild ?? d.rankings.noGuild}
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1 rounded-md border border-border bg-background/60 px-3 py-2.5">
              <dt className="text-xs text-subtle">{s.label}</dt>
              <dd className="tabular text-xl font-semibold text-foreground">{s.value}</dd>
            </div>
          ))}
        </dl>
        <dl data-demo-ranks="true" className="grid grid-cols-3 gap-3">
          {rankRows.map((r) => (
            <div key={r.label} className="flex flex-col gap-1 rounded-md border border-accent/25 bg-accent/5 px-3 py-2.5">
              <dt className="text-xs text-subtle">{r.label}</dt>
              <dd className="tabular text-lg font-semibold text-accent">{t(p.rankValue, { rank: r.value })}</dd>
            </div>
          ))}
        </dl>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
          <div className="flex gap-1.5">
            <dt className="text-subtle">{p.lastSeen}</dt>
            <dd>
              {t(getMessages().demo.lastSeen, { hours: homeDemoFixture.lastSeenHoursAgo[characterKey] })} ({getMessages().demo.lastSeenNote})
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-subtle">{p.currentLevel}</dt>
            <dd>{p.currentLevelValue}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-subtle">{p.source}</dt>
            <dd>{p.sourceValue}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-subtle">{p.verification}</dt>
            <dd>{p.verificationValue}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function EquipmentCard({ characterKey }: { characterKey: DemoCharacterKey }) {
  const e = getMessages().demo.characters.equipment;
  const d = getMessages().home.demo;
  const items = demoEquipment(characterKey);
  const equipped = items.filter((item) => item.itemLevel !== null);
  const average = equipped.reduce((n, item) => n + item.itemLevel!, 0) / equipped.length;
  return (
    <Card data-demo-equipment="true">
      <CardHeader className="items-start">
        <div className="flex flex-col gap-0.5">
          <CardTitle>{e.title}</CardTitle>
          <p className="text-xs text-subtle">{e.subtitle}</p>
        </div>
        <Badge variant="accent">{d.badge}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="grid gap-x-4 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.slot}
              data-demo-slot={item.slot}
              className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                {item.icon && item.quality ? <DemoItemIcon icon={item.icon} quality={item.quality} /> : <DemoEmptySlot />}
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-xs text-subtle">{e.slots[item.slot]}</span>
                  {item.name ? (
                    <span className="break-keep" data-demo-item-id={item.itemId ?? undefined}>
                      <ItemName name={item.name} quality={item.quality} />
                    </span>
                  ) : (
                    <span className="text-subtle">{item.blockedByTwoHand ? `${e.empty} · ${e.twoHandNote}` : e.empty}</span>
                  )}
                </span>
              </span>
              <span className="tabular shrink-0 text-sm font-semibold text-foreground">{item.itemLevel ?? "—"}</span>
            </li>
          ))}
        </ul>
        <p className="tabular text-right text-sm text-muted">
          {t(e.averageLine, { count: equipped.length, value: formatAverageItemLevel(Math.round(average * 100) / 100) })}
        </p>
      </CardContent>
    </Card>
  );
}

function milestoneWhen(m: DemoMilestone): string {
  const ms = getMessages().demo.characters.milestones;
  return m.daysAgo === 0 ? ms.today : t(ms.daysAgo, { days: m.daysAgo });
}

function MilestoneCard({ characterKey }: { characterKey: DemoCharacterKey }) {
  const ms = getMessages().demo.characters.milestones;
  const d = getMessages().home.demo;
  return (
    <Card data-demo-milestones="true">
      <CardHeader className="items-start">
        <div className="flex flex-col gap-0.5">
          <CardTitle>{ms.title}</CardTitle>
          <p className="text-xs text-subtle">{ms.subtitle}</p>
        </div>
        <Badge variant="accent">{d.badge}</Badge>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col">
          {demoMilestones(characterKey).map((m) => (
            <li key={m.level} className="flex items-center gap-3 border-b border-border/60 py-2 text-sm last:border-b-0">
              <span
                aria-hidden="true"
                className={cn("size-2 shrink-0 rounded-full", m.basis === "inferred" ? "border border-subtle" : "bg-accent")}
              />
              <span className="tabular w-14 font-semibold text-foreground">{t(ms.levelValue, { level: m.level })}</span>
              <span className="flex-1 text-xs text-muted">{ms.basis[m.basis]}</span>
              <span className="text-xs text-subtle">{milestoneWhen(m)}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/** 레벨 성장 그래프 (가로: 경과 일수, 세로: 레벨). 같은 내용은 레벨 달성 기록 목록에 텍스트로 있다. */
function GrowthChart({ characterKey }: { characterKey: DemoCharacterKey }) {
  const g = getMessages().demo.characters.growth;
  const d = getMessages().home.demo;
  const points = demoMilestones(characterKey)
    .filter((m) => m.basis !== "inferred")
    .reverse();
  const maxDays = Math.max(...points.map((p) => p.daysAgo));
  const minLevel = Math.min(...points.map((p) => p.level)) - 2;
  const maxLevel = Math.max(...points.map((p) => p.level)) + 1;
  const W = 320;
  const H = 120;
  const pad = { l: 28, r: 10, t: 10, b: 22 };
  const x = (daysAgo: number) => pad.l + ((maxDays - daysAgo) / maxDays) * (W - pad.l - pad.r);
  const y = (level: number) => pad.t + ((maxLevel - level) / (maxLevel - minLevel)) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.daysAgo).toFixed(1)},${y(p.level).toFixed(1)}`).join(" ");
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return (
    <Card data-demo-growth="true">
      <CardHeader className="items-start">
        <div className="flex flex-col gap-0.5">
          <CardTitle>{g.title}</CardTitle>
          <p className="text-xs text-subtle">{g.subtitle}</p>
        </div>
        <Badge variant="accent">{d.badge}</Badge>
      </CardHeader>
      <CardContent>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${g.title}: ${t(g.axis, { days: first.daysAgo })} ${first.level} → ${g.now} ${last.level}`}
          className="h-auto w-full text-accent"
        >
          {[minLevel + 2, Math.round((minLevel + maxLevel) / 2), maxLevel - 1].map((lv) => (
            <g key={lv}>
              <line x1={pad.l} x2={W - pad.r} y1={y(lv)} y2={y(lv)} className="stroke-border" strokeDasharray="2 3" />
              <text x={pad.l - 6} y={y(lv) + 3} textAnchor="end" className="fill-subtle text-[9px]">
                {lv}
              </text>
            </g>
          ))}
          <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p) => (
            <circle key={p.level} cx={x(p.daysAgo)} cy={y(p.level)} r={3} className="fill-background" stroke="currentColor" strokeWidth={2} />
          ))}
          <text x={pad.l} y={H - 6} className="fill-subtle text-[9px]">
            {t(g.axis, { days: maxDays })}
          </text>
          <text x={W - pad.r} y={H - 6} textAnchor="end" className="fill-subtle text-[9px]">
            {g.now}
          </text>
        </svg>
      </CardContent>
    </Card>
  );
}
