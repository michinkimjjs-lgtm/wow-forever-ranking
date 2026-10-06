/**
 * Mock 데이터 생성기 (명세서 §32 Phase 1-6)
 *
 * 개발용 가짜 데이터다. 실제 WoW: Forever 캐릭터, 아이템, 길드가 아니다.
 * - 같은 seed + 같은 기준 시각(anchor)이면 항상 같은 데이터를 만든다.
 * - 시각은 anchor를 기준으로 한 상대 시각이다. 최근 데이터와 오래된(7일 이상) 데이터를 모두 포함한다.
 * - 직업 / 종족 / 지역 / 게임 모드 / 장비 슬롯 코드는 mock 임시 설정(config/*)과 같은 값을 쓴다.
 */
import type { CharacterObservationInput } from "@/lib/ingestion/schema";
import { SeededRandom } from "./random";

export const MOCK_SOURCE_BUILD = "mock-build-1";
export const DEFAULT_MOCK_SEED = 20261006;
export const DEFAULT_MOCK_CHARACTER_COUNT = 120;

export interface MockDatasetOptions {
  seed?: number;
  /** 기준 시각. 기본값은 오늘 0시(UTC). 같은 날 여러 번 실행해도 같은 데이터가 나온다. */
  anchor?: Date;
  characterCount?: number;
}

