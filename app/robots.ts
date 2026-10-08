import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/config/env";
import { isTestDataDeployment } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * robots.txt
 * - 테스트 데이터 배포(mock)는 모든 경로를 검색 엔진에서 제외한다(각 페이지의 noindex와 함께).
 * - 실제 배포는 관리자 화면, API, 테스트용 예시 파일 경로만 제외한다.
 */
export default function robots(): MetadataRoute.Robots {
  if (isTestDataDeployment()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/contribute/test-export"] }],
    host: getSiteUrl(),
  };
}
