/**
 * 정규화 관측 데이터 스키마 (명세서 §15, §16)
 *
 * 모든 공급원(Provider, 애드온 파서, 사용자 제출)은 이 형태로 데이터를 넘긴다.
 * dataEnvironment는 이 형태에 들어 있지 않다. 서버 설정이 부여한다(명세서 §6.4-7).
 */
import { z } from "zod";
import { DATA_SOURCES } from "@/lib/domain/enums";

const code = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);
const nameText = z.string().trim().min(1).max(64);

export const equipmentItemSchema = z.object({
  slotCode: code,
  externalItemId: z.string().min(1).max(128),
  name: nameText.max(128),
  nameLocale: z.string().max(16).nullish(),
  itemSlotCode: code.nullish(),
  qualityCode: code.nullish(),
  itemLevel: z.number().int().min(0).max(10_000).nullable(),
  baseItemLevel: z.number().int().min(0).max(10_000).nullish(),
  iconUrl: z.string().url().max(512).nullish(),
  enchant: z.unknown().optional(),
  gems: z.unknown().optional(),
});

export const characterObservationSchema = z.object({
  dataSource: z.enum(DATA_SOURCES),
  observedAt: z.coerce.date(),
  sourceUpdatedAt: z.coerce.date().nullish(),
  sourceBuild: z.string().max(64).nullish(),
  identity: z.object({
    externalId: z.string().min(1).max(128).nullish(),
    region: code,
    gameMode: code,
    characterName: nameText.max(32),
  }),
  level: z.number().int().min(1).max(1000),
  /** 공급원이 제공한 실제 레벨 달성 시각. 없으면 null */
  levelReachedAt: z.coerce.date().nullish(),
  factionCode: code.nullish(),
  raceCode: code.nullish(),
  classCode: code.nullish(),
  /** undefined: 길드 정보 없음(변경하지 않음) / null: 길드 없음 */
  guild: z
    .object({
      externalId: z.string().min(1).max(128).nullish(),
      name: nameText,
      factionCode: code.nullish(),
    })
    .nullish(),
  /** undefined / null: 장비 정보 없음 / []: 장착한 장비가 없음 */
  equipment: z.array(equipmentItemSchema).max(64).nullish(),
});

export type CharacterObservation = z.infer<typeof characterObservationSchema>;
export type CharacterObservationInput = z.input<typeof characterObservationSchema>;
export type EquipmentItem = z.infer<typeof equipmentItemSchema>;

/** 클라이언트가 보낸 순위 값은 사용하지 않는다(명세서 §10.1). 발견하면 제거하고 경고로 남긴다. */
export const FORBIDDEN_RANK_FIELDS = ["rank", "position", "ranking", "rankPosition"] as const;
