/**
 * 역사 기록 보존 Phase 1 (docs/HISTORY-PRESERVATION.md)
 *
 * - 기존 level_milestones → level_milestone_evidence 이관 (migration 0007)
 * - 근거는 추가만, 현재 채택 기록은 근거에서 다시 고름
 * - 캐릭터 삭제가 스냅샷·milestone·근거를 연쇄 삭제하지 않음 (migration 0008)
 * - 달성 시각 주장 판정: 미래 / 순서 모순 / 뒷받침 없음 / 신뢰 수준
 * - 도착 순서와 무관한 판정·채택 (재판정 이력은 level_milestone_claim_assessments에 추가)
 * - 채택 기록이 다른 캐릭터·레벨의 근거나 다른 근거의 판정을 가리키지 못하게 하는 DB 제약
 * 모든 값은 가상 테스트 값이다.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initDatabaseIdentity } from "@/db/identity";
import * as schema from "@/db/schema";
import { characterSnapshots, characters, levelMilestoneClaimAssessments, levelMilestoneEvidence, levelMilestones } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { ingestObservation } from "@/lib/ingestion/ingest";
import { chooseAdoptedEvidence, evaluateClaims, type ClaimAssessment, type EvidenceFact } from "@/lib/ingestion/milestone-evidence";
import { getLevelRanking } from "@/lib/ranking";
import { createTestDb } from "./helpers/db";
import { hoursAgo, NOW, observation } from "./helpers/fixtures";

const beta = { dataEnvironment: "beta" as const, parserVersion: "history-test" };
const mockCtx = { dataEnvironment: "mock" as const, parserVersion: "history-test" };
const addon = (o: Parameters<typeof observation>[0]) => observation({ dataSource: "addon", ...o });

async function evidenceOf(db: AppDatabase, characterId: string, level?: number) {
  const rows = await db
    .select()
    .from(levelMilestoneEvidence)
    .where(eq(levelMilestoneEvidence.characterId, characterId))
    .orderBy(asc(levelMilestoneEvidence.level), asc(levelMilestoneEvidence.createdAt), asc(levelMilestoneEvidence.observedAt));
  return level === undefined ? rows : rows.filter((r) => r.level === level);
}
async function milestoneOf(db: AppDatabase, characterId: string, level: number) {
  const [row] = await db
    .select()
    .from(levelMilestones)
    .where(eq(levelMilestones.characterId, characterId))
    .then((rows) => rows.filter((r) => r.level === level));
  return row;
}
const rejects = (p: Promise<unknown>) => expect(p.then(() => "ok", () => "rejected")).resolves.toBe("rejected");

// ---------------------------------------------------------------------------
// 1. 기존 milestone 이관
// ---------------------------------------------------------------------------
describe("기존 level_milestones 이관 (migration 0007)", () => {
  const T0 = new Date("2026-09-01T00:00:00Z");
  const T1 = new Date("2026-09-02T00:00:00Z");
  const T2 = new Date("2026-09-03T00:00:00Z");
  const T3 = new Date("2026-09-04T00:00:00Z");
  /** 레벨 11 실제 달성 시각: 레벨 10 관측(T1) 이후, 레벨 11 최초 관측(T2) 이전 */
  const REACHED11 = new Date("2026-09-02T12:00:00Z");
  const RECEIVED = new Date("2026-09-02T00:05:00Z");
  const ids = {
    character: "00000000-0000-4000-8000-000000000001",
    record: "00000000-0000-4000-8000-000000000002",
    snap1: "00000000-0000-4000-8000-000000000003",
    snap2: "00000000-0000-4000-8000-000000000004",
    m9: "00000000-0000-4000-8000-000000000009",
    m10: "00000000-0000-4000-8000-000000000010",
    m11: "00000000-0000-4000-8000-000000000011",
  };
  let client: PGlite;
  let db: AppDatabase;
  let before: Record<string, unknown>[];
  let dir: string;

  beforeAll(async () => {
    // 0006까지만 적용한 옛 DB를 만든다.
    dir = mkdtempSync(join(tmpdir(), "fr-migrations-"));
    cpSync("db/migrations", dir, { recursive: true });
    const journalPath = join(dir, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { tag: string }[] };
    const cut = journal.entries.findIndex((e) => e.tag.startsWith("0007_"));
    writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.slice(0, cut) }));
    client = new PGlite({ extensions: { pg_trgm } });
    const d = drizzle(client, { schema });
    await migrate(d, { migrationsFolder: dir });
    db = d as unknown as AppDatabase;
    await initDatabaseIdentity(db, ["beta"]);

    const q = (text: string, params: unknown[] = []) => client.query(text, params);
    await q(
      `insert into characters (id, data_environment, region, game_mode, character_name, name_normalized, slug, level,
        class_code, faction_code, first_seen_at, last_seen_at, data_source, verification_status)
       values ($1, 'beta', 'test-region', 'normal', '이관 캐릭터', '이관 캐릭터', '이관 캐릭터', 11, 'mage', 'alliance', $2, $3, 'addon', 'COMMUNITY_SUBMITTED')`,
      [ids.character, T1, T3],
    );
    await q(
      `insert into ingestion_records (id, data_environment, data_source, parser_version, received_at, payload, payload_hash, status)
       values ($1, 'beta', 'addon', 'legacy', $2, '{}', 'h', 'ACCEPTED')`,
      [ids.record, RECEIVED],
    );
    // 스냅샷 1: T1 관측. 당시 직업은 warrior (현재 캐릭터 값 mage와 다름)
    await q(
      `insert into character_snapshots (id, character_id, data_environment, observed_at, level, normalized_data, content_hash, data_source, verification_status)
       values ($1, $2, 'beta', $3, 10, $4, 'c1', 'addon', 'COMMUNITY_SUBMITTED')`,
      [ids.snap1, ids.character, T1, JSON.stringify({ characterName: "이관 캐릭터", classCode: "warrior", raceCode: "orc", factionCode: "horde" })],
    );
    await q(
      `insert into character_snapshots (id, character_id, data_environment, observed_at, level, normalized_data, content_hash, data_source, verification_status)
       values ($1, $2, 'beta', $3, 11, $4, 'c2', 'addon', 'COMMUNITY_SUBMITTED')`,
      [ids.snap2, ids.character, T3, JSON.stringify({ characterName: "이관 캐릭터", classCode: "mage" })],
    );
    const insertMilestone = (id: string, level: number, basis: string, reachedAt: Date | null, firstObserved: Date, snapshotId: string | null, recordId: string | null) =>
      q(
        `insert into level_milestones (id, character_id, data_environment, level, timing_basis, reached_at, first_observed_at, previous_observed_at,
          data_source, verification_status, source_build, snapshot_id, ingestion_record_id, created_at, updated_at)
         values ($1, $2, 'beta', $3, $4, $5, $6, $7, 'addon', 'COMMUNITY_SUBMITTED', '1.0.0', $8, $9, $10, $10)`,
        [id, ids.character, level, basis, reachedAt, firstObserved, T0, snapshotId, recordId, RECEIVED],
      );
    await insertMilestone(ids.m9, 9, "INFERRED", null, T1, ids.snap1, ids.record);
    await insertMilestone(ids.m10, 10, "FIRST_OBSERVED", null, T1, ids.snap1, ids.record);
    // 11: 실제 달성 시각 기록. 연결된 스냅샷(T3)은 최초 관측(T2)과 다른 시각 → 맥락을 옮기지 않아야 한다
    await insertMilestone(ids.m11, 11, "SOURCE_REPORTED", REACHED11, T2, ids.snap2, null);
    before = (await client.query(`select * from level_milestones order by level`)).rows as Record<string, unknown>[];

    // 전체 migration 적용 (0007 이관 + 0008 보호)
    await migrate(d, { migrationsFolder: "db/migrations" });
  });
  afterAll(async () => {
    await client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("milestone마다 근거 1행을 만들고 evidence_id로 연결한다. 기존 milestone 값과 updated_at은 바뀌지 않는다", async () => {
    const evidence = await evidenceOf(db, ids.character);
    expect(evidence).toHaveLength(3);
    const after = (await client.query(`select * from level_milestones order by level`)).rows as Record<string, unknown>[];
    expect(after).toHaveLength(3);
    for (let i = 0; i < 3; i += 1) {
      const { evidence_id: evidenceId, ...rest } = after[i]!;
      delete rest.claim_assessment_id;
      delete rest.claim_assessment_status;
      expect(rest).toEqual(before[i]);
      expect(evidence.find((e) => e.id === evidenceId)?.level).toBe(before[i]!.level);
    }
  });

  it("원래 시간 근거는 legacy_timing_basis에 보존하고, 실제 달성 시각 기록은 이관 판정(ACCEPTED)으로 연결한다", async () => {
    const [e9, e10, e11] = await evidenceOf(db, ids.character);
    expect(e9).toMatchObject({ level: 9, observationBasis: "INFERRED", legacyTimingBasis: "INFERRED", receiptClaimStatus: "NONE", claimedReachedAt: null, origin: "MIGRATED" });
    expect(e10).toMatchObject({ level: 10, observationBasis: "FIRST_OBSERVED", legacyTimingBasis: "FIRST_OBSERVED", receiptClaimStatus: "NONE" });
    // 관측 근거는 출처를 알 수 없어 낮은 쪽(INFERRED)으로, 달성 시각 주장은 그대로
    expect(e11).toMatchObject({ level: 11, observationBasis: "INFERRED", legacyTimingBasis: "SOURCE_REPORTED", receiptClaimStatus: "ACCEPTED", claimedReachedAt: REACHED11 });
    for (const e of [e9!, e10!, e11!]) {
      expect(e).toMatchObject({
        dataEnvironment: "beta",
        dataSource: "addon",
        verificationStatus: "COMMUNITY_SUBMITTED",
        sourceBuild: "1.0.0",
        previousObservedAt: T0,
        region: "test-region",
        gameMode: "normal",
        origin: "MIGRATED",
      });
      expect(e.receiptClaimReasons).toEqual(["MIGRATED_FROM_LEVEL_MILESTONES"]);
    }
    expect(e10!.observedAt).toEqual(T1);
    expect(e11!.observedAt).toEqual(T2);
    const assessments = await db.select().from(levelMilestoneClaimAssessments);
    expect(assessments).toHaveLength(1);
    expect(assessments[0]).toMatchObject({ evidenceId: e11!.id, status: "ACCEPTED", kind: "MIGRATED", ingestionRecordId: null });
    const m11 = (await milestoneOf(db, ids.character, 11))!;
    expect(m11).toMatchObject({ timingBasis: "SOURCE_REPORTED", evidenceId: e11!.id, claimAssessmentId: assessments[0]!.id, claimAssessmentStatus: "ACCEPTED" });
    expect((await milestoneOf(db, ids.character, 10))!).toMatchObject({ claimAssessmentId: null, claimAssessmentStatus: null });
  });

  it("맥락은 같은 관측 시각의 스냅샷에서만 옮기고, 확인되지 않으면 null로 둔다 (현재 캐릭터 값을 쓰지 않는다)", async () => {
    const [e9, e10, e11] = await evidenceOf(db, ids.character);
    for (const e of [e9!, e10!]) {
      expect(e).toMatchObject({ characterName: "이관 캐릭터", classCode: "warrior", raceCode: "orc", factionCode: "horde", guildId: null });
      expect(e.snapshotId).toBe(ids.snap1);
      expect(e.receivedAt).toEqual(RECEIVED);
    }
    expect(e11).toMatchObject({ characterName: null, classCode: null, raceCode: null, factionCode: null, receivedAt: null, snapshotId: ids.snap2 });
  });

  it("DB가 다른 캐릭터·다른 레벨의 근거 연결, 이관 근거 중복, 다른 근거의 판정 연결을 거부한다", async () => {
    const [e9, e10, e11] = await evidenceOf(db, ids.character);
    const q = (text: string, params: unknown[]) => client.query(text, params).then(() => "allowed", () => "rejected");
    // 다른 레벨의 근거
    expect(await q(`update level_milestones set evidence_id = $1 where id = $2`, [e9!.id, ids.m10])).toBe("rejected");
    // 같은 근거를 두 채택 기록이 공유 (m9의 근거를 m10이 가리킴) = 다른 레벨 연결과 같으므로 거부
    expect(await q(`update level_milestones set evidence_id = $1 where id = $2`, [e10!.id, ids.m9])).toBe("rejected");
    // 다른 캐릭터의 근거
    const other = "00000000-0000-4000-8000-0000000000c2";
    await client.query(
      `insert into characters (id, data_environment, region, game_mode, character_name, name_normalized, slug, level, first_seen_at, last_seen_at, data_source, verification_status)
       values ($1, 'beta', 'test-region', 'normal', '다른 캐릭터', '다른 캐릭터', '다른 캐릭터', 10, $2, $2, 'addon', 'COMMUNITY_SUBMITTED')`,
      [other, T1],
    );
    const insertEvidence = (characterId: string, level: number) =>
      client.query(
        `insert into level_milestone_evidence (character_id, data_environment, level, observation_basis, receipt_claim_status, legacy_timing_basis,
          observed_at, data_source, verification_status, region, game_mode, origin)
         values ($1, 'beta', $2, 'FIRST_OBSERVED', 'NONE', 'FIRST_OBSERVED', $3, 'addon', 'COMMUNITY_SUBMITTED', 'test-region', 'normal', 'MIGRATED') returning id`,
        [characterId, level, T1],
      );
    const otherEvidence = ((await insertEvidence(other, 10)).rows[0] as { id: string }).id;
    expect(await q(`update level_milestones set evidence_id = $1 where id = $2`, [otherEvidence, ids.m10])).toBe("rejected");
    // 같은 캐릭터·레벨의 이관 근거 중복
    expect(await insertEvidence(ids.character, 10).then(() => "allowed", () => "rejected")).toBe("rejected");
    // SOURCE_REPORTED 채택 기록이 다른 근거의 판정을 가리킴 / 판정 없이 SOURCE_REPORTED / ACCEPTED가 아닌 판정
    const [assessment] = await db.select().from(levelMilestoneClaimAssessments);
    expect(await q(`update level_milestones set evidence_id = $1 where id = $2`, [e10!.id, ids.m10])).toBe("allowed");
    expect(
      await q(`update level_milestones set timing_basis = 'SOURCE_REPORTED', reached_at = $1, claim_assessment_id = $2, claim_assessment_status = 'ACCEPTED' where id = $3`, [T0, assessment!.id, ids.m10]),
    ).toBe("rejected");
    expect(await q(`update level_milestones set claim_assessment_id = null, claim_assessment_status = null where id = $1`, [ids.m11])).toBe("rejected");
    expect(await q(`update level_milestones set claim_assessment_status = 'NEEDS_REVIEW' where id = $1`, [ids.m11])).toBe("rejected");
    // 근거와 판정 기록은 수정할 수 없다
    expect(await q(`update level_milestone_claim_assessments set status = 'CONFLICT'`, [])).toBe("rejected");
    expect(await q(`delete from level_milestone_claim_assessments`, [])).toBe("rejected");
    expect(e11!.id).toBeDefined();
  });

  it("이관 후 새 관측이 들어와도 이관 근거는 그대로이고, 이관된 실제 달성 시각 기록이 낮아지지 않는다", async () => {
    const snapshot = (await evidenceOf(db, ids.character)).filter((e) => e.origin === "MIGRATED");
    await ingestObservation(
      db,
      beta,
      addon({ name: "이관 캐릭터", level: 11, observedAt: new Date("2026-09-05T00:00:00Z"), identity: { externalId: null, region: "test-region", gameMode: "normal", characterName: "이관 캐릭터" } }),
    );
    const after = await evidenceOf(db, ids.character);
    expect(after.filter((e) => e.origin === "MIGRATED")).toEqual(snapshot);
    expect(await milestoneOf(db, ids.character, 11)).toMatchObject({ timingBasis: "SOURCE_REPORTED", reachedAt: REACHED11 });
  });

  it("회귀: 이관 판정을 같은 ACCEPTED로 다시 확인할 때는 재판정 행을 추가하지 않고, 채택 기록은 이관 판정을 계속 가리킨다", async () => {
    const [e11] = await evidenceOf(db, ids.character, 11);
    const before = await latestAssessment(db, e11!.id);
    expect(before.map((a) => [a.kind, a.status, a.reasons])).toEqual([["MIGRATED", "ACCEPTED", ["MIGRATED_FROM_LEVEL_MILESTONES"]]]);
    // 직전 테스트에서 이미 한 번 관측됐다. 한 번 더 관측해도 판정 이력은 늘지 않는다.
    await ingestObservation(
      db,
      beta,
      addon({ name: "이관 캐릭터", level: 11, observedAt: new Date("2026-09-05T12:00:00Z"), identity: { externalId: null, region: "test-region", gameMode: "normal", characterName: "이관 캐릭터" } }),
    );
    expect(await latestAssessment(db, e11!.id)).toEqual(before);
    expect((await milestoneOf(db, ids.character, 11))!).toMatchObject({
      timingBasis: "SOURCE_REPORTED",
      reachedAt: REACHED11,
      evidenceId: e11!.id,
      claimAssessmentId: before[0]!.id,
      claimAssessmentStatus: "ACCEPTED",
    });
  });

  it("이관된 기록이라도 알려진 관측과 모순되면 다음 관측 때 충돌로 재판정되고 채택에서 빠진다", async () => {
    // 레벨 10을 T1(9/2)에 관측했는데 레벨 12를 9/1에 달성했다는 이관 기록
    await client.query(
      `insert into level_milestone_evidence (character_id, data_environment, level, observation_basis, claimed_reached_at, receipt_claim_status,
        legacy_timing_basis, observed_at, data_source, verification_status, region, game_mode, origin)
       values ($1, 'beta', 12, 'INFERRED', $2, 'ACCEPTED', 'SOURCE_REPORTED', $3, 'addon', 'COMMUNITY_SUBMITTED', 'test-region', 'normal', 'MIGRATED')`,
      [ids.character, T0, T3],
    );
    await ingestObservation(
      db,
      beta,
      addon({ name: "이관 캐릭터", level: 12, observedAt: new Date("2026-09-06T00:00:00Z"), identity: { externalId: null, region: "test-region", gameMode: "normal", characterName: "이관 캐릭터" } }),
    );
    const [legacy] = (await evidenceOf(db, ids.character, 12)).filter((e) => e.origin === "MIGRATED");
    const [latest] = await latestAssessment(db, legacy!.id);
    expect(latest).toMatchObject({ kind: "REASSESSMENT", status: "CONFLICT" });
    expect((await milestoneOf(db, ids.character, 12))!.timingBasis).not.toBe("SOURCE_REPORTED");
    expect(await milestoneOf(db, ids.character, 11)).toMatchObject({ timingBasis: "SOURCE_REPORTED", reachedAt: REACHED11 });
  });

  it("회귀: 이관 판정(ACCEPTED)이 실제로 바뀌면 재판정 행을 기록하고 채택에서 뺀다", async () => {
    const [e11] = await evidenceOf(db, ids.character, 11);
    // 9/2 18시에는 아직 레벨 10이었다는 관측이 늦게 도착 → 9/2 12시 레벨 11 달성 이관 기록과 모순
    await ingestObservation(
      db,
      beta,
      addon({ name: "이관 캐릭터", level: 10, observedAt: new Date("2026-09-02T18:00:00Z"), identity: { externalId: null, region: "test-region", gameMode: "normal", characterName: "이관 캐릭터" } }),
    );
    const history = await latestAssessment(db, e11!.id);
    expect(history.map((a) => [a.kind, a.status])).toEqual([
      ["REASSESSMENT", "CONFLICT"],
      ["MIGRATED", "ACCEPTED"],
    ]);
    expect(history[0]!.reasons).toEqual(["CLAIM_BEFORE_LOWER_LEVEL_FACT"]);
    expect((await milestoneOf(db, ids.character, 11))!).toMatchObject({ timingBasis: "FIRST_OBSERVED", reachedAt: null, claimAssessmentId: null, claimAssessmentStatus: null });
  });
});

