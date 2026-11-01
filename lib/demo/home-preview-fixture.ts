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
  { key: "c02", name: "붉은갈기", demoClass: "rogue", demoRace: "orc", level: 42, guild: "새벽 원정대", averageItemLevel: 116.88, highestItemLevel: 131, highestItemName: "불꽃 각인 예시 단검", highestItemQuality: "epic", growthRecords: 39 },
  { key: "c03", name: "고요한숲", demoClass: "druid", demoRace: "nightElf", level: 41, guild: "은빛 등불", averageItemLevel: 119.19, highestItemLevel: 126, highestItemName: "잎맥 예시 성물", highestItemQuality: "epic", growthRecords: 37 },
  { key: "c04", name: "강철방패", demoClass: "paladin", demoRace: "dwarf", level: 41, guild: "북부 수비대", averageItemLevel: 117.38, highestItemLevel: 124, highestItemName: "성채 예시 방패", highestItemQuality: "rare", growthRecords: 36 },
  { key: "c05", name: "달빛사냥꾼", demoClass: "hunter", demoRace: "nightElf", level: 40, guild: "북부 수비대", averageItemLevel: 114.8, highestItemLevel: 127, highestItemName: "달그림자 예시 활", highestItemQuality: "epic", growthRecords: 34 },
  { key: "c06", name: "잿빛망토", demoClass: "rogue", demoRace: "undead", level: 40, guild: "새벽 원정대", averageItemLevel: 112.31, highestItemLevel: 122, highestItemName: "재의 예시 단검", highestItemQuality: "rare", growthRecords: 31 },
  { key: "c07", name: "푸른물결", demoClass: "shaman", demoRace: "tauren", level: 39, guild: "파도 쉼터", averageItemLevel: 113.5, highestItemLevel: 121, highestItemName: "물결 예시 홀", highestItemQuality: "rare", growthRecords: 29 },
  { key: "c08", name: "돌주먹", demoClass: "warrior", demoRace: "dwarf", level: 39, guild: "북부 수비대", averageItemLevel: 115.13, highestItemLevel: 125, highestItemName: "바위 예시 투구", highestItemQuality: "epic", growthRecords: 28 },
  { key: "c09", name: "바람칼날", demoClass: "rogue", demoRace: "troll", level: 38, guild: "파도 쉼터", averageItemLevel: 110.69, highestItemLevel: 119, highestItemName: "질풍 예시 검", highestItemQuality: "rare", growthRecords: 25 },
  { key: "c10", name: "별빛노래", demoClass: "warlock", demoRace: "gnome", level: 37, guild: "은빛 등불", averageItemLevel: 109.88, highestItemLevel: 120, highestItemName: "별노래 예시 마법봉", highestItemQuality: "rare", growthRecords: 22 },
  { key: "c11", name: "늦깎이모험가", demoClass: "priest", demoRace: "undead", level: 33, guild: null, averageItemLevel: 98.4, highestItemLevel: 108, highestItemName: "새싹 예시 지팡이", highestItemQuality: "rare", growthRecords: 15 },
  { key: "c12", name: "첫걸음", demoClass: "warrior", demoRace: "troll", level: 28, guild: "파도 쉼터", averageItemLevel: 86.19, highestItemLevel: 97, highestItemName: "초보 예시 방패", highestItemQuality: "rare", growthRecords: 9 },
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

export const DEMO_SLOTS = [
  "head", "neck", "shoulder", "back", "chest", "wrist", "hands", "waist",
  "legs", "feet", "finger1", "finger2", "trinket1", "trinket2", "mainHand", "offHand",
] as const satisfies readonly DemoSlot[];

export interface DemoEquippedItem {
  slot: DemoSlot;
  name: string | null;
  itemLevel: number | null;
  quality: "rare" | "epic" | null;
}

/**
 * 캐릭터별 예시 장비 구성. 최고 아이템이 놓인 칸과 양손 무기 여부, 장비 이름에 붙일 말을 정한다.
 * 양손 무기면 보조 무기 칸이 비고 장착 15칸, 아니면 16칸이다.
 */
const gearLayout = {
  c01: { theme: "서리", highestSlot: "mainHand", twoHand: true, mainHand: "지팡이", offHand: null },
  c02: { theme: "불꽃", highestSlot: "mainHand", twoHand: false, mainHand: "단검", offHand: "단검" },
  c03: { theme: "잎맥", highestSlot: "offHand", twoHand: false, mainHand: "단검", offHand: "성물" },
  c04: { theme: "성채", highestSlot: "offHand", twoHand: false, mainHand: "망치", offHand: "방패" },
  c05: { theme: "달그림자", highestSlot: "mainHand", twoHand: true, mainHand: "활", offHand: null },
  c06: { theme: "재", highestSlot: "mainHand", twoHand: false, mainHand: "단검", offHand: "단검" },
  c07: { theme: "물결", highestSlot: "mainHand", twoHand: false, mainHand: "홀", offHand: "방패" },
  c08: { theme: "바위", highestSlot: "head", twoHand: false, mainHand: "도끼", offHand: "방패" },
  c09: { theme: "질풍", highestSlot: "mainHand", twoHand: false, mainHand: "검", offHand: "단검" },
  c10: { theme: "별노래", highestSlot: "mainHand", twoHand: false, mainHand: "마법봉", offHand: "마법서" },
  c11: { theme: "새싹", highestSlot: "mainHand", twoHand: true, mainHand: "지팡이", offHand: null },
  c12: { theme: "초보", highestSlot: "offHand", twoHand: false, mainHand: "도끼", offHand: "방패" },
} as const satisfies Record<DemoCharacterKey, { theme: string; highestSlot: DemoSlot; twoHand: boolean; mainHand: string; offHand: string | null }>;

