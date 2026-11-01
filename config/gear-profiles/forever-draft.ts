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
 * 버전 2 (2026-11-01, 초안 검토): WoW: Forever 실제 아이템으로 만든 예시 장비 14명으로 계산해 본 결과를 반영했다(docs/GEAR-PROFILE.md §6).
 * - 최소 커버리지를 "랭킹 대상 칸의 75%"에서 "유효 아이템 10개 이상"으로 바꿨다.
 *   레벨업 중인 캐릭터는 장신구·목 등이 실제로 비어 있는 경우가 많아, 비율 기준은 정상 장비를 "정보 부족"으로 빼 버린다.
 *   개수 기준은 무기 하나만 담긴 것 같은 일부만 기록된 제출을 막는 목적을 그대로 지킨다.
 * - 원거리 칸은 랭킹 대상으로 유지한다(클래식 캐릭터 창의 장비 칸, 사냥꾼의 주 무기). 개수 기준이라 원거리 무기가 없는 직업도 불리하지 않다.
 *
 * 승인 전에 확인할 것 (Runtime verification required)
 * - 실제 export의 clientAverageItemLevel.equipped(게임이 계산한 값)와 이 프로필의 계산 결과 비교 → 원거리·빈 칸·양손 무기 처리 확정
 * - 양손 무기를 들었을 때 보조 무기 슬롯이 비는지, 계산 방식(COUNT_ONCE 유지 여부)
 * - 양손 무기를 판별할 아이템 분류 값(Enum.InventoryType) → config/export-mapping.ts
 * - 최소 유효 아이템 개수(10)가 실제 제출 데이터에서 적절한지
 */
import type { GearProfileInput } from "@/lib/config/schema";

export const foreverDraftGearProfile: GearProfileInput = {
  id: "forever-draft",
  version: 2,
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
  // 유효 아이템 10개 이상 (v1: 랭킹 대상 칸의 75% 이상). 근거: docs/GEAR-PROFILE.md §6
  minimumCoverage: { minRankableSlotCount: 10 },
  highestItemRequiresCoverage: true,
  itemLevelBounds: { min: 1 },
  calculation: { method: "MEAN_OF_RANKABLE_EQUIPPED", version: 1 },
};
