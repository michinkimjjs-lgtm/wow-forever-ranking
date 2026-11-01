import Link from "next/link";
import { DemoArmory } from "@/components/demo/demo-armory";
import { DemoCharacterIdentity, DemoFactionTag, DemoPageBanner, DemoSection, demoFactionOf } from "@/components/demo/demo-common";
import { DEMO_ARMORY_CHARACTER, DEMO_SEARCH_QUERY, demoCharacter, demoSearch } from "@/lib/demo/home-preview-fixture";
import { getMessages, t } from "@/lib/i18n";
import { routes } from "@/lib/routes";

/**
 * 캐릭터 검색·Armory 화면 미리보기 (실제 데이터 설정이 확인되지 않은 배포에서만)
 *
 * - 검색 결과와 Armory는 lib/demo/home-preview-fixture.ts의 정적 값만 쓴다. DB·검색 API를 거치지 않는다.
 * - 검색창은 모양만 보여 주는 예시다(입력·제출 없음). 가상 캐릭터는 캐릭터 페이지로 연결하지 않는다.
 */
export function CharacterDemoPreview() {
  return (
    <div className="flex flex-col gap-10">
      <DemoPageBanner />
      <SearchPreview />
      <ArmoryPreview />
    </div>
  );
}

function SearchPreview() {
  const c = getMessages().demo.characters;
  const d = getMessages().home.demo;
  const results = demoSearch();
  return (
    <DemoSection title={c.searchTitle} subtitle={t(c.searchSubtitle, { query: DEMO_SEARCH_QUERY })}>
      {/* 입력할 수 없는 예시 검색창 */}
      <div aria-hidden="true" className="flex flex-col gap-2 sm:flex-row">
        <div className="flex h-10 flex-1 items-center rounded-md border border-border bg-surface px-3 text-sm text-foreground">
          {DEMO_SEARCH_QUERY}
        </div>
        <div className="flex h-10 items-center justify-center rounded-md bg-accent/60 px-5 text-sm font-semibold text-accent-foreground">
          {c.searchButton}
        </div>
      </div>
      <p className="text-xs text-subtle">{t(c.resultCount, { n: results.length })}</p>
      <ul data-demo-search-results="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((ch) => (
          <li key={ch.key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <DemoCharacterIdentity character={ch} extra={ch.guild ?? d.rankings.noGuild} />
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="tabular text-sm font-semibold text-foreground">{t(c.resultLine, { level: ch.level })}</span>
              <DemoFactionTag faction={demoFactionOf(ch)} />
            </span>
          </li>
        ))}
      </ul>
    </DemoSection>
  );
}

function ArmoryPreview() {
  const c = getMessages().demo.characters;
  const ch = demoCharacter(DEMO_ARMORY_CHARACTER);
  return (
    <DemoSection title={c.armoryTitle} subtitle={c.armorySubtitle}>
      <DemoArmory characterKey={DEMO_ARMORY_CHARACTER} />
      <Link href={routes.demoCharacter(ch.name)} className="self-start text-sm text-accent hover:underline">
        {t(c.detailLink, { name: ch.name })}
      </Link>
    </DemoSection>
  );
}