// ---------------------------------------------------------------------------
// 근거 보존, 판정, 채택 (beta 영역, 커뮤니티 제출 데이터)
// ---------------------------------------------------------------------------
async function latestAssessment(db: AppDatabase, evidenceId: string) {
  const rows = await db.select().from(levelMilestoneClaimAssessments).where(eq(levelMilestoneClaimAssessments.evidenceId, evidenceId));
  return rows.sort((a, b) => b.seq - a.seq);
}

describe("근거 보존과 채택 (beta)", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;
  beforeAll(async () => {
    ({ db, close } = await createTestDb(["beta"]));
  });
  afterAll(() => close());

  it("새 근거로 현재 채택 기록이 바뀌어도 이전 근거는 그대로 남고, 채택한 근거와 판정을 추적할 수 있다", async () => {
    const first = await ingestObservation(db, beta, addon({ name: "보존", level: 5, observedAt: hoursAgo(50) }));
    const id = first.characterId!;
    await ingestObservation(db, beta, addon({ name: "보존", level: 6, observedAt: hoursAgo(40) }));
    const beforeRows = await evidenceOf(db, id);
    expect((await milestoneOf(db, id, 6))!.timingBasis).toBe("FIRST_OBSERVED");

    const third = await ingestObservation(db, beta, addon({ name: "보존", level: 6, observedAt: hoursAgo(30), levelReachedAt: hoursAgo(45) }));
    expect(third.warnings).toEqual([]);
    const afterRows = await evidenceOf(db, id);
    for (const row of beforeRows) expect(afterRows.find((a) => a.id === row.id)).toEqual(row);
    const milestone = (await milestoneOf(db, id, 6))!;
    expect(milestone).toMatchObject({ timingBasis: "SOURCE_REPORTED", reachedAt: hoursAgo(45), firstObservedAt: hoursAgo(40), previousObservedAt: hoursAgo(50) });
    const adopted = afterRows.find((e) => e.id === milestone.evidenceId)!;
    expect(adopted).toMatchObject({ level: 6, receiptClaimStatus: "ACCEPTED", claimedReachedAt: hoursAgo(45), ingestionRecordId: third.ingestionRecordId });
    const [assessment] = await latestAssessment(db, adopted.id);
    expect(assessment).toMatchObject({ id: milestone.claimAssessmentId, kind: "RECEIPT", status: "ACCEPTED" });
  });

  it("과거 스냅샷은 새 관측으로 바뀌거나 지워지지 않고, DB가 수정·삭제·TRUNCATE를 거부한다", async () => {
    const r = await ingestObservation(db, beta, addon({ name: "스냅샷", level: 3, observedAt: hoursAgo(60) }));
    const id = r.characterId!;
    const beforeRows = await db.select().from(characterSnapshots).where(eq(characterSnapshots.characterId, id));
    await ingestObservation(db, beta, addon({ name: "스냅샷", level: 4, observedAt: hoursAgo(50) }));
    await ingestObservation(db, beta, addon({ name: "스냅샷", level: 5, observedAt: hoursAgo(40), classCode: "mage" }));
    const afterRows = await db.select().from(characterSnapshots).where(eq(characterSnapshots.characterId, id));
    expect(afterRows.length).toBe(beforeRows.length + 2);
    for (const row of beforeRows) expect(afterRows.find((a) => a.id === row.id)).toEqual(row);
    await rejects(db.execute(sql`update character_snapshots set level = 99 where character_id = ${id}`));
    await rejects(db.execute(sql`delete from character_snapshots where character_id = ${id}`));
    await rejects(db.execute(sql`truncate character_snapshots`));
  });

  it("근거·판정 기록은 수정·삭제할 수 없고, 현재 채택 기록은 삭제할 수 없다 (실제 영역)", async () => {
    await rejects(db.execute(sql`update level_milestone_evidence set level = 99`));
    await rejects(db.execute(sql`delete from level_milestone_evidence`));
    await rejects(db.execute(sql`truncate level_milestone_evidence`));
    await rejects(db.execute(sql`update level_milestone_claim_assessments set status = 'CONFLICT'`));
    await rejects(db.execute(sql`delete from level_milestone_claim_assessments`));
    await rejects(db.execute(sql`truncate level_milestone_claim_assessments`));
    await rejects(db.execute(sql`delete from level_milestones`));
    await rejects(db.execute(sql`truncate level_milestones`));
  });

  it("캐릭터를 삭제하려 하면 거부되고, 스냅샷·milestone·근거·판정 기록이 하나도 사라지지 않는다", async () => {
    const counts = async () => [
      await db.$count(characterSnapshots),
      await db.$count(levelMilestones),
      await db.$count(levelMilestoneEvidence),
      await db.$count(levelMilestoneClaimAssessments),
    ];
    const beforeCounts = await counts();
    const [target] = await db.select().from(characters).limit(1);
    await rejects(db.delete(characters).where(eq(characters.id, target!.id)));
    await rejects(db.execute(sql`delete from characters`));
    expect(await counts()).toEqual(beforeCounts);
    expect(await db.$count(characters)).toBeGreaterThan(0);
  });

  it("D-1 관측 시각보다 미래인 달성 시각: 근거는 REJECTED로 보관하고 채택하지 않는다", async () => {
    const r = await ingestObservation(db, beta, addon({ name: "미래", level: 7, observedAt: hoursAgo(10), levelReachedAt: hoursAgo(-48) }));
    expect(r.status).toBe("ACCEPTED");
    expect(r.warnings).toContain("레벨 달성 시각이 관측 시각보다 늦어 사용하지 않았습니다.");
    const [e] = await evidenceOf(db, r.characterId!, 7);
    expect(e).toMatchObject({ receiptClaimStatus: "REJECTED", observationBasis: "FIRST_OBSERVED", claimedReachedAt: hoursAgo(-48), receiptClaimReasons: ["CLAIM_AFTER_OBSERVATION"] });
    expect((await milestoneOf(db, r.characterId!, 7))!).toMatchObject({ timingBasis: "FIRST_OBSERVED", reachedAt: null, evidenceId: e!.id, claimAssessmentId: null });
  });

  it("D-2 달성 순서와 모순: 낮은 레벨로 관측된 시각보다 이른 상위 레벨 달성 주장은 CONFLICT, 순서가 맞지 않는 관측은 식별 충돌", async () => {
    const a = await ingestObservation(db, beta, addon({ name: "순서", level: 7, observedAt: hoursAgo(20) }));
    const b = await ingestObservation(db, beta, addon({ name: "순서", level: 8, observedAt: hoursAgo(10), levelReachedAt: hoursAgo(25) }));
    const [e] = await evidenceOf(db, a.characterId!, 8);
    expect(e).toMatchObject({ receiptClaimStatus: "CONFLICT", observationBasis: "FIRST_OBSERVED", receiptClaimReasons: ["CLAIM_BEFORE_LOWER_LEVEL_FACT"] });
    expect(b.warnings.some((w) => w.includes("순서와 맞지 않아"))).toBe(true);
    expect((await milestoneOf(db, a.characterId!, 8))!.timingBasis).toBe("FIRST_OBSERVED");

    // 현재 레벨 8(10시간 전)인데, 더 옛날(30시간 전) 관측이 레벨 12라고 늦게 도착
    const late = await ingestObservation(db, beta, addon({ name: "순서", level: 12, observedAt: hoursAgo(30) }));
    expect(late.status).toBe("IDENTITY_CONFLICT");
    // 레벨 7(20시간 전)과 8(10시간 전) 사이 시각(15시간 전)에 레벨 6이었다는 관측: 순서 모순
    const between = await ingestObservation(db, beta, addon({ name: "순서", level: 6, observedAt: hoursAgo(15) }));
    expect(between.status).toBe("IDENTITY_CONFLICT");
    expect(await milestoneOf(db, a.characterId!, 12)).toBeUndefined();
    expect(await evidenceOf(db, a.characterId!, 12)).toHaveLength(0);
    expect(await evidenceOf(db, a.characterId!, 6)).toHaveLength(0);
  });

  it("D-5 사이트가 처음 관측하기 전의 달성 주장은 거부하지 않고 검토 대기(NEEDS_REVIEW)로 보관한다", async () => {
    const r = await ingestObservation(db, beta, addon({ name: "이전달성", level: 20, observedAt: hoursAgo(5), levelReachedAt: hoursAgo(24 * 30) }));
    expect(r.status).toBe("ACCEPTED");
    const [e] = await evidenceOf(db, r.characterId!, 20);
    expect(e).toMatchObject({ receiptClaimStatus: "NEEDS_REVIEW", claimedReachedAt: hoursAgo(24 * 30), receiptClaimReasons: ["UNCORROBORATED_CLAIM"] });
    expect((await milestoneOf(db, r.characterId!, 20))!).toMatchObject({ timingBasis: "FIRST_OBSERVED", firstObservedAt: hoursAgo(5) });
    const [c] = await db.select().from(characters).where(eq(characters.id, r.characterId!));
    expect(c!.currentLevelReachedAt).toEqual(hoursAgo(5));
  });

  it("검토 대기 주장이 나중에 뒷받침되면 재판정되어 채택된다. 받은 시점의 판정은 근거 행에 그대로 남는다", async () => {
    const r = await ingestObservation(db, beta, addon({ name: "뒷받침", level: 20, observedAt: hoursAgo(5), levelReachedAt: hoursAgo(24 * 30) }));
    const id = r.characterId!;
    const [claimRow] = await evidenceOf(db, id, 20);
    expect(claimRow!.receiptClaimStatus).toBe("NEEDS_REVIEW");
    // 늦게 도착한 옛 관측: 31일 전에는 레벨 19였다 → 30일 전 레벨 20 달성 주장을 뒷받침
    await ingestObservation(db, beta, addon({ name: "뒷받침", level: 19, observedAt: hoursAgo(24 * 31) }));
    const history = await latestAssessment(db, claimRow!.id);
    expect(history.map((h) => [h.kind, h.status])).toEqual([
      ["REASSESSMENT", "ACCEPTED"],
      ["RECEIPT", "NEEDS_REVIEW"],
    ]);
    const milestone = (await milestoneOf(db, id, 20))!;
    expect(milestone).toMatchObject({
      timingBasis: "SOURCE_REPORTED",
      reachedAt: hoursAgo(24 * 30),
      evidenceId: claimRow!.id,
      claimAssessmentId: history[0]!.id,
      claimAssessmentStatus: "ACCEPTED",
      previousObservedAt: hoursAgo(24 * 31),
    });
    // 근거 행은 바뀌지 않았다
    const [after] = await evidenceOf(db, id, 20);
    expect(after).toEqual(claimRow);
  });

  it("나중에 발견한 모순은 기존 채택 기록에 반영된다 (인정됐던 주장이 충돌로 재판정되고 채택에서 빠진다)", async () => {
    const a = await ingestObservation(db, beta, addon({ name: "후모순", level: 5, observedAt: hoursAgo(50) }));
    const id = a.characterId!;
    await ingestObservation(db, beta, addon({ name: "후모순", level: 6, observedAt: hoursAgo(30), levelReachedAt: hoursAgo(45) }));
    expect((await milestoneOf(db, id, 6))!.timingBasis).toBe("SOURCE_REPORTED");
    // 40시간 전에는 아직 레벨 5였다는 관측이 늦게 도착 → 45시간 전 레벨 6 달성 주장과 모순
    await ingestObservation(db, beta, addon({ name: "후모순", level: 5, observedAt: hoursAgo(40) }));
    const [claimRow] = (await evidenceOf(db, id, 6)).filter((e) => e.claimedReachedAt);
    const history = await latestAssessment(db, claimRow!.id);
    expect(history[0]).toMatchObject({ kind: "REASSESSMENT", status: "CONFLICT", reasons: ["CLAIM_BEFORE_LOWER_LEVEL_FACT"] });
    expect(claimRow!.receiptClaimStatus).toBe("ACCEPTED");
    expect((await milestoneOf(db, id, 6))!).toMatchObject({ timingBasis: "FIRST_OBSERVED", reachedAt: null, claimAssessmentId: null, firstObservedAt: hoursAgo(30) });
  });

  it("D-5 낮은 레벨 관측이 뒷받침하면, 이 레벨을 처음 관측한 시각보다 이른 달성 시각도 채택한다", async () => {
    const a = await ingestObservation(db, beta, addon({ name: "구간", level: 14, observedAt: hoursAgo(50) }));
    await ingestObservation(db, beta, addon({ name: "구간", level: 15, observedAt: hoursAgo(30), levelReachedAt: hoursAgo(45) }));
    expect((await milestoneOf(db, a.characterId!, 15))!).toMatchObject({ timingBasis: "SOURCE_REPORTED", reachedAt: hoursAgo(45), firstObservedAt: hoursAgo(30) });
  });

  it("D-4 같은 캐릭터·레벨에 근거가 여러 개 들어오면 모두 보관하고, 채택은 규칙에 따라 하나로 정해진다", async () => {
    const a = await ingestObservation(db, beta, addon({ name: "여러근거", level: 9, observedAt: hoursAgo(60) }));
    const id = a.characterId!;
    await ingestObservation(db, beta, addon({ name: "여러근거", level: 10, observedAt: hoursAgo(40) }));
    await ingestObservation(db, beta, addon({ name: "여러근거", level: 10, observedAt: hoursAgo(35), levelReachedAt: hoursAgo(50) }));
    await ingestObservation(db, beta, addon({ name: "여러근거", level: 10, observedAt: hoursAgo(30), levelReachedAt: hoursAgo(55) }));
    await ingestObservation(db, beta, addon({ name: "여러근거", level: 10, observedAt: hoursAgo(25), levelReachedAt: hoursAgo(-1) }));
    const rows = await evidenceOf(db, id, 10);
    expect(rows.map((r) => r.receiptClaimStatus)).toEqual(["NONE", "ACCEPTED", "ACCEPTED", "REJECTED"]);
    const milestone = (await milestoneOf(db, id, 10))!;
    expect(milestone).toMatchObject({ timingBasis: "SOURCE_REPORTED", reachedAt: hoursAgo(55), firstObservedAt: hoursAgo(40) });
    expect(rows.find((r) => r.id === milestone.evidenceId)!.claimedReachedAt).toEqual(hoursAgo(55));
  });

  it("D-3 / 6 신뢰 수준이 낮은 커뮤니티 근거는 더 이른 시각을 주장해도 검증된 기록을 대체하지 않는다", async () => {
    const a = await ingestObservation(db, beta, addon({ name: "검증", level: 11, observedAt: hoursAgo(80) }));
    const id = a.characterId!;
    await ingestObservation(db, beta, addon({ name: "검증", level: 12, observedAt: hoursAgo(60) }));
    // 검증된 근거 (공식 출처를 가정한 테스트 행). 수집 파이프라인으로는 아직 만들 수 없어 직접 넣는다.
    const verifiedId = "00000000-0000-4000-8000-0000000000aa";
    await db.insert(levelMilestoneEvidence).values({
      id: verifiedId,
      characterId: id,
      dataEnvironment: "beta",
      level: 12,
      observationBasis: "FIRST_OBSERVED",
      claimedReachedAt: hoursAgo(65),
      receiptClaimStatus: "ACCEPTED",
      observedAt: hoursAgo(62),
      receivedAt: hoursAgo(62),
      dataSource: "blizzard",
      verificationStatus: "VERIFIED",
      region: "kr",
      gameMode: "standard",
      origin: "INGESTED",
      createdAt: hoursAgo(62),
    });
    const community = await ingestObservation(db, beta, addon({ name: "검증", level: 12, observedAt: hoursAgo(50), levelReachedAt: hoursAgo(75) }));
    const rows = await evidenceOf(db, id, 12);
    expect(rows.find((r) => r.ingestionRecordId === community.ingestionRecordId)!.receiptClaimStatus).toBe("ACCEPTED");
    const milestone = (await milestoneOf(db, id, 12))!;
    expect(milestone).toMatchObject({ evidenceId: verifiedId, verificationStatus: "VERIFIED", dataSource: "blizzard", reachedAt: hoursAgo(65) });
    const [verifiedAssessment] = await latestAssessment(db, verifiedId);
    expect(milestone.claimAssessmentId).toBe(verifiedAssessment!.id);
  });
});

