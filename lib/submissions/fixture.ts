/**
 * 테스트 fixture 표식 (tests/fixtures/character-export/mock/README.md)
 *
 * collector.version에 표식이 있는 Export는 개발·시연용 테스트 데이터다.
 * - 실제 영역(beta / live) 제출로는 받지 않는다(MOCK_FIXTURE_REJECTED). 커뮤니티 제출(COMMUNITY_SUBMITTED)이나
 *   검증됨(VERIFIED)으로 승격되지 않게 하기 위해서다.
 * - mock 배포의 검증 전용 제출(dryRun, 저장 없음)에서만 통과시키고, 검증 상태는 테스트 데이터(MOCK)로 돌려준다.
 * 브라우저와 서버에서 함께 쓴다.
 */
export const MOCK_FIXTURE_COLLECTOR_MARK = "mock-fixture";

export function isMockFixtureExport(data: { collector: { version: string } }): boolean {
  return data.collector.version.includes(MOCK_FIXTURE_COLLECTOR_MARK);
}
