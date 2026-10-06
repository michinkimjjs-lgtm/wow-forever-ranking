/**
 * 장비 레벨 계산 (명세서 §9.1, §9.2, §9.4)
 *
 * Gear Profile의 설정만 따른다. 슬롯 목록이나 정책을 이 파일에 하드코딩하지 않는다.
 */
import type { GearProfile } from "@/lib/config";

export interface EquippedItemInput {
  /** 장착 슬롯 (Gear Profile의 표준 슬롯 코드) */
  slotCode: string;
  /** 관측된 아이템 레벨. 모르면 null */
  itemLevel: number | null;
  /** 아이템 자체의 장착 부위 코드 (양손 무기 판정용) */
  itemSlotCode: string | null;
}

export interface GearCalculation {
  /** 소수점 둘째 자리에서 반올림한 평균. 계산할 아이템이 없으면 null */
  averageItemLevel: number | null;
  highestItemLevel: number | null;
  /** 0~1. 소수점 셋째 자리에서 반올림 */
  coverage: number;
  /** 아이템 레벨을 알고 있는 장착 랭킹 대상 슬롯 수 */
  knownSlotCount: number;
  /** 예상 랭킹 대상 슬롯 수 (양손 무기 정책 반영) */
  expectedSlotCount: number;
  meetsCoverage: boolean;
  isTwoHanded: boolean;
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

export function calculateGear(profile: GearProfile, equipped: readonly EquippedItemInput[]): GearCalculation {
  const rankable = rankableSlotCodes(profile);
  const bySlot = new Map<string, EquippedItemInput>();
  for (const item of equipped) {
    if (rankable.includes(item.slotCode)) bySlot.set(item.slotCode, item);
  }

  const { policy, mainHandSlot, offHandSlot, twoHandItemSlotCodes } = profile.twoHandWeapon;
  const mainHand = bySlot.get(mainHandSlot);
  const isTwoHanded =
    mainHand?.itemSlotCode != null && twoHandItemSlotCodes.includes(mainHand.itemSlotCode);

  // 슬롯별 계산 값: number = 아이템 레벨, "empty" = 미착용, "unknown" = 장착했지만 아이템 레벨을 모름
  const slotValues = new Map<string, number | "empty" | "unknown">();
  for (const code of rankable) {
    const item = bySlot.get(code);
    slotValues.set(code, item ? (item.itemLevel ?? "unknown") : "empty");
  }

  if (isTwoHanded && rankable.includes(offHandSlot)) {
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
  let known = 0;
  let highest: number | null = null;
  for (const value of slotValues.values()) {
    if (typeof value === "number") {
      sum += value;
      denominator += 1;
      known += 1;
      highest = highest === null ? value : Math.max(highest, value);
    } else if (value === "empty" && profile.emptySlotPolicy === "COUNT_AS_ZERO") {
      denominator += 1;
    }
    // "unknown"은 계산에 넣지 않고 커버리지만 낮춘다 (명세서 §9.4)
  }

  const expected = slotValues.size;
  const coverage = expected === 0 ? 0 : roundTo(known / expected, 3);
  const { minRankableSlotRatio, minRankableSlotCount } = profile.minimumCoverage;
  const meetsCoverage =
    known > 0 &&
    (minRankableSlotRatio === undefined || coverage >= minRankableSlotRatio) &&
    (minRankableSlotCount === undefined || known >= minRankableSlotCount);

  return {
    averageItemLevel: denominator === 0 || known === 0 ? null : roundTo(sum / denominator, 2),
    highestItemLevel: highest,
    coverage,
    knownSlotCount: known,
    expectedSlotCount: expected,
    meetsCoverage,
    isTwoHanded,
  };
}
