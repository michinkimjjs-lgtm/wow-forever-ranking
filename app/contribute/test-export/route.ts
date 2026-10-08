/**
 * GET /contribute/test-export — 테스트용 예시 Export 파일 (mock 배포 전용)
 *
 * beta / live에서는 내려 주지 않는다(404). 실제 영역 제출은 이 파일을 거부한다.
 */
import { buildTestExport, TEST_EXPORT_FILE_NAME } from "@/lib/collector/test-export";
import { getMessages } from "@/lib/i18n";
import { getAppEnvironmentSafe } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export function GET(): Response {
  if (getAppEnvironmentSafe() !== "mock") {
    const message = getMessages().api.NOT_FOUND;
    return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message } }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  }
  return new Response(`${JSON.stringify(buildTestExport(new Date()), null, 2)}\n`, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${TEST_EXPORT_FILE_NAME}"`,
      "Cache-Control": "no-store",
      // 테스트 데이터는 검색 엔진에 노출하지 않는다.
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