export interface MockDataset {
  seed: number;
  anchor: Date;
  observations: CharacterObservationInput[];
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const REGION = "kr";
const GAME_MODES = [
  ["standard", 5],
  ["alternate", 1],
] as const;

const RACES_BY_FACTION = {
  alliance: ["human", "dwarf", "night_elf", "gnome"],
  horde: ["orc", "undead", "tauren", "troll"],
} as const;

const CLASSES_BY_RACE: Record<string, readonly string[]> = {
  human: ["warrior", "paladin", "rogue", "priest", "mage", "warlock"],
  dwarf: ["warrior", "paladin", "hunter", "rogue", "priest"],
  night_elf: ["warrior", "hunter", "rogue", "priest", "druid"],
  gnome: ["warrior", "rogue", "mage", "warlock"],
  orc: ["warrior", "hunter", "rogue", "shaman", "warlock"],
  undead: ["warrior", "rogue", "priest", "mage", "warlock"],
  tauren: ["warrior", "hunter", "shaman", "druid"],
  troll: ["warrior", "hunter", "rogue", "priest", "shaman", "mage"],
};

const TWO_HAND_CLASSES = new Set(["warrior", "paladin", "hunter", "shaman", "druid"]);

const GUILDS = [
  { name: "아제로스 수호대", faction: "alliance", weight: 6 },
  { name: "새벽의 칼날", faction: "alliance", weight: 4 },
  { name: "고요한 숲", faction: "alliance", weight: 3 },
  { name: "푸른 등불", faction: "alliance", weight: 2 },
  { name: "붉은 서약", faction: "horde", weight: 6 },
  { name: "강철 맹세", faction: "horde", weight: 4 },
  { name: "잿빛 늑대", faction: "horde", weight: 3 },
  { name: "폭풍의 메아리", faction: "horde", weight: 2 },
] as const;

const SYLLABLES = [
  "가", "나", "다", "라", "마", "바", "사", "아", "자", "하", "서", "도", "유", "윤", "진", "한",
  "강", "별", "빛", "달", "솔", "휘", "린", "연", "무", "검", "결", "령", "은", "새", "온", "슬",
];
const LATIN_HEADS = ["Kal", "Ra", "Thel", "Mor", "Vy", "Zan", "El", "Dra", "Fen", "Lor", "Ash", "Bri"];
const LATIN_TAILS = ["dor", "wyn", "ra", "mir", "ven", "ka", "lis", "gar", "nor", "ith"];

const ARMOR_SLOTS = [
  "head", "neck", "shoulder", "back", "chest", "wrist", "hands", "waist", "legs", "feet",
  "finger_1", "finger_2", "trinket_1", "trinket_2",
] as const;

const SLOT_NOUNS: Record<string, string> = {
  head: "투구",
  neck: "목걸이",
  shoulder: "어깨보호구",
  back: "망토",
  chest: "흉갑",
  wrist: "팔보호구",
  hands: "장갑",
  waist: "허리띠",
  legs: "다리보호구",
  feet: "장화",
  finger: "반지",
  trinket: "장신구",
  one_hand: "검",
  two_hand: "대검",
  off_hand: "방패",
  shirt: "셔츠",
};
const ITEM_THEMES = ["늑대", "곰", "매", "독수리", "올빼미", "멧돼지", "사자", "여우"];
const QUALITY_WORDS: Record<string, string> = {
  poor: "낡은",
  common: "평범한",
  uncommon: "단단한",
  rare: "정교한",
  epic: "찬란한",
};

const MINUTE = 60_000;

function itemSlotCodeFor(slot: string): string {
  if (slot.startsWith("finger")) return "finger";
  if (slot.startsWith("trinket")) return "trinket";
  return slot;
}

function qualityFor(offset: number): string {
  if (offset >= 8) return "epic";
  if (offset >= 4) return "rare";
  if (offset >= 1) return "uncommon";
  if (offset >= -1) return "common";
  return "poor";
}

interface CharacterPlan {
  index: number;
  name: string;
  gameMode: string;
  faction: "alliance" | "horde";
  race: string;
  className: string;
  guild: (typeof GUILDS)[number] | null;
  finalLevel: number;
  usesTwoHand: boolean;
  wearsShirt: boolean;
  lowCoverage: boolean;
  standoutItem: boolean;
  unknownItemLevelSlot: string | null;
}

export function generateMockDataset(options: MockDatasetOptions = {}): MockDataset {
  const seed = options.seed ?? DEFAULT_MOCK_SEED;
  const anchor = options.anchor ?? startOfUtcDay(new Date());
  const count = options.characterCount ?? DEFAULT_MOCK_CHARACTER_COUNT;
  const random = new SeededRandom(seed);
  const usedNames = new Set<string>();

  const plans: CharacterPlan[] = [];
  for (let index = 0; index < count; index += 1) {
    const faction = random.chance(0.5) ? "alliance" : "horde";
    const race = random.pick(RACES_BY_FACTION[faction]);
    const className = random.pick(CLASSES_BY_RACE[race]!);
    const guildCandidates = GUILDS.filter((g) => g.faction === faction);
    const guild = random.chance(0.15)
      ? null
      : random.weighted(guildCandidates.map((g) => [g, g.weight] as const));
    const finalLevel = random.weighted<[number, number]>([
      [[30, 30], 6],
      [[25, 29], 16],
      [[15, 24], 38],
      [[5, 14], 30],
      [[1, 4], 10],
    ]);
    plans.push({
      index,
      name: uniqueName(random, usedNames),
      gameMode: random.weighted(GAME_MODES),
      faction,
      race,
      className,
      guild,
      finalLevel: random.int(finalLevel[0], finalLevel[1]),
      usesTwoHand: TWO_HAND_CLASSES.has(className) && random.chance(0.5),
      wearsShirt: random.chance(0.5),
      lowCoverage: random.chance(0.12),
      standoutItem: random.chance(0.06),
      unknownItemLevelSlot: random.chance(0.04) ? random.pick(ARMOR_SLOTS) : null,
    });
  }

  const observations: CharacterObservationInput[] = [];
  for (const plan of plans) {
    observations.push(...planObservations(random, plan, anchor));
  }
  observations.sort(
    (a, b) =>
      new Date(a.observedAt as Date).getTime() - new Date(b.observedAt as Date).getTime() ||
      String(a.identity.externalId).localeCompare(String(b.identity.externalId)),
  );
  return { seed, anchor, observations };
}

function uniqueName(random: SeededRandom, used: Set<string>): string {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const name = random.chance(0.15)
      ? `${random.pick(LATIN_HEADS)}${random.pick(LATIN_TAILS)}`
      : Array.from({ length: random.int(2, 3) }, () => random.pick(SYLLABLES)).join("");
    const key = name.toLowerCase();
    if (!used.has(key)) {
      used.add(key);
      return name;
    }
  }
  throw new Error("mock 캐릭터 이름을 만들지 못했습니다.");
}

