/**
 * 데이터 공급원 우선순위 (docs/BLIZZARD-API-INTEGRATION-PLAN.md §13)
 *
 * 같은 캐릭터가 여러 공급원에 있을 때 검증 상태로 우선한다.
 *   VERIFIED → LOG_VERIFIED → COMMUNITY_SUBMITTED → UNVERIFIED → MOCK
 * 검증 상태가 같으면 더 최근에 관측한 데이터를 쓴다.
 *
 * - 검증 상태는 각 데이터에 이미 저장된 값을 그대로 쓴다. 이 모듈은 상태를 올리거나 바꾸지 않는다.
 *   데이터 출처(dataSource)만으로 VERIFIED가 되지 않는다.
 * - 서로 다른 dataEnvironment의 데이터는 비교하지 않는다(예외). mock과 실제 데이터는 섞이지 않는다.
 */
import type { DataEnvironment, VerificationStatus } from "./enums";

export const VERIFICATION_PRIORITY: readonly VerificationStatus[] = [
  "VERIFIED",
  "LOG_VERIFIED",
  "COMMUNITY_SUBMITTED",
  "UNVERIFIED",
  "MOCK",
];

export function verificationRank(status: VerificationStatus): number {
  return VERIFICATION_PRIORITY.indexOf(status);
}

export interface PrioritizedCandidate {
  dataEnvironment: DataEnvironment;
  verificationStatus: VerificationStatus;
  observedAt: Date;
}

export class MixedDataEnvironmentError extends Error {
  constructor() {
    super("서로 다른 데이터 영역의 데이터는 비교할 수 없습니다.");
    this.name = "MixedDataEnvironmentError";
  }
}

/** 음수면 a가 우선. 검증 상태 → 최근 관측 순 */
export function compareCandidates(a: PrioritizedCandidate, b: PrioritizedCandidate): number {
  const byStatus = verificationRank(a.verificationStatus) - verificationRank(b.verificationStatus);
  if (byStatus !== 0) return byStatus;
  return b.observedAt.getTime() - a.observedAt.getTime();
}

/** 가장 우선하는 데이터. 후보가 없으면 null. 영역이 섞여 있으면 예외 */
export function selectPreferred<T extends PrioritizedCandidate>(candidates: readonly T[]): T | null {
  if (candidates.length === 0) return null;
  const env = candidates[0]!.dataEnvironment;
  if (candidates.some((c) => c.dataEnvironment !== env)) throw new MixedDataEnvironmentError();
  return [...candidates].sort(compareCandidates)[0]!;
}
