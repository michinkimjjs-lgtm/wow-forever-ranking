import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CharacterDetailDemo } from "@/components/demo/character-detail-demo";
import { getGameScope } from "@/lib/config";
import { demoCharacterByName } from "@/lib/demo/home-preview-fixture";
import { getMessages, t } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import { getAppEnvironmentSafe } from "@/lib/server/context";
import { isDesignPreviewDeployment } from "@/lib/server/design-preview";

/**
 * 가상 캐릭터 상세 예시 (화면 미리보기)
 *
 * - 실제 데이터 설정이 확인되지 않은 배포(beta·live, 디자인 확인용 Preview)에서만 연다. 그 밖에는 404.
 * - DB에 접근하지 않고, 검색 엔진에 노출하지 않는다(robots.txt에서도 제외).
 */
function demoPagesEnabled(): boolean {
  if (isDesignPreviewDeployment()) return true;
  const appEnv = getAppEnvironmentSafe();
  return appEnv !== null && appEnv !== "mock" && !getGameScope(appEnv);
}

type Params = Promise<{ name: string }>;

async function findCharacter(params: Params) {
  const { name } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    return null;
  }
  return demoCharacterByName(decoded);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const c = getMessages().demo.detail;
  const character = demoPagesEnabled() ? await findCharacter(params) : null;
  const name = character?.name ?? "";
  return {
    ...pageMetadata({ title: t(c.seoTitle, { name }), description: c.seoDescription, path: routes.demoCharacter(name) }),
    robots: { index: false, follow: false },
  };
}

export default async function DemoCharacterPage({ params }: { params: Params }) {
  if (!demoPagesEnabled()) notFound();
  const character = await findCharacter(params);
  if (!character) notFound();
  return <CharacterDetailDemo character={character} />;
}
