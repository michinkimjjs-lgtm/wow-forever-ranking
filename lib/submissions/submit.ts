/**
 * 캐릭터 제출 처리 (docs/SUBMISSION-SYSTEM.md, docs/ARCHITECTURE.md §8, docs/DATA-SPEC.md §9)
 *
 *   validate → normalize → identify → calculate gear → duplicate check → conflict check → store
 *
 * - validate / normalize에서 실패하면 DB에 아무것도 쓰지 않는다.
 *   예외: 검토 대기(queue) 모드에서 게임 값 매핑이 아직 없어서 실패한 경우에는 MAPPING_PENDING으로 보관한다.
 * - dryRun이면 store를 하지 않는다(중복·충돌 여부는 읽기만 해서 알려 준다).
 * - 저장 방식
 *   - apply(관리자 API): 충돌이 없으면 바로 수집 파이프라인에 반영하고 제출 기록을 ACCEPTED로 남긴다.
 *   - queue(공개 제출): 제출 기록만 PENDING / CONFLICT로 남긴다. 관리자가 승인하면 반영한다.
 * - 저장되는 데이터는 dataSource = addon, verificationStatus = COMMUNITY_SUBMITTED.
 *   제출 데이터는 자동으로 VERIFIED가 되지 않는다. 검토 상태와 검증 상태는 별개다.
 */
import { and, eq } from "drizzle-orm";
import { characterExternalRefs, characters } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import type { ExportMapping, GearProfile } from "@/lib/config";
import type { DataEnvironment, IngestionStatus, SubmissionChannel, SubmissionReviewStatus } from "@/lib/domain/enums";
import { normalizeName } from "@/lib/domain/names";
import { calculateEquippedItemLevel, type EquippedItemLevelResult } from "@/lib/gear/calculate";
import { defaultVerificationStatus, ingestObservation } from "@/lib/ingestion/ingest";
import { characterObservationSchema, type CharacterObservation } from "@/lib/ingestion/schema";
import { characterExportV1Schema, type CharacterExportV1 } from "./export-schema";
import type { SubmissionIssue, SubmissionIssueCode } from "./issues";
import { EXPORT_PARSER_VERSION, normalizeCharacterExport } from "./normalize";
import { buildExportPreview, type ExportPreview } from "./preview";
import {
  checkSubmissionFrequency,
  compareWithPrevious,
  contentHashOf,
  findDuplicate,
  identityKeyHash,
  insertSubmission,
  markDuplicate,
  payloadHashOf,
  type SubmissionComparison,
} from "./review";

export interface SubmissionContext {
  /** 제출 데이터를 저장할 실제 영역 */
  targetEnvironment: Extract<DataEnvironment, "beta" | "live">;
  mapping: ExportMapping;
  /** 슬롯 이름 매핑용 프로필 (DRAFT 포함) */
  slotProfile: GearProfile | null;
  /** 랭킹용 프로필 (beta / live는 APPROVED만). 없으면 장비 계산 결과는 랭킹에 쓰지 않는다. */
  rankingProfile: GearProfile | null;
  now: Date;
  dryRun: boolean;
  /** DB 조회/저장. dryRun이고 DB가 없으면 identify를 건너뛴다. */
  db: AppDatabase | null;
  newId?: () => string;
  /** 제출 경로와 검토 방식. 생략하면 관리자 API(apply) */
  review?: SubmissionReviewOptions;
}

export interface SubmissionReviewOptions {
  channel: SubmissionChannel;
  mode: "apply" | "queue";
  /** 공개 제출의 동의 기록 (서버 시각) */
  consent: { consentVersion: string; policyVersion: string; consentedAt: Date } | null;
  /** 같은 캐릭터 반복 제출 제한. null이면 검사하지 않음 */
  frequency: { perCharacterMinIntervalMinutes: number; maxOpenPerCharacter: number } | null;
  /** queue 모드에서 충돌 없는 제출을 바로 반영할지 */
  autoAcceptNonConflicting: boolean;
}

const ADMIN_API_REVIEW: SubmissionReviewOptions = {
  channel: "admin_api",
  mode: "apply",
  consent: null,
  frequency: null,
  autoAcceptNonConflicting: true,
};

