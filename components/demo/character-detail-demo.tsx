import Link from "next/link";
import { DemoArmory } from "@/components/demo/demo-armory";
import { DemoCharacterIdentity, DemoPageBanner, DemoSection } from "@/components/demo/demo-common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { homeDemoFixture, type DemoCharacterEntry } from "@/lib/demo/home-preview-fixture";
import { formatAverageItemLevel } from "@/lib/format";
import { getMessages, t } from "@/lib/i18n";
import { routes } from "@/lib/routes";

/**
 * 가상 캐릭터 상세 예시 화면 (/demo/characters/{이름})
 *
 * - 실제 캐릭터 페이지(/characters/{지역}/{게임 규칙}/{이름})가 아니다. 가상 데이터만 보여 준다.
 * - 같은 길드의 다른 가상 캐릭터와 다른 상세 예시로 이동할 수 있다.
 */
export function CharacterDetailDemo({ character }: { character: DemoCharacterEntry }) {
  const c = getMessages().demo.detail;
  const d = getMessages().home.demo;
  const guildmates = character.guild ? homeDemoFixture.characters.filter((x) => x.guild === character.guild && x.key !== character.key) : [];
  const others = homeDemoFixture.characters.filter((x) => x.key !== character.key);
  return (
    <div className="flex flex-col gap-8">
      <nav aria-label={c.breadcrumbLabel} className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <Link href={routes.characters()} className="hover:text-foreground hover:underline">
          {c.breadcrumbCharacters}
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-foreground">{character.name}</span>
        <Badge variant="accent" className="ml-1">
          {d.badge}
        </Badge>
      </nav>
      <DemoPageBanner />
      <DemoSection title={t(c.title, { name: character.name })} subtitle={c.subtitle}>
        <DemoArmory characterKey={character.key} />
      </DemoSection>

      {guildmates.length > 0 ? (
        <DemoSection title={t(c.guildTitle, { guild: character.guild! })} subtitle={c.guildSubtitle}>
          <Card data-demo-guildmates="true">
            <CardHeader>
              <CardTitle>{character.guild}</CardTitle>
              <Badge variant="accent">{d.badge}</Badge>
            </CardHeader>
            <CardContent className="px-0 py-0">
              <ul className="divide-y divide-border">
                {guildmates.map((m) => (
                  <li key={m.key} className="px-4 py-3">
                    <DemoCharacterIdentity
                      character={m}
                      extra={t(getMessages().demo.guilds.memberLine, { level: m.level, itemLevel: formatAverageItemLevel(m.averageItemLevel) })}
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </DemoSection>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">{c.othersTitle}</h2>
        <ul className="flex flex-wrap gap-2">
          {others.map((o) => (
            <li key={o.key}>
              <Link
                href={routes.demoCharacter(o.name)}
                className="inline-flex rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-accent/50 hover:text-foreground"
              >
                {o.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
