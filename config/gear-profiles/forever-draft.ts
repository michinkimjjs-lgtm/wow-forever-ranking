/**
 * WoW: Forever용 Gear Profile 초안 (docs/GEAR-PROFILE.md)
 *
 * 상태: DRAFT — beta / live 랭킹에는 쓰지 않는다. (APPROVED 프로필이 없으면 "장비 랭킹 준비 중")
 *
 * 근거
 * - 슬롯 이름 20개: Forever UI 소스 Blizzard_UIPanels_Game/Camelot/PaperDollFrame.xml (1.60.1.70235)
 *   → CLIENT_SOURCE_REFERENCED (docs/FOREVER-API-CAPABILITY.md §4-2)
 * - 슬롯 번호: 클라이언트가 실행 중에 C_PaperDollInfo.GetInventorySlotInfo(slotName)로 정한다.
 *   Runtime verification required — 이 파일에 넣지 않는다.
 *
 * 승인 전에 결정할 것 (Runtime verification required)
 * - 원거리(ranged) 슬롯을 모든 직업의 랭킹 대상으로 볼지
 * - 양손 무기를 들었을 때 보조 무기 슬롯이 비는지, 계산 방식(COUNT_ONCE 유지 여부)
 * - 양손 무기를 판별할 아이템 분류 값(Enum.InventoryType)
 * - 최소 커버리지 기준
 */
import type { GearProfileInput } from "@/lib/config/schema";

export const foreverDraftGearProfile: GearProfileInput = {
  id: "forever-draft",
  version: 1,
  status: "DRAFT",
  appliesTo: { dataEnvironments: ["beta", "live"], gameModes: ["*"], sourceBuilds: ["*"] },
  slots: [
    { code: "head", clientSlotName: "HeadSlot", rankable: true, group: "armor", displayOrder: 1 },
    { code: "neck", clientSlotName: "NeckSlot", rankable: true, group: "jewelry", displayOrder: 2 },
    { code: "shoulder", clientSlotName: "ShoulderSlot", rankable: true, group: "armor", displayOrder: 3 },
    { code: "back", clientSlotName: "BackSlot", rankable: true, group: "armor", displayOrder: 4 },
    { code: "chest", clientSlotName: "ChestSlot", rankable: true, group: "armor", displayOrder: 5 },
    { code: "shirt", clientSlotName: "ShirtSlot", rankable: false, group: "cosmetic", displayOrder: 6 },
    { code: "tabard", clientSlotName: "TabardSlot", rankable: false, group: "cosmetic", displayOrder: 7 },
    { code: "wrist", clientSlotName: "WristSlot", rankable: true, group: "armor", displayOrder: 8 },
    { code: "hands", clientSlotName: "HandsSlot", rankable: true, group: "armor", displayOrder: 9 },
    { code: "waist", clientSlotName: "WaistSlot", rankable: true, group: "armor", displayOrder: 10 },
    { code: "legs", clientSlotName: "LegsSlot", rankable: true, group: "armor", displayOrder: 11 },
    { code: "feet", clientSlotName: "FeetSlot", rankable: true, group: "armor", displayOrder: 12 },
    { code: "finger_1", clientSlotName: "Finger0Slot", rankable: true, group: "jewelry", displayOrder: 13 },
    { code: "finger_2", clientSlotName: "Finger1Slot", rankable: true, group: "jewelry", displayOrder: 14 },
    { code: "trinket_1", clientSlotName: "Trinket0Slot", rankable: true, group: "jewelry", displayOrder: 15 },
    { code: "trinket_2", clientSlotName: "Trinket1Slot", rankable: true, group: "jewelry", displayOrder: 16 },
    { code: "main_hand", clientSlotName: "MainHandSlot", rankable: true, group: "weapon", displayOrder: 17 },
    { code: "off_hand", clientSlotName: "SecondaryHandSlot", rankable: true, group: "weapon", displayOrder: 18 },
    // 원거리 슬롯의 랭킹 포함 여부는 승인 전에 결정한다. (Runtime verification required)
    { code: "ranged", clientSlotName: "RangedSlot", rankable: true, group: "weapon", displayOrder: 19 },
    // 탄약은 소모품이라 장비 레벨 계산에서 뺀다.
    { code: "ammo", clientSlotName: "AmmoSlot", rankable: false, group: "other", displayOrder: 20 },
  ],
  excludedSlots: ["shirt", "tabard", "ammo"],
  twoHandWeapon: {
    // 실제 장비 데이터로 확인하기 전까지 양손 무기를 두 슬롯으로 중복 계산하지 않는다.
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
