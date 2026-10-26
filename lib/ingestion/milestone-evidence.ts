/**
 * 레벨 달성 근거의 판정과 채택 (명세서 §8.5, docs/HISTORY-PRESERVATION.md)
 *
 * 모든 판단은 "지금까지 알려진 사실 전체"로 다시 계산한다. 같은 사실 집합이면 도착 순서와 관계없이 결과가 같다.
 *
 * 1. evaluateClaims: 각 달성 시각 주장(levelReachedAt)을 판정한다.
 *    1단계 (관측 사실과 비교)
 *    - 관측 시각보다 늦음 → REJECTED
 *    - 더 낮은 레벨로 관측된 시각보다 이름 / 더 높은 레벨을 관측한 시각보다 늦음 → CONFLICT
 *    - 신뢰 수준이 높지 않은 출처(커뮤니티 제출·미검증)인데 그 시각 이전의 더 낮은 레벨 관측이 없음 → NEEDS_REVIEW
 *      (사이트가 처음 관측하기 전에 실제로 달성했을 수 있으므로 거부하지 않는다. 확인된 하한이 없어 날짜를 고정하지 않는다)
 *    - 그 밖 → ACCEPTED
 *    2단계 (주장끼리 비교): 1단계에서 ACCEPTED인 주장과 달성 순서가 모순되면(높은 레벨을 더 일찍 달성) CONFLICT.
 *      상대가 같거나 더 높은 신뢰 수준일 때만 적용한다. 검토 대기 주장은 다른 주장을 무효로 만들지 못한다.
 *    관측 사실은 판정 대상과 같거나 더 높은 신뢰 수준의 출처만 쓴다.
 * 2. inferGapEvidence: 새 관측과 시간상 바로 앞·뒤 관측 사이에서 건너뛴 레벨(INFERRED)을 찾는다.
 *    늦게 도착한 관측도 같은 추론 근거를 만들도록 양쪽을 모두 본다.
 * 3. chooseAdoptedEvidence: 같은 캐릭터·레벨의 근거 중 현재 채택할 하나를 고른다.
 *    - 신뢰 수준(검증 상태)이 가장 높은 근거들만 후보로 한다. 낮은 신뢰의 근거는 날짜가 이르더라도 높은 신뢰의 기록을 대체하지 않는다.
 *    - 같은 신뢰 수준 안에서: 시간 근거(현재 판정이 ACCEPTED인 주장 = SOURCE_REPORTED > FIRST_OBSERVED > INFERRED)
 *      → 더 이른 시각 → 더 늦은 직전 관측(좁은 구간) → 출처·빌드·관측 시각 → id
 * 순수 함수다. DB를 읽거나 쓰지 않는다.
 */
import type {
  DataSource,
  EvidenceOrigin,
  MilestoneTimingBasis,
  ReachedAtClaimStatus,
  VerificationStatus,
} from "@/lib/domain/enums";

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
  /** 더 낮은 레벨로 관측된 시각보다 이름 */
  | "CLAIM_BEFORE_LOWER_LEVEL_FACT"
  /** 더 높은 레벨을 이미 관측한 시각보다 늦음 */
  | "CLAIM_AFTER_HIGHER_LEVEL_FACT"
  /** 다른 인정된 주장과 달성 순서가 모순됨 (높은 레벨을 더 일찍 달성) */
  | "CLAIM_ORDER_CONFLICT"
  /** 뒷받침하는 더 낮은 레벨 관측이 없음 (예: 사이트가 처음 관측하기 전의 달성 주장) */
  | "UNCORROBORATED_CLAIM";

export type ClaimStatus = Exclude<ReachedAtClaimStatus, "NONE">;

export interface ClaimAssessment {
  status: ClaimStatus;
  reasons: ClaimReason[];
}

/** 판정·채택에 쓰는 근거 한 행 */
export interface EvidenceFact {
  id: string;
  level: number;
  observationBasis: Exclude<MilestoneTimingBasis, "SOURCE_REPORTED">;
  claimedReachedAt: Date | null;
  observedAt: Date;
  previousObservedAt: Date | null;
  verificationStatus: VerificationStatus;
  origin: EvidenceOrigin;
  dataSource: DataSource;
  sourceBuild: string | null;
}

/** 정확한 레벨을 관측한 사실 (수집 근거의 직접 관측 행, 스냅샷, 캐릭터의 마지막 상태) */
export interface SightingFact {
  level: number;
  observedAt: Date;
  verificationStatus: VerificationStatus;
}

const ms = (d: Date) => d.getTime();

/** 수집 근거 중 정확한 레벨을 관측한 행 (이관 행·추론 행 제외) */
export function sightingsFromEvidence(evidence: readonly EvidenceFact[]): SightingFact[] {
  return evidence
    .filter((e) => e.origin === "INGESTED" && e.observationBasis === "FIRST_OBSERVED")
    .map((e) => ({ level: e.level, observedAt: e.observedAt, verificationStatus: e.verificationStatus }));
}

