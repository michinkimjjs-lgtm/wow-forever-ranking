/**
 * 수집 파이프라인 (명세서 §15)
 *
 * 원본 저장 → 입력 검증(금지 필드 제거) → dataEnvironment 부여(서버 설정) → 캐릭터 식별(§7.3)
 * → 현재 상태 / 장비 / milestone / 스냅샷 갱신 (Gear Profile 적용)
 */
import { and, desc, eq } from "drizzle-orm";
import {
  characterExternalRefs,
  characterItems,
  characters,
  characterSnapshots,
  guildExternalRefs,
  guilds,
  ingestionRecords,
  items,
  levelMilestones,
} from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { getRankingConfig, resolveGearProfile } from "@/lib/config";
import {
  DATA_SOURCES,
  isMockTripleConsistent,
  type DataEnvironment,
  type DataSource,
  type IngestionStatus,
  type MilestoneTimingBasis,
  type VerificationStatus,
} from "@/lib/domain/enums";
import { normalizeName, toSlug } from "@/lib/domain/names";
import { calculateEquippedItemLevel, type EquippedItemLevelResult } from "@/lib/gear/calculate";
import { sha256, stableStringify } from "@/lib/util/stable-json";
import {
  characterObservationSchema,
  FORBIDDEN_RANK_FIELDS,
  type CharacterObservation,
} from "./schema";

export class IngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestionError";
  }
}

export interface IngestionContext {
  /** 서버 설정에서 정해진 데이터 영역. payload 값을 쓰지 않는다. */
  dataEnvironment: DataEnvironment;
  parserVersion: string;
  /** 새 행의 UUID 생성기. 기본값은 crypto.randomUUID (mock seed는 결정적 생성기를 넘긴다) */
  newId?: () => string;
  /** 수신 시각. 기본값은 현재 시각 */
  receivedAt?: Date;
  /**
   * ingestion_records에 보관할 원본. 기본값은 raw.
   * 제출 API처럼 원본(예: Character Export v1)을 정규화한 뒤 넘기는 경우, 재처리를 위해 원본을 보관한다.
   */
  originalPayload?: unknown;
}

export interface IngestionResult {
  status: IngestionStatus;
  ingestionRecordId: string | null;
  characterId: string | null;
  warnings: string[];
  reason?: string;
}

/** 공급원별 기본 검증 상태 (명세서 §11) */
export function defaultVerificationStatus(source: DataSource): VerificationStatus {
  switch (source) {
    case "mock":
      return "MOCK";
    case "addon":
    case "user_submission":
      return "COMMUNITY_SUBMITTED";
    case "blizzard":
      // 공식 API 존재가 확인되기 전까지 기본값을 정하지 않는다.
      throw new IngestionError("blizzard 공급원의 기본 검증 상태는 아직 정해지지 않았습니다.");
  }
}

const BASIS_PRIORITY: Record<MilestoneTimingBasis, number> = {
  SOURCE_REPORTED: 3,
  FIRST_OBSERVED: 2,
  INFERRED: 1,
};

interface MilestoneCandidate {
  level: number;
  timingBasis: MilestoneTimingBasis;
  reachedAt: Date | null;
  firstObservedAt: Date;
  previousObservedAt: Date | null;
}

function effectiveTime(c: { timingBasis: MilestoneTimingBasis; reachedAt: Date | null; firstObservedAt: Date }) {
  return c.timingBasis === "SOURCE_REPORTED" && c.reachedAt ? c.reachedAt : c.firstObservedAt;
}

