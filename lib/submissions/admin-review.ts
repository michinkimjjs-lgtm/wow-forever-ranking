/**
 * 관리자 검토 처리 (docs/ADMIN-REVIEW.md §3)
 *
 * - 승인(accept): 보관한 export를 **지금 설정**으로 다시 정규화하고, 충돌을 다시 확인한 뒤 수집 파이프라인에 반영한다.
 *   매핑이 아직 없으면 반영하지 않고 MAPPING_PENDING으로 남긴다.
 *   CONFLICT 제출은 관리자가 확인했다는 뜻으로 overrideConflict가 있어야 반영한다.
 * - 거부(reject): 랭킹에 반영하지 않는다. 기록은 남긴다.
 * - 어느 경우에도 검증 상태는 COMMUNITY_SUBMITTED 그대로다.
 * - Collector 파일 제출과 웹 직접 등록을 같은 절차로 검토한다. 직접 등록의 데이터 출처는 user_submission이다.
 */
import type { RegistrationConfig } from "@/config/registration";
import { and, eq } from "drizzle-orm";
import { characterSubmissions } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import type { ExportMapping, GearProfile } from "@/lib/config";
import { ingestObservation } from "@/lib/ingestion/ingest";
import { characterObservationSchema } from "@/lib/ingestion/schema";
import type { CharacterObservation, CharacterObservationInput } from "@/lib/ingestion/schema";
import { characterExportV1Schema } from "./export-schema";
import type { SubmissionIssue } from "./issues";
import { MANUAL_PARSER_VERSION, manualIdentityKey, normalizeManualCharacter } from "./manual";
import { isManualPayload, manualCharacterSchema } from "./manual-schema";
import { EXPORT_PARSER_VERSION, normalizeCharacterExport } from "./normalize";
import { compareWithPrevious, contentHashOf, getSubmission, identityKeyHash, type SubmissionRow } from "./review";
import { REVIEW_STATUS_BY_INGESTION, resolveSubmissionConfig } from "./submit";
import type { ExportPreview } from "./preview";

type RealEnvironment = "beta" | "live";

export interface ReviewConfig {
  mapping: (env: RealEnvironment) => ExportMapping;
  slotProfile: (env: RealEnvironment, gameMode: string) => GearProfile | null;
  rankingProfile: (env: RealEnvironment, gameMode: string) => GearProfile | null;
  /** 웹 직접 등록의 지역·직업 매핑 (기본: config/registration.ts) */
  registration?: RegistrationConfig;
  /** 웹 직접 등록의 게임 규칙 → gameMode (기본: 데이터 영역 설정) */
  gameModeForRuleset?: (env: RealEnvironment, ruleset: string) => string | null;
}

export type ReviewOutcome =
  | { ok: true; submission: SubmissionRow }
  | { ok: false; reason: "NOT_FOUND" | "NOT_REVIEWABLE" | "MAPPING_PENDING" | "INVALID_PAYLOAD" | "CONFLICT_NEEDS_OVERRIDE" };

const REVIEWABLE = new Set(["PENDING", "CONFLICT"]);

function cleanNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim().slice(0, 500);
  return trimmed ? trimmed : null;
}

