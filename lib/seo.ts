/**
 * 페이지별 SEO 메타데이터 (명세서 §26)
 */
import type { Metadata } from "next";
import { getAppEnvironmentSafe } from "@/lib/server/context";
import { getSiteUrl } from "@/lib/config/env";
import { getMessages } from "@/lib/i18n";

export function pageMetadata(input: { title: string; description: string; path: string }): Metadata {
  const isMock = isTestDataDeployment();
  const messages = getMessages();
  const siteName = messages.common.siteName;
  // 테스트 데이터 배포는 제목·설명에 표시를 붙여, 공유 화면이나 검색 결과에서 실제 랭킹으로 오해하지 않게 한다.
  const title = isMock ? `${messages.seo.testData.titlePrefix}${input.title}` : input.title;
  const description = isMock ? `${messages.seo.testData.descriptionPrefix}${input.description}` : input.description;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: input.path },
    openGraph: {
      title,
      description,
      url: input.path,
      siteName,
      locale: "ko_KR",
      type: "website",
    },
    // mock 배포는 검색 엔진에 노출하지 않는다.
    robots: isMock ? { index: false, follow: false } : { index: true, follow: true },
    metadataBase: new URL(getSiteUrl()),
  };
}

/** 실제 데이터 배포(beta / live)가 아니면 테스트 데이터 배포로 본다(설정을 읽지 못한 경우 포함). */
export function isTestDataDeployment(): boolean {
  const env = getAppEnvironmentSafe();
  return env !== "beta" && env !== "live";
}
