/**
 * 서버 시작 검사 (명세서 §6.4-4)
 * 설정과 DB 식별 표식이 맞지 않으면 서버 시작을 실패시킨다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
