/**
 * 데이터 출처 구분 (docs/DATA-SOURCE-POLICY.md §1, docs/COMMUNITY-RANKING-PLAN.md §2)
 *
 * 화면에서 쓰는 출처 구분은 세 가지다.
 * - official: Blizzard 공식 데이터 (현재 연결되지 않음)
 * - community: 사용자 Collector 제출 / 애드온 제출
 * - test: mock 개발용 데이터
 * 출처 구분은 검증 상태와 별개다. 출처가 official이어도 검증 상태는 저장된 값을 그대로 쓴다.
 */
import type { DataSource } from "./enums";

export const DATA_ORIGINS = ["official", "community", "test"] as const;
export type DataOrigin = (typeof DATA_ORIGINS)[number];

export function dataOriginOf(source: DataSource): DataOrigin {
  switch (source) {
    case "blizzard":
      return "official";
    case "addon":
    case "user_submission":
      return "community";
    case "mock":
      return "test";
  }
}