/** 새 관측이 기존 관측과 달성 순서가 모순되는지 (더 이른 시각에 더 높은 레벨 / 더 늦은 시각에 더 낮은 레벨) */
export function contradictsSightings(level: number, observedAt: Date, sightings: readonly SightingFact[]): boolean {
  const t = ms(observedAt);
  return sightings.some((s) => (ms(s.observedAt) < t && s.level > level) || (ms(s.observedAt) > t && s.level < level));
}

export function evaluateClaims(
  evidence: readonly EvidenceFact[],
  extraSightings: readonly SightingFact[],
): Map<string, ClaimAssessment> {
  const sightings = [...sightingsFromEvidence(evidence), ...extraSightings];
  const claims = evidence.filter((e) => e.claimedReachedAt !== null);
  const result = new Map<string, ClaimAssessment>();

  // 1단계: 관측 사실과 비교
  for (const e of claims) {
    const claim = ms(e.claimedReachedAt!);
    if (claim > ms(e.observedAt)) {
      result.set(e.id, { status: "REJECTED", reasons: ["CLAIM_AFTER_OBSERVATION"] });
      continue;
    }
    const trust = TRUST_RANK[e.verificationStatus];
    const trusted = (v: VerificationStatus) => TRUST_RANK[v] >= trust;
    const lower = sightings.filter((s) => s.level < e.level && trusted(s.verificationStatus)).map((s) => ms(s.observedAt));
    const higher = [
      ...sightings.filter((s) => s.level > e.level && trusted(s.verificationStatus)).map((s) => ms(s.observedAt)),
      // 더 높은 레벨의 근거(추론·이관 포함): 그 관측 시각에는 이미 그 레벨 이상
      ...evidence.filter((o) => o.id !== e.id && o.level > e.level && trusted(o.verificationStatus)).map((o) => ms(o.observedAt)),
    ];
    const reasons: ClaimReason[] = [];
    if (lower.length > 0 && claim < Math.max(...lower)) reasons.push("CLAIM_BEFORE_LOWER_LEVEL_FACT");
    if (higher.length > 0 && claim > Math.min(...higher)) reasons.push("CLAIM_AFTER_HIGHER_LEVEL_FACT");
    if (reasons.length > 0) {
      result.set(e.id, { status: "CONFLICT", reasons });
      continue;
    }
    // 이관 행은 기존 판단을 유지한다(뒷받침 요건을 새로 적용하지 않음). 모순 검사는 받는다.
    const needsCorroboration = e.origin === "INGESTED" && !SELF_SUFFICIENT.has(e.verificationStatus);
    if (needsCorroboration && !(lower.length > 0 && Math.min(...lower) <= claim)) {
      result.set(e.id, { status: "NEEDS_REVIEW", reasons: ["UNCORROBORATED_CLAIM"] });
      continue;
    }
    result.set(e.id, { status: "ACCEPTED", reasons: [] });
  }

  // 2단계: 1단계에서 인정된 주장과의 달성 순서 비교
  const accepted = claims.filter((e) => result.get(e.id)!.status === "ACCEPTED");
  const orderConflicts = new Set<string>();
  for (const e of claims) {
    const status = result.get(e.id)!.status;
    if (status !== "ACCEPTED" && status !== "NEEDS_REVIEW") continue;
    const trust = TRUST_RANK[e.verificationStatus];
    const contradicted = accepted.some(
      (o) =>
        o.id !== e.id &&
        TRUST_RANK[o.verificationStatus] >= trust &&
        ((o.level < e.level && ms(o.claimedReachedAt!) > ms(e.claimedReachedAt!)) ||
          (o.level > e.level && ms(o.claimedReachedAt!) < ms(e.claimedReachedAt!))),
    );
    if (contradicted) orderConflicts.add(e.id);
  }
  for (const id of orderConflicts) {
    const prev = result.get(id)!;
    result.set(id, { status: "CONFLICT", reasons: [...prev.reasons.filter((r) => r !== "UNCORROBORATED_CLAIM"), "CLAIM_ORDER_CONFLICT"] });
  }
  return result;
}

export interface GapInference {
  level: number;
  /** 더 높은 레벨을 관측한 시각 */
  observedAt: Date;
  /** 더 낮은 레벨을 관측한 시각 */
  previousObservedAt: Date;
  /** 더 높은 레벨 관측 근거 (추론 근거의 출처로 쓴다) */
  upperEvidenceId: string;
}

/**
 * 새 직접 관측(newSighting)과 시간상 바로 앞·뒤의 직접 관측 사이에서 건너뛴 레벨을 찾는다.
 * 이미 같은 (레벨, 관측 시각, 직전 관측 시각)의 추론 근거가 있으면 만들지 않는다.
 */
