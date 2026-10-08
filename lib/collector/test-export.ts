/**
 * 테스트용 예시 Export (mock 배포 전용, docs/CONTRIBUTOR-GUIDE.md §6)
 *
 * 실제 게임 데이터가 없어도 Contributor 흐름(다운로드 → 제출 화면 → 검증)을 끝까지 확인할 수 있게 한다.
 * - 내용은 테스트 fixture(tests/fixtures/character-export/mock/01-valid-character.json)와 같은 가짜 데이터다.
 * - collector.version에 mock-fixture 표식을 넣는다. 실제 영역(beta / live)은 이 파일을 받지 않는다(MOCK_FIXTURE_REJECTED).
 * - 관측 시각만 요청 시각 기준으로 바꾼다(오래된 관측으로 거부되지 않도록). 레벨 상승 시각과의 간격은 유지한다.
 */
import { collectorRelease } from "@/config/collector";
import { MOCK_FIXTURE_COLLECTOR_MARK } from "@/lib/submissions/fixture";
import template from "./test-export.template.json";

export const TEST_EXPORT_FILE_NAME = "forever-rank-test-export.json";

export function buildTestExport(now: Date): typeof template {
  const copy = structuredClone(template);
  // 요청 시각을 정각으로 내린다(초 단위가 매번 달라지지 않도록).
  const observedAt = Math.floor(now.getTime() / 3_600_000) * 3600;
  const shift = observedAt - template.observedAt;
  copy.observedAt = observedAt;
  copy.levelEvents = template.levelEvents.map((e) => ({ ...e, observedAt: e.observedAt + shift }));
  copy.collector = { ...template.collector, version: `${collectorRelease.version}-${MOCK_FIXTURE_COLLECTOR_MARK}` };
  return copy;
}
