import { describe, expect, it } from "vitest";
import { loadConfig, resolveGearProfile, resolveSlotMappingProfile, type GearProfile } from "@/lib/config";
import { gearProfilesSchema } from "@/lib/config/schema";
import { calculateEquippedItemLevel, type GearItemInput } from "@/lib/gear/calculate";

const profiles = loadConfig().gearProfiles;
const mockProfile = profiles.find((p) => p.id === "mock-provisional")!;
const foreverDraft = profiles.find((p) => p.id === "forever-draft")!;

function withPolicy(base: GearProfile, overrides: Partial<GearProfile>): GearProfile {
  return { ...base, ...overrides };
}

/** foreverDraft의 랭킹 대상 슬롯 16개(주 무기 한손)를 같은 아이템 레벨로 채운다. (테스트용 가짜 장비) */
function fullGear(level: number, options: { skip?: string[]; twoHand?: boolean } = {}): GearItemInput[] {
  const codes = [
    "head", "neck", "shoulder", "back", "chest", "wrist", "hands", "waist", "legs", "feet",
    "finger_1", "finger_2", "trinket_1", "trinket_2", "main_hand", "off_hand", "ranged",
  ];
  return codes
    .filter((c) => !(options.skip ?? []).includes(c))
    .filter((c) => !(options.twoHand && c === "off_hand"))
    .map((slotCode) => ({
      slotCode,
      itemLevel: level,
      itemSlotCode: slotCode === "main_hand" ? (options.twoHand ? "two_hand" : "one_hand") : null,
    }));
}

describe("Gear Profile 설정", () => {
  it("상태는 DRAFT / APPROVED이고, 계산 방식과 버전을 가진다", () => {
    for (const p of profiles) {
      expect(["DRAFT", "APPROVED"]).toContain(p.status);
      expect(p.calculation).toEqual({ method: "MEAN_OF_RANKABLE_EQUIPPED", version: 1 });
    }
  });

  it("Forever 초안은 슬롯 이름 20개만 갖고, 슬롯 번호는 설정에 없다", () => {
    expect(foreverDraft.status).toBe("DRAFT");
    expect(foreverDraft.slots).toHaveLength(20);
    expect(foreverDraft.slots.every((s) => typeof s.clientSlotName === "string")).toBe(true);
    expect(foreverDraft.slots.some((s) => "slotId" in s || "slotNumber" in s)).toBe(false);
    expect(foreverDraft.excludedSlots).toEqual(["shirt", "tabard", "ammo"]);
    expect(foreverDraft.twoHandWeapon.policy).toBe("COUNT_ONCE");
    expect(foreverDraft.emptySlotPolicy).toBe("EXCLUDE_FROM_DENOMINATOR");
  });

  it("beta / live 랭킹은 APPROVED 프로필만 쓴다 (초안만 있으면 null → 장비 랭킹 준비 중)", () => {
    expect(resolveGearProfile("beta", "anything")).toBeNull();
    expect(resolveGearProfile("live", "anything")).toBeNull();
    expect(resolveGearProfile("mock", "standard")?.id).toBe("mock-provisional");
  });

  it("슬롯 이름 매핑에는 DRAFT 프로필도 쓴다", () => {
    expect(resolveSlotMappingProfile("beta", "anything")?.id).toBe("forever-draft");
  });

  it("설정 검증: clientSlotName 중복, 없는 양손 무기 슬롯, 잘못된 범위를 거부한다", () => {
    const base = { ...foreverDraft };
    const dupName = { ...base, id: "x1", slots: [...base.slots, { ...base.slots[0]!, code: "extra" }] };
    const badHand = { ...base, id: "x2", twoHandWeapon: { ...base.twoHandWeapon, offHandSlot: "nope" } };
    const badBounds = { ...base, id: "x3", itemLevelBounds: { min: 10, max: 5 } };
    for (const profile of [dupName, badHand, badBounds]) {
      expect(gearProfilesSchema.safeParse([profile]).success).toBe(false);
    }
  });
});