/** 게임 값 매핑·슬롯 기준이 확인되지 않아 생기는 정규화 실패 (설정이 채워지면 다시 처리할 수 있음) */
const MAPPING_PENDING_CODES: readonly SubmissionIssueCode[] = [
  "MAPPING_MISSING",
  "NAME_SEPARATOR_UNCONFIRMED",
  // 숨긴 성이 export에 담기는지는 Runtime verification required. 확인 전까지는 버리지 않고 검토 대기로 보관한다.
  "FULL_NAME_REQUIRED",
  "SLOT_MAPPING_UNAVAILABLE",
  "UNKNOWN_SLOT",
];

export interface SubmissionGearSummary {
  profileId: string;
  profileVersion: number;
  profileStatus: GearProfile["status"];
  usableForRanking: boolean;
  calculation: EquippedItemLevelResult;
}

export type SubmissionResult =
  | {
      ok: false;
      stage: "validate" | "normalize" | "limit";
      issues: SubmissionIssue[];
      preview?: ExportPreview;
      limit?: "TOO_FREQUENT" | "TOO_MANY_OPEN";
    }
  | {
      ok: true;
      mode: "dry-run" | "stored" | "queued" | "duplicate";
      status: IngestionStatus | "VALID" | "QUEUED" | "DUPLICATE";
      verificationStatus: "COMMUNITY_SUBMITTED";
      identity: { match: "EXTERNAL_ID" | "NATURAL_KEY" | "NEW" | "SKIPPED"; characterId: string | null };
      gear: SubmissionGearSummary | null;
      warnings: string[];
      ingestionRecordId: string | null;
      reason?: string;
      preview: ExportPreview;
      /** 제출 기록 ID (저장했거나 중복으로 찾은 경우) */
      submissionId: string | null;
      reviewStatus: SubmissionReviewStatus | null;
      blockedReason?: "MAPPING_PENDING";
      duplicate: boolean;
      comparison: SubmissionComparison | null;
    };

function zodIssues(error: { issues: readonly { path: PropertyKey[]; message: string }[] }): SubmissionIssue[] {
  return error.issues.slice(0, 50).map((issue) => ({
    code: "INVALID_FORMAT",
    path:
      issue.path
        .map((p, i) => (typeof p === "number" ? `[${p}]` : `${i === 0 ? "" : "."}${String(p)}`))
        .join("") || "(root)",
    detail: issue.message,
  }));
}

/** 읽기 전용 식별: 외부 ID → 자연 키 순서 (명세서 §7.3) */
async function identify(
  db: AppDatabase,
  env: DataEnvironment,
  identity: { externalId?: string | null; region: string; gameMode: string; characterName: string },
): Promise<{ match: "EXTERNAL_ID" | "NATURAL_KEY" | "NEW"; characterId: string | null }> {
  if (identity.externalId) {
    const [ref] = await db
      .select({ characterId: characterExternalRefs.characterId })
      .from(characterExternalRefs)
      .where(
        and(
          eq(characterExternalRefs.dataEnvironment, env),
          eq(characterExternalRefs.dataSource, "addon"),
          eq(characterExternalRefs.externalId, identity.externalId),
        ),
      )
      .limit(1);
    if (ref) return { match: "EXTERNAL_ID", characterId: ref.characterId };
  }
  const [row] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(
      and(
        eq(characters.dataEnvironment, env),
        eq(characters.region, identity.region),
        eq(characters.gameMode, identity.gameMode),
        eq(characters.nameNormalized, normalizeName(identity.characterName)),
      ),
    )
    .limit(1);
  return row ? { match: "NATURAL_KEY", characterId: row.id } : { match: "NEW", characterId: null };
}