export function inferGapEvidence(
  newSighting: { level: number; observedAt: Date; evidenceId: string },
  sightings: readonly { level: number; observedAt: Date; evidenceId: string | null }[],
  existing: readonly EvidenceFact[],
): GapInference[] {
  const t = ms(newSighting.observedAt);
  const others = sightings.filter((s) => ms(s.observedAt) !== t);
  // 같은 시각·레벨이면 출처를 아는(근거가 있는) 관측을 먼저 쓴다
  const known = (x: { evidenceId: string | null }) => (x.evidenceId ? 0 : 1);
  const before = others
    .filter((s) => ms(s.observedAt) < t)
    .sort((a, b) => ms(b.observedAt) - ms(a.observedAt) || b.level - a.level || known(a) - known(b))[0];
  const after = others
    .filter((s) => ms(s.observedAt) > t)
    .sort((a, b) => ms(a.observedAt) - ms(b.observedAt) || a.level - b.level || known(a) - known(b))[0];
  const pairs: { lower: { level: number; observedAt: Date }; upper: { level: number; observedAt: Date; evidenceId: string | null } }[] = [];
  if (before) pairs.push({ lower: before, upper: newSighting });
  if (after) pairs.push({ lower: newSighting, upper: after });

  const has = (level: number, at: Date, prev: Date) =>
    existing.some(
      (e) =>
        e.observationBasis === "INFERRED" &&
        e.level === level &&
        ms(e.observedAt) === ms(at) &&
        e.previousObservedAt !== null &&
        ms(e.previousObservedAt) === ms(prev),
    );
  const gaps: GapInference[] = [];
  for (const { lower, upper } of pairs) {
    if (!upper.evidenceId) continue; // 출처를 알 수 없는 관측(스냅샷만 있는 이관 이전 기록)에서는 추론 근거를 만들지 않는다
    for (let level = lower.level + 1; level < upper.level; level += 1) {
      if (!has(level, upper.observedAt, lower.observedAt)) {
        gaps.push({ level, observedAt: upper.observedAt, previousObservedAt: lower.observedAt, upperEvidenceId: upper.evidenceId });
      }
    }
  }
  return gaps;
}

export interface AdoptedMilestone {
  evidence: EvidenceFact;
  timingBasis: MilestoneTimingBasis;
  reachedAt: Date | null;
  firstObservedAt: Date;
}

const effectiveBasis = (e: EvidenceFact, assessments: ReadonlyMap<string, ClaimAssessment>): MilestoneTimingBasis =>
  assessments.get(e.id)?.status === "ACCEPTED" ? "SOURCE_REPORTED" : e.observationBasis;

const nullableDesc = (a: Date | null, b: Date | null) => (b ? ms(b) : -Infinity) - (a ? ms(a) : -Infinity);

/** 같은 캐릭터·레벨의 근거 목록에서 현재 채택할 기록을 고른다. 근거가 없으면 null */
export function chooseAdoptedEvidence(
  rows: readonly EvidenceFact[],
  assessments: ReadonlyMap<string, ClaimAssessment>,
): AdoptedMilestone | null {
  if (rows.length === 0) return null;
  const topTrust = Math.max(...rows.map((r) => TRUST_RANK[r.verificationStatus]));
  const tier = rows.filter((r) => TRUST_RANK[r.verificationStatus] === topTrust);
  const effective = (e: EvidenceFact) =>
    effectiveBasis(e, assessments) === "SOURCE_REPORTED" ? ms(e.claimedReachedAt!) : ms(e.observedAt);
  const best = [...tier].sort(
    (a, b) =>
      TIMING_PRIORITY[effectiveBasis(b, assessments)] - TIMING_PRIORITY[effectiveBasis(a, assessments)] ||
      effective(a) - effective(b) ||
      nullableDesc(a.previousObservedAt, b.previousObservedAt) ||
      a.dataSource.localeCompare(b.dataSource) ||
      (a.sourceBuild ?? "").localeCompare(b.sourceBuild ?? "") ||
      ms(a.observedAt) - ms(b.observedAt) ||
      a.id.localeCompare(b.id),
  )[0]!;
  const firstObservedAt = new Date(Math.min(...tier.map((r) => ms(r.observedAt))));
  const basis = effectiveBasis(best, assessments);
  return {
    evidence: best,
    timingBasis: basis,
    reachedAt: basis === "SOURCE_REPORTED" ? best.claimedReachedAt : null,
    firstObservedAt,
  };
}

/** 채택 기록의 직전 관측 시각: 최초 관측 이전에 더 낮은 레벨로 관측된 가장 늦은 시각 (같거나 높은 신뢰 수준만) */
export function previousSightingBefore(
  level: number,
  firstObservedAt: Date,
  minTrust: number,
  sightings: readonly SightingFact[],
): Date | null {
  const times = sightings
    .filter((s) => s.level < level && ms(s.observedAt) < ms(firstObservedAt) && TRUST_RANK[s.verificationStatus] >= minTrust)
    .map((s) => ms(s.observedAt));
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}
