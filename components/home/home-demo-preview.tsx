import Link from "next/link";
import type { ReactNode } from "react";
import { SetupPending } from "@/components/setup-pending";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  demoCharacter,
  demoSummary,
  homeDemoFixture,
  type DemoActivity,
  type DemoActivityKind,
  type DemoCharacter,
  type DemoCharacterKey,
} from "@/lib/demo/home-preview-fixture";
import type { DataEnvironment } from "@/lib/domain/enums";
import { formatAverageItemLevel, formatInteger } from "@/lib/format";
import { getMessages, t } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * 실제 데이터 설정이 확인되지 않은 배포(beta / live)의 홈페이지 (화면 예시)
 *
 * - 실제 서비스 상태(SetupPending)를 그대로 알리고, 그 아래에 가상 데이터로 기능을 미리 보여 준다.
 * - 데이터는 lib/demo/home-preview-fixture.ts의 정적 값만 쓴다. DB·랭킹 엔진·API를 거치지 않는다.
 * - 모든 예시 영역(data-demo)에 DEMO 안내를 붙이고, 캐릭터 이름은 실제 페이지로 연결하지 않는다.
 */
/** dataEnvironment가 null이면 데이터 영역이 연결되지 않은 디자인 확인용 배포다. */
export function HomeDemoPreview({ dataEnvironment }: { dataEnvironment: DataEnvironment | null }) {
  return (
    <div className="flex flex-col gap-10">
      <Hero />
      <SetupPending dataEnvironment={dataEnvironment} />
      <SummaryStats />
      <RankingPreview />
      <ActivityPreview />
      <Features />
      <Flow />
      <Closing />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 공통
// ---------------------------------------------------------------------------

function DemoNotice({ className }: { className?: string }) {
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

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
    </div>
  );
}

/** 가상 데이터를 담는 영역. DEMO 안내를 항상 함께 표시한다. */
function DemoSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section data-demo="true" className="flex flex-col gap-4">
      <SectionHeader title={title} subtitle={subtitle} />
      <DemoNotice />
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// A. 히어로
// ---------------------------------------------------------------------------

function Hero() {
  const h = getMessages().home.demo.hero;
  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-accent/10 via-surface to-background px-5 py-8 sm:px-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold tracking-wide text-accent">{h.eyebrow}</p>
          <h1 className="text-3xl leading-tight font-bold tracking-tight text-foreground sm:text-4xl">{h.title}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">{h.body}</p>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-background/60 px-4 py-4">
          <p className="text-xs font-semibold text-muted">{h.statusTitle}</p>
          <StatusLine tone="warning" text={h.statusLive} />
          <StatusLine tone="info" text={h.statusDemo} />
        </div>
      </div>
    </section>
  );
}

function StatusLine({ tone, text }: { tone: "warning" | "info"; text: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-foreground">
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", tone === "warning" ? "bg-warning" : "bg-info")} />
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------------
// B. 샘플 통계
// ---------------------------------------------------------------------------

function SummaryStats() {
  const d = getMessages().home.demo;
  const s = demoSummary();
  const items = [
    { label: d.stats.characters, value: s.characters },
    { label: d.stats.rankingTypes, value: s.rankingTypes },
    { label: d.stats.growthRecords, value: s.growthRecords },
    { label: d.stats.guilds, value: s.guilds },
  ];
  return (
    <DemoSection title={d.stats.title}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">{item.label}</span>
              <Badge>{d.sampleTag}</Badge>
            </div>
            <span className="tabular text-3xl font-bold text-accent">{formatInteger(item.value)}</span>
          </div>
        ))}
      </div>
    </DemoSection>
  );
}

// ---------------------------------------------------------------------------
// C. 랭킹 미리보기
// ---------------------------------------------------------------------------

function RankingPreview() {
  const r = getMessages().home.demo.rankings;
  const { rankings } = homeDemoFixture;
  return (
    <DemoSection title={r.title} subtitle={r.subtitle}>
      <div className="grid gap-4 lg:grid-cols-3">
        <DemoRankingCard
          kind="level"
          title={r.level}
          hint={r.levelHint}
          keys={rankings.level}
          score={(c) => ({ value: formatInteger(c.level), label: r.columns.level })}
        />
        <DemoRankingCard
          kind="gear"
          title={r.gear}
          hint={r.gearHint}
          keys={rankings.gear}
          score={(c) => ({ value: formatAverageItemLevel(c.averageItemLevel), label: r.columns.score })}
        />
        <DemoRankingCard
          kind="highestItem"
          title={r.highestItem}
          hint={r.highestItemHint}
          keys={rankings.highestItem}
          score={(c) => ({ value: formatInteger(c.highestItemLevel), label: r.columns.score })}
          detail={(c) => (
            <span className={c.highestItemQuality === "epic" ? "text-quality-epic" : "text-quality-rare"}>{c.highestItemName}</span>
          )}
        />
      </div>
    </DemoSection>
  );
}

