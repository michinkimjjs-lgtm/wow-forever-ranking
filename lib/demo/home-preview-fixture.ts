/**
 * 홈페이지 데모 미리보기 전용 정적 데이터 (화면 예시용 가상 데이터)
 *
 * - 실제 게임 데이터·랭킹이 아니다. 캐릭터·길드·아이템 이름은 모두 지어낸 값이다.
 * - 홈페이지의 HomeDemoPreview(components/home/home-demo-preview.tsx)만 이 파일을 쓴다.
 *   DB 저장, mock seed, 랭킹 엔진, 통계 계산, API 응답에 넘기지 않는다(tests/home-demo.test.tsx가 확인).
 * - 순위는 화면 예시를 위해 미리 정해 둔 값이다. 랭킹 엔진으로 계산하지 않는다.
 * - 확인되지 않은 지역·직업·게임 규칙·최대 레벨을 쓰지 않는다.
 *   직업 대신 화면 예시용 역할 분류(근접·원거리·치유·방어)만 쓰고, 레벨·아이템 레벨 수치에는 의미를 두지 않는다.
 */

export const HOME_DEMO_FIXTURE_KIND = "home-demo-fixture" as const;

/** 화면 예시용 역할 분류 (게임 직업 코드가 아니다) */
export type DemoRole = "melee" | "ranged" | "healer" | "tank";

export interface DemoCharacter {
  key: string;
  name: string;
  role: DemoRole;
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
  { key: "c01", name: "새벽서리", role: "ranged", level: 42, guild: "은빛 등불", averageItemLevel: 118.6, highestItemLevel: 128, highestItemName: "서리 맺힌 예시 지팡이", highestItemQuality: "epic", growthRecords: 41 },
  { key: "c02", name: "붉은갈기", role: "melee", level: 42, guild: "새벽 원정대", averageItemLevel: 116.9, highestItemLevel: 131, highestItemName: "불꽃 각인 예시 도끼", highestItemQuality: "epic", growthRecords: 39 },
  { key: "c03", name: "고요한숲", role: "healer", level: 41, guild: "은빛 등불", averageItemLevel: 119.2, highestItemLevel: 126, highestItemName: "잎맥 예시 성물", highestItemQuality: "epic", growthRecords: 37 },
  { key: "c04", name: "강철방패", role: "tank", level: 41, guild: "북부 수비대", averageItemLevel: 117.4, highestItemLevel: 124, highestItemName: "성채 예시 방패", highestItemQuality: "rare", growthRecords: 36 },
  { key: "c05", name: "달빛사냥꾼", role: "ranged", level: 40, guild: "새벽 원정대", averageItemLevel: 114.8, highestItemLevel: 127, highestItemName: "달그림자 예시 활", highestItemQuality: "epic", growthRecords: 34 },
  { key: "c06", name: "잿빛망토", role: "melee", level: 40, guild: null, averageItemLevel: 112.3, highestItemLevel: 122, highestItemName: "재의 예시 단검", highestItemQuality: "rare", growthRecords: 31 },
  { key: "c07", name: "푸른물결", role: "healer", level: 39, guild: "파도 쉼터", averageItemLevel: 113.5, highestItemLevel: 121, highestItemName: "물결 예시 홀", highestItemQuality: "rare", growthRecords: 29 },
  { key: "c08", name: "돌주먹", role: "tank", level: 39, guild: "북부 수비대", averageItemLevel: 115.1, highestItemLevel: 125, highestItemName: "바위 예시 투구", highestItemQuality: "epic", growthRecords: 28 },
  { key: "c09", name: "바람칼날", role: "melee", level: 38, guild: "파도 쉼터", averageItemLevel: 110.7, highestItemLevel: 119, highestItemName: "질풍 예시 검", highestItemQuality: "rare", growthRecords: 25 },
  { key: "c10", name: "별빛노래", role: "ranged", level: 37, guild: "은빛 등불", averageItemLevel: 109.9, highestItemLevel: 120, highestItemName: "별노래 예시 마법봉", highestItemQuality: "rare", growthRecords: 22 },
  { key: "c11", name: "늦깎이모험가", role: "healer", level: 33, guild: null, averageItemLevel: 98.4, highestItemLevel: 108, highestItemName: "새싹 예시 지팡이", highestItemQuality: "rare", growthRecords: 15 },
  { key: "c12", name: "첫걸음", role: "tank", level: 28, guild: "파도 쉼터", averageItemLevel: 86.2, highestItemLevel: 97, highestItemName: "초보 예시 방패", highestItemQuality: "rare", growthRecords: 9 },
] as const satisfies readonly DemoCharacter[];

export type DemoCharacterKey = (typeof characters)[number]["key"];

/** 미리 정해 둔 예시 순위 (랭킹 엔진으로 계산하지 않는다) */
const rankings = {
  level: ["c01", "c02", "c03", "c04", "c05", "c06", "c07", "c08"],
  gear: ["c03", "c01", "c04", "c02", "c08", "c05", "c07", "c06"],
  highestItem: ["c02", "c01", "c05", "c03", "c08", "c04", "c06", "c07"],
} as const satisfies Record<string, readonly DemoCharacterKey[]>;

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
  { kind: "gearChange", character: "c02", hoursAgo: 3, itemName: "불꽃 각인 예시 도끼", itemLevel: 131 },
  { kind: "observed", character: "c07", hoursAgo: 5, level: 39 },
  { kind: "levelUp", character: "c03", hoursAgo: 8, level: 41 },
  { kind: "growth", character: "c12", hoursAgo: 12, records: 9 },
  { kind: "gearChange", character: "c03", hoursAgo: 20, itemName: "잎맥 예시 성물", itemLevel: 126 },
] as const satisfies readonly DemoActivity[];

export const homeDemoFixture = {
  kind: HOME_DEMO_FIXTURE_KIND,
  characters,
  rankings,
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
