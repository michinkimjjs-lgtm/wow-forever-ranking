/**
 * Character Export v1 서버 입력 스키마 (docs/CHARACTER-EXPORT-V1.md)
 *
 * docs/schemas/character-export-v1.schema.json과 같은 구조를 서버에서 검증한다.
 * 서버는 JSON Schema보다 조금 더 엄격하다: 아이템 레벨 범위, 슬롯 이름 중복, 배열 크기 제한.
 */
import { z } from "zod";

const int = z.number().int();
const text = (max: number) => z.string().min(1).max(max);

export const EXPORT_LIMITS = {
  maxGear: 30,
  maxLevelEvents: 200,
  maxGems: 10,
  maxUnavailable: 500,
} as const;

const gearItemSchema = z.object({
  slotName: z.string().regex(/^[A-Za-z0-9]{1,32}$/, "슬롯 이름 형식이 올바르지 않습니다."),
  slotId: int.min(0).max(255),
  itemId: int.min(1).optional(),
  itemLink: text(1024).optional(),
  itemLevel: z.number().finite().min(1).max(100_000).optional(),
  itemLevelSource: z.enum(["C_Item.GetCurrentItemLevel", "C_Item.GetDetailedItemLevelInfo"]).optional(),
  quality: int.optional(),
  icon: int.optional(),
  inventoryType: int.optional(),
  socketCount: int.min(0).max(EXPORT_LIMITS.maxGems).optional(),
  gemIds: z.array(int.min(1)).max(EXPORT_LIMITS.maxGems).optional(),
  dataCached: z.boolean().optional(),
});

export const characterExportV1Schema = z.object({
  schema: z.literal("forever-rank/character-export"),
  schemaVersion: z.literal(1),
  collector: z.object({ name: z.literal("ForeverRankCollector"), version: text(32) }),
  observedAt: int.min(0).optional(),
  observedAtSource: z.enum(["GetServerTime", "time", "none"]),
  trigger: z.enum(["login", "manual", "level_up", "equipment_changed", "guild_changed", "item_data_loaded", "logout"]),
  client: z.object({
    buildVersion: text(32).optional(),
    buildNumber: text(32).optional(),
    buildDate: text(64).optional(),
    interfaceVersion: int.optional(),
    localizedVersion: text(64).optional(),
    locale: text(16).optional(),
    regionId: int.optional(),
    regionName: text(32).optional(),
  }),
  gameMode: z.object({
    activeGameMode: int.optional(),
    gameModeRecordId: int.optional(),
    isHardcore: z.boolean().optional(),
    isSelfFoundAllowed: z.boolean().optional(),
    isStandard: z.boolean().optional(),
    foreverExperiencePreset: int.optional(),
  }),
  character: z.object({
    guid: text(128).optional(),
    name: text(64).optional(),
    surname: text(64).optional(),
    level: int.min(1).max(1000).optional(),
    classFile: text(64).optional(),
    classId: int.optional(),
    className: text(64).optional(),
    raceFile: text(64).optional(),
    raceId: int.optional(),
    raceName: text(64).optional(),
    faction: text(64).optional(),
    factionName: text(64).optional(),
    isInGuild: z.boolean().optional(),
    guildName: text(64).optional(),
  }),
  gear: z
    .array(gearItemSchema)
    .max(EXPORT_LIMITS.maxGear)
    .refine((list) => new Set(list.map((g) => g.slotName)).size === list.length, "같은 슬롯 이름이 두 번 이상 있습니다."),
  clientAverageItemLevel: z
    .object({
      overall: z.number().finite().optional(),
      equipped: z.number().finite().optional(),
      pvp: z.number().finite().optional(),
    })
    .optional(),
  levelEvents: z
    .array(z.object({ level: int.min(1).max(1000), observedAt: int.min(0).optional(), event: z.literal("PLAYER_LEVEL_UP") }))
    .max(EXPORT_LIMITS.maxLevelEvents),
  unavailable: z.array(z.string().max(128)).max(EXPORT_LIMITS.maxUnavailable),
});

export type CharacterExportV1 = z.infer<typeof characterExportV1Schema>;
