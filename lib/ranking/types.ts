import type { DataEnvironment, DataSource, GearProfileStatus, MilestoneTimingBasis, VerificationStatus } from "@/lib/domain/enums";

/** 랭킹은 항상 하나의 dataEnvironment와 하나의 gameMode 안에서만 계산한다(명세서 §10.3). */
export interface RankingScope {
  dataEnvironment: DataEnvironment;
  gameMode: string;
}

export interface RankingFilters {
  region?: string;
  classCode?: string;
  factionCode?: string;
  guildId?: string;
  /** true면 VERIFIED, LOG_VERIFIED만 */
  verifiedOnly?: boolean;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

export interface RankingQuery {
  scope: RankingScope;
  filters?: RankingFilters;
  pagination: Pagination;
  /** 오래된 데이터 판정 기준 시각 */
  now: Date;
}

export interface RankingRow {
  /** 서버가 계산한 순위 */
  rank: number;
  characterId: string;
  characterName: string;
  slug: string;
  region: string;
  gameMode: string;
  level: number;
  classCode: string | null;
  raceCode: string | null;
  factionCode: string | null;
  guild: { id: string; name: string; slug: string } | null;
  averageItemLevel: number | null;
  highestItemLevel: number | null;
  highestItemName: string | null;
  currentLevelReachedAt: Date | null;
  currentLevelTimingBasis: MilestoneTimingBasis | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  dataSource: DataSource;
  verificationStatus: VerificationStatus;
}

export interface RankingPolicy {
  staleAfterDays: number;
  gearProfile: { id: string; version: number; status: GearProfileStatus } | null;
}

export type RankingResult =
  | {
      status: "ok";
      rows: RankingRow[];
      total: number;
      /** 랭킹 대상 데이터 중 가장 최근 관측 시각 */
      lastUpdatedAt: Date | null;
      policy: RankingPolicy;
    }
  | {
      status: "unavailable";
      reason: "GEAR_PROFILE_NOT_APPROVED";
      policy: RankingPolicy;
    };

export type RankingType = "level" | "gear" | "highest-item";
