/**
 * 홈 DEMO 종족 초상화 수집 대상 (scripts/collect-race-portraits.ts)
 *
 * - 8종 종족 얼굴 이미지만 대상이다. 사이트 전체를 수집하지 않는다.
 * - 이미지 주소·권리자·이용 조건은 사람이 원문을 확인해 채운다. rights.status가 CONFIRMED인 항목만 내려받는다.
 * - 2026-10-31: 원본 주소와 Blizzard 법률 FAQ의 팬사이트 이미지 사용 조건을 확인해 CONFIRMED로 등록했다.
 */
import type { ImageSource } from "@/lib/image-collector/collector";
import type { DemoRace } from "./home-preview-fixture";

const SPRITE = "https://wowf-assets.t3.tigrisfiles.io/sprites/common.26c420c8c4.svg";
const FAQ = "https://www.blizzard.com/en-us/legal/28d5ebbf-c245-4408-8ba9-043dd5f056bf/legal-faq";

/**
 * 2026-10-31 확인. 이미지는 WOWF.IO 에셋 서버의 아이콘 묶음(WebP 원본 1장을 담은 SVG) 안 56×56 칸이다.
 * 이 수집기는 묶음 파일을 다루지 않으므로, 8개 파일은 묶음에서 칸을 잘라 픽셀 변경 없이 저장했다(docs/DEMO-RACE-PORTRAITS.md).
 */
const confirmed = (key: DemoRace, file: string, iconId: string): ImageSource => ({
  key,
  file,
  pageUrl: "https://wowf.io/en/level-up?f=horde&r=undead",
  imageUrl: `${SPRITE}#races-${iconId}`,
  allowedHosts: ["wowf-assets.t3.tigrisfiles.io"],
  rights: {
    status: "CONFIRMED",
    holder: "Blizzard Entertainment, Inc. (WOWF.IO About: 게임 스크린샷·아이콘·게임 데이터는 Blizzard 소유)",
    terms: "팬사이트 웹 페이지의 Blizzard 이미지 사용 허용(제한 내): 비상업적 사용, 저작권·상표 고지 유지, 변경 금지, Blizzard가 언제든 철회 가능, 부적절한 콘텐츠 사이트 금지",
    evidenceUrl: FAQ,
    nonCommercialUse: true,
    attribution: "©2004 Blizzard Entertainment, Inc. All rights reserved. World of Warcraft, Warcraft and Blizzard Entertainment are trademarks or registered trademarks of Blizzard Entertainment, Inc. in the U.S. and/or other countries.",
    checkedAt: "2026-10-31",
  },
  minSize: 56,
});

export const RACE_PORTRAIT_SOURCES: readonly ImageSource[] = [
  confirmed("human", "human.webp", "achievement_character_human_male"),
  confirmed("dwarf", "dwarf.webp", "achievement_character_dwarf_male"),
  confirmed("nightElf", "night-elf.webp", "achievement_character_nightelf_male"),
  confirmed("gnome", "gnome.webp", "achievement_character_gnome_male"),
  confirmed("orc", "orc.webp", "achievement_character_orc_male"),
  confirmed("undead", "undead.webp", "achievement_character_undead_male"),
  confirmed("tauren", "tauren.webp", "achievement_character_tauren_male"),
  confirmed("troll", "troll.webp", "achievement_character_troll_male"),
];
