/**
 * 홈페이지 데모 미리보기 전용 정적 데이터 (화면 예시용 가상 데이터)
 *
 * - 실제 게임 데이터·랭킹이 아니다. 캐릭터·길드·아이템 이름은 모두 지어낸 값이다.
 * - 홈페이지의 HomeDemoPreview(components/home/)와 랭킹·캐릭터·길드·통계 화면의 미리보기(components/demo/)만 이 파일을 쓴다.
 *   DB 저장, mock seed, 랭킹 엔진, 통계 계산, API 응답에 넘기지 않는다(tests/home-demo.test.tsx가 확인).
 * - 순위는 화면 예시를 위해 미리 정해 둔 값이다. 랭킹 엔진으로 계산하지 않는다.
 * - 확인되지 않은 지역·게임 규칙·최대 레벨을 쓰지 않는다. 레벨·아이템 레벨 수치에는 의미를 두지 않는다.
 * - 직업·종족은 화면 예시용 값이다. WoW: Forever의 실제 직업·종족 목록이나 게임 코드 설정(config/codes.ts)이 아니며,
 *   그 설정을 읽지도 바꾸지도 않는다. 직업 색상도 화면 예시용이다(app/globals.css의 --color-demo-*).
 */

export const HOME_DEMO_FIXTURE_KIND = "home-demo-fixture" as const;

/** 화면 예시용 직업 (게임 설정의 직업 코드가 아니다) */
export const DEMO_CLASSES = ["warrior", "paladin", "hunter", "rogue", "priest", "shaman", "mage", "warlock", "druid"] as const;
export type DemoClass = (typeof DEMO_CLASSES)[number];

/** 화면 예시용 종족 (게임 설정의 종족 코드가 아니다) */
export const DEMO_RACES = ["human", "dwarf", "nightElf", "gnome", "orc", "undead", "tauren", "troll"] as const;
export type DemoRace = (typeof DEMO_RACES)[number];

export interface DemoCharacter {
  key: string;
  name: string;
  demoClass: DemoClass;
  demoRace: DemoRace;
  level: number;
  guild: string | null;
  averageItemLevel: number;
  highestItemLevel: number;
  /** 최고 아이템 예시 이름 */
  highestItemName: string;
  highestItemQuality: "rare" | "epic";
  /** 이 캐릭터에 쌓인 예시 성장 기록 수 */
  growthRecords: number;
}

const characters = [
  { key: "c01", name: "새벽서리", demoClass: "mage", demoRace: "human", level: 42, guild: "은빛 등불", averageItemLevel: 118.6, highestItemLevel: 128, highestItemName: "서리 맺힌 예시 지팡이", highestItemQuality: "epic", growthRecords: 41 },
  { key: "c02", name: "붉은갈기", demoClass: "rogue", demoRace: "orc", level: 42, guild: "새벽 원정대", averageItemLevel: 116.9, highestItemLevel: 131, highestItemName: "불꽃 각인 예시 단검", highestItemQuality: "epic", growthRecords: 39 },
  { key: "c03", name: "고요한숲", demoClass: "druid", demoRace: "nightElf", level: 41, guild: "은빛 등불", averageItemLevel: 119.2, highestItemLevel: 126, highestItemName: "잎맥 예시 성물", highestItemQuality: "epic", growthRecords: 37 },
  { key: "c04", name: "강철방패", demoClass: "paladin", demoRace: "dwarf", level: 41, guild: "북부 수비대", averageItemLevel: 117.4, highestItemLevel: 124, highestItemName: "성채 예시 방패", highestItemQuality: "rare", growthRecords: 36 },
  { key: "c05", name: "달빛사냥꾼", demoClass: "hunter", demoRace: "nightElf", level: 40, guild: "북부 수비대", averageItemLevel: 114.8, highestItemLevel: 127, highestItemName: "달그림자 예시 활", highestItemQuality: "epic", growthRecords: 34 },
  { key: "c06", name: "잿빛망토", demoClass: "rogue", demoRace: "undead", level: 40, guild: "새벽 원정대", averageItemLevel: 112.3, highestItemLevel: 122, highestItemName: "재의 예시 단검", highestItemQuality: "rare", growthRecords: 31 },
  { key: "c07", name: "푸른물결", demoClass: "shaman", demoRace: "tauren", level: 39, guild: "파도 쉼터", averageItemLevel: 113.5, highestItemLevel: 121, highestItemName: "물결 예시 홀", highestItemQuality: "rare", growthRecords: 29 },
  { key: "c08", name: "돌주먹", demoClass: "warrior", demoRace: "dwarf", level: 39, guild: "북부 수비대", averageItemLevel: 115.1, highestItemLevel: 125, highestItemName: "바위 예시 투구", highestItemQuality: "epic", growthRecords: 28 },
  { key: "c09", name: "바람칼날", demoClass: "rogue", demoRace: "troll", level: 38, guild: "파도 쉼터", averageItemLevel: 110.7, highestItemLevel: 119, highestItemName: "질풍 예시 검", highestItemQuality: "rare", growthRecords: 25 },
  { key: "c10", name: "별빛노래", demoClass: "warlock", demoRace: "gnome", level: 37, guild: "은빛 등불", averageItemLevel: 109.9, highestItemLevel: 120, highestItemName: "별노래 예시 마법봉", highestItemQuality: "rare", growthRecords: 22 },
  { key: "c11", name: "늦깎이모험가", demoClass: "priest", demoRace: "undead", level: 33, guild: null, averageItemLevel: 98.4, highestItemLevel: 108, highestItemName: "새싹 예시 지팡이", highestItemQuality: "rare", growthRecords: 15 },
  { key: "c12", name: "첫걸음", demoClass: "warrior", demoRace: "troll", level: 28, guild: "파도 쉼터", averageItemLevel: 86.2, highestItemLevel: 97, highestItemName: "초보 예시 방패", highestItemQuality: "rare", growthRecords: 9 },
] as const satisfies readonly DemoCharacter[];

