/**
 * 웹 직접 등록 처리 (docs/DATA-COLLECTION-STRATEGY.md §2)
 *
 *   validate → normalize → (identify: 승인 때) → duplicate → 반복 제출 제한 → conflict → store(검토 대기)
 *
 * - 데이터 출처는 user_submission(직접 제출), 검증 상태는 COMMUNITY_SUBMITTED. 자동으로 검증 상태가 올라가지 않는다.
 * - 항상 검토 대기로 저장한다. 공개 제출의 자동 반영 설정(autoAcceptNonConflicting)과 관계없이 관리자가 승인해야 반영된다.
 * - 지역·게임 규칙·직업을 데이터 영역 코드로 바꾸는 값이 확인되지 않았으면 MAPPING_PENDING으로 보관한다.
 * - Collector 파일 제출(submitCharacterExport)과 같은 표(character_submissions)와 검토 화면을 쓴다.
 */
import { normalizeName } from "@/lib/domain/names";
import { registrationConfig, type RegistrationConfig } from "@/config/registration";
import type { ExportMapping, GearProfile } from "@/lib/config";
import { gameModeForRuleset, isRulesetCode } from "@/lib/config";
import type { SubmissionReviewStatus } from "@/lib/domain/enums";
import { calculateEquippedItemLevel } from "@/lib/gear/calculate";
import { characterObservationSchema, type CharacterObservation, type CharacterObservationInput } from "@/lib/ingestion/schema";
import type { AppDatabase } from "@/db/types";
import { buildFullName } from "@/lib/domain/names";
import type { SubmissionIssue } from "./issues";
import { manualCharacterSchema, type ManualCharacter } from "./manual-schema";
import type { ExportPreview } from "./preview";
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

export const MANUAL_PARSER_VERSION = "manual-character-v1@1";

type RealEnvironment = "beta" | "live";

export interface ManualNormalizeContext {
  env: RealEnvironment;
  /** 이름·성 구분자와 관측 시각 허용 범위 (Collector와 같은 설정) */
  mapping: ExportMapping;
  /** 장비 슬롯 기준 (DRAFT 포함). 없으면 장비를 처리하지 않는다 */
  slotProfile: GearProfile | null;
  now: Date;
  registration?: RegistrationConfig;
  /** 게임 규칙 → gameMode 코드 (기본: 데이터 영역 설정) */
  gameModeForRuleset?: (env: RealEnvironment, ruleset: string) => string | null;
}

export type ManualNormalizeResult =
  | { ok: true; observation: CharacterObservationInput; warnings: string[] }
  | { ok: false; issues: SubmissionIssue[] };

/** 게임에 표시된 이름을 비교용으로 정리한다 */
export function displayNameKey(value: string): string {
  return value.normalize("NFC").trim().toLowerCase();
}

/** 직접 등록 → 정규화 관측 데이터. 확인되지 않은 값은 추정하지 않는다. */
export function normalizeManualCharacter(input: ManualCharacter, ctx: ManualNormalizeContext): ManualNormalizeResult {
  const registration = ctx.registration ?? registrationConfig;
  const issues: SubmissionIssue[] = [];
  const warnings: string[] = [];

  const observedMs = Date.parse(input.observedAt);
  if (observedMs > ctx.now.getTime() + ctx.mapping.maxFutureSkewSeconds * 1000) {
    issues.push({ code: "OBSERVED_AT_IN_FUTURE", path: "observedAt" });
  } else if (observedMs < ctx.now.getTime() - ctx.mapping.maxObservationAgeDays * 86_400_000) {
    issues.push({ code: "OBSERVED_AT_TOO_OLD", path: "observedAt" });
  }

  const region = registration.regionCodeByBattleNetRegion[ctx.env][input.region];
  if (!region) issues.push({ code: "MAPPING_MISSING", path: "region", detail: `no region mapping for ${input.region}` });

  const toGameMode = ctx.gameModeForRuleset ?? ((env, ruleset) => (isRulesetCode(ruleset) ? gameModeForRuleset(env, ruleset) : null));
  const gameMode = toGameMode(ctx.env, input.ruleset);
  if (!gameMode) issues.push({ code: "MAPPING_MISSING", path: "ruleset", detail: `no gameMode for ruleset ${input.ruleset}` });

  let characterName: string | null = null;
  if (ctx.mapping.nameSeparator === null) {
    issues.push({ code: "NAME_SEPARATOR_UNCONFIRMED", path: "surname" });
  } else {
    characterName = buildFullName(input.name, input.surname, ctx.mapping.nameSeparator);
  }

  const classCode = registration.classCodeByName[ctx.env][displayNameKey(input.className)];
  if (!classCode) issues.push({ code: "MAPPING_MISSING", path: "className", detail: "class name not mapped" });

  const slotCodes = new Set((ctx.slotProfile?.slots ?? []).map((s) => s.code));
  const equipment: NonNullable<CharacterObservationInput["equipment"]> = [];
  input.equipment.forEach((item, index) => {
    const path = `equipment[${index}]`;
    if (!ctx.slotProfile) {
      issues.push({ code: "SLOT_MAPPING_UNAVAILABLE", path });
      return;
    }
    if (!slotCodes.has(item.slot)) {
      issues.push({ code: "UNKNOWN_SLOT", path: `${path}.slot`, detail: item.slot });
      return;
    }
    if (item.itemId === undefined) {
      warnings.push(`${path}: 아이템 번호가 없어 장비 계산에서 제외했습니다.`);
      return;
    }
    equipment.push({ slotCode: item.slot, externalItemId: String(item.itemId), name: item.itemName, itemLevel: item.itemLevel ?? null });
  });

  if (issues.length > 0 || !region || !gameMode || !characterName) return { ok: false, issues };

  const observedAt = new Date(observedMs);
  return {
    ok: true,
    warnings,
    observation: {
      dataSource: "user_submission",
      observedAt,
      sourceUpdatedAt: observedAt,
      sourceBuild: null,
      identity: { externalId: null, region, gameMode, characterName },
      level: input.level,
      // 직접 입력은 레벨 달성 시각의 근거가 아니다. 최초 확인 시각(FIRST_OBSERVED)으로만 기록된다.
      levelReachedAt: null,
      classCode,
      raceCode: null,
      factionCode: null,
      ...(input.guildName ? { guild: { name: input.guildName } } : {}),
      equipment: input.equipment.length > 0 ? equipment : null,
    },
  };
}

