/**
 * Character Export v1 → 정규화 관측 데이터 (docs/CHARACTER-EXPORT-V1.md §6)
 *
 * 원칙
 * - 매핑 설정에 없는 원본 값은 추정하지 않는다. MAPPING_MISSING으로 거부한다.
 * - dataEnvironment는 넣지 않는다. 서버 설정이 정한다.
 * - dataSource는 "addon". 검증 상태는 수집 파이프라인이 COMMUNITY_SUBMITTED로 정한다(명세서 §11).
 */
import type { ExportMapping, GearProfile } from "@/lib/config";
import type { CharacterObservationInput } from "@/lib/ingestion/schema";
import type { CharacterExportV1 } from "./export-schema";
import { buildFullName } from "@/lib/domain/names";
import type { SubmissionIssue } from "./issues";

export const EXPORT_PARSER_VERSION = "character-export-v1@1";

export interface NormalizeContext {
  mapping: ExportMapping;
  /** 슬롯 이름 → 슬롯 코드 매핑에 쓰는 프로필 (DRAFT 포함). 없으면 장비를 처리할 수 없다. */
  slotProfile: GearProfile | null;
  now: Date;
}

export type NormalizeResult =
  | { ok: true; observation: CharacterObservationInput; warnings: string[] }
  | { ok: false; issues: SubmissionIssue[] };

/** 아이템 링크의 표시 이름 "[...]" (WoW 하이퍼링크 형식. Runtime verification required) */
export function itemNameFromLink(link: string | undefined): string | null {
  if (!link) return null;
  const match = /\|h\[([^\]|]{1,128})\]\|h/.exec(link);
  return match?.[1] ?? null;
}

function mapValue(
  map: Record<string, string>,
  value: string | number | undefined,
  path: string,
  issues: SubmissionIssue[],
): string | undefined {
  if (value === undefined) return undefined;
  const mapped = map[String(value)];
  if (mapped === undefined) {
    issues.push({ code: "MAPPING_MISSING", path, detail: `no mapping for ${String(value)}` });
  }
  return mapped;
}

