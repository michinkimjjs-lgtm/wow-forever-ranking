import { verifyStartup } from "@/lib/server/context";
import { isDesignPreviewDeployment } from "@/lib/server/design-preview";

/** 다시 시도해도 결과가 같은 설정 오류: 배포 설정·DB 식별 표식이 틀렸으므로 서버를 시작하지 않는다. */
const FATAL_STARTUP_ERRORS = new Set(["ConfigurationError", "GameScopeNotConfiguredError", "DatabaseIdentityError"]);

// 디자인 확인용 Vercel Preview 배포(APP_DATA_ENVIRONMENT 없음)만 DB에 연결하지 않는다.
// Production·로컬을 포함한 그 밖의 배포는 항상 설정과 DB 식별 표식을 검사한다.
if (!isDesignPreviewDeployment()) {
  try {
    await verifyStartup();
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (FATAL_STARTUP_ERRORS.has(name)) throw error;
    // 일시적인 DB 접속 실패(서버리스 DB 깨어나는 중, 네트워크 등)로 시작 검사를 실패시키면
    // Next.js가 이 서버 인스턴스의 모든 화면을 계속 500으로 응답한다.
    // 데이터를 다루는 요청은 getServerContext()가 매번 같은 검사를 다시 하므로, 여기서는 기록만 남긴다.
    const code = (error as { code?: unknown; cause?: { code?: unknown } })?.code ?? (error as { cause?: { code?: unknown } })?.cause?.code;
    console.error(`[서버 시작 검사] DB 접속 실패로 검사를 요청 시점으로 미룹니다 (${name || "Error"}${code ? `, ${String(code)}` : ""}).`);
  }
}
