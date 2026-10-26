/**
 * 역사 기록 보존 Phase 1 (docs/HISTORY-PRESERVATION.md)
 *
 * - 기존 level_milestones → level_milestone_evidence 이관 (migration 0007)
 * - 근거는 추가만, 현재 채택 기록은 근거에서 다시 고름
 * - 캐릭터 삭제가 스냅샷·milestone·근거를 연쇄 삭제하지 않음 (migration 0008)
 * - 달성 시각 주장 판정: 미래 / 순서 모순 / 뒷받침 없음 / 신뢰 수준
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
import { characterSnapshots, characters, levelMilestoneEvidence, levelMilestones } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { ingestObservation } from "@/lib/ingestion/ingest";
import { assessReachedAtClaim, chooseAdoptedEvidence, type EvidenceForAdoption } from "@/lib/ingestion/milestone-evidence";
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
    await insertMilestone(ids.m11, 11, "SOURCE_REPORTED", T0, T2, ids.snap2, null);
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
      expect(rest).toEqual(before[i]);
      expect(evidence.find((e) => e.id === evidenceId)?.level).toBe(before[i]!.level);
    }
  });

  it("시간 근거·시각·출처·검증 상태·빌드·연결을 그대로 옮기고 근거 수준을 올리지 않는다", async () => {
    const [e9, e10, e11] = await evidenceOf(db, ids.character);
    expect(e9).toMatchObject({ level: 9, timingBasis: "INFERRED", claimStatus: "NONE", claimedReachedAt: null, origin: "MIGRATED" });
    expect(e10).toMatchObject({ level: 10, timingBasis: "FIRST_OBSERVED", claimStatus: "NONE", claimedReachedAt: null });
    expect(e11).toMatchObject({ level: 11, timingBasis: "SOURCE_REPORTED", claimStatus: "ACCEPTED", claimedReachedAt: T0 });
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
      expect(e.claimReasons).toEqual(["MIGRATED_FROM_LEVEL_MILESTONES"]);
    }
    expect(e10!.observedAt).toEqual(T1);
    expect(e11!.observedAt).toEqual(T2);
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

  it("이관 후 새 관측이 들어와도 이관 근거는 그대로이고, 이관된 실제 달성 시각 기록이 낮아지지 않는다", async () => {
    const snapshot = await evidenceOf(db, ids.character);
    await ingestObservation(
      db,
      beta,
      addon({ name: "이관 캐릭터", level: 11, observedAt: new Date("2026-09-05T00:00:00Z"), identity: { externalId: null, region: "test-region", gameMode: "normal", characterName: "이관 캐릭터" } }),
    );
    const after = await evidenceOf(db, ids.character);
    expect(after.filter((e) => e.origin === "MIGRATED")).toEqual(snapshot);
    expect(await milestoneOf(db, ids.character, 11)).toMatchObject({ timingBasis: "SOURCE_REPORTED", reachedAt: T0 });
  });
});

// ---------------------------------------------------------------------------
// 2~4, 6, D: beta 영역 (커뮤니티 제출 데이터)
// ---------------------------------------------------------------------------
describe("근거 보존과 채택 (beta)", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;
  beforeAll(async () => {
    ({ db, close } = await createTestDb(["beta"]));
  });
  afterAll(() => close());

  it("새 근거로 현재 채택 기록이 바뀌어도 이전 근거는 그대로 남고, 채택한 근거를 evidence_id로 추적할 수 있다", async () => {
    const first = await ingestObservation(db, beta, addon({ name: "보존", level: 5, observedAt: hoursAgo(50) }));
    const id = first.characterId!;
    await ingestObservation(db, beta, addon({ name: "보존", level: 6, observedAt: hoursAgo(40) }));
    const beforeRows = await evidenceOf(db, id);
    expect((await milestoneOf(db, id, 6))!.timingBasis).toBe("FIRST_OBSERVED");

    // 레벨 5 관측(50시간 전)이 뒷받침하는 달성 시각 주장(45시간 전) → 채택
    const third = await ingestObservation(db, beta, addon({ name: "보존", level: 6, observedAt: hoursAgo(30), levelReachedAt: hoursAgo(45) }));
    expect(third.warnings).toEqual([]);
    const afterRows = await evidenceOf(db, id);
    expect(afterRows.slice(0, beforeRows.length)).toEqual(beforeRows);
    const milestone = (await milestoneOf(db, id, 6))!;
    expect(milestone).toMatchObject({ timingBasis: "SOURCE_REPORTED", reachedAt: hoursAgo(45), firstObservedAt: hoursAgo(40) });
    const adopted = afterRows.find((e) => e.id === milestone.evidenceId)!;
    expect(adopted).toMatchObject({ level: 6, claimStatus: "ACCEPTED", claimedReachedAt: hoursAgo(45), ingestionRecordId: third.ingestionRecordId });
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

  it("근거는 수정·삭제할 수 없고, 현재 채택 기록은 삭제할 수 없다 (실제 영역)", async () => {
    await rejects(db.execute(sql`update level_milestone_evidence set level = 99`));
    await rejects(db.execute(sql`delete from level_milestone_evidence`));
    await rejects(db.execute(sql`truncate level_milestone_evidence`));
    await rejects(db.execute(sql`delete from level_milestones`));
    await rejects(db.execute(sql`truncate level_milestones`));
  });

  it("캐릭터를 삭제하려 하면 거부되고, 스냅샷·milestone·근거가 하나도 사라지지 않는다", async () => {
    const counts = async () => [await db.$count(characterSnapshots), await db.$count(levelMilestones), await db.$count(levelMilestoneEvidence)];
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
    expect(e).toMatchObject({ claimStatus: "REJECTED", timingBasis: "FIRST_OBSERVED", claimedReachedAt: hoursAgo(-48), claimReasons: ["CLAIM_AFTER_OBSERVATION"] });
    expect((await milestoneOf(db, r.characterId!, 7))!).toMatchObject({ timingBasis: "FIRST_OBSERVED", reachedAt: null, evidenceId: e!.id });
  });

  it("D-2 달성 순서와 모순: 낮은 레벨로 관측된 시각보다 이른 상위 레벨 달성 주장은 CONFLICT, 늦게 온 상위 레벨 관측은 식별 충돌", async () => {
    const a = await ingestObservation(db, beta, addon({ name: "순서", level: 7, observedAt: hoursAgo(20) }));
    // 20시간 전에는 레벨 7이었는데 레벨 8을 25시간 전에 달성했다는 주장
    const b = await ingestObservation(db, beta, addon({ name: "순서", level: 8, observedAt: hoursAgo(10), levelReachedAt: hoursAgo(25) }));
    const [e] = await evidenceOf(db, a.characterId!, 8);
    expect(e).toMatchObject({ claimStatus: "CONFLICT", timingBasis: "FIRST_OBSERVED", claimReasons: ["CLAIM_BEFORE_LOWER_LEVEL_FACT"] });
    expect(b.warnings.some((w) => w.includes("순서와 맞지 않아"))).toBe(true);
    expect((await milestoneOf(db, a.characterId!, 8))!.timingBasis).toBe("FIRST_OBSERVED");

    // 현재 레벨 8(10시간 전)인데, 더 옛날(30시간 전) 관측이 레벨 12라고 늦게 도착
    const late = await ingestObservation(db, beta, addon({ name: "순서", level: 12, observedAt: hoursAgo(30) }));
    expect(late.status).toBe("IDENTITY_CONFLICT");
    expect(await milestoneOf(db, a.characterId!, 12)).toBeUndefined();
    expect(await evidenceOf(db, a.characterId!, 12)).toHaveLength(0);
  });

  it("D-5 사이트가 처음 관측하기 전의 달성 주장은 거부하지 않고 검토 대기(NEEDS_REVIEW)로 보관한다", async () => {
    const r = await ingestObservation(db, beta, addon({ name: "이전달성", level: 20, observedAt: hoursAgo(5), levelReachedAt: hoursAgo(24 * 30) }));
    expect(r.status).toBe("ACCEPTED");
    const [e] = await evidenceOf(db, r.characterId!, 20);
    expect(e).toMatchObject({ claimStatus: "NEEDS_REVIEW", claimedReachedAt: hoursAgo(24 * 30), claimReasons: ["UNCORROBORATED_CLAIM"] });
    expect((await milestoneOf(db, r.characterId!, 20))!).toMatchObject({ timingBasis: "FIRST_OBSERVED", firstObservedAt: hoursAgo(5) });
    const [c] = await db.select().from(characters).where(eq(characters.id, r.characterId!));
    expect(c!.currentLevelReachedAt).toEqual(hoursAgo(5));
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
    expect(rows.map((r) => r.claimStatus)).toEqual(["NONE", "ACCEPTED", "ACCEPTED", "REJECTED"]);
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
      timingBasis: "SOURCE_REPORTED",
      claimedReachedAt: hoursAgo(65),
      claimStatus: "ACCEPTED",
      observedAt: hoursAgo(62),
      receivedAt: hoursAgo(62),
      dataSource: "blizzard",
      verificationStatus: "VERIFIED",
      region: "kr",
      gameMode: "standard",
      origin: "INGESTED",
      createdAt: hoursAgo(62),
    });
    // 커뮤니티 제출: 레벨 11 관측(80시간 전)이 뒷받침하는 더 이른 주장(75시간 전)
    const community = await ingestObservation(db, beta, addon({ name: "검증", level: 12, observedAt: hoursAgo(50), levelReachedAt: hoursAgo(75) }));
    const rows = await evidenceOf(db, id, 12);
    const communityRow = rows.find((r) => r.ingestionRecordId === community.ingestionRecordId)!;
    expect(communityRow.claimStatus).toBe("ACCEPTED");
    const milestone = (await milestoneOf(db, id, 12))!;
    expect(milestone).toMatchObject({ evidenceId: verifiedId, verificationStatus: "VERIFIED", dataSource: "blizzard", reachedAt: hoursAgo(65) });
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

  it("7일이 지나 랭킹에서 빠져도 스냅샷·milestone·근거는 하나도 줄지 않는다", async () => {
    await ingestObservation(db, mockCtx, observation({ name: "오래됨", level: 8, observedAt: hoursAgo(30) }));
    await ingestObservation(db, mockCtx, observation({ name: "오래됨", level: 12, observedAt: hoursAgo(20), levelReachedAt: hoursAgo(22) }));
    const counts = async () => [await db.$count(characterSnapshots), await db.$count(levelMilestones), await db.$count(levelMilestoneEvidence)];
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

  it("D-2 높은 레벨을 이미 달성한 시각보다 늦은 낮은 레벨 달성 주장은 CONFLICT (mock 생성기 데이터도 순서 검사는 같다)", async () => {
    const a = await ingestObservation(db, mockCtx, observation({ name: "상위먼저", level: 10, observedAt: hoursAgo(10), levelReachedAt: hoursAgo(30) }));
    const late = await ingestObservation(db, mockCtx, observation({ name: "상위먼저", level: 9, observedAt: hoursAgo(15), levelReachedAt: hoursAgo(20) }));
    expect(late.status).toBe("ACCEPTED");
    const [e] = await evidenceOf(db, a.characterId!, 9);
    expect(e).toMatchObject({ claimStatus: "CONFLICT", claimReasons: ["CLAIM_AFTER_HIGHER_LEVEL_FACT"] });
  });

  it("mock 영역은 개발용 초기화를 위해 근거·채택 기록·스냅샷 삭제를 허용하지만, 캐릭터 연쇄 삭제는 여전히 막는다", async () => {
    await rejects(db.execute(sql`delete from characters`));
    await db.execute(sql`delete from level_milestones`);
    await db.execute(sql`delete from level_milestone_evidence`);
    await db.execute(sql`delete from character_snapshots`);
    expect(await db.$count(levelMilestoneEvidence)).toBe(0);
    await rejects(db.execute(sql`update characters set level = level`).then(() => db.execute(sql`truncate level_milestone_evidence`)));
  });
});

// ---------------------------------------------------------------------------
// 판정·채택 규칙 (순수 함수)
// ---------------------------------------------------------------------------
describe("판정과 채택 규칙", () => {
  const facts = { lowerSightingMin: null, lowerSightingMax: null, lowerReachedMax: null, higherFactMin: null };
  const at = (h: number) => hoursAgo(h);

  it("검증된 출처는 뒷받침 없이도 채택 가능, 커뮤니티 제출·미검증은 검토 대기", () => {
    for (const status of ["VERIFIED", "LOG_VERIFIED"] as const) {
      expect(assessReachedAtClaim({ claim: at(10), observedAt: at(5), verificationStatus: status, facts }).status).toBe("ACCEPTED");
    }
    for (const status of ["COMMUNITY_SUBMITTED", "UNVERIFIED"] as const) {
      expect(assessReachedAtClaim({ claim: at(10), observedAt: at(5), verificationStatus: status, facts }).status).toBe("NEEDS_REVIEW");
    }
  });

  it("검증된 출처라도 관측과 모순되면 CONFLICT, 관측보다 늦으면 REJECTED", () => {
    expect(
      assessReachedAtClaim({ claim: at(10), observedAt: at(5), verificationStatus: "VERIFIED", facts: { ...facts, lowerSightingMax: at(8) } }).status,
    ).toBe("CONFLICT");
    expect(assessReachedAtClaim({ claim: at(1), observedAt: at(5), verificationStatus: "VERIFIED", facts }).status).toBe("REJECTED");
  });

  it("채택: 신뢰 수준이 가장 높은 근거 → 시간 근거 → 이른 시각 순. 낮은 신뢰의 더 이른 주장은 무시된다", () => {
    const row = (o: Partial<EvidenceForAdoption> & { id: string }): EvidenceForAdoption => ({
      timingBasis: "FIRST_OBSERVED",
      claimedReachedAt: null,
      observedAt: at(10),
      previousObservedAt: null,
      verificationStatus: "COMMUNITY_SUBMITTED",
      createdAt: at(10),
      ...o,
    });
    const rows = [
      row({ id: "verified", verificationStatus: "VERIFIED", observedAt: at(5) }),
      row({ id: "community", timingBasis: "SOURCE_REPORTED", claimedReachedAt: at(100), observedAt: at(20) }),
    ];
    const adopted = chooseAdoptedEvidence(rows)!;
    expect(adopted.evidence.id).toBe("verified");
    expect(adopted.firstObservedAt).toEqual(at(5));
    expect(chooseAdoptedEvidence([])).toBeNull();
  });
});
