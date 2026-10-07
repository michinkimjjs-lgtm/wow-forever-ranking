/**
 * 캐릭터 제출 처리 (docs/ARCHITECTURE.md §8, docs/DATA-SPEC.md §9)
 *
 *   validate → normalize → identify → calculate gear → store
 *
 * - validate / normalize에서 실패하면 DB에 아무것도 쓰지 않는다.
 * - dryRun이면 store를 하지 않는다.
 * - 저장되는 데이터는 dataSource = addon, verificationStatus = COMMUNITY_SUBMITTED.
 *   제출 데이터는 자동으로 VERIFIED가 되지 않는다.
 */
import { and, eq } from "drizzle-orm";
import { characterExternalRefs, characters } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import type { ExportMapping, GearProfile } from "@/lib/config";
import type { DataEnvironment, IngestionStatus } from "@/lib/domain/enums";
import { normalizeName } from "@/lib/domain/names";
import { calculateEquippedItemLevel, type EquippedItemLevelResult } from "@/lib/gear/calculate";
import { defaultVerificationStatus, ingestObservation } from "@/lib/ingestion/ingest";
import { characterObservationSchema } from "@/lib/ingestion/schema";
import { characterExportV1Schema } from "./export-schema";
import type { SubmissionIssue } from "./issues";
import { EXPORT_PARSER_VERSION, normalizeCharacterExport } from "./normalize";

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
}

export interface SubmissionGearSummary {
  profileId: string;
  profileVersion: number;
  profileStatus: GearProfile["status"];
  usableForRanking: boolean;
  calculation: EquippedItemLevelResult;
}

export type SubmissionResult =
  | { ok: false; stage: "validate" | "normalize"; issues: SubmissionIssue[] }
  | {
      ok: true;
      mode: "dry-run" | "stored";
      status: IngestionStatus | "VALID";
      verificationStatus: "COMMUNITY_SUBMITTED";
      identity: { match: "EXTERNAL_ID" | "NATURAL_KEY" | "NEW" | "SKIPPED"; characterId: string | null };
      gear: SubmissionGearSummary | null;
      warnings: string[];
      ingestionRecordId: string | null;
      reason?: string;
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
  // 1. validate
  const parsed = characterExportV1Schema.safeParse(input);
  if (!parsed.success) return { ok: false, stage: "validate", issues: zodIssues(parsed.error) };

  // 2. normalize
  const normalized = normalizeCharacterExport(parsed.data, {
    mapping: ctx.mapping,
    slotProfile: ctx.slotProfile,
    now: ctx.now,
  });
  if (!normalized.ok) return { ok: false, stage: "normalize", issues: normalized.issues };
  const checked = characterObservationSchema.safeParse(normalized.observation);
  if (!checked.success) return { ok: false, stage: "normalize", issues: zodIssues(checked.error) };
  const observation = checked.data;

  // 3. identify (읽기 전용)
  const identity = ctx.db
    ? await identify(ctx.db, ctx.targetEnvironment, observation.identity)
    : { match: "SKIPPED" as const, characterId: null };

  // 4. calculate gear (랭킹용 APPROVED 프로필이 없으면 슬롯 매핑 프로필로 미리보기만)
  const gearProfile = ctx.rankingProfile ?? ctx.slotProfile;
  const gear: SubmissionGearSummary | null =
    gearProfile && observation.equipment
      ? {
          profileId: gearProfile.id,
          profileVersion: gearProfile.version,
          profileStatus: gearProfile.status,
          usableForRanking: false,
          calculation: calculateEquippedItemLevel(
            observation.equipment.map((e) => ({ slotCode: e.slotCode, itemLevel: e.itemLevel, itemSlotCode: e.itemSlotCode })),
            gearProfile,
          ),
        }
      : null;
  if (gear) {
    gear.usableForRanking = ctx.rankingProfile !== null && gear.calculation.status === "OK";
  }

  const verificationStatus = defaultVerificationStatus("addon");
  if (verificationStatus !== "COMMUNITY_SUBMITTED") {
    throw new Error("제출 데이터의 검증 상태는 COMMUNITY_SUBMITTED여야 합니다.");
  }

  if (ctx.dryRun || !ctx.db) {
    return {
      ok: true,
      mode: "dry-run",
      status: "VALID",
      verificationStatus,
      identity,
      gear,
      warnings: normalized.warnings,
      ingestionRecordId: null,
    };
  }

  // 5. store (수집 파이프라인: 원본 보관, 식별, 현재 상태 / 장비 / milestone / 스냅샷)
  const stored = await ingestObservation(
    ctx.db,
    {
      dataEnvironment: ctx.targetEnvironment,
      parserVersion: EXPORT_PARSER_VERSION,
      receivedAt: ctx.now,
      originalPayload: input,
      newId: ctx.newId,
    },
    observation,
  );
  return {
    ok: true,
    mode: "stored",
    status: stored.status,
    verificationStatus,
    identity: { match: identity.match, characterId: stored.characterId ?? identity.characterId },
    gear,
    warnings: [...normalized.warnings, ...stored.warnings],
    ingestionRecordId: stored.ingestionRecordId,
    reason: stored.reason,
  };
}
