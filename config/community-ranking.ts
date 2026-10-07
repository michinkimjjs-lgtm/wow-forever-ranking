/**
 * 커뮤니티 랭킹 단계와 "전체 서버 1위" 표시 정책 (docs/COMMUNITY-RANKING-PLAN.md, docs/DATA-COVERAGE-MODEL.md)
 *
 * 상태: DRAFT
 * - 단계를 올리는 기준 숫자는 실제 제출 데이터를 보기 전에는 정하지 않는다. null = "아직 정하지 않음"이며,
 *   null인 기준이 있는 단계에는 올라가지 않는다. (임의의 숫자를 만들지 않기 위해)
 * - 실제 데이터가 쌓이면 docs/DATA-COVERAGE-MODEL.md §5 절차로 값을 정하고 명세서를 먼저 고친다.
 */
import type { CommunityRankingPolicyInput } from "@/lib/ranking/community";

export const communityRankingPolicy: CommunityRankingPolicyInput = {
  status: "DRAFT",
  /** 2단계 "Forever Rank 커뮤니티 랭킹"으로 부르기 위한 최소 조건 */
  brandedCommunity: {
    minActiveCharacters: null,
    minIndependentSubmitters: null,
    /** 활성 캐릭터 중 식별 충돌이 차지하는 비율의 상한 */
    maxIdentityConflictRatio: null,
  },
  /** "전체 서버 1위" 표시 조건. 모두 충족해야 한다. */
  serverWideClaim: {
    /** 공식 공급원(blizzard)으로 확인한 데이터만 대상 */
    requireOfficialSource: true,
    /** 모집단 대비 확인 비율. 모집단 수를 공식적으로 알 수 없으면 판단하지 않는다. */
    minPopulationCoverage: null,
    /** 활성 캐릭터 중 VERIFIED / LOG_VERIFIED 비율 */
    minVerifiedRatio: null,
    maxIdentityConflictRatio: null,
  },
};
