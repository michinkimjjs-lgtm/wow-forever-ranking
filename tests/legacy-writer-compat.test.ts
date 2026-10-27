/**
 * 구버전 앱 호환 (migration 0007 §5, docs/HISTORY-PRESERVATION.md §8)
 *
 * migration을 적용한 뒤에도 이전 배포가 실행되는 기간(새 빌드 실패, 승격 전, 이전 배포로 되돌림)에는
 * 근거·판정을 모르는 구버전 앱이 level_milestones에 직접 쓴다. 아래의 "구버전 쓰기"는 main(c6fe8f5)의
 * lib/ingestion/ingest.ts upsertMilestone과 lib/mock/seed.ts resetMockData가 보내는 문장과 같은 컬럼·순서다.
 * 모든 값은 가상 테스트 값이다.
 */
import { asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ingestionRecords, levelMilestoneClaimAssessments, levelMilestoneEvidence, levelMilestones } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { ingestObservation } from "@/lib/ingestion/ingest";
import { createTestDb } from "./helpers/db";
import { hoursAgo, observation } from "./helpers/fixtures";

const live = { dataEnvironment: "live" as const, parserVersion: "legacy-compat-test" };
const mockCtx = { dataEnvironment: "mock" as const, parserVersion: "legacy-compat-test" };
const addon = (o: Parameters<typeof observation>[0]) => observation({ dataSource: "addon", ...o });
const rejects = (p: Promise<unknown>) => expect(p.then(() => "ok", () => "rejected")).resolves.toBe("rejected");

const milestones = (db: AppDatabase, characterId: string) =>
  db.select().from(levelMilestones).where(eq(levelMilestones.characterId, characterId)).orderBy(asc(levelMilestones.level));
const evidence = (db: AppDatabase, characterId: string) =>
  db
    .select()
    .from(levelMilestoneEvidence)
    .where(eq(levelMilestoneEvidence.characterId, characterId))
    .orderBy(asc(levelMilestoneEvidence.level), asc(levelMilestoneEvidence.observedAt));
const assessmentsOf = (db: AppDatabase, evidenceId: string) =>
  db.select().from(levelMilestoneClaimAssessments).where(eq(levelMilestoneClaimAssessments.evidenceId, evidenceId)).orderBy(asc(levelMilestoneClaimAssessments.seq));

/** main의 upsertMilestone이 새 레벨에 보내는 INSERT */
function legacyInsert(
  db: AppDatabase,
  v: { characterId: string; env: string; level: number; basis: string; reachedAt: Date | null; firstObservedAt: Date; previousObservedAt: Date | null; source: string; status: string; recordId: string; receivedAt: Date },
) {
  return db.execute(sql`insert into level_milestones (id, character_id, data_environment, level, timing_basis, reached_at, first_observed_at,
      previous_observed_at, created_at, updated_at, data_source, verification_status, source_build, snapshot_id, ingestion_record_id)
    values (gen_random_uuid(), ${v.characterId}, ${v.env}, ${v.level}, ${v.basis}, ${v.reachedAt}, ${v.firstObservedAt},
      ${v.previousObservedAt}, ${v.receivedAt}, ${v.receivedAt}, ${v.source}, ${v.status}, 'build-1', null, ${v.recordId})`);
}

/** main의 upsertMilestone이 기존 레벨에 보내는 UPDATE (더 좋은 근거·더 이른 관측) */
function legacyUpdate(db: AppDatabase, id: string, v: { basis: string; reachedAt: Date | null; firstObservedAt: Date; recordId: string; receivedAt: Date }) {
  return db.execute(sql`update level_milestones set timing_basis = ${v.basis}, reached_at = ${v.reachedAt}, first_observed_at = ${v.firstObservedAt},
      previous_observed_at = null, updated_at = ${v.receivedAt}, data_source = 'addon', verification_status = 'COMMUNITY_SUBMITTED',
      source_build = 'build-1', snapshot_id = null, ingestion_record_id = ${v.recordId}
    where id = ${id}`);
}