export type DemoCharacterKey = (typeof characters)[number]["key"];

/** 미리 정해 둔 예시 순위 (랭킹 엔진으로 계산하지 않는다). 랭킹 화면 미리보기는 12명 전체를 쓴다. */
const rankingsFull = {
  level: ["c01", "c02", "c03", "c04", "c05", "c06", "c07", "c08", "c09", "c10", "c11", "c12"],
  gear: ["c03", "c01", "c04", "c02", "c08", "c05", "c07", "c06", "c09", "c10", "c11", "c12"],
  highestItem: ["c02", "c01", "c05", "c03", "c08", "c04", "c06", "c07", "c10", "c09", "c11", "c12"],
} as const satisfies Record<string, readonly DemoCharacterKey[]>;

/** 홈 카드는 상위 8명만 보여 준다 */
const rankings = {
  level: rankingsFull.level.slice(0, 8),
  gear: rankingsFull.gear.slice(0, 8),
  highestItem: rankingsFull.highestItem.slice(0, 8),
} as const satisfies Record<string, readonly DemoCharacterKey[]>;

/** 예시 마지막 확인 경과 시간(시간 단위). 실제 시각이 아니다. */
const lastSeenHoursAgo = {
  c01: 1, c02: 3, c03: 8, c04: 14, c05: 6, c06: 22, c07: 5, c08: 30, c09: 44, c10: 18, c11: 60, c12: 12,
} as const satisfies Record<DemoCharacterKey, number>;

export type DemoActivityKind = "levelUp" | "observed" | "gearChange" | "growth";

export interface DemoActivity {
  kind: DemoActivityKind;
  character: DemoCharacterKey;
  /** 예시 경과 시간(시간 단위). 실제 시각이 아니다. */
  hoursAgo: number;
  level?: number;
  itemName?: string;
  itemLevel?: number;
  records?: number;
}

const activity = [
  { kind: "levelUp", character: "c01", hoursAgo: 1, level: 42 },
  { kind: "gearChange", character: "c02", hoursAgo: 3, itemName: "불꽃 각인 예시 단검", itemLevel: 131 },
  { kind: "observed", character: "c07", hoursAgo: 5, level: 39 },
  { kind: "levelUp", character: "c03", hoursAgo: 8, level: 41 },
  { kind: "growth", character: "c12", hoursAgo: 12, records: 9 },
  { kind: "gearChange", character: "c03", hoursAgo: 20, itemName: "잎맥 예시 성물", itemLevel: 126 },
] as const satisfies readonly DemoActivity[];

