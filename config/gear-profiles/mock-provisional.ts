/**
 * mock 전용 임시 Gear Profile (명세서 §9.4, §9.5, docs/GEAR-PROFILE.md)
 *
 * 슬롯 목록과 계산 정책은 개발용 가정이며 실제 WoW: Forever 규칙이 아니다.
 * 상태는 DRAFT이고 mock 영역에만 적용된다. (mock 영역은 DRAFT 프로필로도 랭킹을 계산할 수 있다)
 * id는 저장된 mock 데이터와의 호환을 위해 유지한다.
 */
import type { GearProfileInput } from "@/lib/config/schema";

export const mockProvisionalGearProfile: GearProfileInput = {
  id: "mock-provisional",
  version: 1,
  status: "DRAFT",
  appliesTo: { dataEnvironments: ["mock"], gameModes: ["*"], sourceBuilds: ["*"] },
  slots: [
    { code: "head", clientSlotName: "HeadSlot", rankable: true, group: "armor", displayOrder: 1 },
    { code: "neck", clientSlotName: "NeckSlot", rankable: true, group: "jewelry", displayOrder: 2 },
    { code: "shoulder", clientSlotName: "ShoulderSlot", rankable: true, group: "armor", displayOrder: 3 },
    { code: "back", clientSlotName: "BackSlot", rankable: true, group: "armor", displayOrder: 4 },
    { code: "chest", clientSlotName: "ChestSlot", rankable: true, group: "armor", displayOrder: 5 },
    { code: "wrist", clientSlotName: "WristSlot", rankable: true, group: "armor", displayOrder: 6 },
    { code: "hands", clientSlotName: "HandsSlot", rankable: true, group: "armor", displayOrder: 7 },
    { code: "waist", clientSlotName: "WaistSlot", rankable: true, group: "armor", displayOrder: 8 },
    { code: "legs", clientSlotName: "LegsSlot", rankable: true, group: "armor", displayOrder: 9 },
    { code: "feet", clientSlotName: "FeetSlot", rankable: true, group: "armor", displayOrder: 10 },
    { code: "finger_1", clientSlotName: "Finger0Slot", rankable: true, group: "jewelry", displayOrder: 11 },
    { code: "finger_2", clientSlotName: "Finger1Slot", rankable: true, group: "jewelry", displayOrder: 12 },
    { code: "trinket_1", clientSlotName: "Trinket0Slot", rankable: true, group: "jewelry", displayOrder: 13 },
    { code: "trinket_2", clientSlotName: "Trinket1Slot", rankable: true, group: "jewelry", displayOrder: 14 },
    { code: "main_hand", clientSlotName: "MainHandSlot", rankable: true, group: "weapon", displayOrder: 15 },
    { code: "off_hand", clientSlotName: "SecondaryHandSlot", rankable: true, group: "weapon", displayOrder: 16 },
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
  itemLevelBounds: { min: 1 },
  calculation: { method: "MEAN_OF_RANKABLE_EQUIPPED", version: 1 },
};
