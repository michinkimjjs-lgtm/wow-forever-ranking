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
    expect(r).toMatchObject({ profileId: "forever-draft", profileVersion: 2, calculationVersion: 1 });
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
    // forever-draft v2: 유효 아이템 10개 이상. 9개는 미달
    const r = calculateEquippedItemLevel(
      fullGear(20, { skip: ["head", "neck", "shoulder", "back", "chest", "wrist", "hands", "waist"] }),
      foreverDraft,
    );
    expect(r.equippedItemCount).toBe(9);
    expect(r.meetsCoverage).toBe(false);
    expect(r.status).toBe("INSUFFICIENT_COVERAGE");
    expect(r.averageItemLevel).toBe(20);
  });

  it("forever-draft v2: 레벨업 중이라 칸이 많이 비어도 유효 아이템이 10개 이상이면 장비 랭킹 대상이다", () => {
    // 장신구·목·어깨·손목·허리·발·원거리 7칸이 빈 캐릭터 (v1의 75% 기준이면 10/17 = 0.588로 빠졌다)
    const r = calculateEquippedItemLevel(
      fullGear(20, { skip: ["trinket_1", "trinket_2", "neck", "shoulder", "wrist", "waist", "feet"] }),
      foreverDraft,
    );
    expect(r.equippedItemCount).toBe(10);
    expect(r.coverage).toBe(0.588);
    expect(r.status).toBe("OK");
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

describe("forever-draft v2 초안 검토: WoW: Forever 실제 아이템 예시 장비 (docs/GEAR-PROFILE.md §6)", () => {
  const SLOT: Record<string, string> = { finger1: "finger_1", finger2: "finger_2", trinket1: "trinket_1", trinket2: "trinket_2", mainHand: "main_hand", offHand: "off_hand" };

  it("화면 미리보기의 평균 아이템 레벨과 같은 값이 나오고, 30레벨 이상 예시 캐릭터는 모두 장비 랭킹 대상이다", async () => {
    const { DEMO_GEAR, demoItem } = await import("@/lib/demo/demo-items");
    const { homeDemoFixture } = await import("@/lib/demo/home-preview-fixture");
    for (const c of homeDemoFixture.characters) {
      const gear = DEMO_GEAR[c.key as keyof typeof DEMO_GEAR] as Record<string, number>;
      const items = Object.entries(gear).map(([slot, id]) => {
        const item = demoItem(id as Parameters<typeof demoItem>[0]);
        return { slotCode: SLOT[slot] ?? slot, itemLevel: item.itemLevel, itemSlotCode: item.slot === "양손" ? "two_hand" : null };
      });
      const r = calculateEquippedItemLevel(items, foreverDraft);
      expect(r.averageItemLevel, c.name).toBe(c.averageItemLevel);
      expect(r.highestItemLevel, c.name).toBe(c.highestItemLevel);
      if (c.level >= 30) expect(r.status, c.name).toBe("OK");
    }
  });
});