// ---------------------------------------------------------------------------
// 도착 순서와 무관한 결과
// ---------------------------------------------------------------------------
describe("도착 순서가 달라도 최종 채택 결과가 같다", () => {
  type Obs = Parameters<typeof observation>[0];
  async function finalState(order: Obs[]) {
    const { db, close } = await createTestDb(["beta"]);
    let characterId = "";
    for (const o of order) {
      const r = await ingestObservation(db, beta, addon(o));
      if (r.characterId) characterId = r.characterId;
    }
    const milestones = (await db.select().from(levelMilestones).where(eq(levelMilestones.characterId, characterId)))
      .sort((a, b) => a.level - b.level)
      .map((m) => ({
        level: m.level,
        timingBasis: m.timingBasis,
        reachedAt: m.reachedAt,
        firstObservedAt: m.firstObservedAt,
        previousObservedAt: m.previousObservedAt,
        effectiveReachedAt: m.effectiveReachedAt,
        verificationStatus: m.verificationStatus,
        dataSource: m.dataSource,
        sourceBuild: m.sourceBuild,
        hasAssessment: m.claimAssessmentId !== null,
      }));
    const [c] = await db.select().from(characters).where(eq(characters.id, characterId));
    const character = { level: c!.level, currentLevelReachedAt: c!.currentLevelReachedAt, currentLevelTimingBasis: c!.currentLevelTimingBasis, firstSeenAt: c!.firstSeenAt, lastSeenAt: c!.lastSeenAt };
    await close();
    return { milestones, character };
  }

  it("낮은 레벨 관측과 달성 시각 주장: 어느 쪽이 먼저 와도 주장이 인정되어 같은 기록이 된다", async () => {
    const lower: Obs = { name: "역순", level: 5, observedAt: hoursAgo(50) };
    const claim: Obs = { name: "역순", level: 6, observedAt: hoursAgo(30), levelReachedAt: hoursAgo(45) };
    const a = await finalState([lower, claim]);
    const b = await finalState([claim, lower]);
    expect(b).toEqual(a);
    expect(a.milestones.find((m) => m.level === 6)).toMatchObject({ timingBasis: "SOURCE_REPORTED", reachedAt: hoursAgo(45), hasAssessment: true });
  });

  it("레벨을 건너뛴 두 관측: 어느 쪽이 먼저 와도 같은 추론 기록이 생긴다", async () => {
    const low: Obs = { name: "건너뜀", level: 5, observedAt: hoursAgo(50) };
    const high: Obs = { name: "건너뜀", level: 8, observedAt: hoursAgo(30) };
    const a = await finalState([low, high]);
    const b = await finalState([high, low]);
    expect(b).toEqual(a);
    expect(a.milestones.map((m) => [m.level, m.timingBasis])).toEqual([
      [5, "FIRST_OBSERVED"],
      [6, "INFERRED"],
      [7, "INFERRED"],
      [8, "FIRST_OBSERVED"],
    ]);
    expect(a.milestones.find((m) => m.level === 7)).toMatchObject({ firstObservedAt: hoursAgo(30), previousObservedAt: hoursAgo(50) });
  });

  it("관측 세 개(주장 포함)의 모든 도착 순서에서 결과가 같다", async () => {
    const obs: Obs[] = [
      { name: "세개", level: 3, observedAt: hoursAgo(70) },
      { name: "세개", level: 6, observedAt: hoursAgo(40), levelReachedAt: hoursAgo(50) },
      { name: "세개", level: 9, observedAt: hoursAgo(10), levelReachedAt: hoursAgo(20) },
    ];
    const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    const results = [];
    for (const p of perms) results.push(await finalState(p.map((i) => obs[i]!)));
    for (const r of results.slice(1)) expect(r).toEqual(results[0]);
    expect(results[0]!.milestones.filter((m) => m.timingBasis === "SOURCE_REPORTED").map((m) => m.level)).toEqual([6, 9]);
  });
});

