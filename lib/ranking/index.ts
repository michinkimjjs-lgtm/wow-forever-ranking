/**
 * 랭킹 엔진 진입점 (명세서 §10, CLAUDE.md §18)
 * 랭킹은 서버에서만 계산한다. UI 컴포넌트는 이 모듈을 직접 호출하지 않고 서비스 계층을 사용한다.
 */
import type { AppDatabase } from "@/db/types";
import { getGearRanking } from "./gear";
import { getHighestItemRanking } from "./highest-item";
import { getLevelRanking } from "./level";
import type { RankingQuery, RankingResult, RankingType } from "./types";

export { getLevelRanking } from "./level";
export { getGearRanking } from "./gear";
export { getHighestItemRanking } from "./highest-item";
export { getCharacterRanks, type CharacterRank, type RankExclusionReason } from "./character-ranks";
export * from "./types";

export const RANKING_TYPES: readonly RankingType[] = ["level", "gear", "highest-item"];

export function getRanking(db: AppDatabase, type: RankingType, query: RankingQuery): Promise<RankingResult> {
  switch (type) {
    case "level":
      return getLevelRanking(db, query);
    case "gear":
      return getGearRanking(db, query);
    case "highest-item":
      return getHighestItemRanking(db, query);
  }
}
