/**
 * 설정 파일 스키마. 앱 시작 시 이 스키마로 검증하고, 잘못되면 시작하지 않는다(명세서 §25).
 */
import { z } from "zod";
import {
  DATA_ENVIRONMENTS,
  EMPTY_SLOT_POLICIES,
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
  })
  .refine(
    (p) => p.status === "APPROVED" || p.appliesTo.dataEnvironments.every((e) => e === "mock"),
    "PROVISIONAL 프로필은 mock 영역에만 적용할 수 있습니다.",
  )
  .refine((p) => new Set(p.slots.map((s) => s.code)).size === p.slots.length, "슬롯 코드가 중복되었습니다.");

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