// ---------------------------------------------------------------------------
// 5. 오래된 캐릭터와 mock 초기화 (mock 영역)
// ---------------------------------------------------------------------------
describe("랭킹 제외와 mock 영역", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;
  beforeAll(async () => {
    ({ db, close } = await createTestDb(["mock"]));
  });
  afterAll(() => close());

  it("7일이 지나 랭킹에서 빠져도 스냅샷·milestone·근거·판정 기록은 하나도 줄지 않는다", async () => {
    await ingestObservation(db, mockCtx, observation({ name: "오래됨", level: 8, observedAt: hoursAgo(30) }));
    await ingestObservation(db, mockCtx, observation({ name: "오래됨", level: 12, observedAt: hoursAgo(20), levelReachedAt: hoursAgo(22) }));
    const counts = async () => [
      await db.$count(characterSnapshots),
      await db.$count(levelMilestones),
      await db.$count(levelMilestoneEvidence),
      await db.$count(levelMilestoneClaimAssessments),
    ];
    const beforeCounts = await counts();
    const page = { page: 1, pageSize: 50 };
    const fresh = await getLevelRanking(db, { scope: { dataEnvironment: "mock", gameMode: "standard" }, pagination: page, now: NOW });
    expect(fresh.status === "ok" && fresh.total).toBe(1);
    const stale = await getLevelRanking(db, {
      scope: { dataEnvironment: "mock", gameMode: "standard" },
      pagination: page,
      now: new Date(NOW.getTime() + 8 * 86_400_000),
    });
    expect(stale.status === "ok" && stale.total).toBe(0);
    expect(await counts()).toEqual(beforeCounts);
    expect(beforeCounts.every((n) => n > 0)).toBe(true);
  });

  it("높은 레벨 달성 주장이 나중에 온 낮은 레벨 관측과 모순되면 충돌로 재판정된다 (mock 생성기 데이터도 순서 검사는 같다)", async () => {
    const a = await ingestObservation(db, mockCtx, observation({ name: "상위먼저", level: 10, observedAt: hoursAgo(10), levelReachedAt: hoursAgo(30) }));
    const id = a.characterId!;
    const [high] = await evidenceOf(db, id, 10);
    expect(high!.receiptClaimStatus).toBe("ACCEPTED");
    // 15시간 전에는 레벨 9였다 → 30시간 전에 레벨 10을 달성했다는 주장과 모순
    const late = await ingestObservation(db, mockCtx, observation({ name: "상위먼저", level: 9, observedAt: hoursAgo(15), levelReachedAt: hoursAgo(20) }));
    expect(late.status).toBe("ACCEPTED");
    const [latestHigh] = await latestAssessment(db, high!.id);
    expect(latestHigh).toMatchObject({ kind: "REASSESSMENT", status: "CONFLICT" });
    expect((await milestoneOf(db, id, 10))!.timingBasis).toBe("FIRST_OBSERVED");
    expect((await milestoneOf(db, id, 9))!).toMatchObject({ timingBasis: "SOURCE_REPORTED", reachedAt: hoursAgo(20) });
  });

  it("mock 영역은 개발용 초기화를 위해 판정 기록·근거·채택 기록·스냅샷 삭제를 허용하지만, 캐릭터 연쇄 삭제는 여전히 막는다", async () => {
    await rejects(db.execute(sql`delete from characters`));
    await db.execute(sql`delete from level_milestones`);
    await db.execute(sql`delete from level_milestone_claim_assessments`);
    await db.execute(sql`delete from level_milestone_evidence`);
    await db.execute(sql`delete from character_snapshots`);
    expect(await db.$count(levelMilestoneEvidence)).toBe(0);
    await rejects(db.execute(sql`truncate level_milestone_evidence`));
  });
});

