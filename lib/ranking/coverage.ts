/**
 * 데이터 커버리지 (docs/DATA-COVERAGE-MODEL.md)
 *
 * "우리가 얼마나 보고 있는가"를 숫자로 남긴다. 모집단(전체 캐릭터 수)은 공식적으로 알 수 없으므로
 * populationEstimate는 null이다. 그래서 지금은 비율(%) 커버리지를 계산하지 않는다.
 * 모든 값은 하나의 dataEnvironment + gameMode 안에서만 계산한다.
 */
import { and, count, eq, gte, max, min } from "drizzle-orm";
import { characters, ingestionRecords } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { getAllowedVerificationStatuses } from "@/lib/config";
import { dataOriginOf, type DataOrigin } from "@/lib/domain/data-origin";
import {
  DATA_SOURCES,
  VERIFICATION_STATUSES,
  VERIFIED_ONLY_STATUSES,
  type DataSource,
  type VerificationStatus,
} from "@/lib/domain/enums";
import { staleCutoff } from "./common";
import type { RankingScope } from "./types";

export interface DataCoverage {
  dataEnvironment: RankingScope["dataEnvironment"];
  gameMode: string;
  /** 이 범위에서 한 번이라도 확인한 캐릭터 */
  observedCharacters: number;
  /** 오래된 데이터 기준 안에서 확인한 캐릭터 (랭킹 후보) */
  activeCharacters: number;
  staleCharacters: number;
  /** 활성 캐릭터 중 랭킹에 포함되는 검증 상태의 캐릭터 */
  rankableCharacters: number;
  byVerification: Record<VerificationStatus, number>;
  bySource: Record<DataSource, number>;
  /** 활성 캐릭터에 나타난 출처 구분 (화면 표시용) */
  origins: DataOrigin[];
  /** (VERIFIED + LOG_VERIFIED) / 활성. 활성이 0이면 null */
  verifiedRatio: number | null;
  /** blizzard 출처 / 활성. 활성이 0이면 null */
  officialRatio: number | null;
  /** 같은 기간 식별 충돌로 기록된 수집 건수 (영역 전체) */
  identityConflicts: number;
  latestSeenAt: Date | null;
  oldestActiveSeenAt: Date | null;
  /** 모집단 추정치. 공식 근거가 없으므로 null */
  populationEstimate: number | null;
  /** 서로 다른 제출자 수. 제출자 단위 집계를 하지 않으므로 null */
  independentSubmitters: number | null;
}

function emptyRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

/** 집계 행으로 커버리지를 만든다 (DB와 분리해 테스트할 수 있게 함) */
export function buildCoverage(input: {
  scope: RankingScope;
  observedCharacters: number;
  activeGroups: { verificationStatus: VerificationStatus; dataSource: DataSource; count: number }[];
  identityConflicts: number;
  latestSeenAt: Date | null;
  oldestActiveSeenAt: Date | null;
  populationEstimate?: number | null;
  independentSubmitters?: number | null;
}): DataCoverage {
  const byVerification = emptyRecord(VERIFICATION_STATUSES);
  const bySource = emptyRecord(DATA_SOURCES);
  let active = 0;
  for (const g of input.activeGroups) {
    byVerification[g.verificationStatus] += g.count;
    bySource[g.dataSource] += g.count;
    active += g.count;
  }
  const allowed = getAllowedVerificationStatuses(input.scope.dataEnvironment);
  const rankable = allowed.reduce((sum, s) => sum + byVerification[s], 0);
  const verified = VERIFIED_ONLY_STATUSES.reduce((sum, s) => sum + byVerification[s], 0);
  const origins = [...new Set(DATA_SOURCES.filter((s) => bySource[s] > 0).map(dataOriginOf))];
  return {
    dataEnvironment: input.scope.dataEnvironment,
    gameMode: input.scope.gameMode,
    observedCharacters: input.observedCharacters,
    activeCharacters: active,
    staleCharacters: Math.max(0, input.observedCharacters - active),
    rankableCharacters: rankable,
    byVerification,
    bySource,
    origins,
    verifiedRatio: active === 0 ? null : verified / active,
    officialRatio: active === 0 ? null : bySource.blizzard / active,
    identityConflicts: input.identityConflicts,
    latestSeenAt: input.latestSeenAt,
    oldestActiveSeenAt: input.oldestActiveSeenAt,
    populationEstimate: input.populationEstimate ?? null,
    independentSubmitters: input.independentSubmitters ?? null,
  };
}

export async function getDataCoverage(db: AppDatabase, scope: RankingScope, now: Date): Promise<DataCoverage> {
  const cutoff = staleCutoff(scope, now);
  const inScope = and(eq(characters.dataEnvironment, scope.dataEnvironment), eq(characters.gameMode, scope.gameMode));
  const [[totals], groups, [conflicts], [activeRange]] = await Promise.all([
    db.select({ observed: count(), latest: max(characters.lastSeenAt) }).from(characters).where(inScope),
    db
      .select({ verificationStatus: characters.verificationStatus, dataSource: characters.dataSource, count: count() })
      .from(characters)
      .where(and(inScope, gte(characters.lastSeenAt, cutoff)))
      .groupBy(characters.verificationStatus, characters.dataSource),
    db
      .select({ n: count() })
      .from(ingestionRecords)
      .where(
        and(
          eq(ingestionRecords.dataEnvironment, scope.dataEnvironment),
          eq(ingestionRecords.status, "IDENTITY_CONFLICT"),
          gte(ingestionRecords.receivedAt, cutoff),
        ),
      ),
    db
      .select({ oldest: min(characters.lastSeenAt) })
      .from(characters)
      .where(and(inScope, gte(characters.lastSeenAt, cutoff))),
  ]);
  return buildCoverage({
    scope,
    observedCharacters: totals?.observed ?? 0,
    activeGroups: groups.map((g) => ({ ...g, count: Number(g.count) })),
    identityConflicts: conflicts?.n ?? 0,
    latestSeenAt: totals?.latest ?? null,
    oldestActiveSeenAt: activeRange?.oldest ?? null,
  });
}
