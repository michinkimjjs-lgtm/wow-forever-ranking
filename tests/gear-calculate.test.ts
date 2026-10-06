import { describe, expect, it } from "vitest";
import { loadConfig, type GearProfile } from "@/lib/config";
import { calculateGear, type EquippedItemInput } from "@/lib/gear/calculate";

const baseProfile = loadConfig().gearProfiles.find((p) => p.id === "mock-provisional")!;
const profile = (overrides: Partial<GearProfile> = {}): GearProfile => ({ ...baseProfile, ...overrides });

const ALL = baseProfile.slots.map((s) => s.code);
function equip(
  level: number,
  opts: { twoHand?: boolean; skip?: string[]; extra?: EquippedItemInput[] } = {},
): EquippedItemInput[] {
  const base: EquippedItemInput[] = ALL.filter((s) => !(opts.skip ?? []).includes(s))
    .filter((s) => !(opts.twoHand && s === "off_hand"))
    .map((slotCode) => ({
      slotCode,
      itemLevel: level,
      itemSlotCode: slotCode === "main_hand" ? (opts.twoHand ? "two_hand" : "one_hand") : slotCode,
    }));
  return [...base, ...(opts.extra ?? [])];
}

describe("장비 레벨 계산 (Gear Profile)", () => {
  it("랭킹 대상 슬롯 평균을 소수점 둘째 자리로 계산한다", () => {
    const items = equip(20).map((i) => (i.slotCode === "head" ? { ...i, itemLevel: 27 } : i));
    const result = calculateGear(profile(), items);
    expect(result.averageItemLevel).toBe(20.44); // (20*15 + 27) / 16 = 20.4375
    expect(result.highestItemLevel).toBe(27);
    expect(result.coverage).toBe(1);
    expect(result.meetsCoverage).toBe(true);
  });

  it("제외 슬롯(셔츠)은 계산하지 않는다", () => {
    const result = calculateGear(profile(), equip(20, { extra: [{ slotCode: "shirt", itemLevel: 99, itemSlotCode: "shirt" }] }));
    expect(result.averageItemLevel).toBe(20);
    expect(result.highestItemLevel).toBe(20);
  });

  it("양손 무기 COUNT_ONCE: 보조 무기 슬롯을 분모에서 뺀다", () => {
    const result = calculateGear(profile(), equip(20, { twoHand: true }));
    expect(result.isTwoHanded).toBe(true);
    expect(result.expectedSlotCount).toBe(15);
    expect(result.coverage).toBe(1);
    expect(result.averageItemLevel).toBe(20);
  });

  it("양손 무기 COUNT_TWICE: 주 무기 레벨을 두 번 센다", () => {
    const items = equip(20, { twoHand: true }).map((i) => (i.slotCode === "main_hand" ? { ...i, itemLevel: 36 } : i));
    const p = profile({ twoHandWeapon: { ...baseProfile.twoHandWeapon, policy: "COUNT_TWICE" } });
    expect(calculateGear(p, items).averageItemLevel).toBe(22); // (20*14 + 36*2) / 16
  });

  it("양손 무기 OFFHAND_AS_EMPTY + COUNT_AS_ZERO: 보조 무기를 0으로 센다", () => {
    const p = profile({
      twoHandWeapon: { ...baseProfile.twoHandWeapon, policy: "OFFHAND_AS_EMPTY" },
      emptySlotPolicy: "COUNT_AS_ZERO",
    });
    const result = calculateGear(p, equip(16, { twoHand: true }));
    expect(result.averageItemLevel).toBe(15); // 16*15 / 16
  });

  it("빈 슬롯 EXCLUDE_FROM_DENOMINATOR와 COUNT_AS_ZERO의 차이", () => {
    const items = equip(20, { skip: ["head", "neck"] });
    expect(calculateGear(profile(), items).averageItemLevel).toBe(20);
    expect(calculateGear(profile({ emptySlotPolicy: "COUNT_AS_ZERO" }), items).averageItemLevel).toBe(17.5);
  });

  it("아이템 레벨을 모르는 아이템은 계산하지 않고 커버리지만 낮춘다", () => {
    const items = equip(20).map((i) => (i.slotCode === "head" ? { ...i, itemLevel: null } : i));
    const result = calculateGear(profile(), items);
    expect(result.averageItemLevel).toBe(20);
    expect(result.knownSlotCount).toBe(15);
    expect(result.coverage).toBe(0.938);
  });

  it("최소 커버리지에 못 미치면 meetsCoverage가 false다", () => {
    const result = calculateGear(profile(), equip(20, { skip: ["head", "neck", "shoulder", "back", "chest"] }));
    expect(result.coverage).toBe(0.688);
    expect(result.meetsCoverage).toBe(false);
  });

  it("minRankableSlotCount 기준도 적용한다", () => {
    const p = profile({ minimumCoverage: { minRankableSlotCount: 16 } });
    expect(calculateGear(p, equip(20, { skip: ["head"] })).meetsCoverage).toBe(false);
    expect(calculateGear(p, equip(20)).meetsCoverage).toBe(true);
  });

  it("장착한 아이템이 없으면 평균과 최고 아이템은 null이다", () => {
    const result = calculateGear(profile(), []);
    expect(result.averageItemLevel).toBeNull();
    expect(result.highestItemLevel).toBeNull();
    expect(result.meetsCoverage).toBe(false);
  });
});