export async function submitCharacterExport(input: unknown, ctx: SubmissionContext): Promise<SubmissionResult> {
  const review = ctx.review ?? ADMIN_API_REVIEW;
  const env = ctx.targetEnvironment;

  // 1. validate
  const parsed = characterExportV1Schema.safeParse(input);
  if (!parsed.success) return { ok: false, stage: "validate", issues: zodIssues(parsed.error) };
  const data = parsed.data;
  const preview = buildExportPreview(data, ctx.slotProfile);
  // 공개 제출은 알 수 없는 필드를 뺀 검증 결과만 보관한다. 관리자 API는 기존처럼 받은 원본을 보관한다.
  const storedPayload: unknown = review.channel === "public" ? data : input;
  const payloadHash = payloadHashOf(data);

  // 2. normalize
  const normalized = normalizeCharacterExport(data, { mapping: ctx.mapping, slotProfile: ctx.slotProfile, now: ctx.now });
  let observation: CharacterObservation | null = null;
  let normalizeIssues: SubmissionIssue[] = [];
  if (normalized.ok) {
    const checked = characterObservationSchema.safeParse(normalized.observation);
    if (!checked.success) return { ok: false, stage: "normalize", issues: zodIssues(checked.error), preview };
    observation = checked.data;
  } else {
    normalizeIssues = normalized.issues;
    const mappingPending = normalizeIssues.every((i) => MAPPING_PENDING_CODES.includes(i.code));
    // 공개 제출(queue)은 매핑 미확인만 원인이면 보관(또는 dryRun에서는 "매핑 대기"로 통과)한다.
    if (!(review.mode === "queue" && mappingPending && (ctx.dryRun || ctx.db))) {
      return { ok: false, stage: "normalize", issues: normalizeIssues, preview };
    }
  }

  const identityKey = identityKeyHash({
    guid: observation?.identity.externalId ?? data.character.guid,
    region: observation?.identity.region,
    gameMode: observation?.identity.gameMode,
    characterName: observation?.identity.characterName,
  });
  const contentHash = observation ? contentHashOf(observation) : null;

  // 3. identify (읽기 전용)
  const identity =
    ctx.db && observation
      ? await identify(ctx.db, env, observation.identity)
      : { match: "SKIPPED" as const, characterId: null };

  // 4. calculate gear (랭킹용 APPROVED 프로필이 없으면 슬롯 매핑 프로필로 미리보기만)
  const gear = observation ? gearSummary(observation, ctx) : null;

  const verificationStatus = defaultVerificationStatus("addon");
  if (verificationStatus !== "COMMUNITY_SUBMITTED") {
    throw new Error("제출 데이터의 검증 상태는 COMMUNITY_SUBMITTED여야 합니다.");
  }
  const base = {
    ok: true as const,
    verificationStatus,
    identity,
    gear,
    warnings: normalized.ok ? normalized.warnings : [],
    preview,
  };

  // 5. duplicate check
  const duplicateOf = ctx.db ? await findDuplicate(ctx.db, env, { payloadHash, identityKey, contentHash }) : null;
  if (duplicateOf) {
    if (!ctx.dryRun) await markDuplicate(ctx.db!, env, duplicateOf.id, ctx.now);
    return {
      ...base,
      mode: ctx.dryRun ? "dry-run" : "duplicate",
      status: ctx.dryRun ? "VALID" : "DUPLICATE",
      ingestionRecordId: duplicateOf.ingestionRecordId,
      submissionId: duplicateOf.id,
      reviewStatus: duplicateOf.reviewStatus,
      duplicate: true,
      comparison: null,
    };
  }

  // 반복 제출 제한 (공개 제출)
  if (ctx.db && review.frequency && !ctx.dryRun) {
    const problem = await checkSubmissionFrequency(ctx.db, env, identityKey, ctx.now, review.frequency);
    if (problem) return { ok: false, stage: "limit", issues: [], preview, limit: problem };
  }

  // 6. conflict check
  const comparison =
    ctx.db && observation ? await compareWithPrevious(ctx.db, env, identityKey, { observation, summary: preview }) : null;

  if (ctx.dryRun || !ctx.db) {
    return {
      ...base,
      mode: "dry-run",
      status: "VALID",
      ingestionRecordId: null,
      submissionId: null,
      reviewStatus: null,
      ...(observation ? {} : { blockedReason: "MAPPING_PENDING" as const }),
      duplicate: false,
      comparison,
    };
  }
  const db = ctx.db;

  const record = {
    env,
    channel: review.channel,
    payload: storedPayload,
    payloadHash,
    contentHash,
    identityKey,
    summary: preview,
    observation,
    comparison,
    issues: [...normalizeIssues, ...(comparison?.issues ?? [])],
    consent: review.consent,
    submittedAt: ctx.now,
  };

  // 7. store — 검토 대기
  const apply =
    observation !== null &&
    !comparison?.conflict &&
    (review.mode === "apply" || review.autoAcceptNonConflicting);
  if (!apply) {
    const reviewStatus: SubmissionReviewStatus = comparison?.conflict ? "CONFLICT" : "PENDING";
    const submissionId = await insertSubmission(db, {
      ...record,
      reviewStatus,
      blockedReason: observation ? null : "MAPPING_PENDING",
      characterId: null,
      ingestionRecordId: null,
      reviewedAt: null,
      reviewNote: null,
    });
    return {
      ...base,
      mode: "queued",
      status: "QUEUED",
      ingestionRecordId: null,
      submissionId,
      reviewStatus,
      ...(observation ? {} : { blockedReason: "MAPPING_PENDING" as const }),
      duplicate: false,
      comparison,
    };
  }

  // 7. store — 바로 반영 (수집 파이프라인: 원본 보관, 식별, 현재 상태 / 장비 / milestone / 스냅샷)
  return db.transaction(async (tx) => {
    const stored = await ingestObservation(
      tx,
      { dataEnvironment: env, parserVersion: EXPORT_PARSER_VERSION, receivedAt: ctx.now, originalPayload: storedPayload, newId: ctx.newId },
      observation!,
    );
    const reviewStatus = REVIEW_STATUS_BY_INGESTION[stored.status];
    const submissionId = await insertSubmission(tx, {
      ...record,
      reviewStatus,
      blockedReason: null,
      characterId: stored.characterId,
      ingestionRecordId: stored.ingestionRecordId,
      reviewedAt: reviewStatus === "ACCEPTED" ? ctx.now : null,
      reviewNote: null,
    });
    return {
      ...base,
      mode: "stored" as const,
      status: stored.status,
      identity: { match: identity.match, characterId: stored.characterId ?? identity.characterId },
      warnings: [...base.warnings, ...stored.warnings],
      ingestionRecordId: stored.ingestionRecordId,
      reason: stored.reason,
      submissionId,
      reviewStatus,
      duplicate: false,
      comparison,
    };
  });
}

