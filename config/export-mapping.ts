/**
 * Character Export v1 값 매핑 (docs/CHARACTER-EXPORT-V1.md §6, docs/GEAR-PROFILE.md)
 *
 * 아래 값은 모두 Runtime verification required 상태라 비워 둔다.
 * - regionById: GetCurrentRegion() 번호 → region 코드
 * - gameModeByActiveGameMode: C_GameRules.GetActiveGameMode() 값(Enum.GameMode) → gameMode 코드
 * - classByFile / raceByFile / factionByTag: UnitClass·UnitRace·UnitFactionGroup의 영어 코드 → 우리 코드
 * - qualityById: Enum.ItemQuality → 품질 코드
 * - twoHandInventoryTypes: 양손 무기를 뜻하는 Enum.InventoryType 값
 * - nameSeparator: 이름과 성의 구분자 (CHARACTERNAME_SURNAME_SEPARATOR)
 *
 * 매핑이 비어 있는 동안 실제 제출은 "매핑 미확인"으로 거부된다. 값을 추정해서 채우지 않는다.
 * mock 영역은 제출을 받지 않으므로 매핑이 없다.
 */
import type { ExportMappingConfigInput } from "@/lib/config/schema";

const unconfirmed = {
  regionById: {},
  gameModeByActiveGameMode: {},
  classByFile: {},
  raceByFile: {},
  factionByTag: {},
  qualityById: {},
  twoHandInventoryTypes: [],
  nameSeparator: null,
  maxObservationAgeDays: 14,
  maxFutureSkewSeconds: 300,
} satisfies ExportMappingConfigInput["beta"];

export const exportMappingConfig: ExportMappingConfigInput = {
  beta: unconfirmed,
  live: unconfirmed,
};
