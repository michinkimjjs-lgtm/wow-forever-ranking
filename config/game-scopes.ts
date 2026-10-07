/**
 * 지역 / 게임 모드 / 최대 레벨 설정 (명세서 §25)
 *
 * WoW: Forever의 실제 region, gameMode 값과 최대 레벨은 아직 확인되지 않았다(명세서 §30-5,6,8).
 * beta / live 값은 확인 전까지 비워 둔다.
 * beta / live의 gameMode 코드는 공식 Ruleset 코드(normal, pvp, roleplaying, hardcore)여야 한다(docs/RULESETS.md).
 * Ruleset은 공식 자료로 확인됐지만 region 값과 영역별 제공 여부는 아직 확인되지 않아 null을 유지한다.
 * mock 값은 개발용 임시 값이며 실제 게임 구조를 뜻하지 않는다.
 */
import type { GameScopesConfigInput } from "@/lib/config/schema";

export const gameScopesConfig: GameScopesConfigInput = {
  mock: {
    regions: [{ code: "kr" }],
    gameModes: [
      // mock 개발용 코드. 화면의 Ruleset 필터를 확인하기 위해 공식 Ruleset에 연결한다(테스트 데이터).
      { code: "standard", maxLevel: 30, ruleset: "normal" },
      { code: "alternate", maxLevel: 30, ruleset: "pvp" },
    ],
    defaultRegion: "kr",
    defaultGameMode: "standard",
  },
  beta: null,
  live: null,
};
