import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** 랭킹 등록 안내 단계 (/contribute → 다운로드 → 설치 → 사용 → 제출) */
export const CONTRIBUTE_STEPS = ["download", "install", "howToUse", "submit"] as const;
export type ContributeStep = (typeof CONTRIBUTE_STEPS)[number];

export const CONTRIBUTE_HREF: Record<ContributeStep | "overview", string> = {
  overview: routes.contribute(),
  download: routes.contributeDownload(),
  install: routes.contributeInstall(),
  howToUse: routes.contributeHowToUse(),
  submit: routes.submit(),
};

/**
 * 안내 화면 공통 버튼: [Collector 다운로드] [설치 방법] [사용 방법] [캐릭터 데이터 제출]
 * 모바일에서는 2열, 넓은 화면에서는 한 줄로 보인다. 현재 단계는 강조한다.
 */
export function ContributeNav({ current }: { current: ContributeStep | "overview" }) {
  const m = getMessages().contribute.nav;
  return (
    <nav aria-label={m.label} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {CONTRIBUTE_STEPS.map((step, index) => {
        const active = step === current;
        return (
          <Link
            key={step}
            href={CONTRIBUTE_HREF[step]}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-accent bg-accent/10 text-accent"
                : step === "submit"
                  ? "border-accent/60 text-foreground hover:bg-surface-raised"
                  : "border-border-strong text-foreground hover:bg-surface-raised",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs",
                active ? "bg-accent text-accent-foreground" : "bg-surface-raised text-muted",
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0">{m[step]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** 화면 아래의 이전 / 다음 단계 버튼 */
export function ContributeStepper({
  previous,
  next,
  nextLabel,
}: {
  previous?: ContributeStep | "overview";
  next?: ContributeStep;
  /** 다음 버튼 문구 (없으면 "다음 단계: 단계 이름") */
  nextLabel?: string;
}) {
  const m = getMessages().contribute;
  const label = (step: ContributeStep | "overview") => m.nav[step];
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
      {previous ? (
        <Link
          href={CONTRIBUTE_HREF[previous]}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong px-4 text-sm text-foreground hover:bg-surface-raised"
        >
          {m.previous}: {label(previous)}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={CONTRIBUTE_HREF[next]}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-strong"
        >
          {nextLabel ?? `${m.next}: ${label(next)}`}
        </Link>
      ) : null}
    </div>
  );
}

/** 현재 랭킹 기준 안내: Forever Rank가 확인한 캐릭터 기준 */
export function RankingBasisNotice() {
  const m = getMessages().contribute.rankingBasis;
  return (
    <section aria-labelledby="ranking-basis-title" className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3">
      <h2 id="ranking-basis-title" className="text-sm font-semibold text-accent">
        {m.title}
      </h2>
      <p className="mt-1 text-sm text-foreground">{m.body}</p>
      <p className="mt-1 text-xs text-muted">{m.detail}</p>
    </section>
  );
}

/** "실제 게임에서 확인 필요" 표시 */
export function RuntimeCheckBadge() {
  const m = getMessages().contribute;
  return (
    <span className="inline-flex shrink-0 items-center rounded border border-warning/50 bg-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-warning">
      {m.runtimeCheck}
    </span>
  );
}

/** 폴더 경로·명령어 같은 코드 표시. 긴 경로는 줄바꿈한다. */
export function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <pre
      aria-label={label}
      className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
    >
      {children}
    </pre>
  );
}
