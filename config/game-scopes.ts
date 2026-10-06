/**
 * 지역 / 게임 모드 / 최대 레벨 설정 (명세서 §25)
 *
 * WoW: Forever의 실제 region, gameMode 값과 최대 레벨은 아직 확인되지 않았다(명세서 §30-5,6,8).
 * beta / live 값은 확인 전까지 비워 둔다.
 * mock 값은 개발용 임시 값이며 실제 게임 구조를 뜻하지 않는다.
 */
import type { GameScopesConfigInput } from "@/lib/config/schema";

export const gameScopesConfig: GameScopesConfigInput = {
  mock: {
    regions: [{ code: "kr" }],
    gameModes: [
      { code: "standard", maxLevel: 30 },
      { code: "alternate", maxLevel: 30 },
    ],
    defaultRegion: "kr",
    defaultGameMode: "standard",
  },
  beta: null,
  live: null,
};
