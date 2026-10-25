/**
 * 정기 갱신 계획: 호출 한도 안에서 어떤 캐릭터를 먼저 다시 받을지 (docs/DATA-COLLECTION-STRATEGY.md §4.2)
 *
 * - 보존 기간 만료가 가까운 캐릭터부터 고른다. 받은 적 없는 후보는 그다음.
 * - 한도를 넘는 후보는 다음 회차로 미루고, 미루면 만료되는 캐릭터는 atRisk로 알려 준다(운영자 확인용).
 * 실제 호출은 하지 않는다. 공식 API가 공개되고 capability가 AVAILABLE이 된 뒤 작업 큐에서 쓴다.
 */
import type { BlizzardDataPolicy } from "@/config/blizzard/data-policy";
import { decideRetention } from "./retention";

export interface RefreshCandidate {
  characterId: string;
  /** Blizzard에서 마지막으로 받은 시각. 받은 적 없으면 null(새로 발견한 캐릭터) */
  lastFetchedAt: Date | null;
}

export interface RefreshPlanInput {
  candidates: readonly RefreshCandidate[];
  now: Date;
  /** 이번 회차 길이(분). 다음 회차는 이만큼 뒤에 실행된다 */
  windowMinutes: number;
  /** 캐릭터 하나를 다시 받는 데 필요한 호출 수 (프로필·장비·상태 등) */
  callsPerCharacter: number;
  policy: BlizzardDataPolicy;
}

export interface RefreshPlan {
  budget: number;
  selected: string[];
  deferred: string[];
  /** 미루면 다음 회차 전에 보존 기간이 끝나는 캐릭터 */
  atRisk: string[];
}

export function planRefreshBatch(input: RefreshPlanInput): RefreshPlan {
  const { policy, now } = input;
  const calls = Math.floor(policy.rateLimit.requestsPerHour * policy.rateLimit.refreshShare * (input.windowMinutes / 60));
  const budget = Math.max(0, Math.floor(calls / Math.max(1, input.callsPerCharacter)));

  const due = input.candidates
    .map((c) => ({ c, decision: c.lastFetchedAt ? decideRetention({ dataSource: "blizzard", lastFetchedAt: c.lastFetchedAt }, now, policy) : null }))
    .filter(({ decision }) => decision === null || decision.action !== "KEEP")
    .sort((a, b) => {
      const ea = a.decision?.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const eb = b.decision?.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
      return ea !== eb ? ea - eb : a.c.characterId.localeCompare(b.c.characterId);
    });

  const selected = due.slice(0, budget);
  const deferred = due.slice(budget);
  const nextRun = now.getTime() + input.windowMinutes * 60_000;
  return {
    budget,
    selected: selected.map(({ c }) => c.characterId),
    deferred: deferred.map(({ c }) => c.characterId),
    atRisk: deferred.filter(({ decision }) => decision?.expiresAt && decision.expiresAt.getTime() <= nextRun).map(({ c }) => c.characterId),
  };
}
