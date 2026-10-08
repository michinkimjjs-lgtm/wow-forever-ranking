/**
 * mock 영역 Character Export 처리 (Phase 3D, docs/SUBMISSION-SYSTEM.md §10)
 *
 * 테스트 fixture로 제출 흐름 전체를 게임 접속 없이 검증하기 위한 경로다.
 *
 *   validate → normalize → identify → Gear Profile → duplicate check → conflict check → storage → (ranking)
 *
 * 실제 제출 경로(submitCharacterExport)와 같은 검증·정규화·장비 계산 코드를 쓰지만, 다음이 다르다.
 * - mock 배포(appEnv = mock)에서만 동작한다. 저장되는 행은 dataSource = mock, verificationStatus = MOCK.
 *   커뮤니티 제출(COMMUNITY_SUBMITTED)이나 검증 상태로 승격되지 않는다.
 * - character_submissions(실제 영역 전용)를 쓰지 않는다. 중복은 ingestion_records의 원본 해시,
 *   충돌은 캐릭터의 현재 상태와 비교해서 판단한다. 충돌이면 저장하지 않는다.
 */
import { and, eq } from "drizzle-orm";
import { characterExternalRefs, characters, ingestionRecords } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import type { ExportMapping, GearProfile } from "@/lib/config";
import type { DataEnvironment, IngestionStatus } from "@/lib/domain/enums";
import { normalizeName } from "@/lib/domain/names";
import { compareSubmissions, type SubmissionIssue as ConsistencyIssue } from "@/lib/domain/submission-consistency";
import { calculateEquippedItemLevel, type EquippedItemLevelResult } from "@/lib/gear/calculate";
import { ingestObservation } from "@/lib/ingestion/ingest";
import { characterObservationSchema, type CharacterObservation } from "@/lib/ingestion/schema";
import { sha256, stableStringify } from "@/lib/util/stable-json";
import { characterExportV1Schema } from "./export-schema";
import { exportVersionIssue } from "./export-version";
import type { SubmissionIssue } from "./issues";
import { normalizeCharacterExport } from "./normalize";

export const MOCK_EXPORT_PARSER_VERSION = "character-export-v1@1+mock";

export class MockExportEnvironmentError extends Error {
  constructor(appEnv: DataEnvironment) {
    super(`mock 배포에서만 테스트 export를 처리할 수 있습니다(현재 ${appEnv}).`);
    this.name = "MockExportEnvironmentError";
  }
}

export interface MockExportContext {
  /** 반드시 "mock". 다른 값이면 예외 */
  appEnv: DataEnvironment;
  db: AppDatabase;
  /** 테스트용 매핑 (가짜 게임 값). 실제 config/export-mapping.ts는 쓰지 않는다. */
  mapping: ExportMapping;
  /** 슬롯 이름 → 슬롯 코드, 장비 계산에 쓰는 프로필 (예: forever-draft) */
  gearProfile: GearProfile;
  now: Date;
}

export type MockExportStage =
  | "validate"
  | "normalize"
  | "identify"
  | "gear"
  | "duplicate"
  | "conflict"
  | "storage";

export type MockExportResult =
  | { ok: false; stage: "validate" | "normalize"; issues: SubmissionIssue[] }
  | { ok: false; stage: "duplicate"; ingestionRecordId: string }
  | { ok: false; stage: "conflict"; characterId: string; issues: ConsistencyIssue[] }
  | { ok: false; stage: "storage"; status: IngestionStatus; reason?: string }
  | {
      ok: true;
      stage: "storage";
      stages: MockExportStage[];
      characterId: string;
      ingestionRecordId: string;
      identity: { match: "EXTERNAL_ID" | "NATURAL_KEY" | "NEW"; characterId: string | null };
      gear: EquippedItemLevelResult | null;
      dataEnvironment: "mock";
      dataSource: "mock";
      verificationStatus: "MOCK";
    };

async function identify(db: AppDatabase, o: CharacterObservation) {
  if (o.identity.externalId) {
    const [ref] = await db
      .select({ characterId: characterExternalRefs.characterId })
      .from(characterExternalRefs)
      .where(
        and(
          eq(characterExternalRefs.dataEnvironment, "mock"),
          eq(characterExternalRefs.dataSource, "mock"),
          eq(characterExternalRefs.externalId, o.identity.externalId),
        ),
      )
      .limit(1);
    if (ref) return { match: "EXTERNAL_ID" as const, characterId: ref.characterId };
  }
  const [row] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(
      and(
        eq(characters.dataEnvironment, "mock"),
        eq(characters.region, o.identity.region),
        eq(characters.gameMode, o.identity.gameMode),
        eq(characters.nameNormalized, normalizeName(o.identity.characterName)),
      ),
    )
    .limit(1);
  return row ? { match: "NATURAL_KEY" as const, characterId: row.id } : { match: "NEW" as const, characterId: null };
}

