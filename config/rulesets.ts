/**
 * WoW: Forever 공식 Ruleset(게임 규칙) (docs/RULESETS.md)
 *
 * - 코드·공개 상태는 Blizzard 공식 자료에서 확인한 내용이다(officialSources).
 * - 클라이언트 내부 Enum.GameMode 숫자(clientGameMode.value)는 확인되지 않았다. 추측해서 넣지 않는다.
 *   값을 확인하면 config/export-mapping.ts의 gameModeByActiveGameMode에도 같은 값을 넣는다.
 * - 한국어 이름은 locales/ko/game.ts의 rulesets에 있다.
 */
import type { RulesetsConfigInput } from "@/lib/config/schema";

const unknownClientValue = { value: null, status: "UNKNOWN" } as const;

export const rulesetsConfig: RulesetsConfigInput = {
  rulesets: [
    {
      code: "normal",
      publicStatus: "AVAILABLE",
      clientGameMode: unknownClientValue,
      factionRule: "BOTH_FACTIONS",
      evidence: ["choose-your-ruleset"],
    },
    {
      code: "pvp",
      publicStatus: "AVAILABLE",
      clientGameMode: unknownClientValue,
      // 공식 자료: PvP 규칙에서 한 진영 캐릭터를 만들면 다른 진영 캐릭터를 만들 수 없다.
      factionRule: "SINGLE_FACTION_PER_ACCOUNT",
      evidence: ["choose-your-ruleset"],
    },
    {
      code: "roleplaying",
      publicStatus: "AVAILABLE",
      clientGameMode: unknownClientValue,
      factionRule: "BOTH_FACTIONS",
      evidence: ["choose-your-ruleset"],
    },
    {
      code: "hardcore",
      // 공식 자료: 하드코어는 출시 시점이 아니라 출시 후 제공된다.
      publicStatus: "POST_LAUNCH",
      clientGameMode: unknownClientValue,
      factionRule: "BOTH_FACTIONS",
      evidence: ["choose-your-ruleset"],
    },
  ],
  officialSources: [
    {
      id: "choose-your-ruleset",
      title: "Choose Your Ruleset in World of Warcraft: Forever",
      url: "https://news.blizzard.com/en-us/article/24302070/choose-your-ruleset-in-world-of-warcraft-forever",
      checkedAt: "2026-10-07",
      finding:
        "규칙 4종(Normal, PvP, Roleplaying, Hardcore). Hardcore는 출시 후 제공. 규칙 간 파티·던전·공격대 불가. PvP 규칙은 계정당 한 진영.",
    },
    {
      id: "create-a-name",
      title: "Create a Name of Your Own in WoW: Forever",
      url: "https://news.blizzard.com/en-us/article/24304161/create-a-name-of-your-own-in-wow-forever",
      checkedAt: "2026-10-07",
      finding: "realm 없는 구조. 이름 + 성(두 이름) 체계이며, 전체 이름이 region 안에서 고유하다. 첫 이름은 다른 캐릭터와 같을 수 있다.",
    },
    {
      id: "deep-dive-panel",
      title: "World of Warcraft: Forever Deep Dive Panel Recap",
      url: "https://news.blizzard.com/en-us/article/24303313/world-of-warcraft-forever-deep-dive-panel-recap",
      checkedAt: "2026-10-07",
      finding: "게임 시스템 소개(캠핑, 전문 기술, Legacy 시스템, 비행 탈것·레벨 스케일링 없음). Ruleset 내부 값이나 API 정보는 없음.",
    },
  ],
};