/** payload에서 금지 필드를 제거하고 경고를 만든다. */
function sanitizePayload(raw: unknown, dataEnvironment: DataEnvironment): {
  payload: Record<string, unknown>;
  warnings: string[];
  rejectReason?: string;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { payload: {}, warnings: [], rejectReason: "payload가 객체가 아닙니다." };
  }
  const payload = { ...(raw as Record<string, unknown>) };
  const warnings: string[] = [];
  for (const field of FORBIDDEN_RANK_FIELDS) {
    if (field in payload) {
      delete payload[field];
      warnings.push(`순위 필드(${field})는 사용하지 않으므로 제거했습니다.`);
    }
  }
  if ("dataEnvironment" in payload) {
    const claimed = payload.dataEnvironment;
    delete payload.dataEnvironment;
    if (claimed !== dataEnvironment) {
      return {
        payload,
        warnings,
        rejectReason: `payload의 데이터 영역(${String(claimed)})이 서버 설정(${dataEnvironment})과 다릅니다.`,
      };
    }
    warnings.push("payload의 dataEnvironment 값은 사용하지 않고 서버 설정을 사용했습니다.");
  }
  return { payload, warnings };
}

export async function ingestObservation(
  db: AppDatabase,
  ctx: IngestionContext,
  raw: unknown,
): Promise<IngestionResult> {
  const newId = ctx.newId ?? (() => crypto.randomUUID());
  const receivedAt = ctx.receivedAt ?? new Date();
  const env = ctx.dataEnvironment;

  const { payload, warnings, rejectReason } = sanitizePayload(raw, env);
  const sourceGuess = payload.dataSource;
  const dataSource = (DATA_SOURCES as readonly unknown[]).includes(sourceGuess)
    ? (sourceGuess as DataSource)
    : null;

  // 공급원을 알 수 없거나 영역과 맞지 않으면 원본조차 저장하지 않는다. (mock 행이 실제 DB에 들어가지 않도록)
  if (!dataSource) throw new IngestionError("dataSource 값이 없거나 올바르지 않습니다.");
  if (!isMockTripleConsistent(env, dataSource)) {
    throw new IngestionError(`${env} 영역에는 ${dataSource} 공급원 데이터를 저장할 수 없습니다.`);
  }

  return db.transaction(async (tx) => {
    const recordId = newId();
    const parsed = rejectReason ? null : characterObservationSchema.safeParse(payload);
    const failure = rejectReason ?? (parsed && !parsed.success ? formatIssues(parsed.error.issues) : undefined);

    await tx.insert(ingestionRecords).values({
      id: recordId,
      dataEnvironment: env,
      dataSource,
      sourceBuild: typeof payload.sourceBuild === "string" ? payload.sourceBuild : null,
      parserVersion: ctx.parserVersion,
      receivedAt,
      payload: (ctx.originalPayload ?? raw) as object,
      payloadHash: sha256(stableStringify(ctx.originalPayload ?? raw)),
      status: failure ? "REJECTED" : "ACCEPTED",
      warnings,
      rejectionReason: failure ?? null,
    });

    if (failure || !parsed?.success) {
      return { status: "REJECTED", ingestionRecordId: recordId, characterId: null, warnings, reason: failure };
    }

    const result = await applyObservation(tx, { env, newId, receivedAt, recordId, warnings }, parsed.data);
    if (result.status !== "ACCEPTED") {
      await tx
        .update(ingestionRecords)
        .set({ status: result.status, rejectionReason: result.reason ?? null, warnings })
        .where(eq(ingestionRecords.id, recordId));
    } else if (warnings.length > 0) {
      await tx.update(ingestionRecords).set({ warnings }).where(eq(ingestionRecords.id, recordId));
    }
    return { ...result, ingestionRecordId: recordId, warnings };
  });
}

