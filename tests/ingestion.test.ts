import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { characters, characterSnapshots, ingestionRecords, levelMilestones } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { ingestObservation, IngestionError } from "@/lib/ingestion/ingest";
import { createTestDb } from "./helpers/db";
import { fullEquipment, hoursAgo, observation } from "./helpers/fixtures";

const ctx = { dataEnvironment: "mock" as const, parserVersion: "test-1" };

async function milestonesOf(db: AppDatabase, characterId: string) {
  const rows = await db.select().from(levelMilestones).where(eq(levelMilestones.characterId, characterId));
  return Object.fromEntries(rows.map((r) => [r.level, r]));
}

describe("수집 파이프라인과 레벨 달성 기록", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["mock"]));
  });
  afterAll(() => close());

  it("처음 관측한 캐릭터는 현재 레벨만 FIRST_OBSERVED로 기록한다", async () => {
    const result = await ingestObservation(db, ctx, observation({ name: "신규", level: 12, observedAt: hoursAgo(30) }));
    expect(result.status).toBe("ACCEPTED");
    const ms = await milestonesOf(db, result.characterId!);
    expect(Object.keys(ms)).toEqual(["12"]);
    expect(ms[12]!.timingBasis).toBe("FIRST_OBSERVED");
    expect(ms[12]!.effectiveReachedAt.toISOString()).toBe(hoursAgo(30).toISOString());
  });

  it("관측 사이에 여러 레벨이 오르면 중간 레벨은 INFERRED, 마지막 레벨은 실제 시각(SOURCE_REPORTED)으로 기록한다", async () => {
    await ingestObservation(db, ctx, observation({ name: "도약", level: 10, observedAt: hoursAgo(40) }));
    const reached = hoursAgo(25);
    const result = await ingestObservation(
      db,
      ctx,
      observation({ name: "도약", level: 13, observedAt: hoursAgo(20), levelReachedAt: reached }),
    );
    const ms = await milestonesOf(db, result.characterId!);
    expect(ms[11]!.timingBasis).toBe("INFERRED");
    expect(ms[12]!.timingBasis).toBe("INFERRED");
    expect(ms[11]!.previousObservedAt?.toISOString()).toBe(hoursAgo(40).toISOString());
    expect(ms[13]!.timingBasis).toBe("SOURCE_REPORTED");
    expect(ms[13]!.reachedAt?.toISOString()).toBe(reached.toISOString());
    expect(ms[13]!.firstObservedAt.toISOString()).toBe(hoursAgo(20).toISOString());
    expect(ms[13]!.effectiveReachedAt.toISOString()).toBe(reached.toISOString());

    const [c] = await db.select().from(characters).where(eq(characters.id, result.characterId!));
    expect(c!.level).toBe(13);
    expect(c!.currentLevelReachedAt?.toISOString()).toBe(reached.toISOString());
    expect(c!.currentLevelTimingBasis).toBe("SOURCE_REPORTED");
  });

  it("같은 레벨에 더 좋은 근거(실제 달성 시각)가 들어오면 milestone을 갱신한다", async () => {
    await ingestObservation(db, ctx, observation({ name: "보정", level: 5, observedAt: hoursAgo(50) }));
    const first = await ingestObservation(db, ctx, observation({ name: "보정", level: 6, observedAt: hoursAgo(40) }));
    let ms = await milestonesOf(db, first.characterId!);
    expect(ms[6]!.timingBasis).toBe("FIRST_OBSERVED");

    await ingestObservation(
      db,
      ctx,
      observation({ name: "보정", level: 6, observedAt: hoursAgo(30), levelReachedAt: hoursAgo(45) }),
    );
    ms = await milestonesOf(db, first.characterId!);
    expect(ms[6]!.timingBasis).toBe("SOURCE_REPORTED");
    expect(ms[6]!.effectiveReachedAt.toISOString()).toBe(hoursAgo(45).toISOString());
    // first_observed_at은 더 이른 값을 유지한다.
    expect(ms[6]!.firstObservedAt.toISOString()).toBe(hoursAgo(40).toISOString());
  });

  it("레벨이 낮아진 관측은 현재 상태에 반영하지 않고 식별 충돌로 기록한다", async () => {
    await ingestObservation(db, ctx, observation({ name: "충돌", level: 20, observedAt: hoursAgo(10) }));
    const result = await ingestObservation(db, ctx, observation({ name: "충돌", level: 3, observedAt: hoursAgo(5) }));
    expect(result.status).toBe("IDENTITY_CONFLICT");
    const [c] = await db.select().from(characters).where(eq(characters.nameNormalized, "충돌"));
    expect(c!.level).toBe(20);
    const [record] = await db.select().from(ingestionRecords).where(eq(ingestionRecords.id, result.ingestionRecordId!));
    expect(record!.status).toBe("IDENTITY_CONFLICT");
  });

  it("늦게 도착한 오래된 관측은 현재 상태를 덮어쓰지 않는다", async () => {
    await ingestObservation(db, ctx, observation({ name: "역순", level: 15, observedAt: hoursAgo(10) }));
    const result = await ingestObservation(db, ctx, observation({ name: "역순", level: 12, observedAt: hoursAgo(30) }));
    expect(result.status).toBe("ACCEPTED");
    const [c] = await db.select().from(characters).where(eq(characters.id, result.characterId!));
    expect(c!.level).toBe(15);
    expect(c!.lastSeenAt.toISOString()).toBe(hoursAgo(10).toISOString());
    expect(c!.firstSeenAt.toISOString()).toBe(hoursAgo(30).toISOString());
  });

  it("payload의 순위 필드는 제거하고 경고로 남긴다", async () => {
    const payload = { ...observation({ name: "순위조작", level: 9 }), rank: 1, position: 1 };
    const result = await ingestObservation(db, ctx, payload);
    expect(result.status).toBe("ACCEPTED");
    expect(result.warnings).toHaveLength(2);
    const [record] = await db.select().from(ingestionRecords).where(eq(ingestionRecords.id, result.ingestionRecordId!));
    expect(record!.warnings).toHaveLength(2);
  });

  it("payload가 다른 데이터 영역을 주장하면 거부한다", async () => {
    const payload = { ...observation({ name: "영역주장", level: 9 }), dataEnvironment: "live" };
    const result = await ingestObservation(db, ctx, payload);
    expect(result.status).toBe("REJECTED");
    const found = await db.select().from(characters).where(eq(characters.nameNormalized, "영역주장"));
    expect(found).toHaveLength(0);
  });

  it("mock 영역에 실제 공급원 데이터를 넣으려 하면 원본조차 저장하지 않는다", async () => {
    await expect(
      ingestObservation(db, ctx, observation({ name: "실제데이터", dataSource: "addon" })),
    ).rejects.toThrow(IngestionError);
  });

  it("형식이 잘못된 관측은 REJECTED로 기록한다", async () => {
    const result = await ingestObservation(db, ctx, { ...observation({ name: "잘못됨" }), level: -1 });
    expect(result.status).toBe("REJECTED");
    expect(result.reason).toContain("level");
  });

  it("장비를 Gear Profile로 계산해 저장하고, 내용이 같으면 스냅샷을 다시 만들지 않는다", async () => {
    const equipment = fullEquipment(20, { head: 28 });
    const a = await ingestObservation(db, ctx, observation({ name: "장비", level: 20, observedAt: hoursAgo(12), equipment }));
    await ingestObservation(db, ctx, observation({ name: "장비", level: 20, observedAt: hoursAgo(11), equipment }));
    const [c] = await db.select().from(characters).where(eq(characters.id, a.characterId!));
    expect(c!.averageItemLevel).toBe(20.5);
    expect(c!.highestItemLevel).toBe(28);
    expect(c!.gearCoverage).toBe(1);
    expect(c!.gearProfileId).toBe("mock-provisional");
    const snapshots = await db.select().from(characterSnapshots).where(eq(characterSnapshots.characterId, a.characterId!));
    expect(snapshots).toHaveLength(1);

    // 24시간이 지나면 내용이 같아도 스냅샷을 저장한다.
    await ingestObservation(db, ctx, observation({ name: "장비", level: 20, observedAt: hoursAgo(-13), equipment }));
    const after = await db.select().from(characterSnapshots).where(eq(characterSnapshots.characterId, a.characterId!));
    expect(after).toHaveLength(2);
  });

  it("외부 ID가 같으면 이름이 바뀌어도 같은 캐릭터로 연결한다", async () => {
    const before = await ingestObservation(
      db,
      ctx,
      observation({ name: "옛이름", identity: { externalId: "ext-rename", region: "kr", gameMode: "standard", characterName: "옛이름" } }),
    );
    const after = await ingestObservation(
      db,
      ctx,
      observation({
        name: "새이름",
        observedAt: hoursAgo(5),
        identity: { externalId: "ext-rename", region: "kr", gameMode: "standard", characterName: "새이름" },
      }),
    );
    expect(after.characterId).toBe(before.characterId);
    const [c] = await db.select().from(characters).where(eq(characters.id, after.characterId!));
    expect(c!.slug).toBe("새이름");
  });

  it("같은 이름이라도 다른 외부 ID면 식별 충돌로 기록한다", async () => {
    await ingestObservation(
      db,
      ctx,
      observation({ name: "동명", identity: { externalId: "ext-a", region: "kr", gameMode: "standard", characterName: "동명" } }),
    );
    const result = await ingestObservation(
      db,
      ctx,
      observation({
        name: "동명",
        observedAt: hoursAgo(1),
        identity: { externalId: "ext-b", region: "kr", gameMode: "standard", characterName: "동명" },
      }),
    );
    expect(result.status).toBe("IDENTITY_CONFLICT");
  });
});
