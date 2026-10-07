/**
 * 설정 파일 스키마. 앱 시작 시 이 스키마로 검증하고, 잘못되면 시작하지 않는다(명세서 §25).
 */
import { z } from "zod";
import {
  DATA_ENVIRONMENTS,
  EMPTY_SLOT_POLICIES,
  GEAR_CALCULATION_METHODS,
  GEAR_PROFILE_STATUSES,
  TWO_HAND_WEAPON_POLICIES,
  VERIFICATION_STATUSES,
} from "@/lib/domain/enums";

const code = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, "코드는 영어 소문자, 숫자, _, - 만 사용할 수 있습니다.");
const dataEnvironment = z.enum(DATA_ENVIRONMENTS);
const perEnvironment = <T extends z.ZodType>(schema: T) =>
  z.object({ mock: schema, beta: schema, live: schema });

export const gameScopeSchema = z
  .object({
    regions: z.array(z.object({ code })).min(1),
    gameModes: z.array(z.object({ code, maxLevel: z.number().int().positive().nullable() })).min(1),
    defaultRegion: code,
    defaultGameMode: code,
  })
  .refine((s) => s.regions.some((r) => r.code === s.defaultRegion), "defaultRegion이 regions에 없습니다.")
  .refine((s) => s.gameModes.some((m) => m.code === s.defaultGameMode), "defaultGameMode가 gameModes에 없습니다.");

export const gameScopesConfigSchema = perEnvironment(gameScopeSchema.nullable());

export const rankingConfigSchema = z
  .object({
    staleAfterDays: perEnvironment(z.number().int().positive()),
    allowedVerificationStatuses: perEnvironment(z.array(z.enum(VERIFICATION_STATUSES)).min(1)),
    defaultPageSize: z.number().int().positive(),
    maxPageSize: z.number().int().positive(),
    snapshotHeartbeatHours: z.number().positive(),
  })
  .refine((c) => c.defaultPageSize <= c.maxPageSize, "defaultPageSize는 maxPageSize 이하여야 합니다.")
  .refine(
    (c) =>
      c.allowedVerificationStatuses.mock.every((s) => s === "MOCK") &&
      !c.allowedVerificationStatuses.beta.includes("MOCK") &&
      !c.allowedVerificationStatuses.live.includes("MOCK"),
    "MOCK 검증 상태는 mock 영역에서만 허용됩니다.",
  );

export const codesSchema = z.object({
  factions: z.array(code).min(1),
  classes: z.array(code).min(1),
  races: z.array(z.object({ code, faction: code })).min(1),
  qualities: z.array(code).min(1),
});

export const codesConfigSchema = perEnvironment(codesSchema.nullable());