// ---------------------------------------------------------------------------
// 처음부터 전체 migration
// ---------------------------------------------------------------------------
describe("빈 DB에 전체 migration 적용", () => {
  it("0000부터 마지막까지 순서대로 적용되고, 보호 제약·트리거가 모두 생긴다", async () => {
    const c = new PGlite({ extensions: { pg_trgm } });
    await migrate(drizzle(c, { schema }), { migrationsFolder: "db/migrations" });
    const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8")) as { entries: unknown[] };
    const applied = (await c.query<{ n: number }>("select count(*)::int n from drizzle.__drizzle_migrations")).rows[0]!.n;
    expect(applied).toBe(journal.entries.length);
    const constraints = (await c.query<{ conname: string }>(
      `select conname from pg_constraint where conname in ('level_milestones_evidence_fk', 'level_milestones_claim_assessment_fk',
        'level_milestones_claim_assessment', 'level_milestone_evidence_id_scope', 'level_milestone_claim_assessments_evidence_fk') order by 1`,
    )).rows.map((r) => r.conname);
    expect(constraints).toHaveLength(5);
    const index = (await c.query(`select 1 from pg_indexes where indexname = 'level_milestone_evidence_migrated_uq'`)).rows;
    expect(index).toHaveLength(1);
    await c.close();
  });
});