export function normalizeCharacterExport(input: CharacterExportV1, ctx: NormalizeContext): NormalizeResult {
  const issues: SubmissionIssue[] = [];
  const warnings: string[] = [];
  const { mapping } = ctx;

  // 관측 시각
  if (input.observedAt === undefined) {
    issues.push({ code: "OBSERVED_AT_REQUIRED", path: "observedAt" });
  } else {
    const observedMs = input.observedAt * 1000;
    if (observedMs > ctx.now.getTime() + mapping.maxFutureSkewSeconds * 1000) {
      issues.push({ code: "OBSERVED_AT_IN_FUTURE", path: "observedAt" });
    } else if (observedMs < ctx.now.getTime() - mapping.maxObservationAgeDays * 86_400_000) {
      issues.push({ code: "OBSERVED_AT_TOO_OLD", path: "observedAt" });
    }
  }

  // 빌드 (파서 선택 기준)
  const { buildVersion, buildNumber } = input.client;
  if (!buildVersion || !buildNumber) {
    issues.push({ code: "SOURCE_BUILD_REQUIRED", path: "client.buildNumber" });
  }

  // 지역 / 게임 모드: 식별에 필요하므로 매핑이 반드시 있어야 한다.
  let region: string | undefined;
  if (input.client.regionId === undefined) {
    issues.push({ code: "MAPPING_MISSING", path: "client.regionId", detail: "regionId missing" });
  } else {
    region = mapValue(mapping.regionById, input.client.regionId, "client.regionId", issues);
  }
  let gameMode: string | undefined;
  if (input.gameMode.activeGameMode === undefined) {
    issues.push({ code: "MAPPING_MISSING", path: "gameMode.activeGameMode", detail: "activeGameMode missing" });
  } else {
    gameMode = mapValue(mapping.gameModeByActiveGameMode, input.gameMode.activeGameMode, "gameMode.activeGameMode", issues);
  }

  // 캐릭터
  const c = input.character;
  if (!c.name) issues.push({ code: "CHARACTER_NAME_REQUIRED", path: "character.name" });
  if (c.level === undefined) issues.push({ code: "CHARACTER_LEVEL_REQUIRED", path: "character.level" });
  // 전체 이름(이름 + 성)으로 식별한다. 첫 이름만으로는 식별하지 않는다(docs/RULESETS.md §3).
  let characterName: string | undefined;
  if (c.name && !c.surname) {
    if (mapping.requireSurname !== false) issues.push({ code: "FULL_NAME_REQUIRED", path: "character.surname" });
    else characterName = c.name;
  } else if (c.name && c.surname) {
    if (mapping.nameSeparator === null) {
      issues.push({ code: "NAME_SEPARATOR_UNCONFIRMED", path: "character.surname" });
    } else {
      characterName = buildFullName(c.name, c.surname, mapping.nameSeparator) ?? undefined;
    }
  }
  const classCode = mapValue(mapping.classByFile, c.classFile, "character.classFile", issues);
  const raceCode = mapValue(mapping.raceByFile, c.raceFile, "character.raceFile", issues);
  const factionCode = mapValue(mapping.factionByTag, c.faction, "character.faction", issues);

  // 장비
  const slotByName = new Map<string, string>();
  for (const slot of ctx.slotProfile?.slots ?? []) {
    if (slot.clientSlotName) slotByName.set(slot.clientSlotName, slot.code);
  }
  if (input.gear.length > 0 && !ctx.slotProfile) {
    issues.push({ code: "SLOT_MAPPING_UNAVAILABLE", path: "gear" });
  }
  const equipment: NonNullable<CharacterObservationInput["equipment"]> = [];
  input.gear.forEach((item, index) => {
    const path = `gear[${index}]`;
    const slotCode = slotByName.get(item.slotName);
    if (ctx.slotProfile && slotCode === undefined) {
      issues.push({ code: "UNKNOWN_SLOT", path: `${path}.slotName`, detail: item.slotName });
      return;
    }
    const qualityCode = mapValue(mapping.qualityById, item.quality, `${path}.quality`, issues);
    const name = itemNameFromLink(item.itemLink);
    if (item.itemId === undefined || name === null) {
      warnings.push(`${path}: 아이템 ID 또는 이름을 알 수 없어 이 슬롯은 제외했습니다.`);
      return;
    }
    let itemLevel: number | null = null;
    if (item.itemLevel !== undefined) {
      if (Number.isInteger(item.itemLevel)) itemLevel = item.itemLevel;
      else warnings.push(`${path}: 아이템 레벨이 정수가 아니어서 계산에서 제외했습니다.`);
    }
    const twoHand = item.inventoryType !== undefined && mapping.twoHandInventoryTypes.includes(item.inventoryType);
    if (slotCode) {
      equipment.push({
        slotCode,
        externalItemId: String(item.itemId),
        name,
        itemSlotCode: twoHand ? "two_hand" : null,
        qualityCode: qualityCode ?? null,
        itemLevel,
        gems: item.gemIds && item.gemIds.length > 0 ? item.gemIds : undefined,
      });
    }
  });

  if (issues.length > 0 || !region || !gameMode || !characterName || c.level === undefined || input.observedAt === undefined) {
    return { ok: false, issues };
  }

  const observedAt = new Date(input.observedAt * 1000);
  const reached = input.levelEvents
    .filter((e) => e.level === c.level && e.observedAt !== undefined && e.observedAt <= input.observedAt!)
    .map((e) => e.observedAt!)
    .sort((a, b) => b - a)[0];

  let guild: CharacterObservationInput["guild"];
  if (c.isInGuild === false) guild = null;
  else if (c.guildName) guild = { name: c.guildName, factionCode: factionCode ?? null };

  return {
    ok: true,
    warnings,
    observation: {
      dataSource: "addon",
      observedAt,
      sourceUpdatedAt: observedAt,
      sourceBuild: `${buildVersion}.${buildNumber}`,
      identity: { externalId: c.guid ?? null, region, gameMode, characterName },
      level: c.level,
      levelReachedAt: reached !== undefined ? new Date(reached * 1000) : null,
      factionCode: factionCode ?? null,
      raceCode: raceCode ?? null,
      classCode: classCode ?? null,
      ...(guild !== undefined ? { guild } : {}),
      equipment,
    },
  };
}
