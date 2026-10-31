/**
 * 디자인 확인용 Vercel Preview 배포 판단
 *
 * 다음을 모두 만족할 때만 참이다.
 * - Vercel이 넣는 시스템 환경변수: VERCEL = "1", VERCEL_ENV = "preview"
 * - 데이터 영역 설정(APP_DATA_ENVIRONMENT)이 없음
 *
 * 이때는 DB에 연결하지 않고 홈페이지 기능 미리보기(정적 가상 데이터)만 보여 준다.
 * - Production(VERCEL_ENV = "production")과 로컬·개발 실행(VERCEL_ENV 없음)은 항상 거짓이다.
 *   그 배포들의 시작 검사(설정·DB 식별 표식)는 그대로 실행된다.
 * - Preview에 APP_DATA_ENVIRONMENT가 설정되어 있으면 거짓이다(일반 경로와 같은 검사를 한다).
 * - 다른 페이지와 API는 이 판단을 쓰지 않는다. 설정이 없으므로 기존처럼 오류로 응답하고 데이터를 내보내지 않는다.
 */
export function isDesignPreviewDeployment(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL === "1" && env.VERCEL_ENV === "preview" && !env.APP_DATA_ENVIRONMENT;
}