export const gearProfileSchema = z
  .object({
    id: code,
    version: z.number().int().positive(),
    status: z.enum(GEAR_PROFILE_STATUSES),
    appliesTo: z.object({
      dataEnvironments: z.array(dataEnvironment).min(1),
      gameModes: z.array(z.string().min(1)).min(1),
      sourceBuilds: z.array(z.string().min(1)).min(1),
    }),
    slots: z
      .array(
        z.object({
          code,
          /**
           * 클라이언트의 슬롯 이름 (예: "HeadSlot"). 수집 데이터의 슬롯 이름을 우리 슬롯 코드로 바꿀 때 쓴다.
           * 슬롯 번호는 클라이언트가 실행 중에 결정하므로 설정에 넣지 않는다.
           */
          clientSlotName: z.string().regex(/^[A-Za-z0-9]+$/).optional(),
          rankable: z.boolean(),
          group: z.enum(["armor", "jewelry", "weapon", "cosmetic", "other"]),
          displayOrder: z.number().int(),
        }),
      )
      .min(1),
    excludedSlots: z.array(code),
    twoHandWeapon: z.object({
      policy: z.enum(TWO_HAND_WEAPON_POLICIES),
      mainHandSlot: code,
      offHandSlot: code,
      twoHandItemSlotCodes: z.array(code),
    }),
    emptySlotPolicy: z.enum(EMPTY_SLOT_POLICIES),
    minimumCoverage: z
      .object({
        minRankableSlotRatio: z.number().min(0).max(1).optional(),
        minRankableSlotCount: z.number().int().min(0).optional(),
      })
      .refine(
        (c) => c.minRankableSlotRatio !== undefined || c.minRankableSlotCount !== undefined,
        "minimumCoverage는 minRankableSlotRatio 또는 minRankableSlotCount 중 하나 이상이 필요합니다.",
      ),
    highestItemRequiresCoverage: z.boolean(),
    /** 계산에 쓸 수 있는 아이템 레벨 범위. 범위 밖이거나 숫자가 아니면 계산에서 뺀다. */
    itemLevelBounds: z.object({
      min: z.number().int().min(1),
      max: z.number().int().positive().optional(),
    }),
    calculation: z.object({
      method: z.enum(GEAR_CALCULATION_METHODS),
      /** 계산 방식이 바뀌면 올린다. 프로필 version도 함께 올려 이전 계산 결과가 랭킹에 섞이지 않게 한다. */
      version: z.number().int().positive(),
    }),
  })
  .refine((p) => new Set(p.slots.map((s) => s.code)).size === p.slots.length, "슬롯 코드가 중복되었습니다.")
  .refine(
    (p) => {
      const names = p.slots.map((s) => s.clientSlotName).filter((n): n is string => n !== undefined);
      return new Set(names).size === names.length;
    },
    "clientSlotName이 중복되었습니다.",
  )
  .refine(
    (p) => [p.twoHandWeapon.mainHandSlot, p.twoHandWeapon.offHandSlot].every((c) => p.slots.some((s) => s.code === c)),
    "양손 무기 설정의 주 무기 / 보조 무기 슬롯이 slots에 없습니다.",
  )
  .refine(
    (p) => p.itemLevelBounds.max === undefined || p.itemLevelBounds.max >= p.itemLevelBounds.min,
    "itemLevelBounds.max는 min 이상이어야 합니다.",
  );

export const gearProfilesSchema = z
  .array(gearProfileSchema)
  .refine(
    (list) => new Set(list.map((p) => `${p.id}@${p.version}`)).size === list.length,
    "Gear Profile id/version이 중복되었습니다.",
  );

export type GameScope = z.infer<typeof gameScopeSchema>;
export type GameScopesConfigInput = z.input<typeof gameScopesConfigSchema>;
export type RankingConfig = z.infer<typeof rankingConfigSchema>;
export type RankingConfigInput = z.input<typeof rankingConfigSchema>;
export type Codes = z.infer<typeof codesSchema>;
export type CodesConfigInput = z.input<typeof codesConfigSchema>;
export type GearProfile = z.infer<typeof gearProfileSchema>;
export type GearProfileInput = z.input<typeof gearProfileSchema>;

/**
 * Character Export v1의 클라이언트 원본 값 → 우리 코드 매핑 (docs/CHARACTER-EXPORT-V1.md §6)
 * 실제 값은 게임 실행으로 확인해야 한다(Runtime verification required). 확인 전에는 비워 둔다.
 * 매핑이 없는 값이 들어오면 추정하지 않고 제출을 거부한다.
 */
const mappingKey = z.string().min(1).max(64);
export const exportMappingSchema = z.object({
  regionById: z.record(mappingKey, code),
  gameModeByActiveGameMode: z.record(mappingKey, code),
  classByFile: z.record(mappingKey, code),
  raceByFile: z.record(mappingKey, code),
  factionByTag: z.record(mappingKey, code),
  qualityById: z.record(mappingKey, code),
  /** 양손 무기로 볼 Enum.InventoryType 값. 비어 있으면 양손 무기를 판정하지 않는다. */
  twoHandInventoryTypes: z.array(z.number().int()),
  /** 이름과 성을 잇는 구분자. 확인 전에는 null이며, 성이 있는 제출은 처리하지 않는다. */
  nameSeparator: z.string().min(1).max(3).nullable(),
  /** 관측 시각 허용 범위 */
  maxObservationAgeDays: z.number().int().positive(),
  maxFutureSkewSeconds: z.number().int().min(0),
});
export const exportMappingConfigSchema = z.object({
  beta: exportMappingSchema,
  live: exportMappingSchema,
});
export type ExportMapping = z.infer<typeof exportMappingSchema>;
export type ExportMappingConfigInput = z.input<typeof exportMappingConfigSchema>;
