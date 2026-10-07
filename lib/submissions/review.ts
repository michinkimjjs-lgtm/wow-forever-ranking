/**
 * 제출 기록, 중복·충돌 확인, 관리자 검토 (docs/SUBMISSION-SYSTEM.md §4, docs/ADMIN-REVIEW.md)
 *
 * 모든 함수는 dataEnvironment를 필수 인자로 받는다. 제출은 실제 영역(beta / live)에만 저장한다.
 * 검토 상태(reviewStatus)와 검증 상태(verificationStatus)는 별개다. 검토에서 ACCEPTED가 되어도
 * 검증 상태는 COMMUNITY_SUBMITTED 그대로다(DB CHECK로도 강제).
 */
import { and, count, desc, eq, gte, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { characterSubmissions } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import type { DataEnvironment, SubmissionChannel, SubmissionReviewStatus } from "@/lib/domain/enums";
import {
  compareSubmissions,
  identityKeyOf,
  type SubmissionIssue as ConsistencyIssue,
  type SubmittedObservation,
} from "@/lib/domain/submission-consistency";
import { sha256, stableStringify } from "@/lib/util/stable-json";
import type { CharacterObservation } from "@/lib/ingestion/schema";
import type { ExportPreview } from "./preview";

export type SubmissionRow = typeof characterSubmissions.$inferSelect;
type RealEnvironment = Extract<DataEnvironment, "beta" | "live">;

export function payloadHashOf(payload: unknown): string {
  return sha256(stableStringify(payload));
}

export function contentHashOf(observation: CharacterObservation): string {
  return sha256(stableStringify(observation));
}

/** 식별 키 해시 (GUID → 자연 키 순). GUID 원문을 제출 표에 따로 두지 않는다. */
export function identityKeyHash(input: {
  guid: string | null | undefined;
  region?: string;
  gameMode?: string;
  characterName?: string;
}): string | null {
  if (input.guid) return sha256(`guid:${input.guid}`);
  if (!input.region || !input.gameMode || !input.characterName) return null;
  const key = identityKeyOf({
    submissionId: "",
    submitterKey: null,
    observedAt: new Date(0),
    region: input.region,
    gameMode: input.gameMode,
    characterName: input.characterName,
    level: 0,
  }).key;
  return sha256(key);
}

// ---------------------------------------------------------------------------
// 중복
// ---------------------------------------------------------------------------

/** 같은 export(원본 해시) 또는 같은 캐릭터의 같은 관측 내용(정규화 해시)이면 중복이다. */
export async function findDuplicate(
  db: AppDatabase,
  env: RealEnvironment,
  keys: { payloadHash: string; identityKey: string | null; contentHash: string | null },
): Promise<SubmissionRow | null> {
  const match: SQL[] = [eq(characterSubmissions.payloadHash, keys.payloadHash)];
  if (keys.identityKey && keys.contentHash) {
    match.push(and(eq(characterSubmissions.identityKey, keys.identityKey), eq(characterSubmissions.contentHash, keys.contentHash))!);
  }
  const [row] = await db
    .select()
    .from(characterSubmissions)
    .where(and(eq(characterSubmissions.dataEnvironment, env), or(...match)))
    .orderBy(characterSubmissions.submittedAt)
    .limit(1);
  return row ?? null;
}

export async function markDuplicate(db: AppDatabase, env: RealEnvironment, id: string, now: Date): Promise<void> {
  await db
    .update(characterSubmissions)
    .set({ duplicateCount: sql`${characterSubmissions.duplicateCount} + 1`, lastDuplicateAt: now })
    .where(and(eq(characterSubmissions.dataEnvironment, env), eq(characterSubmissions.id, id)));
}

// ---------------------------------------------------------------------------
// 반복 제출 제한
// ---------------------------------------------------------------------------

export type FrequencyProblem = "TOO_FREQUENT" | "TOO_MANY_OPEN";

export async function checkSubmissionFrequency(
  db: AppDatabase,
  env: RealEnvironment,
  identityKey: string | null,
  now: Date,
  policy: { perCharacterMinIntervalMinutes: number; maxOpenPerCharacter: number },
): Promise<FrequencyProblem | null> {
  if (!identityKey) return null;
  const sameCharacter = and(eq(characterSubmissions.dataEnvironment, env), eq(characterSubmissions.identityKey, identityKey));
  const since = new Date(now.getTime() - policy.perCharacterMinIntervalMinutes * 60_000);
  const [[recent], [open]] = await Promise.all([
    db.select({ n: count() }).from(characterSubmissions).where(and(sameCharacter, gte(characterSubmissions.submittedAt, since))),
    db
      .select({ n: count() })
      .from(characterSubmissions)
      .where(and(sameCharacter, inArray(characterSubmissions.reviewStatus, ["PENDING", "CONFLICT"]))),
  ]);
  if ((recent?.n ?? 0) > 0) return "TOO_FREQUENT";
  if ((open?.n ?? 0) >= policy.maxOpenPerCharacter) return "TOO_MANY_OPEN";
  return null;
}

// ---------------------------------------------------------------------------
// 충돌 / 비교
// ---------------------------------------------------------------------------

export interface SubmissionChange {
  field: string;
  before: string | number | null;
  after: string | number | null;
}

export interface SubmissionComparison {
  previousSubmissionId: string;
  previousObservedAt: string | null;
  currentObservedAt: string | null;
  changes: SubmissionChange[];
  issues: ConsistencyIssue[];
  conflict: boolean;
}

interface ComparableState {
  observation: CharacterObservation;
  summary: Pick<ExportPreview, "averageItemLevel" | "highestItemLevel" | "gearCount">;
}

function toSubmitted(id: string, o: CharacterObservation): SubmittedObservation {
  return {
    submissionId: id,
    submitterKey: null,
    observedAt: new Date(o.observedAt),
    region: o.identity.region,
    gameMode: o.identity.gameMode,
    characterName: o.identity.characterName,
    guid: o.identity.externalId ?? null,
    level: o.level,
    classCode: o.classCode ?? null,
    raceCode: o.raceCode ?? null,
    factionCode: o.factionCode ?? null,
  };
}

function diff(previous: ComparableState, current: ComparableState): SubmissionChange[] {
  const pick = (s: ComparableState) => ({
    characterName: s.observation.identity.characterName,
    level: s.observation.level,
    classCode: s.observation.classCode ?? null,
    raceCode: s.observation.raceCode ?? null,
    factionCode: s.observation.factionCode ?? null,
    guildName: s.observation.guild?.name ?? null,
    gearCount: s.summary.gearCount,
    averageItemLevel: s.summary.averageItemLevel,
    highestItemLevel: s.summary.highestItemLevel,
  });
  const before = pick(previous);
  const after = pick(current);
  return (Object.keys(after) as (keyof typeof after)[])
    .filter((field) => before[field] !== after[field])
    .map((field) => ({ field, before: before[field], after: after[field] }));
}

/**
 * 같은 캐릭터의 이전 제출과 비교한다.
 * - 제출할 때: 거부되지 않은 모든 제출(검토 대기 포함)과 비교해 검토 대상을 표시한다.
 * - 승인할 때(acceptedOnly): 이미 반영된(ACCEPTED) 제출과만 비교한다.
 * 새 제출이 들어간 충돌(conflict 심각도)이 있으면 conflict = true → 랭킹에 바로 반영하지 않는다.
 */
export async function compareWithPrevious(
  db: AppDatabase,
  env: RealEnvironment,
  identityKey: string | null,
  current: ComparableState,
  options: { excludeId?: string; acceptedOnly?: boolean } = {},
): Promise<SubmissionComparison | null> {
  if (!identityKey) return null;
  const { excludeId, acceptedOnly } = options;
  const conditions: SQL[] = [
    eq(characterSubmissions.dataEnvironment, env),
    eq(characterSubmissions.identityKey, identityKey),
    acceptedOnly ? eq(characterSubmissions.reviewStatus, "ACCEPTED") : ne(characterSubmissions.reviewStatus, "REJECTED"),
    sql`${characterSubmissions.observation} IS NOT NULL`,
  ];
  if (excludeId) conditions.push(ne(characterSubmissions.id, excludeId));
  const previous = await db
    .select()
    .from(characterSubmissions)
    .where(and(...conditions))
    .orderBy(desc(characterSubmissions.observedAt))
    .limit(20);
  if (previous.length === 0) return null;

  const CURRENT = "current";
  const parsed = previous.map((row) => ({ row, observation: reviveObservation(row.observation) }));
  const result = compareSubmissions([
    ...parsed.map((p) => toSubmitted(p.row.id, p.observation)),
    toSubmitted(CURRENT, current.observation),
  ]);
  const issues = result.issues.filter((i) => i.submissionIds.includes(CURRENT));
  const latest = parsed[0]!;
  return {
    previousSubmissionId: latest.row.id,
    previousObservedAt: latest.row.observedAt?.toISOString() ?? null,
    currentObservedAt: new Date(current.observation.observedAt).toISOString(),
    changes: diff({ observation: latest.observation, summary: latest.row.summary as ComparableState["summary"] }, current),
    issues,
    conflict: issues.some((i) => i.severity === "conflict"),
  };
}

/** jsonb에 저장한 관측 데이터의 시각 문자열을 Date로 되돌린다. */
export function reviveObservation(value: unknown): CharacterObservation {
  const o = value as CharacterObservation & { observedAt: string | Date; sourceUpdatedAt?: string | Date | null; levelReachedAt?: string | Date | null };
  return {
    ...o,
    observedAt: new Date(o.observedAt),
    sourceUpdatedAt: o.sourceUpdatedAt ? new Date(o.sourceUpdatedAt) : o.sourceUpdatedAt,
    levelReachedAt: o.levelReachedAt ? new Date(o.levelReachedAt) : o.levelReachedAt,
  } as CharacterObservation;
}

// ---------------------------------------------------------------------------
// 저장
// ---------------------------------------------------------------------------

export interface NewSubmission {
  env: RealEnvironment;
  channel: SubmissionChannel;
  reviewStatus: SubmissionReviewStatus;
  blockedReason: string | null;
  payload: unknown;
  payloadHash: string;
  contentHash: string | null;
  identityKey: string | null;
  summary: ExportPreview;
  observation: CharacterObservation | null;
  comparison: SubmissionComparison | null;
  issues: unknown[];
  characterId: string | null;
  ingestionRecordId: string | null;
  consent: { consentVersion: string; policyVersion: string; consentedAt: Date } | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
}

export async function insertSubmission(db: AppDatabase, input: NewSubmission): Promise<string> {
  const s = input.summary;
  const [row] = await db
    .insert(characterSubmissions)
    .values({
      dataEnvironment: input.env,
      dataSource: "addon",
      verificationStatus: "COMMUNITY_SUBMITTED",
      reviewStatus: input.reviewStatus,
      channel: input.channel,
      blockedReason: input.blockedReason,
      payload: input.payload,
      payloadHash: input.payloadHash,
      contentHash: input.contentHash,
      identityKey: input.identityKey,
      summary: s,
      characterName: input.observation?.identity.characterName ?? ([s.name, s.surname].filter(Boolean).join(" ") || "-"),
      level: input.observation?.level ?? s.level,
      observedAt: input.observation ? new Date(input.observation.observedAt) : s.observedAt ? new Date(s.observedAt) : null,
      sourceBuild: input.observation?.sourceBuild ?? s.sourceBuild,
      gearCoverage: s.coverage,
      averageItemLevel: s.averageItemLevel,
      highestItemLevel: s.highestItemLevel,
      observation: input.observation,
      comparison: input.comparison,
      issues: input.issues,
      characterId: input.characterId,
      ingestionRecordId: input.ingestionRecordId,
      consentVersion: input.consent?.consentVersion ?? null,
      policyVersion: input.consent?.policyVersion ?? null,
      consentedAt: input.consent?.consentedAt ?? null,
      submittedAt: input.submittedAt,
      reviewedAt: input.reviewedAt,
      reviewNote: input.reviewNote,
    })
    .returning({ id: characterSubmissions.id });
  return row!.id;
}

// ---------------------------------------------------------------------------
// 관리자 조회
// ---------------------------------------------------------------------------

export async function listSubmissions(
  db: AppDatabase,
  env: RealEnvironment,
  options: { status?: SubmissionReviewStatus; page: number; pageSize: number },
): Promise<{ rows: SubmissionRow[]; total: number; counts: Record<SubmissionReviewStatus, number> }> {
  const base = eq(characterSubmissions.dataEnvironment, env);
  const where = options.status ? and(base, eq(characterSubmissions.reviewStatus, options.status)) : base;
  const [rows, [total], grouped] = await Promise.all([
    db
      .select()
      .from(characterSubmissions)
      .where(where)
      .orderBy(desc(characterSubmissions.submittedAt), characterSubmissions.id)
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize),
    db.select({ n: count() }).from(characterSubmissions).where(where),
    db
      .select({ status: characterSubmissions.reviewStatus, n: count() })
      .from(characterSubmissions)
      .where(base)
      .groupBy(characterSubmissions.reviewStatus),
  ]);
  const counts = { PENDING: 0, ACCEPTED: 0, REJECTED: 0, CONFLICT: 0 } as Record<SubmissionReviewStatus, number>;
  for (const g of grouped) counts[g.status] = g.n;
  return { rows, total: total?.n ?? 0, counts };
}

export async function getSubmission(db: AppDatabase, env: RealEnvironment, id: string): Promise<SubmissionRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select()
    .from(characterSubmissions)
    .where(and(eq(characterSubmissions.dataEnvironment, env), eq(characterSubmissions.id, id)))
    .limit(1);
  return row ?? null;
}
