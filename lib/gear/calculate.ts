/**
 * 장비 레벨 계산 (명세서 §9.1, §9.2, §9.4, docs/GEAR-PROFILE.md)
 *
 * Gear Profile의 설정만 따른다. 슬롯 목록이나 정책을 이 파일에 하드코딩하지 않는다.
 *
 * 규칙
 * - 빈 슬롯: 평균 계산에 넣지 않는다 (EXCLUDE_FROM_DENOMINATOR). coverage는 낮아진다.
 * - 제외 슬롯 / 랭킹 대상이 아닌 슬롯 / 프로필에 없는 슬롯: 계산하지 않고 excludedSlots에 기록한다.
 * - 잘못된 아이템 레벨(null, 숫자가 아님, NaN, 무한대, 범위 밖): 계산하지 않고 coverage만 낮춘다.
 * - 양손 무기: 프로필 정책을 따른다. 기본(COUNT_ONCE)은 한 번만 세고 보조 무기 슬롯을 분모에서 뺀다.
 * - coverage가 최소 기준보다 낮으면 status = INSUFFICIENT_COVERAGE. 랭킹은 이 결과를 쓰지 않는다.
 */
import type { GearProfile } from "@/lib/config";
import type { GearCalculationMethod } from "@/lib/domain/enums";

export interface GearItemInput {
  /** 장착 슬롯 (Gear Profile의 슬롯 코드) */
  slotCode: string;
  /** 관측된 아이템 레벨. 검증 전 값이므로 unknown으로 받는다. */
  itemLevel: unknown;
  /** 아이템 자체의 장착 부위 코드 (양손 무기 판정용) */
  itemSlotCode?: string | null;
}

export type GearExclusionReason =
  | "EXCLUDED_BY_PROFILE"
  | "NOT_RANKABLE"
  | "UNKNOWN_SLOT"
  | "INVALID_ITEM_LEVEL"
  | "DUPLICATE_SLOT"
  | "OFFHAND_WITH_TWO_HAND";

export type GearCalculationStatus = "OK" | "INSUFFICIENT_COVERAGE" | "NO_GEAR_DATA";

export interface EquippedItemLevelResult {
  profileId: string;
  profileVersion: number;
  calculationMethod: GearCalculationMethod;
  calculationVersion: number;
  /** 소수점 둘째 자리에서 반올림한 평균. 계산할 아이템이 없으면 null */
  averageItemLevel: number | null;
  highestItemLevel: number | null;
  /** 아이템 레벨이 유효한, 장착된 랭킹 대상 슬롯 수 */
  equippedItemCount: number;
  /** 예상 랭킹 대상 슬롯 수 (양손 무기 정책 반영) */
  expectedItemCount: number;
  /** equippedItemCount / expectedItemCount. 소수점 셋째 자리에서 반올림 */
  coverage: number;
  meetsCoverage: boolean;
  status: GearCalculationStatus;
  isTwoHanded: boolean;
  /** 계산에서 뺀 슬롯과 이유 */
  excludedSlots: { slotCode: string; reason: GearExclusionReason }[];
}

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function rankableSlotCodes(profile: GearProfile): string[] {
  return profile.slots
    .filter((s) => s.rankable && !profile.excludedSlots.includes(s.code))
    .map((s) => s.code);
}

export function isValidItemLevel(value: unknown, profile: GearProfile): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  const { min, max } = profile.itemLevelBounds;
  return value >= min && (max === undefined || value <= max);
}

