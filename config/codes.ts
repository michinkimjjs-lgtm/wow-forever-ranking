/**
 * 직업 / 종족 / 진영 / 아이템 품질 코드 (명세서 §25)
 *
 * WoW: Forever의 실제 목록은 아직 확인되지 않았다(명세서 §30-9).
 * 아래 mock 목록은 개발용 임시 값이다. 한국어 이름은 locales/ko/game.ts에서 표시한다.
 */
import type { CodesConfigInput } from "@/lib/config/schema";

export const codesConfig: CodesConfigInput = {
  mock: {
    factions: ["alliance", "horde"],
    classes: ["warrior", "paladin", "hunter", "rogue", "priest", "shaman", "mage", "warlock", "druid"],
    races: [
      { code: "human", faction: "alliance" },
      { code: "dwarf", faction: "alliance" },
      { code: "night_elf", faction: "alliance" },
      { code: "gnome", faction: "alliance" },
      { code: "orc", faction: "horde" },
      { code: "undead", faction: "horde" },
      { code: "tauren", faction: "horde" },
      { code: "troll", faction: "horde" },
    ],
    qualities: ["poor", "common", "uncommon", "rare", "epic"],
  },
  beta: null,
  live: null,
};