const SLOT_NOUN: Record<Exclude<DemoSlot, "mainHand" | "offHand">, string> = {
  head: "투구", neck: "목걸이", shoulder: "어깨보호구", back: "망토", chest: "흉갑", wrist: "손목보호구",
  hands: "장갑", waist: "허리띠", legs: "다리보호구", feet: "장화", finger1: "반지", finger2: "인장",
  trinket1: "부적", trinket2: "수정",
};

/** 칸마다 평균에서 조금씩 벗어나게 하는 고정 값(합 0). 같은 캐릭터는 항상 같은 장비가 나온다. */
const WOBBLE = [2, -1, 1, -2, 3, -3, 1, -1, 2, -2, 0, 1, -1, 0, 0];

/**
 * 예시 캐릭터의 장착 장비(16칸, 화면 순서).
 * 최고 아이템은 fixture의 이름·레벨·등급 그대로, 나머지 칸은 장착 칸 평균이 fixture의 평균 아이템 레벨과 같아지도록 나눈다.
 */
export function demoEquipment(key: DemoCharacterKey): DemoEquippedItem[] {
  const c = demoCharacter(key);
  const layout = gearLayout[key];
  const slots = DEMO_SLOTS.filter((slot) => !(layout.twoHand && slot === "offHand"));
  const others = slots.filter((slot) => slot !== layout.highestSlot);
  const total = Math.round(c.averageItemLevel * slots.length);
  const rest = total - c.highestItemLevel;
  const base = Math.floor(rest / others.length);
  let remainder = rest - base * others.length;
  const levels = new Map<DemoSlot, number>();
  others.forEach((slot, i) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    levels.set(slot, Math.min(base + extra + (WOBBLE[i] ?? 0), c.highestItemLevel - 1));
  });
  // 상한으로 잘린 만큼은 가장 낮은 칸에 더해 합을 맞춘다
  const diff = rest - [...levels.values()].reduce((n, v) => n + v, 0);
  if (diff !== 0) {
    const lowest = [...levels.entries()].sort((a, b) => a[1] - b[1])[0]!;
    levels.set(lowest[0], lowest[1] + diff);
  }
  return DEMO_SLOTS.map((slot): DemoEquippedItem => {
    if (slot === layout.highestSlot) return { slot, name: c.highestItemName, itemLevel: c.highestItemLevel, quality: c.highestItemQuality };
    if (slot === "offHand" && layout.twoHand) return { slot, name: null, itemLevel: null, quality: null };
    const noun = slot === "mainHand" ? layout.mainHand : slot === "offHand" ? layout.offHand! : SLOT_NOUN[slot];
    const quality = c.highestItemQuality === "epic" && (slot === "chest" || slot === "head") ? "epic" : "rare";
    return { slot, name: `${layout.theme} 예시 ${noun}`, itemLevel: levels.get(slot)!, quality };
  });
}

export interface DemoMilestone {
  level: number;
  /** 예시 경과 일수. 실제 날짜가 아니다. */
  daysAgo: number;
  basis: "firstObserved" | "inferred";
}

/** 예시 레벨 달성 기록: 최신(현재 레벨)부터. 건너뛴 중간 레벨은 추정으로 표시한다. */
export function demoMilestones(key: DemoCharacterKey): DemoMilestone[] {
  const c = demoCharacter(key);
  const steps = [0, 1, 2, 3, 4, 6, 9, 12];
  const days = [0, 2, 4, 6, 6, 9, 13, 17];
  return steps
    .map((step, i): DemoMilestone => ({ level: c.level - step, daysAgo: days[i]!, basis: step === 3 ? "inferred" : "firstObserved" }))
    .filter((m) => m.level >= 1);
}

/** 세 가지 예시 랭킹에서의 순위 (미리 정해 둔 순서 안의 위치) */
export function demoRanks(key: DemoCharacterKey) {
  const { rankingsFull } = homeDemoFixture;
  return {
    level: rankingsFull.level.indexOf(key) + 1,
    gear: rankingsFull.gear.indexOf(key) + 1,
    highestItem: rankingsFull.highestItem.indexOf(key) + 1,
  };
}

/** 캐릭터 화면의 Armory 미리보기에 쓰는 대표 캐릭터 */
export const DEMO_ARMORY_CHARACTER: DemoCharacterKey = "c01";

/** 예시 상세 화면 주소의 이름으로 캐릭터를 찾는다 (NFC 정규화 후 비교) */
export type DemoCharacterEntry = HomeDemoFixture["characters"][number];

export function demoCharacterByName(name: string): DemoCharacterEntry | null {
  const n = name.normalize("NFC");
  return homeDemoFixture.characters.find((c) => c.name.normalize("NFC") === n) ?? null;
}

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