export function calculateEquippedItemLevel(
  gear: readonly GearItemInput[],
  profile: GearProfile,
): EquippedItemLevelResult {
  const rankable = rankableSlotCodes(profile);
  const knownSlots = new Set(profile.slots.map((s) => s.code));
  const excludedSlots: EquippedItemLevelResult["excludedSlots"] = [];
  const bySlot = new Map<string, GearItemInput>();
  const seen = new Set<string>();

  for (const item of gear) {
    if (seen.has(item.slotCode)) {
      excludedSlots.push({ slotCode: item.slotCode, reason: "DUPLICATE_SLOT" });
      continue;
    }
    seen.add(item.slotCode);
    if (profile.excludedSlots.includes(item.slotCode)) {
      excludedSlots.push({ slotCode: item.slotCode, reason: "EXCLUDED_BY_PROFILE" });
    } else if (!knownSlots.has(item.slotCode)) {
      excludedSlots.push({ slotCode: item.slotCode, reason: "UNKNOWN_SLOT" });
    } else if (!rankable.includes(item.slotCode)) {
      excludedSlots.push({ slotCode: item.slotCode, reason: "NOT_RANKABLE" });
    } else {
      bySlot.set(item.slotCode, item);
    }
  }

  const { policy, mainHandSlot, offHandSlot, twoHandItemSlotCodes } = profile.twoHandWeapon;
  const mainHand = bySlot.get(mainHandSlot);
  const isTwoHanded = mainHand?.itemSlotCode != null && twoHandItemSlotCodes.includes(mainHand.itemSlotCode);

  // 슬롯별 값: number = 유효한 아이템 레벨, "empty" = 미착용, "invalid" = 장착했지만 아이템 레벨이 잘못됨
  const slotValues = new Map<string, number | "empty" | "invalid">();
  for (const code of rankable) {
    const item = bySlot.get(code);
    if (!item) {
      slotValues.set(code, "empty");
    } else if (isValidItemLevel(item.itemLevel, profile)) {
      slotValues.set(code, item.itemLevel);
    } else {
      slotValues.set(code, "invalid");
      excludedSlots.push({ slotCode: code, reason: "INVALID_ITEM_LEVEL" });
    }
  }

  if (isTwoHanded && rankable.includes(offHandSlot)) {
    if (bySlot.has(offHandSlot)) {
      excludedSlots.push({ slotCode: offHandSlot, reason: "OFFHAND_WITH_TWO_HAND" });
    }
    const mainValue = slotValues.get(mainHandSlot);
    if (policy === "COUNT_ONCE") {
      slotValues.delete(offHandSlot);
    } else if (policy === "COUNT_TWICE") {
      slotValues.set(offHandSlot, mainValue ?? "empty");
    } else {
      slotValues.set(offHandSlot, "empty");
    }
  }

  let sum = 0;
  let denominator = 0;
  let equipped = 0;
  let highest: number | null = null;
  for (const value of slotValues.values()) {
    if (typeof value === "number") {
      sum += value;
      denominator += 1;
      equipped += 1;
      highest = highest === null ? value : Math.max(highest, value);
    } else if (value === "empty" && profile.emptySlotPolicy === "COUNT_AS_ZERO") {
      denominator += 1;
    }
    // "invalid"는 평균에 넣지 않고 coverage만 낮춘다.
  }

  const expected = slotValues.size;
  const coverage = expected === 0 ? 0 : roundTo(equipped / expected, 3);
  const { minRankableSlotRatio, minRankableSlotCount } = profile.minimumCoverage;
  const meetsCoverage =
    equipped > 0 &&
    (minRankableSlotRatio === undefined || coverage >= minRankableSlotRatio) &&
    (minRankableSlotCount === undefined || equipped >= minRankableSlotCount);

  return {
    profileId: profile.id,
    profileVersion: profile.version,
    calculationMethod: profile.calculation.method,
    calculationVersion: profile.calculation.version,
    averageItemLevel: denominator === 0 || equipped === 0 ? null : roundTo(sum / denominator, 2),
    highestItemLevel: highest,
    equippedItemCount: equipped,
    expectedItemCount: expected,
    coverage,
    meetsCoverage,
    status: equipped === 0 ? "NO_GEAR_DATA" : meetsCoverage ? "OK" : "INSUFFICIENT_COVERAGE",
    isTwoHanded,
    excludedSlots,
  };
}

// ---------------------------------------------------------------------------
// Phase 1 호환용 래퍼 (기존 호출부·테스트용)
// ---------------------------------------------------------------------------

export interface EquippedItemInput {
  slotCode: string;
  itemLevel: number | null;
  itemSlotCode: string | null;
}

export interface GearCalculation {
  averageItemLevel: number | null;
  highestItemLevel: number | null;
  coverage: number;
  knownSlotCount: number;
  expectedSlotCount: number;
  meetsCoverage: boolean;
  isTwoHanded: boolean;
}

/** @deprecated calculateEquippedItemLevel을 사용한다. */
export function calculateGear(profile: GearProfile, equipped: readonly EquippedItemInput[]): GearCalculation {
  const result = calculateEquippedItemLevel(equipped, profile);
  return {
    averageItemLevel: result.averageItemLevel,
    highestItemLevel: result.highestItemLevel,
    coverage: result.coverage,
    knownSlotCount: result.equippedItemCount,
    expectedSlotCount: result.expectedItemCount,
    meetsCoverage: result.meetsCoverage,
    isTwoHanded: result.isTwoHanded,
  };
}