/** 수집 파이프라인 결과 → 제출 검토 상태 */
export const REVIEW_STATUS_BY_INGESTION: Record<IngestionStatus, SubmissionReviewStatus> = {
  ACCEPTED: "ACCEPTED",
  IDENTITY_CONFLICT: "CONFLICT",
  REJECTED: "REJECTED",
};

function gearSummary(observation: CharacterObservation, ctx: Pick<SubmissionContext, "rankingProfile" | "slotProfile">): SubmissionGearSummary | null {
  const gearProfile = ctx.rankingProfile ?? ctx.slotProfile;
  if (!gearProfile || !observation.equipment) return null;
  const calculation = calculateEquippedItemLevel(
    observation.equipment.map((e) => ({ slotCode: e.slotCode, itemLevel: e.itemLevel, itemSlotCode: e.itemSlotCode })),
    gearProfile,
  );
  return {
    profileId: gearProfile.id,
    profileVersion: gearProfile.version,
    profileStatus: gearProfile.status,
    usableForRanking: ctx.rankingProfile !== null && calculation.status === "OK",
    calculation,
  };
}

/** 원본의 gameMode 값으로 매핑·프로필을 고른다 (매핑이 없으면 "*" 기준 프로필) */
export function resolveSubmissionConfig(
  body: unknown,
  target: "beta" | "live",
  config: {
    mapping: (env: "beta" | "live") => ExportMapping;
    slotProfile: (env: "beta" | "live", gameMode: string) => GearProfile | null;
    rankingProfile: (env: "beta" | "live", gameMode: string) => GearProfile | null;
  },
): { mapping: ExportMapping; slotProfile: GearProfile | null; rankingProfile: GearProfile | null } {
  const mapping = config.mapping(target);
  const raw = (body as { gameMode?: { activeGameMode?: unknown } } | null)?.gameMode?.activeGameMode;
  const gameMode = (raw !== undefined && mapping.gameModeByActiveGameMode[String(raw)]) || "*";
  return { mapping, slotProfile: config.slotProfile(target, gameMode), rankingProfile: config.rankingProfile(target, gameMode) };
}

export type { CharacterExportV1 };
