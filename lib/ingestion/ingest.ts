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
  levelMilestoneClaimAssessments,
  levelMilestoneEvidence,
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
  type VerificationStatus,
} from "@/lib/domain/enums";
import { normalizeName, toSlug } from "@/lib/domain/names";
import { calculateEquippedItemLevel, type EquippedItemLevelResult } from "@/lib/gear/calculate";
import { sha256, stableStringify } from "@/lib/util/stable-json";
import {
  chooseAdoptedEvidence,
  contradictsSightings,
  evaluateClaims,
  inferGapEvidence,
  previousSightingBefore,
  sightingsFromEvidence,
  TRUST_RANK,
  type ClaimAssessment,
  type EvidenceFact,
  type SightingFact,
} from "./milestone-evidence";
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

  // 달성 시각 주장은 받은 그대로 근거로 남기고, 채택 여부는 근거 판정(milestone-evidence.ts)이 정한다.
  const claimedReachedAt = obs.levelReachedAt ?? null;

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
  if (character && !inOrder && obs.level > character.level) {
    // 늦게 도착한 옛 관측인데 이후 관측보다 레벨이 높다: 달성 순서와 모순되므로 기록하지 않고 검토로 넘긴다.
    return conflict(
      `늦게 도착한 관측의 레벨(${obs.level})이 이후 관측의 레벨(${character.level})보다 높습니다. 달성 순서와 맞지 않아 기록하지 않았습니다.`,
    );
  }
  // 이 캐릭터의 저장된 근거·스냅샷 (달성 순서 검사와 근거 판정에 쓴다)
  const history = character ? await loadLevelHistory(tx, character.id) : null;
  const priorSightings: SightingFact[] = history
    ? [
        ...sightingsFromEvidence(history.facts),
        ...history.snapshotSightings,
        { level: character!.level, observedAt: character!.lastSeenAt, verificationStatus: character!.verificationStatus },
      ]
    : [];
  if (character && contradictsSightings(obs.level, observedAt, priorSightings)) {
    return conflict(`레벨 ${obs.level} 관측이 다른 시각의 관측과 달성 순서가 맞지 않습니다. 기록하지 않고 검토가 필요합니다.`);
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

  // --- 레벨 달성 근거와 현재 채택 기록 (명세서 §8.3, §8.5) ---------------------------
  // 근거는 추가만 한다. 판정과 채택은 지금까지 알려진 사실 전체로 다시 계산한다(도착 순서와 무관).
  await recordLevelEvidence(tx, ctx, {
    characterId,
    obs,
    verificationStatus,
    snapshotId,
    claimedReachedAt,
    previousObservedAt: inOrder && previousLevel !== null && obs.level > previousLevel ? previousSeenAt : null,
    history: history ?? emptyHistory(),
    priorSightings,
    context: {
      characterName,
      region,
      gameMode,
      classCode: obs.classCode ?? null,
      raceCode: obs.raceCode ?? null,
      factionCode: obs.factionCode ?? null,
      // 관측에 길드 정보가 없으면 알 수 없으므로 null (현재 캐릭터 값을 빌려 쓰지 않는다)
      guildId: guildId ?? null,
    },
  });

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

const CLAIM_WARNINGS: Record<"REJECTED" | "CONFLICT" | "NEEDS_REVIEW", string> = {
  REJECTED: "레벨 달성 시각이 관측 시각보다 늦어 사용하지 않았습니다.",
  CONFLICT: "레벨 달성 시각이 이미 확인된 레벨 순서와 맞지 않아 채택하지 않았습니다. 근거는 검토용으로 보관했습니다.",
  NEEDS_REVIEW: "레벨 달성 시각을 뒷받침하는 이전 관측이 없어 바로 채택하지 않았습니다. 근거는 검토용으로 보관했습니다.",
};

/** 이관 판정의 이유 코드 (migration 0007) */
const MIGRATED_ASSESSMENT_REASON = "MIGRATED_FROM_LEVEL_MILESTONES";

type EvidenceRow = typeof levelMilestoneEvidence.$inferSelect;

/** 근거 행의 출처와 관측 당시 맥락 */
interface EvidenceSource {
  dataSource: DataSource;
  verificationStatus: VerificationStatus;
  sourceBuild: string | null;
  snapshotId: string | null;
  ingestionRecordId: string | null;
  receivedAt: Date;
  characterName: string | null;
  region: string;
  gameMode: string;
  classCode: string | null;
  raceCode: string | null;
  factionCode: string | null;
  guildId: string | null;
}

interface LevelHistory {
  rows: EvidenceRow[];
  facts: EvidenceFact[];
  /** 근거별 가장 최근 판정 */
  latest: Map<string, { id: string; status: string; reasons: string[] }>;
  snapshotSightings: SightingFact[];
  milestones: Map<number, typeof levelMilestones.$inferSelect>;
}

const emptyHistory = (): LevelHistory => ({ rows: [], facts: [], latest: new Map(), snapshotSightings: [], milestones: new Map() });

function toFact(r: EvidenceRow): EvidenceFact {
  return {
    id: r.id,
    level: r.level,
    observationBasis: r.observationBasis as EvidenceFact["observationBasis"],
    claimedReachedAt: r.claimedReachedAt,
    observedAt: r.observedAt,
    previousObservedAt: r.previousObservedAt,
    verificationStatus: r.verificationStatus,
    origin: r.origin,
    dataSource: r.dataSource,
    sourceBuild: r.sourceBuild,
  };
}

async function loadLevelHistory(tx: AppDatabase, characterId: string): Promise<LevelHistory> {
  const rows = await tx.select().from(levelMilestoneEvidence).where(eq(levelMilestoneEvidence.characterId, characterId));
  const a = levelMilestoneClaimAssessments;
  const latestRows = await tx
    .selectDistinctOn([a.evidenceId], { evidenceId: a.evidenceId, id: a.id, status: a.status, reasons: a.reasons })
    .from(a)
    .where(eq(a.characterId, characterId))
    .orderBy(a.evidenceId, desc(a.seq));
  const snapshots = await tx
    .select({ level: characterSnapshots.level, observedAt: characterSnapshots.observedAt, verificationStatus: characterSnapshots.verificationStatus })
    .from(characterSnapshots)
    .where(eq(characterSnapshots.characterId, characterId));
  const milestones = await tx.select().from(levelMilestones).where(eq(levelMilestones.characterId, characterId));
  return {
    rows,
    facts: rows.map(toFact),
    latest: new Map(latestRows.map((r) => [r.evidenceId, { id: r.id, status: r.status, reasons: r.reasons }])),
    snapshotSightings: snapshots,
    milestones: new Map(milestones.map((m) => [m.level, m])),
  };
}

/**
 * 관측 하나의 근거를 기록하고 판정·채택을 다시 계산한다 (명세서 §8.3, §8.5).
 * 1. 이 관측의 근거 행 + 늦게 알게 된 건너뛴 레벨의 추론 근거 행을 추가한다 (근거 행은 수정·삭제하지 않음)
 * 2. 이 캐릭터의 모든 달성 시각 주장을 현재 알려진 사실로 다시 판정한다.
 *    새 주장은 RECEIPT, 판정이 바뀐 기존 주장은 REASSESSMENT로 판정 기록에 추가한다.
 * 3. 근거가 있는 모든 레벨의 현재 채택 기록을 다시 고른다. 바뀐 내용이 없으면 쓰지 않는다.
 */
async function recordLevelEvidence(
  tx: AppDatabase,
  ctx: ApplyContext,
  input: {
    characterId: string;
    obs: CharacterObservation;
    verificationStatus: VerificationStatus;
    snapshotId: string | null;
    claimedReachedAt: Date | null;
    previousObservedAt: Date | null;
    history: LevelHistory;
    priorSightings: SightingFact[];
    context: {
      characterName: string;
      region: string;
      gameMode: string;
      classCode: string | null;
      raceCode: string | null;
      factionCode: string | null;
      guildId: string | null;
    };
  },
): Promise<void> {
  const { obs, history } = input;
  const provenance: EvidenceSource = {
    dataSource: obs.dataSource,
    verificationStatus: input.verificationStatus,
    sourceBuild: obs.sourceBuild ?? null,
    snapshotId: input.snapshotId,
    ingestionRecordId: ctx.recordId,
    receivedAt: ctx.receivedAt,
    ...input.context,
  };
  const current: EvidenceFact = {
    id: ctx.newId(),
    level: obs.level,
    observationBasis: "FIRST_OBSERVED",
    claimedReachedAt: input.claimedReachedAt,
    observedAt: obs.observedAt,
    previousObservedAt: input.previousObservedAt,
    verificationStatus: input.verificationStatus,
    origin: "INGESTED",
    dataSource: obs.dataSource,
    sourceBuild: obs.sourceBuild ?? null,
  };

  // 건너뛴 레벨: 새 관측의 시간상 앞·뒤 관측과 비교 (추론 근거의 출처는 더 높은 레벨 관측)
  const rowById = new Map(history.rows.map((r) => [r.id, r]));
  const gaps = inferGapEvidence(
    { level: current.level, observedAt: current.observedAt, evidenceId: current.id },
    [
      ...history.facts
        .filter((f) => f.origin === "INGESTED" && f.observationBasis === "FIRST_OBSERVED")
        .map((f) => ({ level: f.level, observedAt: f.observedAt, evidenceId: f.id as string | null })),
      ...input.priorSightings.map((s) => ({ level: s.level, observedAt: s.observedAt, evidenceId: null })),
    ],
    history.facts,
  );
  const inferred = gaps.map((g) => {
    const upper = g.upperEvidenceId === current.id ? null : rowById.get(g.upperEvidenceId)!;
    const fact: EvidenceFact = {
      id: ctx.newId(),
      level: g.level,
      observationBasis: "INFERRED",
      claimedReachedAt: null,
      observedAt: g.observedAt,
      previousObservedAt: g.previousObservedAt,
      verificationStatus: upper ? upper.verificationStatus : current.verificationStatus,
      origin: "INGESTED",
      dataSource: upper ? upper.dataSource : current.dataSource,
      sourceBuild: upper ? upper.sourceBuild : current.sourceBuild,
    };
    const source = upper
      ? {
          dataSource: upper.dataSource,
          verificationStatus: upper.verificationStatus,
          sourceBuild: upper.sourceBuild,
          snapshotId: upper.snapshotId,
          ingestionRecordId: upper.ingestionRecordId,
          receivedAt: upper.receivedAt ?? ctx.receivedAt,
          characterName: upper.characterName,
          region: upper.region,
          gameMode: upper.gameMode,
          classCode: upper.classCode,
          raceCode: upper.raceCode,
          factionCode: upper.factionCode,
          guildId: upper.guildId,
        }
      : provenance;
    return { fact, source };
  });

  const facts = [...history.facts, current, ...inferred.map((i) => i.fact)];
  const extraSightings = [...history.snapshotSightings, ...input.priorSightings.slice(-1)];
  const assessments = evaluateClaims(facts, extraSightings);

  // 1. 근거 행 추가 (받은 시점의 판정 포함)
  const receipt = current.claimedReachedAt ? assessments.get(current.id)! : null;
  if (receipt && receipt.status !== "ACCEPTED") ctx.warnings.push(CLAIM_WARNINGS[receipt.status as keyof typeof CLAIM_WARNINGS]);
  const insertRow = async (fact: EvidenceFact, source: EvidenceSource, claim: ClaimAssessment | null) => {
    await tx.insert(levelMilestoneEvidence).values({
      id: fact.id,
      characterId: input.characterId,
      dataEnvironment: ctx.env,
      level: fact.level,
      observationBasis: fact.observationBasis,
      claimedReachedAt: fact.claimedReachedAt,
      receiptClaimStatus: claim ? claim.status : "NONE",
      receiptClaimReasons: claim ? claim.reasons : [],
      legacyTimingBasis: null,
      observedAt: fact.observedAt,
      previousObservedAt: fact.previousObservedAt,
      origin: "INGESTED",
      createdAt: ctx.receivedAt,
      ...source,
    });
  };
  await insertRow(current, provenance, receipt);
  for (const { fact, source } of inferred) await insertRow(fact, source, null);

  // 2. 판정 기록 추가 (새 주장 / 판정이 바뀐 주장)
  const latest = new Map(history.latest);
  const levelOf = new Map(facts.map((f) => [f.id, f.level]));
  for (const [evidenceId, assessment] of assessments) {
    const previous = latest.get(evidenceId);
    const unchanged =
      previous && previous.status === assessment.status && JSON.stringify(previous.reasons) === JSON.stringify(assessment.reasons);
    // 이관 판정(이유: 이관 표시뿐)을 같은 ACCEPTED로 다시 확인한 것은 판정 변경이 아니다.
    const migratedConfirmed =
      previous?.status === "ACCEPTED" &&
      JSON.stringify(previous.reasons) === JSON.stringify([MIGRATED_ASSESSMENT_REASON]) &&
      assessment.status === "ACCEPTED" &&
      assessment.reasons.length === 0;
    if (unchanged || migratedConfirmed) continue;
    const id = ctx.newId();
    await tx.insert(levelMilestoneClaimAssessments).values({
      id,
      evidenceId,
      characterId: input.characterId,
      level: levelOf.get(evidenceId)!,
      dataEnvironment: ctx.env,
      status: assessment.status,
      reasons: assessment.reasons,
      kind: evidenceId === current.id ? "RECEIPT" : "REASSESSMENT",
      assessedAt: ctx.receivedAt,
      ingestionRecordId: ctx.recordId,
      createdAt: ctx.receivedAt,
    });
    latest.set(evidenceId, { id, status: assessment.status, reasons: assessment.reasons });
  }

  // 3. 현재 채택 기록 다시 고르기
  const sources = new Map<string, { snapshotId: string | null; ingestionRecordId: string | null }>([
    ...history.rows.map((r) => [r.id, { snapshotId: r.snapshotId, ingestionRecordId: r.ingestionRecordId }] as const),
    [current.id, { snapshotId: provenance.snapshotId, ingestionRecordId: provenance.ingestionRecordId }],
    ...inferred.map((i) => [i.fact.id, { snapshotId: i.source.snapshotId, ingestionRecordId: i.source.ingestionRecordId }] as const),
  ]);
  const allSightings = [...sightingsFromEvidence(facts), ...extraSightings];
  const levels = [...new Set(facts.map((f) => f.level))];
  for (const level of levels) {
    const adopted = chooseAdoptedEvidence(
      facts.filter((f) => f.level === level),
      assessments,
    );
    if (!adopted) continue;
    const chosen = adopted.evidence;
    const accepted = adopted.timingBasis === "SOURCE_REPORTED" ? latest.get(chosen.id)! : null;
    const values = {
      timingBasis: adopted.timingBasis,
      reachedAt: adopted.reachedAt,
      firstObservedAt: adopted.firstObservedAt,
      previousObservedAt: previousSightingBefore(level, adopted.firstObservedAt, TRUST_RANK[chosen.verificationStatus], allSightings),
      dataSource: chosen.dataSource,
      verificationStatus: chosen.verificationStatus,
      sourceBuild: chosen.sourceBuild,
      snapshotId: sources.get(chosen.id)!.snapshotId,
      ingestionRecordId: sources.get(chosen.id)!.ingestionRecordId,
      evidenceId: chosen.id,
      claimAssessmentId: accepted ? accepted.id : null,
      claimAssessmentStatus: accepted ? ("ACCEPTED" as const) : null,
    };
    const existing = history.milestones.get(level);
    if (!existing) {
      await tx.insert(levelMilestones).values({
        id: ctx.newId(),
        characterId: input.characterId,
        dataEnvironment: ctx.env,
        level,
        ...values,
        createdAt: ctx.receivedAt,
        updatedAt: ctx.receivedAt,
      });
      continue;
    }
    const same = (a: unknown, b: unknown) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b);
    const changed = (Object.keys(values) as (keyof typeof values)[]).some((k) => !same(values[k], existing[k]));
    if (!changed) continue;
    await tx
      .update(levelMilestones)
      .set({ ...values, updatedAt: ctx.receivedAt })
      .where(eq(levelMilestones.id, existing.id));
  }
}