// ---------------------------------------------------------------------------
// 판정·채택 규칙 (순수 함수)
// ---------------------------------------------------------------------------
describe("판정과 채택 규칙", () => {
  const at = (h: number) => hoursAgo(h);
  const fact = (o: Partial<EvidenceFact> & { id: string }): EvidenceFact => ({
    level: 10,
    observationBasis: "FIRST_OBSERVED",
    claimedReachedAt: null,
    observedAt: at(10),
    previousObservedAt: null,
    verificationStatus: "COMMUNITY_SUBMITTED",
    origin: "INGESTED",
    dataSource: "addon",
    sourceBuild: null,
    ...o,
  });

  it("검증된 출처는 뒷받침 없이도 인정, 커뮤니티 제출·미검증은 검토 대기", () => {
    for (const status of ["VERIFIED", "LOG_VERIFIED"] as const) {
      expect(evaluateClaims([fact({ id: "a", claimedReachedAt: at(20), verificationStatus: status, dataSource: "blizzard" })], []).get("a")!.status).toBe("ACCEPTED");
    }
    for (const status of ["COMMUNITY_SUBMITTED", "UNVERIFIED"] as const) {
      expect(evaluateClaims([fact({ id: "a", claimedReachedAt: at(20), verificationStatus: status })], []).get("a")!.status).toBe("NEEDS_REVIEW");
    }
  });

  it("검증된 출처라도 같거나 높은 신뢰의 관측과 모순되면 CONFLICT, 관측보다 늦으면 REJECTED. 낮은 신뢰의 관측은 검증된 주장을 무효로 만들지 못한다", () => {
    const claim = fact({ id: "v", claimedReachedAt: at(20), verificationStatus: "VERIFIED", dataSource: "blizzard" });
    expect(evaluateClaims([claim], [{ level: 9, observedAt: at(15), verificationStatus: "VERIFIED" }]).get("v")!.status).toBe("CONFLICT");
    expect(evaluateClaims([claim], [{ level: 9, observedAt: at(15), verificationStatus: "COMMUNITY_SUBMITTED" }]).get("v")!.status).toBe("ACCEPTED");
    expect(evaluateClaims([fact({ id: "r", claimedReachedAt: at(5), verificationStatus: "VERIFIED", dataSource: "blizzard" })], []).get("r")!.status).toBe("REJECTED");
  });

  it("검토 대기 주장은 인정된 주장을 충돌로 만들지 못한다", () => {
    const rows = [
      fact({ id: "low", level: 5, observedAt: at(60) }),
      fact({ id: "ok", level: 9, claimedReachedAt: at(30), observedAt: at(20) }),
      // 뒷받침 없는(검토 대기) 10레벨 주장이 9레벨 주장보다 이른 시각 → 순서 모순이지만 9레벨 주장은 그대로
      fact({ id: "junk", level: 10, claimedReachedAt: at(100), observedAt: at(10) }),
    ];
    const r = evaluateClaims(rows, []);
    expect(r.get("ok")!.status).toBe("ACCEPTED");
    expect(r.get("junk")!.status).toBe("CONFLICT");
  });

  it("채택: 신뢰 수준이 가장 높은 근거 → 시간 근거 → 이른 시각. 입력 순서와 관계없이 같은 결과", () => {
    const rows = [
      fact({ id: "verified", verificationStatus: "VERIFIED", dataSource: "blizzard", observedAt: at(5) }),
      fact({ id: "community", claimedReachedAt: at(100), observedAt: at(20) }),
    ];
    const assessments = new Map<string, ClaimAssessment>([["community", { status: "ACCEPTED", reasons: [] }]]);
    const adopted = chooseAdoptedEvidence(rows, assessments)!;
    expect(adopted.evidence.id).toBe("verified");
    expect(adopted.firstObservedAt).toEqual(at(5));
    expect(chooseAdoptedEvidence([...rows].reverse(), assessments)!.evidence.id).toBe("verified");
    expect(chooseAdoptedEvidence([], assessments)).toBeNull();
  });
});
