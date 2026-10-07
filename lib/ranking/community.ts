/**
 * 커뮤니티 랭킹 단계와 "전체 서버 1위" 표시 판단 (docs/COMMUNITY-RANKING-PLAN.md)
 *
 * 단계
 * - TEST_DATA: mock 배포
 * - COMMUNITY: 1단계 "커뮤니티 레벨 랭킹". Forever Rank가 확인한 캐릭터 안에서의 순위
 * - BRANDED_COMMUNITY: 2단계 "Forever Rank 커뮤니티 랭킹". 정책의 기준을 모두 충족할 때만
 * - OFFICIAL: 3단계 "공식 데이터 기반 랭킹". 활성 캐릭터가 모두 공식 공급원 데이터일 때만
 *
 * "전체 서버 1위"는 표본이 아니라 전수에 가까운 공식 데이터에서만 쓴다. 근거가 하나라도 부족하면 쓰지 않는다.
 */
import { z } from "zod";
import { communityRankingPolicy } from "@/config/community-ranking";
import type { DataCoverage } from "./coverage";

const ratio = z.number().min(0).max(1).nullable();
const countValue = z.number().int().positive().nullable();

export const communityRankingPolicySchema = z.object({
  status: z.enum(["DRAFT", "APPROVED"]),
  brandedCommunity: z.object({
    minActiveCharacters: countValue,
    minIndependentSubmitters: countValue,
    maxIdentityConflictRatio: ratio,
  }),
  serverWideClaim: z.object({
    requireOfficialSource: z.literal(true),
    minPopulationCoverage: ratio,
    minVerifiedRatio: ratio,
    maxIdentityConflictRatio: ratio,
  }),
});
export type CommunityRankingPolicy = z.infer<typeof communityRankingPolicySchema>;
export type CommunityRankingPolicyInput = z.input<typeof communityRankingPolicySchema>;

export function getCommunityRankingPolicy(): CommunityRankingPolicy {
  return communityRankingPolicySchema.parse(communityRankingPolicy);
}

export const RANKING_STAGES = ["TEST_DATA", "COMMUNITY", "BRANDED_COMMUNITY", "OFFICIAL"] as const;
export type RankingStage = (typeof RANKING_STAGES)[number];

function conflictRatio(c: DataCoverage): number {
  return c.activeCharacters === 0 ? 0 : c.identityConflicts / c.activeCharacters;
}

export function classifyRankingStage(coverage: DataCoverage, policy: CommunityRankingPolicy = getCommunityRankingPolicy()): RankingStage {
  if (coverage.dataEnvironment === "mock") return "TEST_DATA";
  if (coverage.activeCharacters > 0 && coverage.officialRatio === 1) return "OFFICIAL";
  const b = policy.brandedCommunity;
  const meets =
    b.minActiveCharacters !== null &&
    b.minIndependentSubmitters !== null &&
    b.maxIdentityConflictRatio !== null &&
    coverage.independentSubmitters !== null &&
    coverage.activeCharacters >= b.minActiveCharacters &&
    coverage.independentSubmitters >= b.minIndependentSubmitters &&
    conflictRatio(coverage) <= b.maxIdentityConflictRatio;
  return meets ? "BRANDED_COMMUNITY" : "COMMUNITY";
}

export type ServerWideBlocker =
  | "TEST_DATA"
  | "NO_DATA"
  | "NOT_OFFICIAL_SOURCE"
  | "POLICY_UNDEFINED"
  | "POPULATION_UNKNOWN"
  | "LOW_POPULATION_COVERAGE"
  | "LOW_VERIFIED_RATIO"
  | "IDENTITY_CONFLICTS";

export interface ServerWideClaim {
  allowed: boolean;
  blockers: ServerWideBlocker[];
}

/** "전체 서버 N위" 표현을 써도 되는지. 하나라도 막히면 쓰지 않는다. */
export function evaluateServerWideClaim(
  coverage: DataCoverage,
  policy: CommunityRankingPolicy = getCommunityRankingPolicy(),
): ServerWideClaim {
  const blockers: ServerWideBlocker[] = [];
  const p = policy.serverWideClaim;
  if (coverage.dataEnvironment === "mock") blockers.push("TEST_DATA");
  if (coverage.activeCharacters === 0) blockers.push("NO_DATA");
  if (coverage.officialRatio !== 1) blockers.push("NOT_OFFICIAL_SOURCE");
  if (p.minPopulationCoverage === null || p.minVerifiedRatio === null || p.maxIdentityConflictRatio === null) {
    blockers.push("POLICY_UNDEFINED");
  }
  if (coverage.populationEstimate === null || coverage.populationEstimate <= 0) {
    blockers.push("POPULATION_UNKNOWN");
  } else if (p.minPopulationCoverage !== null && coverage.activeCharacters / coverage.populationEstimate < p.minPopulationCoverage) {
    blockers.push("LOW_POPULATION_COVERAGE");
  }
  if (p.minVerifiedRatio !== null && (coverage.verifiedRatio ?? 0) < p.minVerifiedRatio) blockers.push("LOW_VERIFIED_RATIO");
  if (p.maxIdentityConflictRatio !== null && conflictRatio(coverage) > p.maxIdentityConflictRatio) blockers.push("IDENTITY_CONFLICTS");
  return { allowed: blockers.length === 0, blockers };
}

/** 순위 문구 종류: 전체 서버 순위는 허용될 때만 */
export function rankScopeKind(claim: ServerWideClaim): "serverWide" | "observed" {
  return claim.allowed ? "serverWide" : "observed";
}
