/**
 * Blizzard WoW: Forever 웹 API endpoint registry
 *
 * 비어 있다. Forever API endpoint는 공개 자료로 확인되지 않았다(docs/FOREVER-API-CAPABILITY.md §2-9).
 * 존재하지 않는 URL을 만들지 않는다. Retail / Classic API 경로를 Forever용으로 추측해 넣지 않는다.
 *
 * 공식 문서가 공개되면 다음 형태로 추가한다 (docs/BLIZZARD-API-INTEGRATION-PLAN.md §3).
 * - capability: config/blizzard/capabilities.ts의 기능 (AVAILABLE이어야 함)
 * - pathTemplate: API base 기준 상대 경로. "{characterName}" 같은 자리표시자를 쓴다. 전체 URL은 금지
 * - namespace: 공식 문서의 namespace 종류 (예: profile / static / dynamic). 값은 설정에서 받는다
 * - evidence: 공식 문서 URL과 확인 날짜
 */
import type { BlizzardEndpointDefinition } from "@/providers/blizzard/endpoints";

export const blizzardEndpoints: readonly BlizzardEndpointDefinition[] = [];
