import { characters } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import type { DataEnvironment, DataSource, VerificationStatus } from "@/lib/domain/enums";
import { normalizeName, toSlug } from "@/lib/domain/names";
import type { CharacterObservationInput } from "@/lib/ingestion/schema";

export const NOW = new Date("2026-10-06T06:00:00Z");
export const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
export const daysAgo = (d: number) => hoursAgo(d * 24);

let counter = 0;

/** 랭킹 엔진 테스트용: characters 행을 직접 넣는다. (수집 파이프라인을 거치지 않음) */
export async function insertCharacter(
  db: AppDatabase,
  input: Partial<typeof characters.$inferInsert> & { characterName: string },
) {
  counter += 1;
  const env: DataEnvironment = input.dataEnvironment ?? "mock";
  const source: DataSource = input.dataSource ?? (env === "mock" ? "mock" : "addon");
  const status: VerificationStatus = input.verificationStatus ?? (env === "mock" ? "MOCK" : "COMMUNITY_SUBMITTED");
  const [row] = await db
    .insert(characters)
    .values({
      region: "kr",
      gameMode: "standard",
      level: 10,
      firstSeenAt: daysAgo(3),
      lastSeenAt: hoursAgo(1),
      ...input,
      dataEnvironment: env,
      dataSource: source,
      verificationStatus: status,
      nameNormalized: normalizeName(input.characterName),
      slug: toSlug(input.characterName),
      id: input.id ?? `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    })
    .returning();
  return row!;
}

/** 수집 파이프라인 테스트용 관측 데이터 */
export function observation(overrides: Partial<CharacterObservationInput> & { name: string }): CharacterObservationInput {
  const { name, ...rest } = overrides;
  return {
    dataSource: "mock",
    observedAt: hoursAgo(10),
    sourceBuild: "mock-build-1",
    identity: { externalId: `ext-${name}`, region: "kr", gameMode: "standard", characterName: name },
    level: 10,
    factionCode: "horde",
    raceCode: "orc",
    classCode: "warrior",
    ...rest,
  };
}

/** mock-provisional 프로필의 랭킹 대상 16개 슬롯을 모두 같은 아이템 레벨로 채운다. */
export function fullEquipment(itemLevel: number, overrides: Record<string, number | null> = {}) {
  const slots = [
    "head", "neck", "shoulder", "back", "chest", "wrist", "hands", "waist", "legs", "feet",
    "finger_1", "finger_2", "trinket_1", "trinket_2", "main_hand", "off_hand",
  ];
  return slots.map((slot) => ({
    slotCode: slot,
    externalItemId: `item-${slot}-${overrides[slot] ?? itemLevel}`,
    name: `테스트 ${slot}`,
    itemSlotCode: slot === "main_hand" ? "one_hand" : slot,
    qualityCode: "rare",
    itemLevel: slot in overrides ? overrides[slot]! : itemLevel,
  }));
}
