/**
 * 레벨 달성 근거의 판정과 채택 (명세서 §8.5, docs/HISTORY-PRESERVATION.md)
 *
 * 1. assessReachedAtClaim: 공급원이 보낸 달성 시각 주장(levelReachedAt)이 이미 아는 사실과 맞는지 판정한다.
 *    - 관측 시각보다 늦음 → REJECTED
 *    - 이 레벨보다 낮은 레벨로 관측된 시각보다 이름, 또는 더 높은 레벨을 이미 달성·관측한 시각보다 늦음 → CONFLICT
 *    - 신뢰 수준이 높지 않은 출처(커뮤니티 제출·미검증)인데 뒷받침하는 낮은 레벨 관측이 없음 → NEEDS_REVIEW
 *      (사이트가 처음 관측하기 전에 실제로 달성했을 수 있으므로 거부하지 않는다. 확인된 하한이 없어 날짜를 고정하지 않는다)
 *    - 그 밖 → ACCEPTED
 * 2. chooseAdoptedEvidence: 같은 캐릭터·레벨의 근거 중 현재 채택할 하나를 고른다.
 *    - 신뢰 수준(검증 상태)이 가장 높은 근거들만 후보로 한다. 낮은 신뢰의 근거는 날짜가 이르더라도 높은 신뢰의 기록을 대체하지 않는다.
 *    - 같은 신뢰 수준 안에서: 시간 근거(SOURCE_REPORTED > FIRST_OBSERVED > INFERRED) → 더 이른 시각 → 먼저 저장된 행
 * 순수 함수다. DB를 읽거나 쓰지 않는다.
 */
import type { MilestoneTimingBasis, ReachedAtClaimStatus, VerificationStatus } from "@/lib/domain/enums";

/** 검증 상태별 신뢰 수준 (명세서 §11 공급원 우선순위). mock 영역은 MOCK만 있으므로 영역 안에서 비교가 섞이지 않는다 */
export const TRUST_RANK: Record<VerificationStatus, number> = {
  VERIFIED: 4,
  LOG_VERIFIED: 3,
  COMMUNITY_SUBMITTED: 2,
  UNVERIFIED: 1,
  MOCK: 2,
};

/**
 * 뒷받침하는 관측 없이도 달성 시각 주장을 받아들이는 검증 상태.
 * MOCK은 개발용 생성기 데이터라 실제 영역과 섞이지 않는다(mock 영역 전용).
 */
const SELF_SUFFICIENT: ReadonlySet<VerificationStatus> = new Set(["VERIFIED", "LOG_VERIFIED", "MOCK"]);

export const TIMING_PRIORITY: Record<MilestoneTimingBasis, number> = {
  SOURCE_REPORTED: 3,
  FIRST_OBSERVED: 2,
  INFERRED: 1,
};

export type ClaimReason =
  /** 달성 시각이 관측 시각보다 늦음 */
  | "CLAIM_AFTER_OBSERVATION"
  /** 더 낮은 레벨로 관측(또는 더 낮은 레벨 달성)된 시각보다 이름 */
  | "CLAIM_BEFORE_LOWER_LEVEL_FACT"
  /** 더 높은 레벨을 이미 관측(또는 달성)한 시각보다 늦음 */
  | "CLAIM_AFTER_HIGHER_LEVEL_FACT"
  /** 뒷받침하는 더 낮은 레벨 관측이 없음 (예: 사이트가 처음 관측하기 전의 달성 주장) */
  | "UNCORROBORATED_CLAIM";

export interface ClaimFacts {
  /** 이 레벨보다 낮은 레벨로 관측된 시각들 중 가장 이른 / 가장 늦은 값 */
  lowerSightingMin: Date | null;
  lowerSightingMax: Date | null;
  /** 이 레벨보다 낮은 레벨의 채택 가능한 달성 시각 중 가장 늦은 값 */
  lowerReachedMax: Date | null;
  /** 이 레벨보다 높은 레벨을 관측했거나 달성한 가장 이른 시각 */
  higherFactMin: Date | null;
}

export interface ClaimAssessment {
  status: Exclude<ReachedAtClaimStatus, "NONE">;
  reasons: ClaimReason[];
}

export function assessReachedAtClaim(input: {
  claim: Date;
  observedAt: Date;
  verificationStatus: VerificationStatus;
  facts: ClaimFacts;
}): ClaimAssessment {
  const { claim, observedAt, facts } = input;
  const t = claim.getTime();
  if (t > observedAt.getTime()) return { status: "REJECTED", reasons: ["CLAIM_AFTER_OBSERVATION"] };

  const conflicts: ClaimReason[] = [];
  const lowerLatest = Math.max(facts.lowerSightingMax?.getTime() ?? -Infinity, facts.lowerReachedMax?.getTime() ?? -Infinity);
  if (t < lowerLatest) conflicts.push("CLAIM_BEFORE_LOWER_LEVEL_FACT");
  if (facts.higherFactMin && t > facts.higherFactMin.getTime()) conflicts.push("CLAIM_AFTER_HIGHER_LEVEL_FACT");
  if (conflicts.length > 0) return { status: "CONFLICT", reasons: conflicts };

  if (!SELF_SUFFICIENT.has(input.verificationStatus)) {
    const corroborated = facts.lowerSightingMin !== null && facts.lowerSightingMin.getTime() <= t;
    if (!corroborated) return { status: "NEEDS_REVIEW", reasons: ["UNCORROBORATED_CLAIM"] };
  }
  return { status: "ACCEPTED", reasons: [] };
}

export interface EvidenceForAdoption {
  id: string;
  timingBasis: MilestoneTimingBasis;
  claimedReachedAt: Date | null;
  observedAt: Date;
  previousObservedAt: Date | null;
  verificationStatus: VerificationStatus;
  createdAt: Date;
}

export interface AdoptedMilestone {
  evidence: EvidenceForAdoption;
  timingBasis: MilestoneTimingBasis;
  reachedAt: Date | null;
  firstObservedAt: Date;
  previousObservedAt: Date | null;
}

const effectiveTime = (e: EvidenceForAdoption) =>
  (e.timingBasis === "SOURCE_REPORTED" && e.claimedReachedAt ? e.claimedReachedAt : e.observedAt).getTime();

/** 같은 캐릭터·레벨의 근거 목록에서 현재 채택할 기록을 고른다. 근거가 없으면 null */
export function chooseAdoptedEvidence(rows: readonly EvidenceForAdoption[]): AdoptedMilestone | null {
  if (rows.length === 0) return null;
  const topTrust = Math.max(...rows.map((r) => TRUST_RANK[r.verificationStatus]));
  const tier = rows.filter((r) => TRUST_RANK[r.verificationStatus] === topTrust);
  const best = [...tier].sort(
    (a, b) =>
      TIMING_PRIORITY[b.timingBasis] - TIMING_PRIORITY[a.timingBasis] ||
      effectiveTime(a) - effectiveTime(b) ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  )[0]!;
  // 최초 관측 시각: 같은 신뢰 수준의 근거 중 가장 이른 관측
  const earliest = [...tier].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime() || a.id.localeCompare(b.id))[0]!;
  return {
    evidence: best,
    timingBasis: best.timingBasis,
    reachedAt: best.timingBasis === "SOURCE_REPORTED" ? best.claimedReachedAt : null,
    firstObservedAt: earliest.observedAt,
    previousObservedAt: earliest.previousObservedAt,
  };
}