describe("calculateEquippedItemLevel", () => {
  it("정상 장비: 평균, 최고, 개수, coverage, 계산 버전", () => {
    const gear = fullGear(20).map((g) => (g.slotCode === "head" ? { ...g, itemLevel: 37 } : g));
    const r = calculateEquippedItemLevel(gear, foreverDraft);
    expect(r.averageItemLevel).toBe(21); // (20 * 16 + 37) / 17
    expect(r.highestItemLevel).toBe(37);
    expect(r.equippedItemCount).toBe(17);
    expect(r.expectedItemCount).toBe(17);
    expect(r.coverage).toBe(1);
    expect(r.status).toBe("OK");
    expect(r).toMatchObject({ profileId: "forever-draft", profileVersion: 1, calculationVersion: 1 });
  });

  it("빈 슬롯은 평균에 넣지 않고 coverage만 낮춘다", () => {
    const r = calculateEquippedItemLevel(fullGear(20, { skip: ["head", "neck"] }), foreverDraft);
    expect(r.averageItemLevel).toBe(20);
    expect(r.equippedItemCount).toBe(15);
    expect(r.expectedItemCount).toBe(17);
    expect(r.coverage).toBe(0.882);
  });

  it("제외 슬롯(셔츠, 휘장, 탄약)은 평균에서 빼고 이유를 기록한다", () => {
    const gear = [
      ...fullGear(20),
      { slotCode: "shirt", itemLevel: 99 },
      { slotCode: "tabard", itemLevel: 99 },
      { slotCode: "ammo", itemLevel: 99 },
    ];
    const r = calculateEquippedItemLevel(gear, foreverDraft);
    expect(r.averageItemLevel).toBe(20);
    expect(r.highestItemLevel).toBe(20);
    expect(r.excludedSlots).toEqual(
      expect.arrayContaining([
        { slotCode: "shirt", reason: "EXCLUDED_BY_PROFILE" },
        { slotCode: "tabard", reason: "EXCLUDED_BY_PROFILE" },
        { slotCode: "ammo", reason: "EXCLUDED_BY_PROFILE" },
      ]),
    );
  });

  it("프로필에 없는 슬롯과 같은 슬롯 중복은 계산하지 않는다", () => {
    const gear = [...fullGear(20), { slotCode: "relic", itemLevel: 50 }, { slotCode: "head", itemLevel: 90 }];
    const r = calculateEquippedItemLevel(gear, foreverDraft);
    expect(r.highestItemLevel).toBe(20);
    expect(r.excludedSlots).toEqual(
      expect.arrayContaining([
        { slotCode: "relic", reason: "UNKNOWN_SLOT" },
        { slotCode: "head", reason: "DUPLICATE_SLOT" },
      ]),
    );
  });

  it("양손 무기: 기본(COUNT_ONCE)은 두 슬롯으로 중복 계산하지 않는다", () => {
    const gear = fullGear(20, { twoHand: true }).map((g) => (g.slotCode === "main_hand" ? { ...g, itemLevel: 36 } : g));
    const r = calculateEquippedItemLevel(gear, foreverDraft);
    expect(r.isTwoHanded).toBe(true);
    expect(r.expectedItemCount).toBe(16); // 보조 무기 슬롯을 분모에서 뺌
    expect(r.equippedItemCount).toBe(16);
    expect(r.averageItemLevel).toBe(21); // (20 * 15 + 36) / 16
    expect(r.coverage).toBe(1);
  });

  it("양손 무기: 설정을 바꾸면 두 번 셀 수 있다 (COUNT_TWICE)", () => {
    const gear = fullGear(20, { twoHand: true }).map((g) => (g.slotCode === "main_hand" ? { ...g, itemLevel: 37 } : g));
    const twice = withPolicy(foreverDraft, { twoHandWeapon: { ...foreverDraft.twoHandWeapon, policy: "COUNT_TWICE" } });
    expect(calculateEquippedItemLevel(gear, twice).averageItemLevel).toBe(22); // (20 * 15 + 37 * 2) / 17
  });

  it("양손 무기와 보조 무기를 함께 든 경우 보조 무기는 기록만 하고 계산하지 않는다", () => {
    const gear = fullGear(20).map((g) =>
      g.slotCode === "main_hand" ? { ...g, itemSlotCode: "two_hand" } : g.slotCode === "off_hand" ? { ...g, itemLevel: 80 } : g,
    );
    const r = calculateEquippedItemLevel(gear, foreverDraft);
    expect(r.highestItemLevel).toBe(20);
    expect(r.excludedSlots).toContainEqual({ slotCode: "off_hand", reason: "OFFHAND_WITH_TWO_HAND" });
  });

  it.each([
    ["null", null],
    ["음수", -5],
    ["0", 0],
    ["NaN", Number.NaN],
    ["무한대", Number.POSITIVE_INFINITY],
    ["문자열", "25"],
    ["객체", { value: 25 }],
  ])("잘못된 아이템 레벨(%s)은 계산하지 않고 coverage만 낮춘다", (_label, bad) => {
    const gear = fullGear(20).map((g) => (g.slotCode === "head" ? { ...g, itemLevel: bad } : g));
    const r = calculateEquippedItemLevel(gear, foreverDraft);
    expect(r.averageItemLevel).toBe(20);
    expect(r.equippedItemCount).toBe(16);
    expect(r.excludedSlots).toContainEqual({ slotCode: "head", reason: "INVALID_ITEM_LEVEL" });
  });

  it("itemLevelBounds.max를 넘는 값도 계산하지 않는다", () => {
    const bounded = withPolicy(foreverDraft, { itemLevelBounds: { min: 1, max: 100 } });
    const gear = fullGear(20).map((g) => (g.slotCode === "head" ? { ...g, itemLevel: 500 } : g));
    expect(calculateEquippedItemLevel(gear, bounded).highestItemLevel).toBe(20);
  });

  it("coverage 계산: 장착 유효 슬롯 / 예상 슬롯, 소수점 셋째 자리", () => {
    const r = calculateEquippedItemLevel(fullGear(20, { skip: ["head", "neck", "shoulder"] }), foreverDraft);
    expect(r.coverage).toBe(0.824); // 14 / 17
  });

  it("최소 coverage 미달이면 INSUFFICIENT_COVERAGE (평균은 계산하지만 랭킹에 쓰지 않음)", () => {
    const r = calculateEquippedItemLevel(
      fullGear(20, { skip: ["head", "neck", "shoulder", "back", "chest"] }),
      foreverDraft,
    );
    expect(r.coverage).toBe(0.706); // 12 / 17 < 0.75
    expect(r.meetsCoverage).toBe(false);
    expect(r.status).toBe("INSUFFICIENT_COVERAGE");
    expect(r.averageItemLevel).toBe(20);
  });

  it("최소 장착 개수 기준(minRankableSlotCount)도 적용한다", () => {
    const counted = withPolicy(mockProfile, { minimumCoverage: { minRankableSlotCount: 3 } });
    const gear = [
      { slotCode: "head", itemLevel: 10 },
      { slotCode: "neck", itemLevel: 10 },
    ];
    expect(calculateEquippedItemLevel(gear, counted).status).toBe("INSUFFICIENT_COVERAGE");
  });

  it("유효한 장비가 하나도 없으면 NO_GEAR_DATA이고 값을 지어내지 않는다", () => {
    const r = calculateEquippedItemLevel([{ slotCode: "head", itemLevel: null }], foreverDraft);
    expect(r.status).toBe("NO_GEAR_DATA");
    expect(r.averageItemLevel).toBeNull();
    expect(r.highestItemLevel).toBeNull();
    expect(calculateEquippedItemLevel([], foreverDraft).status).toBe("NO_GEAR_DATA");
  });
});