export async function processMockCharacterExport(input: unknown, ctx: MockExportContext): Promise<MockExportResult> {
  if (ctx.appEnv !== "mock") throw new MockExportEnvironmentError(ctx.appEnv);
  const stages: MockExportStage[] = [];

  // 1. validate
  const versionIssue = exportVersionIssue(input);
  if (versionIssue) return { ok: false, stage: "validate", issues: [versionIssue] };
  const parsed = characterExportV1Schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      stage: "validate",
      issues: parsed.error.issues.slice(0, 20).map((i) => ({ code: "INVALID_FORMAT", path: i.path.map(String).join("."), detail: i.message })),
    };
  }
  stages.push("validate");

  // 2. normalize (테스트 매핑) → mock 공급원으로 표시
  const normalized = normalizeCharacterExport(parsed.data, { mapping: ctx.mapping, slotProfile: ctx.gearProfile, now: ctx.now });
  if (!normalized.ok) return { ok: false, stage: "normalize", issues: normalized.issues };
  const checked = characterObservationSchema.safeParse({ ...normalized.observation, dataSource: "mock" });
  if (!checked.success) {
    return { ok: false, stage: "normalize", issues: [{ code: "INVALID_FORMAT", path: "(observation)", detail: checked.error.message }] };
  }
  const observation = checked.data;
  stages.push("normalize");

  // 3. identify (읽기 전용)
  const identity = await identify(ctx.db, observation);
  stages.push("identify");

  // 4. Gear Profile
  const gear = observation.equipment
    ? calculateEquippedItemLevel(
        observation.equipment.map((e) => ({ slotCode: e.slotCode, itemLevel: e.itemLevel, itemSlotCode: e.itemSlotCode })),
        ctx.gearProfile,
      )
    : null;
  stages.push("gear");

  // 5. duplicate check: 같은 export 원본이 이미 반영되었는지
  const payloadHash = sha256(stableStringify(parsed.data));
  const [duplicate] = await ctx.db
    .select({ id: ingestionRecords.id })
    .from(ingestionRecords)
    .where(
      and(
        eq(ingestionRecords.dataEnvironment, "mock"),
        eq(ingestionRecords.payloadHash, payloadHash),
        eq(ingestionRecords.status, "ACCEPTED"),
      ),
    )
    .limit(1);
  if (duplicate) return { ok: false, stage: "duplicate", ingestionRecordId: duplicate.id };
  stages.push("duplicate");

  // 6. conflict check: 같은 캐릭터의 현재 상태와 비교
  if (identity.characterId) {
    const [current] = await ctx.db.select().from(characters).where(eq(characters.id, identity.characterId)).limit(1);
    if (current) {
      const result = compareSubmissions([
        {
          submissionId: "current",
          submitterKey: null,
          observedAt: current.lastSeenAt,
          region: current.region,
          gameMode: current.gameMode,
          characterName: current.characterName,
          level: current.level,
          classCode: current.classCode,
          raceCode: current.raceCode,
          factionCode: current.factionCode,
        },
        {
          submissionId: "incoming",
          submitterKey: null,
          observedAt: observation.observedAt,
          region: observation.identity.region,
          gameMode: observation.identity.gameMode,
          characterName: observation.identity.characterName,
          level: observation.level,
          classCode: observation.classCode ?? null,
          raceCode: observation.raceCode ?? null,
          factionCode: observation.factionCode ?? null,
        },
      ]);
      const conflicts = result.issues.filter((i) => i.severity === "conflict");
      if (conflicts.length > 0) return { ok: false, stage: "conflict", characterId: current.id, issues: result.issues };
    }
  }
  stages.push("conflict");

  // 7. storage (수집 파이프라인: 원본 보관, 식별, 현재 상태, 장비, 스냅샷, milestone)
  const stored = await ingestObservation(
    ctx.db,
    { dataEnvironment: "mock", parserVersion: MOCK_EXPORT_PARSER_VERSION, receivedAt: ctx.now, originalPayload: parsed.data },
    observation,
  );
  if (stored.status !== "ACCEPTED" || !stored.characterId || !stored.ingestionRecordId) {
    return { ok: false, stage: "storage", status: stored.status, reason: stored.reason };
  }
  stages.push("storage");
  return {
    ok: true,
    stage: "storage",
    stages,
    characterId: stored.characterId,
    ingestionRecordId: stored.ingestionRecordId,
    identity,
    gear,
    dataEnvironment: "mock",
    dataSource: "mock",
    verificationStatus: "MOCK",
  };
}
