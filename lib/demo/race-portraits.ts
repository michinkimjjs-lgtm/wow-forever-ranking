/**
 * 홈 기능 미리보기(DEMO) 종족 초상화 목록
 *
 * - 이미지는 public/demo/races/에 로컬 파일로만 둔다(외부 URL을 쓰지 않음).
 * - 출처와 라이선스를 확인한 파일만 등록한다. 등록하지 않은 종족은 null이며, 화면은 이미지 없이 빈 초상화 틀만 보여 준다
 *   (깨진 이미지·이니셜·임의 그림으로 대신하지 않는다. 종족 이름은 항상 텍스트로 함께 표시한다).
 * - Blizzard 게임 원본 이미지는 Blizzard 팬 사이트 정책 원문으로 허용 범위를 확인한 경우에만 등록한다(2026-10-31 확인). 다른 사이트가 만들거나 편집한 이미지는 허락 없이 넣지 않는다.
 * - 등록 절차와 필요한 이미지 목록: docs/DEMO-RACE-PORTRAITS.md
 */
import type { DemoRace } from "./home-preview-fixture";

export const DEMO_RACE_PORTRAIT_DIR = "/demo/races";

export interface DemoRacePortrait {
  /** public/demo/races/ 안의 파일 이름 (예: orc.webp) */
  file: string;
  /** 원본 위치 또는 제작 경위 */
  source: string;
  /** 제작자 */
  author: string;
  /** 라이선스 (예: CC BY 4.0, CC0, 직접 제작·사용 허락) */
  license: string;
}

/**
 * World of Warcraft 게임 아이콘(achievement_character_*_male). 권리자는 Blizzard Entertainment.
 * WOWF.IO 에셋 서버의 아이콘 묶음(스프라이트)에서 해당 칸(56×56)을 잘라 픽셀 변경 없이 무손실 WebP로 저장했다.
 * Blizzard 법률 FAQ의 팬사이트 이미지 사용 조건(비상업, 고지 유지, 변경 금지, 철회 가능)에 따라 쓴다(docs/DEMO-RACE-PORTRAITS.md).
 */
const blizzardIcon = (file: string, iconId: string): DemoRacePortrait => ({
  file,
  source: `World of Warcraft 게임 아이콘 ${iconId} (WOWF.IO 에셋 서버 경유: https://wowf-assets.t3.tigrisfiles.io/sprites/common.26c420c8c4.svg#races-${iconId})`,
  author: "Blizzard Entertainment, Inc.",
  license: "Blizzard 법률 FAQ 팬사이트 이미지 사용 조건 (비상업·고지 유지·변경 금지·철회 가능)",
});

export const DEMO_RACE_PORTRAITS: Record<DemoRace, DemoRacePortrait | null> = {
  human: blizzardIcon("human.webp", "achievement_character_human_male"),
  dwarf: blizzardIcon("dwarf.webp", "achievement_character_dwarf_male"),
  nightElf: blizzardIcon("night-elf.webp", "achievement_character_nightelf_male"),
  gnome: blizzardIcon("gnome.webp", "achievement_character_gnome_male"),
  orc: blizzardIcon("orc.webp", "achievement_character_orc_male"),
  undead: blizzardIcon("undead.webp", "achievement_character_undead_male"),
  tauren: blizzardIcon("tauren.webp", "achievement_character_tauren_male"),
  troll: blizzardIcon("troll.webp", "achievement_character_troll_male"),
};

export function demoRacePortraitSrc(race: DemoRace, portraits = DEMO_RACE_PORTRAITS): string | null {
  const entry = portraits[race];
  return entry ? `${DEMO_RACE_PORTRAIT_DIR}/${entry.file}` : null;
}
