/**
 * 홈 기능 미리보기(DEMO) 종족 초상화 목록
 *
 * - 이미지는 public/demo/races/에 로컬 파일로만 둔다(외부 URL을 쓰지 않음).
 * - 출처와 라이선스를 확인한 파일만 등록한다. 등록하지 않은 종족은 null이며, 화면은 이미지 없이 빈 초상화 틀만 보여 준다
 *   (깨진 이미지·이니셜·임의 그림으로 대신하지 않는다. 종족 이름은 항상 텍스트로 함께 표시한다).
 * - Blizzard 게임 원본 이미지는 Blizzard 팬 사이트 정책 원문으로 허용 범위를 확인한 경우에만 등록한다. 다른 사이트가 만들거나 편집한 이미지는 허락 없이 넣지 않는다.
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

export const DEMO_RACE_PORTRAITS: Record<DemoRace, DemoRacePortrait | null> = {
  human: null,
  dwarf: null,
  nightElf: null,
  gnome: null,
  orc: null,
  undead: null,
  tauren: null,
  troll: null,
};

export function demoRacePortraitSrc(race: DemoRace, portraits = DEMO_RACE_PORTRAITS): string | null {
  const entry = portraits[race];
  return entry ? `${DEMO_RACE_PORTRAIT_DIR}/${entry.file}` : null;
}