function formatIssues(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  return issues
    .slice(0, 5)
    .map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

interface ApplyContext {
  env: DataEnvironment;
  newId: () => string;
  receivedAt: Date;
  recordId: string;
  warnings: string[];
}

type ApplyResult = Omit<IngestionResult, "ingestionRecordId" | "warnings">;

async function applyObservation(
  tx: AppDatabase,
  ctx: ApplyContext,
  obs: CharacterObservation,
): Promise<ApplyResult> {
  const { env, newId } = ctx;
  const verificationStatus = defaultVerificationStatus(obs.dataSource);
  const { region, gameMode, characterName, externalId } = obs.identity;
  const nameNormalized = normalizeName(characterName);
  const slug = toSlug(characterName);
  const observedAt = obs.observedAt;

  let levelReachedAt = obs.levelReachedAt ?? null;
  if (levelReachedAt && levelReachedAt > observedAt) {
    ctx.warnings.push("레벨 달성 시각이 관측 시각보다 늦어 사용하지 않았습니다.");
    levelReachedAt = null;
  }

  // --- 길드 ---------------------------------------------------------------
  let guildId: string | null | undefined = undefined;
  if (obs.guild === null) guildId = null;
  if (obs.guild) {
    guildId = await upsertGuild(tx, ctx, obs, verificationStatus);
  }

  // --- 캐릭터 식별 (명세서 §7.3) -------------------------------------------
  let character: typeof characters.$inferSelect | undefined;
  if (externalId) {
    const ref = await tx
      .select({ characterId: characterExternalRefs.characterId })
      .from(characterExternalRefs)
      .where(
        and(
          eq(characterExternalRefs.dataEnvironment, env),
          eq(characterExternalRefs.dataSource, obs.dataSource),
          eq(characterExternalRefs.externalId, externalId),
        ),
      )
      .limit(1);
    if (ref[0]) {
      [character] = await tx.select().from(characters).where(eq(characters.id, ref[0].characterId)).limit(1);
    }
  }
  let foundByNaturalKey = false;
  if (!character) {
    [character] = await tx
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.dataEnvironment, env),
          eq(characters.region, region),
          eq(characters.gameMode, gameMode),
          eq(characters.nameNormalized, nameNormalized),
        ),
      )
      .limit(1);
    foundByNaturalKey = Boolean(character);
  }

  if (character && foundByNaturalKey && externalId) {
    // 같은 이름이지만 같은 공급원의 다른 외부 ID를 가진 캐릭터 → 다른 캐릭터일 수 있다.
    const other = await tx
      .select({ externalId: characterExternalRefs.externalId })
      .from(characterExternalRefs)
      .where(
        and(
          eq(characterExternalRefs.characterId, character.id),
          eq(characterExternalRefs.dataSource, obs.dataSource),
        ),
      )
      .limit(1);
    if (other[0] && other[0].externalId !== externalId) {
      return conflict("같은 이름의 캐릭터가 다른 외부 ID로 이미 등록되어 있습니다.");
    }
  }

  const profile = resolveGearProfile(env, gameMode, obs.sourceBuild ?? null);
  const gear: EquippedItemLevelResult | null =
    obs.equipment && profile
      ? calculateEquippedItemLevel(
          obs.equipment.map((e) => ({
            slotCode: e.slotCode,
            itemLevel: e.itemLevel,
            itemSlotCode: e.itemSlotCode ?? null,
          })),
          profile,
        )
      : null;
  const gearFields = obs.equipment
    ? {
        averageItemLevel: gear?.averageItemLevel ?? null,
        highestItemLevel: gear?.highestItemLevel ?? null,
        gearCoverage: gear?.coverage ?? null,
        gearProfileId: profile?.id ?? null,
        gearProfileVersion: profile?.version ?? null,
        gearObservedAt: observedAt,
      }
    : {};

  const isNew = !character;
  const inOrder = !character || observedAt >= character.lastSeenAt;

  if (character && inOrder && obs.level < character.level) {
    return conflict(`레벨이 ${character.level}에서 ${obs.level}로 낮아진 관측입니다. 캐릭터 식별을 확인해야 합니다.`);
  }

  if (character && externalId && !foundByNaturalKey && character.nameNormalized !== nameNormalized && inOrder) {
    // 외부 ID로 찾았는데 이름이 바뀜 → 이름 변경
    const clash = await tx
      .select({ id: characters.id })
      .from(characters)
      .where(
        and(
          eq(characters.dataEnvironment, env),
          eq(characters.region, region),
          eq(characters.gameMode, gameMode),
          eq(characters.slug, slug),
        ),
      )
      .limit(1);
    if (clash[0] && clash[0].id !== character.id) {
      return conflict("이름 변경 후의 이름을 다른 캐릭터가 이미 사용하고 있습니다.");
    }
  }

  const previousLevel = character?.level ?? null;
  const previousSeenAt = character?.lastSeenAt ?? null;
  let characterId: string;

  if (!character) {
    characterId = newId();
    await tx.insert(characters).values({
      id: characterId,
      dataEnvironment: env,
      region,
      gameMode,
      characterName,
      nameNormalized,
      slug,
      factionCode: obs.factionCode ?? null,
      raceCode: obs.raceCode ?? null,
      classCode: obs.classCode ?? null,
      level: obs.level,
      guildId: guildId ?? null,
      firstSeenAt: observedAt,
      lastSeenAt: observedAt,
      dataSource: obs.dataSource,
      verificationStatus,
      sourceUpdatedAt: obs.sourceUpdatedAt ?? null,
      sourceBuild: obs.sourceBuild ?? null,
      createdAt: ctx.receivedAt,
      updatedAt: ctx.receivedAt,
      ...gearFields,
    });
  } else {
    characterId = character.id;
    if (inOrder) {
      await tx
        .update(characters)
        .set({
          characterName,
          nameNormalized,
          slug,
          factionCode: obs.factionCode ?? character.factionCode,
          raceCode: obs.raceCode ?? character.raceCode,
          classCode: obs.classCode ?? character.classCode,
          level: obs.level,
          ...(guildId !== undefined ? { guildId } : {}),
          lastSeenAt: observedAt,
          dataSource: obs.dataSource,
          verificationStatus,
          sourceUpdatedAt: obs.sourceUpdatedAt ?? null,
          sourceBuild: obs.sourceBuild ?? null,
          updatedAt: ctx.receivedAt,
          ...gearFields,
        })
        .where(eq(characters.id, characterId));
    } else if (observedAt < character.firstSeenAt) {
      // 늦게 도착한 오래된 관측: 현재 상태는 덮어쓰지 않고 최초 관측 시각만 보정한다.
      await tx.update(characters).set({ firstSeenAt: observedAt }).where(eq(characters.id, characterId));
    }
  }

  if (externalId) {
    await tx
      .insert(characterExternalRefs)
      .values({
        id: newId(),
        characterId,
        dataEnvironment: env,
        dataSource: obs.dataSource,
        externalId,
        firstSeenAt: observedAt,
        lastSeenAt: observedAt,
      })
      .onConflictDoUpdate({
        target: [characterExternalRefs.dataEnvironment, characterExternalRefs.dataSource, characterExternalRefs.externalId],
        set: { lastSeenAt: observedAt },
      });
  }

  // --- 현재 장착 장비 (명세서 §14.10) -----------------------------------------
  if (obs.equipment && inOrder) {
    await tx.delete(characterItems).where(eq(characterItems.characterId, characterId));
    for (const equipped of obs.equipment) {
      const itemId = await upsertItem(tx, ctx, obs, equipped);
      await tx.insert(characterItems).values({
        id: newId(),
        characterId,
        dataEnvironment: env,
        slotCode: equipped.slotCode,
        itemId,
        itemLevel: equipped.itemLevel,
        enchant: equipped.enchant ?? null,
        gems: equipped.gems ?? null,
        observedAt,
        dataSource: obs.dataSource,
        sourceBuild: obs.sourceBuild ?? null,
      });
    }
  }

  // --- 스냅샷 (명세서 §13) ---------------------------------------------------
  const snapshotId = await saveSnapshot(tx, ctx, {
    characterId,
    obs,
    verificationStatus,
    guildId: guildId === undefined ? (character?.guildId ?? null) : guildId,
    gear,
    profileId: obs.equipment ? (profile?.id ?? null) : (character?.gearProfileId ?? null),
    profileVersion: obs.equipment ? (profile?.version ?? null) : (character?.gearProfileVersion ?? null),
    isNew,
    inOrder,
  });

  // --- 레벨 달성 기록 (명세서 §8.3) -------------------------------------------
  const candidates: MilestoneCandidate[] = [];
  const observedBasis: MilestoneTimingBasis = levelReachedAt ? "SOURCE_REPORTED" : "FIRST_OBSERVED";
  if (inOrder && previousLevel !== null && obs.level > previousLevel) {
    for (let level = previousLevel + 1; level < obs.level; level += 1) {
      candidates.push({
        level,
        timingBasis: "INFERRED",
        reachedAt: null,
        firstObservedAt: observedAt,
        previousObservedAt: previousSeenAt,
      });
    }
  }
  candidates.push({
    level: obs.level,
    timingBasis: observedBasis,
    reachedAt: levelReachedAt,
    firstObservedAt: observedAt,
    previousObservedAt: inOrder && previousLevel !== null && obs.level > previousLevel ? previousSeenAt : null,
  });
  for (const candidate of candidates) {
    await upsertMilestone(tx, ctx, { characterId, candidate, obs, verificationStatus, snapshotId });
  }

  // characters의 현재 레벨 도달 시각은 milestone에서 파생한 캐시 값이다.
  const [current] = await tx
    .select({ level: characters.level })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  if (current) {
    const [milestone] = await tx
      .select({
        effectiveReachedAt: levelMilestones.effectiveReachedAt,
        timingBasis: levelMilestones.timingBasis,
      })
      .from(levelMilestones)
      .where(and(eq(levelMilestones.characterId, characterId), eq(levelMilestones.level, current.level)))
      .limit(1);
    await tx
      .update(characters)
      .set({
        currentLevelReachedAt: milestone?.effectiveReachedAt ?? null,
        currentLevelTimingBasis: milestone?.timingBasis ?? null,
      })
      .where(eq(characters.id, characterId));
  }

  return { status: "ACCEPTED", characterId };

  function conflict(reason: string): ApplyResult {
    return { status: "IDENTITY_CONFLICT", characterId: character?.id ?? null, reason };
  }
}

