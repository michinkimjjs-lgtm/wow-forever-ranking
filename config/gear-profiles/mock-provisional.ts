/**
 * mock 전용 임시 Gear Profile (명세서 §9.4, §9.5)
 *
 * 슬롯 목록과 계산 정책은 개발용 가정이며 실제 WoW: Forever 규칙이 아니다.
 * beta / live에는 적용되지 않는다.
 */
import type { GearProfileInput } from "@/lib/config/schema";

export const mockProvisionalGearProfile: GearProfileInput = {
  id: "mock-provisional",
  version: 1,
  status: "PROVISIONAL",
  appliesTo: { dataEnvironments: ["mock"], gameModes: ["*"], sourceBuilds: ["*"] },
  slots: [
    { code: "head", rankable: true, group: "armor", displayOrder: 1 },
    { code: "neck", rankable: true, group: "jewelry", displayOrder: 2 },
    { code: "shoulder", rankable: true, group: "armor", displayOrder: 3 },
    { code: "back", rankable: true, group: "armor", displayOrder: 4 },
    { code: "chest", rankable: true, group: "armor", displayOrder: 5 },
    { code: "wrist", rankable: true, group: "armor", displayOrder: 6 },
    { code: "hands", rankable: true, group: "armor", displayOrder: 7 },
    { code: "waist", rankable: true, group: "armor", displayOrder: 8 },
    { code: "legs", rankable: true, group: "armor", displayOrder: 9 },
    { code: "feet", rankable: true, group: "armor", displayOrder: 10 },
    { code: "finger_1", rankable: true, group: "jewelry", displayOrder: 11 },
    { code: "finger_2", rankable: true, group: "jewelry", displayOrder: 12 },
    { code: "trinket_1", rankable: true, group: "jewelry", displayOrder: 13 },
    { code: "trinket_2", rankable: true, group: "jewelry", displayOrder: 14 },
    { code: "main_hand", rankable: true, group: "weapon", displayOrder: 15 },
    { code: "off_hand", rankable: true, group: "weapon", displayOrder: 16 },
  ],
  excludedSlots: ["shirt", "tabard"],
  twoHandWeapon: {
    policy: "COUNT_ONCE",
    mainHandSlot: "main_hand",
    offHandSlot: "off_hand",
    twoHandItemSlotCodes: ["two_hand"],
  },
  emptySlotPolicy: "EXCLUDE_FROM_DENOMINATOR",
  minimumCoverage: { minRankableSlotRatio: 0.75 },
  highestItemRequiresCoverage: true,
};
