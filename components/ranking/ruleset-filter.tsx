import Link from "next/link";
import { gameModeForRuleset, getRulesets } from "@/lib/config";
import type { DataEnvironment, RulesetCode } from "@/lib/domain/enums";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * 게임 규칙(Ruleset) 선택 (docs/RULESETS.md)
 * - 공식 Ruleset 4개를 항상 보여 준다.
 * - 이 데이터 영역에 데이터가 연결된 규칙만 링크다. 나머지는 "데이터 준비 중"(하드코어는 "출시 후 제공")으로 표시한다.
 * - "전체"는 두지 않는다. 랭킹은 규칙별로 따로 계산하기 때문이다(명세서 §10.3).
 */
export function RulesetFilter({
  path,
  query,
  dataEnvironment,
  active,
}: {
  path: string;
  query: URLSearchParams;
  dataEnvironment: DataEnvironment;
  active: RulesetCode | null;
}) {
  const m = getMessages();
  const r = m.rankings.ruleset;
  return (
    <nav aria-label={r.label} className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{r.label}</span>
      <ul className="flex flex-wrap gap-1.5">
        {getRulesets().map((ruleset) => {
          const label = m.game.rulesets[ruleset.code];
          const available = gameModeForRuleset(dataEnvironment, ruleset.code) !== null;
          if (!available) {
            const status = ruleset.publicStatus === "POST_LAUNCH" ? m.game.rulesetStatuses.POST_LAUNCH : r.pending;
            return (
              <li key={ruleset.code}>
                <span
                  aria-disabled="true"
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-subtle"
                >
                  {label}
                  <span className="text-xs">· {status}</span>
                </span>
              </li>
            );
          }
          const next = new URLSearchParams(query);
          next.delete("gameMode");
          next.delete("page");
          next.set("ruleset", ruleset.code);
          const isActive = ruleset.code === active;
          return (
            <li key={ruleset.code}>
              <Link
                href={`${path}?${next.toString()}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "inline-flex rounded-md border px-3 py-1.5 text-sm",
                  isActive ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-subtle">{r.separateNote}</p>
    </nav>
  );
}