async function upsertGuild(
  tx: AppDatabase,
  ctx: ApplyContext,
  obs: CharacterObservation,
  verificationStatus: VerificationStatus,
): Promise<string> {
  const guild = obs.guild!;
  const { env, newId } = ctx;
  const { region, gameMode } = obs.identity;
  const nameNormalized = normalizeName(guild.name);
  let guildId: string | undefined;

  if (guild.externalId) {
    const ref = await tx
      .select({ guildId: guildExternalRefs.guildId })
      .from(guildExternalRefs)
      .where(
        and(
          eq(guildExternalRefs.dataEnvironment, env),
          eq(guildExternalRefs.dataSource, obs.dataSource),
          eq(guildExternalRefs.externalId, guild.externalId),
        ),
      )
      .limit(1);
    guildId = ref[0]?.guildId;
  }
  if (!guildId) {
    const found = await tx
      .select({ id: guilds.id })
      .from(guilds)
      .where(
        and(
          eq(guilds.dataEnvironment, env),
          eq(guilds.region, region),
          eq(guilds.gameMode, gameMode),
          eq(guilds.nameNormalized, nameNormalized),
        ),
      )
      .limit(1);
    guildId = found[0]?.id;
  }

  if (!guildId) {
    guildId = newId();
    await tx.insert(guilds).values({
      id: guildId,
      dataEnvironment: env,
      region,
      gameMode,
      name: guild.name,
      nameNormalized,
      slug: toSlug(guild.name),
      factionCode: guild.factionCode ?? obs.factionCode ?? null,
      firstSeenAt: obs.observedAt,
      lastSeenAt: obs.observedAt,
      dataSource: obs.dataSource,
      verificationStatus,
      sourceUpdatedAt: obs.sourceUpdatedAt ?? null,
      sourceBuild: obs.sourceBuild ?? null,
      createdAt: ctx.receivedAt,
      updatedAt: ctx.receivedAt,
    });
  } else {
    const [existing] = await tx.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);
    if (existing && obs.observedAt > existing.lastSeenAt) {
      await tx
        .update(guilds)
        .set({
          lastSeenAt: obs.observedAt,
          dataSource: obs.dataSource,
          verificationStatus,
          sourceUpdatedAt: obs.sourceUpdatedAt ?? existing.sourceUpdatedAt,
          sourceBuild: obs.sourceBuild ?? existing.sourceBuild,
          updatedAt: ctx.receivedAt,
        })
        .where(eq(guilds.id, guildId));
    }
  }

  if (guild.externalId) {
    await tx
      .insert(guildExternalRefs)
      .values({
        id: newId(),
        guildId,
        dataEnvironment: env,
        dataSource: obs.dataSource,
        externalId: guild.externalId,
        firstSeenAt: obs.observedAt,
        lastSeenAt: obs.observedAt,
      })
      .onConflictDoUpdate({
        target: [guildExternalRefs.dataEnvironment, guildExternalRefs.dataSource, guildExternalRefs.externalId],
        set: { lastSeenAt: obs.observedAt },
      });
  }
  return guildId;
}

