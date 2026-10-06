/**
 * 페이지별 SEO 메타데이터 (명세서 §26)
 */
import type { Metadata } from "next";
import { getAppEnvironmentSafe } from "@/lib/server/context";
import { getSiteUrl } from "@/lib/config/env";
import { getMessages } from "@/lib/i18n";

export function pageMetadata(input: { title: string; description: string; path: string }): Metadata {
  const isMock = getAppEnvironmentSafe() !== "beta" && getAppEnvironmentSafe() !== "live";
  const siteName = getMessages().common.siteName;
  return {
    title: { absolute: input.title },
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      title: input.title,
      description: input.description,
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
