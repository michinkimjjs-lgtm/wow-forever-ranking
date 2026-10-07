/**
 * Blizzard WoW: Forever 웹 API capability registry
 *
 * 근거: docs/FOREVER-API-CAPABILITY.md §2-9, docs/BLIZZARD-API-INTEGRATION-PLAN.md §2
 * - 2026-10-06 기준 Battle.net 개발자 문서에서 Forever용 namespace / endpoint를 찾지 못했다.
 * - 그래서 모든 기능을 UNKNOWN으로 둔다. 추측으로 AVAILABLE로 바꾸지 않는다.
 *
 * AVAILABLE로 바꾸는 조건 (lib 검증과 테스트가 강제한다)
 * 1. 공식 문서 URL과 확인 날짜(evidence)를 적는다.
 * 2. config/blizzard/endpoints.ts에 같은 capability의 endpoint를 등록한다.
 * 3. 응답 정규화 코드와 테스트를 추가한다.
 */
import type { CapabilityRegistry } from "@/providers/capabilities";

const REVIEWED_AT = "2026-10-06";
const NOT_PUBLISHED = "Blizzard WoW: Forever 웹 API가 공개되지 않았습니다. 확인 필요.";

export const blizzardCapabilities: CapabilityRegistry = {
  character_profile: { status: "UNKNOWN", note: `${NOT_PUBLISHED} 캐릭터 Profile API 존재 여부 미확인.`, reviewedAt: REVIEWED_AT, evidence: null },
  character_level: { status: "UNKNOWN", note: `${NOT_PUBLISHED} Profile 응답에 레벨·레벨 달성 시각이 있는지 미확인.`, reviewedAt: REVIEWED_AT, evidence: null },
  character_equipment: { status: "UNKNOWN", note: `${NOT_PUBLISHED} 장비 API와 장착 아이템 레벨 제공 여부 미확인.`, reviewedAt: REVIEWED_AT, evidence: null },
  item: { status: "UNKNOWN", note: `${NOT_PUBLISHED} Game Data(item / media) API 미확인.`, reviewedAt: REVIEWED_AT, evidence: null },
  guild: { status: "UNKNOWN", note: `${NOT_PUBLISHED} 길드 API와 realm 없는 구조에서의 길드 식별 방식 미확인.`, reviewedAt: REVIEWED_AT, evidence: null },
  achievement: { status: "UNKNOWN", note: `${NOT_PUBLISHED} 업적 API 미확인.`, reviewedAt: REVIEWED_AT, evidence: null },
  dungeon: { status: "UNKNOWN", note: `${NOT_PUBLISHED} 던전 기록 API 미확인.`, reviewedAt: REVIEWED_AT, evidence: null },
  raid: { status: "UNKNOWN", note: `${NOT_PUBLISHED} 공격대 기록 API 미확인.`, reviewedAt: REVIEWED_AT, evidence: null },
};