describe("구버전 앱의 level_milestones 쓰기 (실제 영역)", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;
  let characterId: string;
  let recordId: string;
  const receivedAt = new Date("2026-10-06T05:00:00Z");

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["live"]));
    // 새 앱으로 먼저 수집된 캐릭터 (레벨 10, 근거 기반 채택 기록)
    const first = await ingestObservation(db, live, addon({ name: "구버전호환", level: 10, observedAt: hoursAgo(50) }));
    characterId = first.characterId!;
    recordId = first.ingestionRecordId!;
  });
  afterAll(() => close());

  it("달성 시각 주장이 있는 새 레벨 쓰기는 실패하지 않고, 주장을 판정하지 않은 근거로 남기며 SOURCE_REPORTED로 채택하지 않는다", async () => {
    const base = { characterId, env: "live", source: "addon", status: "COMMUNITY_SUBMITTED", recordId, receivedAt, previousObservedAt: hoursAgo(50) };
    await legacyInsert(db, { ...base, level: 11, basis: "INFERRED", reachedAt: null, firstObservedAt: hoursAgo(40) });
    await legacyInsert(db, { ...base, level: 12, basis: "SOURCE_REPORTED", reachedAt: hoursAgo(41), firstObservedAt: hoursAgo(40) });

    const ms = await milestones(db, characterId);
    const ev = await evidence(db, characterId);
    const [record] = await db.select().from(ingestionRecords).where(eq(ingestionRecords.id, recordId));
    const recordReceivedAt = record!.receivedAt;
    const m12 = ms.find((m) => m.level === 12)!;
    const e12 = ev.find((e) => e.level === 12)!;
    expect(m12).toMatchObject({ timingBasis: "FIRST_OBSERVED", reachedAt: null, evidenceId: e12.id, claimAssessmentId: null, claimAssessmentStatus: null });
    expect(m12.effectiveReachedAt).toEqual(hoursAgo(40));
    expect(e12).toMatchObject({
      origin: "INGESTED",
      observationBasis: "FIRST_OBSERVED",
      claimedReachedAt: hoursAgo(41),
      receiptClaimStatus: "NEEDS_REVIEW",
      receiptClaimReasons: ["RECORDED_BY_LEGACY_WRITER"],
      observedAt: hoursAgo(40),
      previousObservedAt: hoursAgo(50),
      receivedAt: recordReceivedAt, // 연결된 수집 원본의 수신 시각
      ingestionRecordId: recordId,
      dataSource: "addon",
      verificationStatus: "COMMUNITY_SUBMITTED",
      region: "kr",
      gameMode: "standard",
    });
    // 판정하지 않았으므로 판정 기록은 만들지 않는다
    expect(await assessmentsOf(db, e12.id)).toHaveLength(0);
    const e11 = ev.find((e) => e.level === 11)!;
    expect(e11).toMatchObject({ observationBasis: "INFERRED", claimedReachedAt: null, receiptClaimStatus: "NONE", receiptClaimReasons: ["RECORDED_BY_LEGACY_WRITER"] });
    expect(ms.find((m) => m.level === 11)).toMatchObject({ timingBasis: "INFERRED", evidenceId: e11.id });
  });

  it("근거로 채택된 기존 기록의 갱신은 실패하지 않지만 적용되지 않는다 (채택 결과는 근거 기반 기록기만 바꾼다)", async () => {
    const before = (await milestones(db, characterId)).find((m) => m.level === 10)!;
    await legacyUpdate(db, before.id, { basis: "SOURCE_REPORTED", reachedAt: hoursAgo(55), firstObservedAt: hoursAgo(52), recordId, receivedAt });
    const after = (await milestones(db, characterId)).find((m) => m.level === 10)!;
    expect(after).toEqual(before);
  });

  it("근거·판정 연결을 직접 바꾸려는 선언되지 않은 쓰기는 거부한다", async () => {
    const [m10, m11] = await milestones(db, characterId);
    await rejects(db.execute(sql`update level_milestones set evidence_id = ${m11!.evidenceId} where id = ${m10!.id}`));
    await rejects(db.execute(sql`update level_milestones set evidence_id = null where id = ${m10!.id}`));
    await rejects(
      db.execute(sql`insert into level_milestones (character_id, data_environment, level, timing_basis, first_observed_at, data_source, verification_status, evidence_id)
        values (${characterId}, 'live', 30, 'FIRST_OBSERVED', ${hoursAgo(1)}, 'addon', 'COMMUNITY_SUBMITTED', ${m10!.evidenceId})`),
    );
  });

  it("새 앱으로 돌아오면 구버전이 남긴 주장을 다시 판정해 판정 기록을 추가하고, 인정되면 SOURCE_REPORTED로 채택한다", async () => {
    // 레벨 13 관측: 레벨 10(50시간 전) 관측이 12레벨 달성 주장(41시간 전)을 뒷받침한다
    await ingestObservation(db, live, addon({ name: "구버전호환", level: 13, observedAt: hoursAgo(30) }));
    const e12 = (await evidence(db, characterId)).find((e) => e.level === 12)!;
    const history = await assessmentsOf(db, e12.id);
    expect(history.map((a) => [a.kind, a.status])).toEqual([["REASSESSMENT", "ACCEPTED"]]);
    expect(e12.receiptClaimStatus).toBe("NEEDS_REVIEW"); // 근거 행은 바뀌지 않는다
    const m12 = (await milestones(db, characterId)).find((m) => m.level === 12)!;
    expect(m12).toMatchObject({ timingBasis: "SOURCE_REPORTED", reachedAt: hoursAgo(41), evidenceId: e12.id, claimAssessmentId: history[0]!.id, claimAssessmentStatus: "ACCEPTED" });
  });

  it("근거 기반 기록기 선언은 트랜잭션 안에서만 유효하다 (같은 연결의 다음 구버전 쓰기는 다시 구버전 쓰기로 처리)", async () => {
    await legacyInsert(db, {
      characterId, env: "live", source: "addon", status: "COMMUNITY_SUBMITTED", recordId, receivedAt,
      level: 14, basis: "SOURCE_REPORTED", reachedAt: hoursAgo(21), firstObservedAt: hoursAgo(20), previousObservedAt: hoursAgo(30),
    });
    const m14 = (await milestones(db, characterId)).find((m) => m.level === 14)!;
    expect(m14).toMatchObject({ timingBasis: "FIRST_OBSERVED", reachedAt: null, claimAssessmentId: null });
  });

  it("모든 채택 기록이 근거를 가리키고, SOURCE_REPORTED ⇔ ACCEPTED 판정 연결이 유지된다", async () => {
    const rows = await db.select().from(levelMilestones);
    expect(rows.length).toBeGreaterThan(0);
    for (const m of rows) {
      expect(m.evidenceId).not.toBeNull();
      expect(m.timingBasis === "SOURCE_REPORTED").toBe(m.claimAssessmentId !== null);
    }
  });

  it("실제 영역에서는 구버전 쓰기라도 채택 기록·근거를 삭제할 수 없다", async () => {
    const count = await db.$count(levelMilestoneEvidence);
    await rejects(db.execute(sql`delete from level_milestones where data_environment = 'live'`));
    expect(await db.$count(levelMilestoneEvidence)).toBe(count);
  });
});

