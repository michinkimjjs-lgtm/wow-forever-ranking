/**
 * Mock seed (명세서 §6.4-6)
 *
 * 다음을 모두 만족할 때만 실행한다. 하나라도 어긋나면 아무것도 쓰지 않는다.
 * 1) APP_DATA_ENVIRONMENT = mock
 * 2) database_identity = {mock}
 * 3) 실행 인자 --confirm-mock
 */
import { eq } from "drizzle-orm";
import {
  characterExternalRefs,
  characterItems,
  characters,
  characterSnapshots,
  guildExternalRefs,
  guilds,
  ingestionRecords,
  items,
  levelMilestones,
} from "@/db/schema";
import { readDatabaseIdentity } from "@/db/identity";
import type { AppDatabase } from "@/db/types";
import type { DataEnvironment } from "@/lib/domain/enums";
import { ingestObservation } from "@/lib/ingestion/ingest";
import { getMockProvider } from "@/providers/registry";
import { createDeterministicIdGenerator } from "./random";
import { DEFAULT_MOCK_SEED, startOfUtcDay, type MockDatasetOptions } from "./generator";

export class MockSeedRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MockSeedRefusedError";
  }
}

export const MOCK_PARSER_VERSION = "mock-1";

export async function assertMockSeedAllowed(
  db: AppDatabase,
  input: { appEnv: DataEnvironment; confirmed: boolean },
): Promise<void> {
  if (input.appEnv !== "mock") {
    throw new MockSeedRefusedError(`APP_DATA_ENVIRONMENT가 mock이 아닙니다(${input.appEnv}). mock seed를 실행하지 않습니다.`);
  }
  if (!input.confirmed) {
    throw new MockSeedRefusedError("--confirm-mock 인자가 없습니다. mock seed를 실행하지 않습니다.");
  }
  const allowed = await readDatabaseIdentity(db);
  if (!allowed || allowed.length !== 1 || allowed[0] !== "mock") {
    throw new MockSeedRefusedError(
      `이 데이터베이스는 mock 전용이 아닙니다(허용 영역: ${allowed ? allowed.join(", ") : "없음"}). mock seed를 실행하지 않습니다.`,
    );
  }
}

/** mock 영역 데이터만 지운다. (외래 키 순서대로) */
export async function resetMockData(db: AppDatabase): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(levelMilestones).where(eq(levelMilestones.dataEnvironment, "mock"));
    await tx.delete(characterSnapshots).where(eq(characterSnapshots.dataEnvironment, "mock"));
    await tx.delete(characterItems).where(eq(characterItems.dataEnvironment, "mock"));
    await tx.delete(characterExternalRefs).where(eq(characterExternalRefs.dataEnvironment, "mock"));
    await tx.delete(characters).where(eq(characters.dataEnvironment, "mock"));
    await tx.delete(guildExternalRefs).where(eq(guildExternalRefs.dataEnvironment, "mock"));
    await tx.delete(guilds).where(eq(guilds.dataEnvironment, "mock"));
    await tx.delete(items).where(eq(items.dataEnvironment, "mock"));
    await tx.delete(ingestionRecords).where(eq(ingestionRecords.dataEnvironment, "mock"));
  });
}

export interface MockSeedSummary {
  seed: number;
  anchor: Date;
  observations: number;
  accepted: number;
  rejected: number;
  conflicts: number;
}

export async function seedMockDatabase(
  db: AppDatabase,
  input: { appEnv: DataEnvironment; confirmed: boolean; options?: MockDatasetOptions },
): Promise<MockSeedSummary> {
  await assertMockSeedAllowed(db, input);
  const provider = getMockProvider(input.appEnv, input.options);
  const observations = provider.listObservations();
  const seed = input.options?.seed ?? DEFAULT_MOCK_SEED;
  const newId = createDeterministicIdGenerator(seed);

  await resetMockData(db);

  const summary: MockSeedSummary = {
    seed,
    anchor: input.options?.anchor ?? startOfUtcDay(new Date()),
    observations: observations.length,
    accepted: 0,
    rejected: 0,
    conflicts: 0,
  };
  for (const observation of observations) {
    const result = await ingestObservation(
      db,
      {
        dataEnvironment: "mock",
        parserVersion: MOCK_PARSER_VERSION,
        newId,
        receivedAt: new Date(observation.observedAt as Date),
      },
      observation,
    );
    if (result.status === "ACCEPTED") summary.accepted += 1;
    else if (result.status === "REJECTED") summary.rejected += 1;
    else summary.conflicts += 1;
  }
  return summary;
}
