/**
 * Blizzard 출처 데이터의 30일 보존 판단 (docs/DATA-COLLECTION-STRATEGY.md §4)
 *
 * 판단만 한다. 실제 삭제·숨김 실행은 하지 않는다.
 * 프로젝트 규칙("캐릭터·스냅샷·milestone을 삭제하지 않는다")과 Blizzard 정책이 부딪히는 부분은
 * Blizzard 출처 데이터에만 적용하며, 실행 방식은 문서 §4.3의 결정이 끝난 뒤 구현한다.
 */
import type { BlizzardDataPolicy } from "@/config/blizzard/data-policy";
import type { DataSource } from "@/lib/domain/enums";

const DAY_MS = 86_400_000;

export type RetentionAction =
  /** 보존 기간 안. 그대로 둔다 */
  | "KEEP"
  /** 다시 받기 대상 */
  | "REFRESH"
  /** 보존 기간이 지났다. 다시 받기 전까지 Blizzard 출처 값을 쓰지 말고 삭제 대상으로 처리한다 */
  | "PURGE";

export interface RetentionInput {
  dataSource: DataSource;
  /** Blizzard에서 마지막으로 받은 시각 (없으면 받은 적 없음) */
  lastFetchedAt: Date | null;
}

export interface RetentionDecision {
  action: RetentionAction;
  /** 다시 받기를 시작할 시각 */
  refreshDueAt: Date | null;
  /** 이 시각까지 다시 받지 못하면 삭제 대상 */
  expiresAt: Date | null;
}

export function decideRetention(input: RetentionInput, now: Date, policy: BlizzardDataPolicy): RetentionDecision {
  // 30일 정책은 Blizzard에서 받은 데이터에만 적용한다. 사용자 제출·애드온 데이터는 별도 정책(삭제 요청)을 따른다.
  if (input.dataSource !== "blizzard" || input.lastFetchedAt === null) {
    return { action: "KEEP", refreshDueAt: null, expiresAt: null };
  }
  const { refreshAfterDays, maxRetentionDays } = policy.retention;
  const refreshDueAt = new Date(input.lastFetchedAt.getTime() + refreshAfterDays * DAY_MS);
  const expiresAt = new Date(input.lastFetchedAt.getTime() + maxRetentionDays * DAY_MS);
  const action: RetentionAction = now >= expiresAt ? "PURGE" : now >= refreshDueAt ? "REFRESH" : "KEEP";
  return { action, refreshDueAt, expiresAt };
}

/** 캐릭터 상태 확인(character_status) 결과 */
export type StatusCheckResult =
  | { kind: "FOUND"; externalId: string | null }
  | { kind: "NOT_FOUND" }
  | { kind: "ERROR" };

export type StatusCheckAction =
  /** 같은 캐릭터가 있다. 다시 받고 보존 기간을 새로 시작한다 */
  | "REFRESH"
  /** 캐릭터가 없거나 다른 캐릭터로 바뀌었다(삭제 후 이름 재사용 등). Blizzard 출처 값을 삭제 대상으로 처리한다 */
  | "PURGE"
  /** 일시 오류. 보존 기간 안에서 다시 시도한다 */
  | "RETRY";

export function decideOnStatusCheck(storedExternalId: string | null, result: StatusCheckResult): StatusCheckAction {
  if (result.kind === "ERROR") return "RETRY";
  if (result.kind === "NOT_FOUND") return "PURGE";
  if (storedExternalId !== null && result.externalId !== null && storedExternalId !== result.externalId) return "PURGE";
  return "REFRESH";
}