async function upsertItem(
  tx: AppDatabase,
  ctx: ApplyContext,
  obs: CharacterObservation,
  equipped: NonNullable<CharacterObservation["equipment"]>[number],
): Promise<string> {
  const values = {
    name: equipped.name,
    nameLocale: equipped.nameLocale ?? null,
    slotCode: equipped.itemSlotCode ?? null,
    qualityCode: equipped.qualityCode ?? null,
    baseItemLevel: equipped.baseItemLevel ?? null,
    iconUrl: equipped.iconUrl ?? null,
    dataSource: obs.dataSource,
    sourceUpdatedAt: obs.sourceUpdatedAt ?? null,
    sourceBuild: obs.sourceBuild ?? null,
    updatedAt: ctx.receivedAt,
  };
  const [row] = await tx
    .insert(items)
    .values({
      id: ctx.newId(),
      dataEnvironment: ctx.env,
      externalItemId: equipped.externalItemId,
      createdAt: ctx.receivedAt,
      ...values,
    })
    .onConflictDoUpdate({ target: [items.dataEnvironment, items.externalItemId], set: values })
    .returning({ id: items.id });
  return row!.id;
}

async function saveSnapshot(
  tx: AppDatabase,
  ctx: ApplyContext,
  input: {
    characterId: string;
    obs: CharacterObservation;
    verificationStatus: VerificationStatus;
    guildId: string | null;
    gear: EquippedItemLevelResult | null;
    profileId: string | null;
    profileVersion: number | null;
    isNew: boolean;
    inOrder: boolean;
  },
): Promise<string | null> {
  const { obs, characterId } = input;
  const [latest] = await tx
    .select({
      averageItemLevel: characterSnapshots.averageItemLevel,
      highestItemLevel: characterSnapshots.highestItemLevel,
      gearCoverage: characterSnapshots.gearCoverage,
      normalizedData: characterSnapshots.normalizedData,
      contentHash: characterSnapshots.contentHash,
      observedAt: characterSnapshots.observedAt,
    })
    .from(characterSnapshots)
    .where(eq(characterSnapshots.characterId, characterId))
    .orderBy(desc(characterSnapshots.observedAt))
    .limit(1);

  // 장비 정보가 없는 관측은 직전 스냅샷의 장비 상태를 이어받는다.
  const previousEquipment =
    latest && typeof latest.normalizedData === "object" && latest.normalizedData !== null
      ? ((latest.normalizedData as { equipment?: unknown }).equipment ?? null)
      : null;
  const equipment = obs.equipment
    ? [...obs.equipment]
        .map((e) => ({ slotCode: e.slotCode, externalItemId: e.externalItemId, itemLevel: e.itemLevel }))
        .sort((a, b) => a.slotCode.localeCompare(b.slotCode))
    : previousEquipment;

  const averageItemLevel = obs.equipment ? (input.gear?.averageItemLevel ?? null) : (latest?.averageItemLevel ?? null);
  const highestItemLevel = obs.equipment ? (input.gear?.highestItemLevel ?? null) : (latest?.highestItemLevel ?? null);
  const gearCoverage = obs.equipment ? (input.gear?.coverage ?? null) : (latest?.gearCoverage ?? null);

  const normalizedData = {
    level: obs.level,
    characterName: obs.identity.characterName,
    factionCode: obs.factionCode ?? null,
    raceCode: obs.raceCode ?? null,
    classCode: obs.classCode ?? null,
    guildId: input.guildId,
    equipment,
    averageItemLevel,
    highestItemLevel,
    gearCoverage,
  };
  const contentHash = sha256(stableStringify(normalizedData));
  const heartbeatMs = getRankingConfig().snapshotHeartbeatHours * 3_600_000;

  const shouldSave =
    !latest ||
    !input.inOrder ||
    latest.contentHash !== contentHash ||
    obs.observedAt.getTime() - latest.observedAt.getTime() >= heartbeatMs;
  if (!shouldSave) return null;

  const id = ctx.newId();
  await tx.insert(characterSnapshots).values({
    id,
    characterId,
    dataEnvironment: ctx.env,
    observedAt: obs.observedAt,
    level: obs.level,
    averageItemLevel,
    highestItemLevel,
    gearCoverage,
    gearProfileId: input.profileId,
    gearProfileVersion: input.profileVersion,
    guildId: input.guildId,
    normalizedData,
    contentHash,
    ingestionRecordId: ctx.recordId,
    dataSource: obs.dataSource,
    verificationStatus: input.verificationStatus,
    sourceUpdatedAt: obs.sourceUpdatedAt ?? null,
    sourceBuild: obs.sourceBuild ?? null,
    createdAt: ctx.receivedAt,
  });
  return id;
}

