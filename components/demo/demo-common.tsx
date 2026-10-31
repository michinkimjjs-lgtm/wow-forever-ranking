import type { ReactNode } from "react";
import { DEMO_CLASS_STYLE, DemoPortrait } from "@/components/home/demo-portrait";
import { Badge } from "@/components/ui/badge";
import { demoFaction, type DemoCharacter, type DemoFaction } from "@/lib/demo/home-preview-fixture";
import { getMessages, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * 화면 미리보기(DEMO) 공통 요소
 *
 * - 홈(components/home/)과 랭킹·캐릭터·길드·통계 미리보기(components/demo/)가 함께 쓴다.
 * - 가상 데이터를 담는 영역에는 항상 DEMO 안내를 붙인다(data-demo).
 */

export function DemoNotice({ className }: { className?: string }) {
  const d = getMessages().home.demo;
  return (
    <p
      role="note"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border border-dashed border-accent/40 bg-accent/5 px-3 py-2 text-xs text-muted",
        className,
      )}
    >
      <Badge variant="accent">{d.badge}</Badge>
      <span>{d.notice}</span>
    </p>
  );
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
    </div>
  );
}

/** 가상 데이터를 담는 영역. DEMO 안내를 항상 함께 표시한다. */
export function DemoSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section data-demo="true" className="flex flex-col gap-4">
      <SectionHeader title={title} subtitle={subtitle} />
      <DemoNotice />
      {children}
    </section>
  );
}

/** 페이지 위쪽의 "화면 미리보기" 안내 (실제 서비스 상태 안내 바로 아래) */
export function DemoPageBanner() {
  const b = getMessages().demo.pageBanner;
  const d = getMessages().home.demo;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-accent/30 bg-gradient-to-r from-accent/10 via-surface to-surface px-4 py-3">
      <Badge variant="accent" className="mt-0.5 shrink-0">
        {d.badge}
      </Badge>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-foreground">{b.title}</p>
        <p className="text-xs text-muted">{b.body}</p>
      </div>
    </div>
  );
}

/** 초상화 + 이름(직업 색) + 직업 · 종족. 가상 캐릭터이므로 링크를 걸지 않는다. */
export function DemoCharacterIdentity({ character, extra }: { character: DemoCharacter; extra?: ReactNode }) {
  const d = getMessages().home.demo;
  const style = DEMO_CLASS_STYLE[character.demoClass];
  return (
    <div className="flex min-w-0 items-center gap-3">
      <DemoPortrait demoRace={character.demoRace} demoClass={character.demoClass} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("text-sm font-semibold break-keep", style.text)}>{character.name}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-xs">
          <span className={style.text}>{d.classes[character.demoClass]}</span>
          <span aria-hidden="true" className="text-subtle">
            ·
          </span>
          <span className="text-muted">{d.races[character.demoRace]}</span>
        </span>
        {extra ? <span className="text-xs text-subtle">{extra}</span> : null}
      </div>
    </div>
  );
}

export function DemoFactionTag({ faction }: { faction: DemoFaction }) {
  const label = getMessages().demo.factions[faction];
  return (
    <span data-demo-faction={faction} className={cn("text-xs font-medium", faction === "alliance" ? "text-alliance" : "text-horde")}>
      {label}
    </span>
  );
}

export function demoFactionOf(character: DemoCharacter): DemoFaction {
  return demoFaction(character.demoRace);
}

/** 순위 번호 (1~3위 강조) */
export function DemoRankChip({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "tabular flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
        rank <= 3 ? "border-accent/40 bg-accent/15 text-accent" : "border-border text-muted",
      )}
    >
      {rank}
    </span>
  );
}

/** 가로 막대 분포 (이름과 수치를 텍스트로 함께 표시) */
export function DistributionBars({
  rows,
}: {
  rows: { key: string; label: string; count: number; icon: ReactNode; labelClass: string; barClass: string }[];
}) {
  const dist = getMessages().home.demo.distribution;
  const max = Math.max(...rows.map((row) => row.count));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li
          key={row.key}
          title={t(dist.tooltip, { label: row.label, count: row.count })}
          className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_2.5rem] items-center gap-3"
        >
          <span className={cn("flex min-w-0 items-center gap-2 text-sm", row.labelClass)}>
            {row.icon}
            <span className="break-keep">{row.label}</span>
          </span>
          <span className="h-2 rounded-full bg-surface-raised">
            <span className={cn("block h-2 rounded-full", row.barClass)} style={{ width: `${(row.count / max) * 100}%` }} />
          </span>
          <span className="tabular text-right text-sm text-muted">{t(dist.count, { count: row.count })}</span>
        </li>
      ))}
    </ul>
  );
}