export const homeDemoFixture = {
  kind: HOME_DEMO_FIXTURE_KIND,
  characters,
  rankings,
  rankingsFull,
  lastSeenHoursAgo,
  activity,
};

export type HomeDemoFixture = typeof homeDemoFixture;

export function demoCharacter(key: DemoCharacterKey): DemoCharacter {
  return homeDemoFixture.characters.find((c) => c.key === key)!;
}

/** 화면 상단 샘플 수치. fixture 안의 값만 센다(실제 통계 계산을 쓰지 않음). */
export function demoSummary(fixture: HomeDemoFixture = homeDemoFixture) {
  return {
    characters: fixture.characters.length,
    rankingTypes: Object.keys(fixture.rankings).length,
    growthRecords: fixture.characters.reduce((sum, c) => sum + c.growthRecords, 0),
    guilds: new Set(fixture.characters.map((c) => c.guild).filter((g) => g !== null)).size,
  };
}

/** 샘플 캐릭터의 직업·종족 분포. fixture 안의 값만 센다(실제 통계 계산을 쓰지 않음). 수가 같으면 정의 순서. */
export function demoDistribution(fixture: HomeDemoFixture = homeDemoFixture) {
  const count = <K extends string>(keys: readonly K[], pick: (c: DemoCharacter) => K) =>
    keys
      .map((key) => ({ key, count: fixture.characters.filter((c) => pick(c) === key).length }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count || keys.indexOf(a.key) - keys.indexOf(b.key));
  return {
    classes: count(DEMO_CLASSES, (c) => c.demoClass),
    races: count(DEMO_RACES, (c) => c.demoRace),
  };
}

// ---------------------------------------------------------------------------
// 랭킹·캐릭터·길드·통계 화면 미리보기 (components/demo/)
// ---------------------------------------------------------------------------

/** 화면 예시용 진영. 종족으로 정한다(게임 설정의 진영 코드가 아니다). */
export type DemoFaction = "alliance" | "horde";

const RACE_FACTION: Record<DemoRace, DemoFaction> = {
  human: "alliance",
  dwarf: "alliance",
  nightElf: "alliance",
  gnome: "alliance",
  orc: "horde",
  undead: "horde",
  tauren: "horde",
  troll: "horde",
};

export function demoFaction(race: DemoRace): DemoFaction {
  return RACE_FACTION[race];
}

export interface DemoGuild {
  name: string;
  faction: DemoFaction;
  members: DemoCharacter[];
  topLevel: number;
  averageLevel: number;
  averageItemLevel: number;
}

/** 샘플 캐릭터로 묶은 예시 길드. 인원이 많은 순, 같으면 최고 레벨 순. */
export function demoGuilds(fixture: HomeDemoFixture = homeDemoFixture): DemoGuild[] {
  const names = [...new Set(fixture.characters.map((c) => c.guild).filter((g): g is NonNullable<typeof g> => g !== null))];
  return names
    .map((name) => {
      const members = fixture.characters.filter((c) => c.guild === name);
      const avg = (pick: (c: DemoCharacter) => number) => Math.round((members.reduce((n, c) => n + pick(c), 0) / members.length) * 10) / 10;
      return {
        name,
        faction: demoFaction(members[0]!.demoRace),
        members,
        topLevel: Math.max(...members.map((c) => c.level)),
        averageLevel: avg((c) => c.level),
        averageItemLevel: avg((c) => c.averageItemLevel),
      };
    })
    .sort((a, b) => b.members.length - a.members.length || b.topLevel - a.topLevel || a.name.localeCompare(b.name, "ko"));
}

/** 캐릭터 검색 예시: 검색어가 이름에 들어간 샘플 캐릭터 */
export const DEMO_SEARCH_QUERY = "빛";

export function demoSearch(query: string = DEMO_SEARCH_QUERY, fixture: HomeDemoFixture = homeDemoFixture): DemoCharacter[] {
  const q = query.normalize("NFC").toLowerCase();
  return fixture.characters.filter((c) => c.name.normalize("NFC").toLowerCase().includes(q));
}

export type DemoSlot =
  | "head" | "neck" | "shoulder" | "back" | "chest" | "wrist" | "hands" | "waist"
  | "legs" | "feet" | "finger1" | "finger2" | "trinket1" | "trinket2" | "mainHand" | "offHand";

export interface DemoEquippedItem {
  slot: DemoSlot;
  name: string | null;
  itemLevel: number | null;
  quality: "rare" | "epic" | null;
}

/** Armory 예시 캐릭터(새벽서리)의 장비. 양손 지팡이라 보조 무기 칸은 비어 있다. 평균은 장착한 15칸으로 계산한다. */
const armoryEquipment = [
  { slot: "head", name: "서리 예시 두건", itemLevel: 121, quality: "epic" },
  { slot: "neck", name: "푸른 예시 목걸이", itemLevel: 118, quality: "rare" },
  { slot: "shoulder", name: "눈송이 예시 어깨보호구", itemLevel: 119, quality: "rare" },
  { slot: "back", name: "얼음 예시 망토", itemLevel: 116, quality: "rare" },
  { slot: "chest", name: "서리 예시 로브", itemLevel: 122, quality: "epic" },
  { slot: "wrist", name: "은실 예시 손목보호구", itemLevel: 115, quality: "rare" },
  { slot: "hands", name: "냉기 예시 장갑", itemLevel: 120, quality: "rare" },
  { slot: "waist", name: "별실 예시 허리띠", itemLevel: 117, quality: "rare" },
  { slot: "legs", name: "서리 예시 바지", itemLevel: 121, quality: "rare" },
  { slot: "feet", name: "눈길 예시 장화", itemLevel: 118, quality: "rare" },
  { slot: "finger1", name: "새벽 예시 반지", itemLevel: 119, quality: "rare" },
  { slot: "finger2", name: "고요 예시 반지", itemLevel: 116, quality: "rare" },
  { slot: "trinket1", name: "푸른 예시 수정", itemLevel: 117, quality: "rare" },
  { slot: "trinket2", name: "작은 예시 부적", itemLevel: 112, quality: "rare" },
  { slot: "mainHand", name: "서리 맺힌 예시 지팡이", itemLevel: 128, quality: "epic" },
  { slot: "offHand", name: null, itemLevel: null, quality: null },
] as const satisfies readonly DemoEquippedItem[];

export interface DemoMilestone {
  level: number;
  /** 예시 경과 일수. 실제 날짜가 아니다. */
  daysAgo: number;
  basis: "firstObserved" | "inferred";
}

const armoryMilestones = [
  { level: 42, daysAgo: 0, basis: "firstObserved" },
  { level: 41, daysAgo: 2, basis: "firstObserved" },
  { level: 40, daysAgo: 4, basis: "firstObserved" },
  { level: 39, daysAgo: 6, basis: "inferred" },
  { level: 38, daysAgo: 6, basis: "firstObserved" },
  { level: 36, daysAgo: 9, basis: "firstObserved" },
  { level: 33, daysAgo: 13, basis: "firstObserved" },
  { level: 30, daysAgo: 17, basis: "firstObserved" },
] as const satisfies readonly DemoMilestone[];

export const demoArmory = {
  character: "c01" as DemoCharacterKey,
  equipment: armoryEquipment,
  milestones: armoryMilestones,
};

/** 샘플 캐릭터의 레벨 구간 분포 (10레벨 단위). fixture 안의 값만 센다. */
export function demoLevelBuckets(fixture: HomeDemoFixture = homeDemoFixture) {
  const buckets = new Map<number, number>();
  for (const c of fixture.characters) {
    const from = Math.floor(c.level / 10) * 10;
    buckets.set(from, (buckets.get(from) ?? 0) + 1);
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([from, count]) => ({ from, to: from + 9, count }));
}

/** 샘플 캐릭터의 진영 구성. fixture 안의 값만 센다. */
export function demoFactionCounts(fixture: HomeDemoFixture = homeDemoFixture): Record<DemoFaction, number> {
  const counts: Record<DemoFaction, number> = { alliance: 0, horde: 0 };
  for (const c of fixture.characters) counts[demoFaction(c.demoRace)] += 1;
  return counts;
}
