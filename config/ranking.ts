/**
 * 랭킹 정책 설정 (명세서 §10, §25)
 */
import type { RankingConfigInput } from "@/lib/config/schema";

export const rankingConfig: RankingConfigInput = {
  staleAfterDays: { mock: 7, beta: 7, live: 7 },
  allowedVerificationStatuses: {
    mock: ["MOCK"],
    beta: ["VERIFIED", "LOG_VERIFIED", "COMMUNITY_SUBMITTED", "UNVERIFIED"],
    live: ["VERIFIED", "LOG_VERIFIED", "COMMUNITY_SUBMITTED", "UNVERIFIED"],
  },
  defaultPageSize: 50,
  maxPageSize: 100,
  snapshotHeartbeatHours: 24,
};