/** 검토 화면·제출 결과용 요약 (Collector 미리보기와 같은 항목) */
export function buildManualPreview(input: ManualCharacter, slotProfile: GearProfile | null): ExportPreview {
  const withLevel = input.equipment.filter((e) => e.itemLevel !== undefined);
  const calculation = slotProfile
    ? calculateEquippedItemLevel(
        input.equipment
          .filter((e) => slotProfile.slots.some((s) => s.code === e.slot))
          .map((e) => ({ slotCode: e.slot, itemLevel: e.itemLevel ?? null })),
        slotProfile,
      )
    : null;
  return {
    name: input.name,
    surname: input.surname,
    level: input.level,
    className: input.className,
    raceName: input.raceName ?? null,
    factionName: input.factionName ?? null,
    guildName: input.guildName ?? null,
    gearCount: input.equipment.length,
    gearWithItemLevel: withLevel.length,
    averageItemLevel: calculation?.averageItemLevel ?? null,
    highestItemLevel: calculation?.highestItemLevel ?? null,
    coverage: calculation ? calculation.coverage : null,
    coverageStatus: calculation?.status ?? null,
    profile: slotProfile ? { id: slotProfile.id, version: slotProfile.version, status: slotProfile.status } : null,
    observedAt: new Date(input.observedAt).toISOString(),
    sourceBuild: null,
    interfaceVersion: null,
    collectorVersion: null,
    exportSchemaVersion: null,
  };
}

/**
 * 매핑 전에도 같은 캐릭터의 반복 제출을 묶기 위한 식별 키.
 * 신고된 지역·규칙·이름·성으로 만들며, 데이터 영역 코드와 섞이지 않도록 "reported:" 접두사를 붙인다.
 */
export function manualIdentityKey(input: ManualCharacter, observation: CharacterObservation | null): string | null {
  if (observation) {
    return identityKeyHash({
      guid: null,
      region: observation.identity.region,
      gameMode: observation.identity.gameMode,
      characterName: observation.identity.characterName,
    });
  }
  return identityKeyHash({
    guid: null,
    region: `reported:${input.region}`,
    gameMode: input.ruleset,
    characterName: `${normalizeName(input.name)}\u0000${normalizeName(input.surname)}`,
  });
}

export interface ManualSubmissionContext {
  targetEnvironment: RealEnvironment;
  mapping: ExportMapping;
  slotProfile: GearProfile | null;
  now: Date;
  dryRun: boolean;
  db: AppDatabase | null;
  consent: { consentVersion: string; policyVersion: string; consentedAt: Date } | null;
  frequency: { perCharacterMinIntervalMinutes: number; maxOpenPerCharacter: number } | null;
  registration?: RegistrationConfig;
  gameModeForRuleset?: ManualNormalizeContext["gameModeForRuleset"];
}