/**
 * milestone 갱신 규칙 (명세서 §8.3)
 * - 근거 우선순위: SOURCE_REPORTED > FIRST_OBSERVED > INFERRED
 * - 근거 수준이 같으면 더 이른 시각을 채택
 * - first_observed_at은 항상 더 이른 값을 유지
 */
async function upsertMilestone(
  tx: AppDatabase,
  ctx: ApplyContext,
  input: {
    characterId: string;
    candidate: MilestoneCandidate;
    obs: CharacterObservation;
    verificationStatus: VerificationStatus;
    snapshotId: string | null;
  },
): Promise<void> {
  const { candidate, obs, characterId } = input;
  const [existing] = await tx
    .select()
    .from(levelMilestones)
    .where(and(eq(levelMilestones.characterId, characterId), eq(levelMilestones.level, candidate.level)))
    .limit(1);

  const source = {
    dataSource: obs.dataSource,
    verificationStatus: input.verificationStatus,
    sourceBuild: obs.sourceBuild ?? null,
    snapshotId: input.snapshotId,
    ingestionRecordId: ctx.recordId,
  };

  if (!existing) {
    await tx.insert(levelMilestones).values({
      id: ctx.newId(),
      characterId,
      dataEnvironment: ctx.env,
      level: candidate.level,
      timingBasis: candidate.timingBasis,
      reachedAt: candidate.reachedAt,
      firstObservedAt: candidate.firstObservedAt,
      previousObservedAt: candidate.previousObservedAt,
      createdAt: ctx.receivedAt,
      updatedAt: ctx.receivedAt,
      ...source,
    });
    return;
  }

  const candidateWins =
    BASIS_PRIORITY[candidate.timingBasis] > BASIS_PRIORITY[existing.timingBasis] ||
    (candidate.timingBasis === existing.timingBasis && effectiveTime(candidate) < effectiveTime(existing));
  const earlierObservation = candidate.firstObservedAt < existing.firstObservedAt;
  if (!candidateWins && !earlierObservation) return;

  const timingBasis = candidateWins ? candidate.timingBasis : existing.timingBasis;
  const reachedAt = candidateWins ? candidate.reachedAt : existing.reachedAt;
  await tx
    .update(levelMilestones)
    .set({
      timingBasis,
      reachedAt: timingBasis === "SOURCE_REPORTED" ? reachedAt : null,
      firstObservedAt: earlierObservation ? candidate.firstObservedAt : existing.firstObservedAt,
      previousObservedAt: earlierObservation ? candidate.previousObservedAt : existing.previousObservedAt,
      updatedAt: ctx.receivedAt,
      ...(candidateWins ? source : {}),
    })
    .where(eq(levelMilestones.id, existing.id));
}