function planObservations(random: SeededRandom, plan: CharacterPlan, anchor: Date): CharacterObservationInput[] {
  const stale = random.chance(0.15);
  const lastSeenOffset = stale ? random.int(8 * 24 * 60, 25 * 24 * 60) : random.int(5, Math.floor(6.5 * 24 * 60));
  const lastSeen = anchor.getTime() - lastSeenOffset * MINUTE;
  const spanMinutes = random.int(1 * 24 * 60, 20 * 24 * 60);
  const firstSeen = lastSeen - spanMinutes * MINUTE;

  const observationCount = plan.finalLevel <= 2 ? random.int(1, 2) : random.int(2, 6);
  const startLevel = Math.max(1, plan.finalLevel - random.int(0, Math.min(plan.finalLevel - 1, 12)));

  // 관측 시각: firstSeen ~ lastSeen 사이를 고르게 나누고 약간 흔든다.
  const times: number[] = [];
  for (let i = 0; i < observationCount; i += 1) {
    if (i === 0) times.push(firstSeen);
    else if (i === observationCount - 1) times.push(lastSeen);
    else {
      const base = firstSeen + ((lastSeen - firstSeen) * i) / (observationCount - 1);
      times.push(Math.round(base + random.int(-60, 60) * MINUTE));
    }
  }
  times.sort((a, b) => a - b);

  // 레벨: startLevel에서 finalLevel까지 단조 증가 (중간에 여러 레벨을 건너뛸 수 있다)
  const levels: number[] = [];
  for (let i = 0; i < observationCount; i += 1) {
    if (i === observationCount - 1) levels.push(plan.finalLevel);
    else if (i === 0) levels.push(startLevel);
    else levels.push(random.int(startLevel, plan.finalLevel));
  }
  levels.sort((a, b) => a - b);

  const externalId = `mock-char-${String(plan.index + 1).padStart(4, "0")}`;
  const result: CharacterObservationInput[] = [];
  for (let i = 0; i < observationCount; i += 1) {
    const level = levels[i]!;
    const observedAt = new Date(times[i]!);
    const previousTime = i > 0 ? times[i - 1]! : null;
    const leveledUp = i > 0 && level > levels[i - 1]!;
    const levelReachedAt =
      leveledUp && previousTime !== null && random.chance(0.35)
        ? new Date(random.int(previousTime, times[i]!))
        : null;

    result.push({
      dataSource: "mock",
      observedAt,
      sourceUpdatedAt: observedAt,
      sourceBuild: MOCK_SOURCE_BUILD,
      identity: {
        externalId,
        region: REGION,
        gameMode: plan.gameMode,
        characterName: plan.name,
      },
      level,
      levelReachedAt,
      factionCode: plan.faction,
      raceCode: plan.race,
      classCode: plan.className,
      guild: plan.guild
        ? {
            externalId: `mock-guild-${plan.gameMode}-${GUILDS.indexOf(plan.guild) + 1}`,
            name: plan.guild.name,
            factionCode: plan.guild.faction,
          }
        : null,
      equipment: buildEquipment(random, plan, level),
    });
  }
  return result;
}

function buildEquipment(random: SeededRandom, plan: CharacterPlan, level: number) {
  const slots: string[] = [...ARMOR_SLOTS];
  // 저레벨 / 장비 정보가 부족한 캐릭터는 일부 슬롯만 장착한다.
  const keepRatio = plan.lowCoverage || level < 8 ? 0.45 : 0.93;
  const equippedSlots = slots.filter((s) => s === "chest" || random.chance(keepRatio));
  equippedSlots.push("main_hand");
  if (!plan.usesTwoHand && random.chance(0.85)) equippedSlots.push("off_hand");
  if (plan.wearsShirt) equippedSlots.push("shirt");

  return equippedSlots.map((slot) => {
    let itemSlotCode = itemSlotCodeFor(slot);
    if (slot === "main_hand") itemSlotCode = plan.usesTwoHand ? "two_hand" : "one_hand";
    const offset = slot === "shirt" ? 0 : random.int(-3, 6) + (plan.standoutItem && slot === "main_hand" ? 9 : 0);
    const itemLevel = Math.max(1, level + offset);
    const quality = slot === "shirt" ? "common" : qualityFor(offset);
    const theme = random.pick(ITEM_THEMES);
    const noun = SLOT_NOUNS[itemSlotCode] ?? SLOT_NOUNS[slot] ?? "장비";
    return {
      slotCode: slot,
      externalItemId: `mock-item-${itemSlotCode}-${itemLevel}-${ITEM_THEMES.indexOf(theme)}-${quality}`,
      name: slot === "shirt" ? `${theme} 무늬 ${noun}` : `${QUALITY_WORDS[quality]} ${theme}의 ${noun}`,
      nameLocale: "ko-KR",
      itemSlotCode,
      qualityCode: quality,
      itemLevel: slot === plan.unknownItemLevelSlot ? null : itemLevel,
      baseItemLevel: itemLevel,
    };
  });
}