export type ManualSubmissionResult =
  | { ok: false; stage: "validate"; issues: SubmissionIssue[] }
  | { ok: false; stage: "limit"; limit: "TOO_FREQUENT" | "TOO_MANY_OPEN" }
  | {
      ok: true;
      mode: "dry-run" | "queued" | "duplicate";
      submissionId: string | null;
      reviewStatus: SubmissionReviewStatus | null;
      dataSource: "user_submission";
      verificationStatus: "COMMUNITY_SUBMITTED";
      blockedReason: "MAPPING_PENDING" | null;
      duplicate: boolean;
      comparison: SubmissionComparison | null;
      warnings: string[];
      preview: ExportPreview;
    };

function zodIssues(error: { issues: readonly { path: PropertyKey[]; message: string }[] }): SubmissionIssue[] {
  return error.issues.slice(0, 50).map((issue) => ({
    code: "INVALID_FORMAT" as const,
    path: issue.path.map(String).join(".") || "(root)",
    detail: issue.message,
  }));
}

/** 매핑 미확인만 원인인 정규화 실패 (설정이 채워지면 다시 처리할 수 있음) */
const PENDING_CODES = new Set(["MAPPING_MISSING", "NAME_SEPARATOR_UNCONFIRMED", "SLOT_MAPPING_UNAVAILABLE"]);

export async function submitManualRegistration(input: unknown, ctx: ManualSubmissionContext): Promise<ManualSubmissionResult> {
  const env = ctx.targetEnvironment;
  const parsed = manualCharacterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, stage: "validate", issues: zodIssues(parsed.error) };
  const data = parsed.data;
  const preview = buildManualPreview(data, ctx.slotProfile);

  const normalized = normalizeManualCharacter(data, {
    env,
    mapping: ctx.mapping,
    slotProfile: ctx.slotProfile,
    now: ctx.now,
    registration: ctx.registration,
    gameModeForRuleset: ctx.gameModeForRuleset,
  });
  let observation: CharacterObservation | null = null;
  let normalizeIssues: SubmissionIssue[] = [];
  if (normalized.ok) {
    const checked = characterObservationSchema.safeParse(normalized.observation);
    if (!checked.success) return { ok: false, stage: "validate", issues: zodIssues(checked.error) };
    observation = checked.data;
  } else {
    normalizeIssues = normalized.issues;
    // 시각 오류처럼 사용자가 고칠 수 있는 문제는 저장하지 않고 돌려준다. 매핑 미확인만 보관한다.
    const fixable = normalizeIssues.filter((i) => !PENDING_CODES.has(i.code));
    if (fixable.length > 0) return { ok: false, stage: "validate", issues: fixable };
  }

  const payloadHash = payloadHashOf(data);
  const identityKey = manualIdentityKey(data, observation);
  const contentHash = observation ? contentHashOf(observation) : null;
  const blockedReason = observation ? null : ("MAPPING_PENDING" as const);
  const base = {
    ok: true as const,
    dataSource: "user_submission" as const,
    verificationStatus: "COMMUNITY_SUBMITTED" as const,
    warnings: normalized.ok ? normalized.warnings : [],
    preview,
  };

  const duplicateOf = ctx.db ? await findDuplicate(ctx.db, env, { payloadHash, identityKey, contentHash }) : null;
  if (duplicateOf) {
    if (!ctx.dryRun) await markDuplicate(ctx.db!, env, duplicateOf.id, ctx.now);
    return {
      ...base,
      mode: ctx.dryRun ? "dry-run" : "duplicate",
      submissionId: duplicateOf.id,
      reviewStatus: duplicateOf.reviewStatus,
      blockedReason,
      duplicate: true,
      comparison: null,
    };
  }

  if (ctx.db && ctx.frequency && !ctx.dryRun) {
    const problem = await checkSubmissionFrequency(ctx.db, env, identityKey, ctx.now, ctx.frequency);
    if (problem) return { ok: false, stage: "limit", limit: problem };
  }

  const comparison =
    ctx.db && observation ? await compareWithPrevious(ctx.db, env, identityKey, { observation, summary: preview }) : null;

  if (ctx.dryRun || !ctx.db) {
    return { ...base, mode: "dry-run", submissionId: null, reviewStatus: null, blockedReason, duplicate: false, comparison };
  }

  const reviewStatus: SubmissionReviewStatus = comparison?.conflict ? "CONFLICT" : "PENDING";
  const submissionId = await insertSubmission(ctx.db, {
    env,
    channel: "public",
    dataSource: "user_submission",
    reviewStatus,
    blockedReason,
    payload: data,
    payloadHash,
    contentHash,
    identityKey,
    summary: preview,
    observation,
    comparison,
    issues: [...normalizeIssues, ...(comparison?.issues ?? [])],
    characterId: null,
    ingestionRecordId: null,
    consent: ctx.consent,
    submittedAt: ctx.now,
    reviewedAt: null,
    reviewNote: null,
  });
  return { ...base, mode: "queued", submissionId, reviewStatus, blockedReason, duplicate: false, comparison };
}