function DemoRankingCard({
  kind,
  title,
  hint,
  keys,
  score,
  detail,
}: {
  kind: "level" | "gear" | "highestItem";
  title: string;
  hint: string;
  keys: readonly DemoCharacterKey[];
  score: (c: DemoCharacter) => { value: string; label: string };
  detail?: (c: DemoCharacter) => ReactNode;
}) {
  const d = getMessages().home.demo;
  const r = d.rankings;
  return (
    <Card data-demo-ranking={kind} className="flex flex-col">
      <CardHeader className="items-start">
        <div className="flex flex-col gap-0.5">
          <CardTitle>{title}</CardTitle>
          <p className="text-xs text-subtle">{hint}</p>
        </div>
        <Badge variant="accent">{d.badge}</Badge>
      </CardHeader>
      <CardContent className="px-0 py-0">
        <div aria-hidden="true" className="flex items-center gap-3 border-b border-border px-4 py-2 text-[11px] text-subtle">
          <span className="w-7 text-center">{r.columns.rank}</span>
          <span>{r.columns.character}</span>
          <span className="ml-auto">{score(demoCharacter(keys[0]!)).label}</span>
        </div>
        <ol className="divide-y divide-border">
          {keys.map((key, index) => {
            const c = demoCharacter(key);
            const rank = index + 1;
            const s = score(c);
            return (
              <li key={key} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={cn(
                    "tabular flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    rank <= 3 ? "border-accent/40 bg-accent/15 text-accent" : "border-border text-muted",
                  )}
                >
                  {rank}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {/* 가상 캐릭터이므로 캐릭터 페이지로 연결하지 않는다 */}
                  <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                  <span className="truncate text-xs text-subtle">
                    {d.roles[c.role]} · {t(r.levelValue, { level: c.level })} · {c.guild ?? r.noGuild}
                  </span>
                  {detail ? <span className="truncate text-xs">{detail(c)}</span> : null}
                </div>
                <span className="tabular shrink-0 text-base font-semibold text-foreground">{s.value}</span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// D. 최근 성장 기록
// ---------------------------------------------------------------------------

const ACTIVITY_BADGE: Record<DemoActivityKind, "accent" | "info" | "success" | "default"> = {
  levelUp: "accent",
  observed: "default",
  gearChange: "info",
  growth: "success",
};

function activityText(item: DemoActivity): string {
  const a = getMessages().home.demo.activity;
  const name = demoCharacter(item.character).name;
  switch (item.kind) {
    case "levelUp":
      return t(a.levelUp, { name, level: item.level ?? 0 });
    case "observed":
      return t(a.observed, { name, level: item.level ?? 0 });
    case "gearChange":
      return t(a.gearChange, { name, item: item.itemName ?? "", itemLevel: item.itemLevel ?? 0 });
    case "growth":
      return t(a.growth, { name, records: item.records ?? 0 });
  }
}

function ActivityPreview() {
  const a = getMessages().home.demo.activity;
  return (
    <DemoSection title={a.title} subtitle={a.subtitle}>
      <Card>
        <ol className="divide-y divide-border">
          {homeDemoFixture.activity.map((item, i) => (
            <li key={i} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <Badge variant={ACTIVITY_BADGE[item.kind]} className="w-fit">
                {a.kinds[item.kind]}
              </Badge>
              <p className="min-w-0 flex-1 text-sm text-foreground">{activityText(item)}</p>
              <span className="text-xs text-subtle sm:shrink-0">{t(a.when, { hours: item.hoursAgo })}</span>
            </li>
          ))}
        </ol>
      </Card>
    </DemoSection>
  );
}

// ---------------------------------------------------------------------------
// E. 서비스 기능
// ---------------------------------------------------------------------------

type FeatureStatus = "done" | "partial" | "planned";
const FEATURES: { key: "ranking" | "gear" | "history" | "community"; status: FeatureStatus }[] = [
  { key: "ranking", status: "done" },
  { key: "gear", status: "partial" },
  { key: "history", status: "done" },
  { key: "community", status: "partial" },
];
const FEATURE_BADGE: Record<FeatureStatus, "success" | "warning" | "info"> = { done: "success", partial: "warning", planned: "info" };

function Features() {
  const f = getMessages().home.demo.features;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title={f.title} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {FEATURES.map(({ key, status }) => (
          <div key={key} data-feature-status={status} className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">{f.items[key].title}</h3>
              <Badge variant={FEATURE_BADGE[status]}>{f[status]}</Badge>
            </div>
            <p className="text-sm leading-relaxed text-muted">{f.items[key].body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// F. 데이터 수집 과정
// ---------------------------------------------------------------------------

const FLOW: { key: "collect" | "review" | "publish"; ready: boolean }[] = [
  // 수집은 받을 수 있지만 게임 값 매핑이 없어 아직 랭킹에 반영하지 못한다
  { key: "collect", ready: false },
  { key: "review", ready: true },
  { key: "publish", ready: false },
];

function Flow() {
  const f = getMessages().home.demo.flow;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title={f.title} subtitle={f.subtitle} />
      <ol className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        {FLOW.map(({ key, ready }, i) => (
          <li key={key} data-flow-ready={ready} className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-xs font-semibold text-accent">
                {i + 1}
              </span>
              <h3 className="text-sm font-semibold text-foreground">{f.steps[key].title}</h3>
              <Badge variant={ready ? "success" : "warning"} className="ml-auto">
                {ready ? f.ready : f.pending}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-muted">{f.steps[key].body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// G. 하단 안내
// ---------------------------------------------------------------------------

function Closing() {
  const c = getMessages().home.demo.closing;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-accent">{c.title}</h2>
        <p className="text-sm text-muted">{c.body}</p>
      </div>
      <Link
        href={routes.contribute()}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border border-border-strong px-4 text-sm font-medium text-foreground hover:border-accent/60 hover:text-accent"
      >
        {c.link}
      </Link>
    </section>
  );
}
