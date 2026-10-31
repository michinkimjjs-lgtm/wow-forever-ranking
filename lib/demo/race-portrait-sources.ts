/**
 * 홈 DEMO 종족 초상화 수집 대상 (scripts/collect-race-portraits.ts)
 *
 * - 8종 종족 얼굴 이미지만 대상이다. 사이트 전체를 수집하지 않는다.
 * - 이미지 주소·권리자·이용 조건은 사람이 원문을 확인해 채운다. rights.status가 CONFIRMED인 항목만 내려받는다.
 * - 2026-10-31: 작업 환경 네트워크 정책이 wowf.io·blizzard.com 접속을 막아 아직 확인하지 못했다(docs/DEMO-RACE-PORTRAITS.md).
 *   그래서 모든 항목이 UNVERIFIED이고 주소가 비어 있다. 추측한 주소를 넣지 않는다.
 */
import type { ImageSource } from "@/lib/image-collector/collector";
import type { DemoRace } from "./home-preview-fixture";

const unverified = (key: DemoRace, file: string): ImageSource => ({
  key,
  file,
  pageUrl: null,
  imageUrl: null,
  allowedHosts: [],
  rights: { status: "UNVERIFIED", holder: null, terms: null, evidenceUrl: null, nonCommercialUse: null, attribution: null, checkedAt: null },
  minSize: 64,
});

export const RACE_PORTRAIT_SOURCES: readonly ImageSource[] = [
  unverified("human", "human.webp"),
  unverified("dwarf", "dwarf.webp"),
  unverified("nightElf", "night-elf.webp"),
  unverified("gnome", "gnome.webp"),
  unverified("orc", "orc.webp"),
  unverified("undead", "undead.webp"),
  unverified("tauren", "tauren.webp"),
  unverified("troll", "troll.webp"),
];