describe("구버전 mock 초기화 (main의 resetMockData 삭제 순서)", () => {
  it("새 앱이 남긴 근거·판정 기록이 있어도 구버전 초기화가 실패하지 않는다", async () => {
    const { db, close } = await createTestDb(["mock"]);
    await ingestObservation(db, mockCtx, observation({ name: "초기화", level: 10, observedAt: hoursAgo(20), levelReachedAt: hoursAgo(22) }));
    await ingestObservation(db, mockCtx, observation({ name: "초기화", level: 12, observedAt: hoursAgo(10) }));
    expect(await db.$count(levelMilestoneClaimAssessments)).toBeGreaterThan(0);
    // main lib/mock/seed.ts resetMockData와 같은 순서 (근거·판정 기록 테이블을 모른다)
    await db.transaction(async (tx) => {
      for (const table of [
        "level_milestones", "character_snapshots", "character_items", "character_external_refs", "characters",
        "guild_external_refs", "guilds", "items", "ingestion_records",
      ]) {
        await tx.execute(sql.raw(`delete from ${table} where data_environment = 'mock'`));
      }
    });
    expect(await db.$count(levelMilestoneEvidence)).toBe(0);
    expect(await db.$count(levelMilestoneClaimAssessments)).toBe(0);
    await close();
  });
});