export async function acceptSubmission(
  db: AppDatabase,
  env: RealEnvironment,
  id: string,
  options: { now: Date; note?: string | null; overrideConflict?: boolean; config: ReviewConfig },
): Promise<ReviewOutcome> {
  const row = await getSubmission(db, env, id);
  if (!row) return { ok: false, reason: "NOT_FOUND" };
  if (!REVIEWABLE.has(row.reviewStatus)) return { ok: false, reason: "NOT_REVIEWABLE" };

  const prepared = normalizeStoredPayload(row.payload, env, row.submittedAt, options.config);
  if (prepared === "INVALID_PAYLOAD") return { ok: false, reason: "INVALID_PAYLOAD" };
  const { normalized, parserVersion } = prepared;
  if (!normalized.ok) {
    await db
      .update(characterSubmissions)
      .set({ blockedReason: "MAPPING_PENDING", issues: normalized.issues })
      .where(and(eq(characterSubmissions.dataEnvironment, env), eq(characterSubmissions.id, row.id)));
    return { ok: false, reason: "MAPPING_PENDING" };
  }
  const checked = characterObservationSchema.safeParse(normalized.observation);
  if (!checked.success) return { ok: false, reason: "INVALID_PAYLOAD" };
  const observation = checked.data;

  const identityKey = prepared.identityKey(observation);
  const comparison = await compareWithPrevious(
    db,
    env,
    identityKey,
    { observation, summary: row.summary as ExportPreview },
    { excludeId: row.id, acceptedOnly: true },
  );
  if (comparison?.conflict && !options.overrideConflict) {
    await db
      .update(characterSubmissions)
      .set({ reviewStatus: "CONFLICT", blockedReason: null, comparison, identityKey, observation, contentHash: contentHashOf(observation) })
      .where(and(eq(characterSubmissions.dataEnvironment, env), eq(characterSubmissions.id, row.id)));
    return { ok: false, reason: "CONFLICT_NEEDS_OVERRIDE" };
  }

  const updated = await db.transaction(async (tx) => {
    const stored = await ingestObservation(
      tx,
      { dataEnvironment: env, parserVersion, receivedAt: options.now, originalPayload: row.payload },
      observation,
    );
    const [result] = await tx
      .update(characterSubmissions)
      .set({
        reviewStatus: REVIEW_STATUS_BY_INGESTION[stored.status],
        blockedReason: null,
        observation,
        contentHash: contentHashOf(observation),
        identityKey,
        comparison,
        characterId: stored.characterId,
        ingestionRecordId: stored.ingestionRecordId,
        reviewedAt: options.now,
        reviewNote: cleanNote(options.note) ?? stored.reason ?? null,
      })
      .where(and(eq(characterSubmissions.dataEnvironment, env), eq(characterSubmissions.id, row.id)))
      .returning();
    return result!;
  });
  return { ok: true, submission: updated };
}

type StoredNormalize = {
  normalized: { ok: true; observation: CharacterObservationInput } | { ok: false; issues: SubmissionIssue[] };
  parserVersion: string;
  identityKey: (observation: CharacterObservation) => string | null;
};

/**
 * 보관한 제출 원본을 지금 설정으로 다시 정규화한다.
 * - Collector 파일(Character Export v1)과 웹 직접 등록(Manual Character v1)을 구분한다.
 * - 관측 시각 기준은 제출한 시각으로 판단한다(검토가 늦어져도 "너무 오래됨"으로 거부하지 않기 위해).
 */
function normalizeStoredPayload(payload: unknown, env: RealEnvironment, submittedAt: Date, config: ReviewConfig): StoredNormalize | "INVALID_PAYLOAD" {
  if (isManualPayload(payload)) {
    const parsed = manualCharacterSchema.safeParse(payload);
    if (!parsed.success) return "INVALID_PAYLOAD";
    const data = parsed.data;
    return {
      normalized: normalizeManualCharacter(data, {
        env,
        mapping: config.mapping(env),
        slotProfile: config.slotProfile(env, "*"),
        now: submittedAt,
        registration: config.registration,
        gameModeForRuleset: config.gameModeForRuleset,
      }),
      parserVersion: MANUAL_PARSER_VERSION,
      identityKey: (observation) => manualIdentityKey(data, observation),
    };
  }
  const parsed = characterExportV1Schema.safeParse(payload);
  if (!parsed.success) return "INVALID_PAYLOAD";
  const { mapping, slotProfile } = resolveSubmissionConfig(parsed.data, env, config);
  return {
    normalized: normalizeCharacterExport(parsed.data, { mapping, slotProfile, now: submittedAt }),
    parserVersion: EXPORT_PARSER_VERSION,
    identityKey: (observation) =>
      identityKeyHash({
        guid: observation.identity.externalId,
        region: observation.identity.region,
        gameMode: observation.identity.gameMode,
        characterName: observation.identity.characterName,
      }),
  };
}

export async function rejectSubmission(
  db: AppDatabase,
  env: RealEnvironment,
  id: string,
  options: { now: Date; note?: string | null },
): Promise<ReviewOutcome> {
  const row = await getSubmission(db, env, id);
  if (!row) return { ok: false, reason: "NOT_FOUND" };
  if (!REVIEWABLE.has(row.reviewStatus)) return { ok: false, reason: "NOT_REVIEWABLE" };
  const [updated] = await db
    .update(characterSubmissions)
    .set({ reviewStatus: "REJECTED", reviewedAt: options.now, reviewNote: cleanNote(options.note) })
    .where(and(eq(characterSubmissions.dataEnvironment, env), eq(characterSubmissions.id, row.id)))
    .returning();
  return { ok: true, submission: updated! };
}
