/**
 * 정적 게임 데이터 스키마 (docs/STATIC-GAME-DATA.md)
 *
 * 데이터셋 = 메타데이터(공급원, 버전, 빌드, 이용 조건) + 레코드 목록.
 * dataEnvironment는 데이터셋 파일에 넣지 않는다. 가져오는 서버의 설정이 부여한다.
 */
import { z } from "zod";
import { STATIC_DATA_KINDS, STATIC_DATA_LICENSE_STATUSES, type StaticDataKind } from "@/lib/domain/enums";

const code = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/).max(64);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const versionText = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._+-]*$/).max(64);
const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().min(0);

/**
 * 이름의 확인 상태
 * - CLIENT_CONFIRMED: WoW: Forever 클라이언트에서 실제로 확인한 명칭 (게임 실행 또는 공식 자료 필요)
 * - SOURCE_PROVIDED: 데이터셋 공급원이 준 명칭. Forever 공식 명칭인지 확인되지 않음
 * - UNCONFIRMED: 임시 명칭
 * 화면에 "확정 명칭"으로 쓸 수 있는 것은 CLIENT_CONFIRMED뿐이다.
 */
export const NAME_STATUSES = ["CLIENT_CONFIRMED", "SOURCE_PROVIDED", "UNCONFIRMED"] as const;
export type NameStatus = (typeof NAME_STATUSES)[number];

const localizedName = z.object({
  value: z.string().trim().min(1).max(128),
  status: z.enum(NAME_STATUSES),
});

/** 언어별 이름. 영문 내부 코드와 분리한다. */
export const localizedNamesSchema = z
  .object({ ko: localizedName.optional(), en: localizedName.optional() })
  .strict();
export type LocalizedNames = z.infer<typeof localizedNamesSchema>;

export const staticDatasetLicenseSchema = z
  .object({
    status: z.enum(STATIC_DATA_LICENSE_STATUSES),
    termsUrl: z.string().url().startsWith("https://").max(512).nullable(),
    checkedAt: isoDate.nullable(),
    attribution: z.string().max(512).nullable(),
    note: z.string().max(1000).nullable().optional(),
  })
  .strict()
  .refine((l) => l.status !== "PERMITTED" || (l.termsUrl !== null && l.checkedAt !== null), {
    message: "PERMITTED에는 이용 조건 URL(termsUrl)과 확인 날짜(checkedAt)가 필요합니다.",
    path: ["termsUrl"],
  });

export const staticDatasetMetaSchema = z
  .object({
    kind: z.enum(STATIC_DATA_KINDS),
    /** 데이터셋 공급원 코드. mock 데이터셋은 반드시 "mock" */
    source: code,
    /** 공급원 쪽 버전 (공급원이 매기는 값) */
    sourceVersion: versionText,
    /** 데이터를 얻은 게임 클라이언트 빌드 (예: 1.60.1.70235). 모르면 null */
    sourceBuild: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).max(64).nullable(),
    /** 클라이언트 interface 버전 (예: 16001). 모르면 null */
    interfaceVersion: z.string().regex(/^\d{1,8}$/).nullable(),
    /** 우리가 매기는 데이터셋 버전. 같은 (영역, 종류, 공급원) 안에서 고유 */
    datasetVersion: versionText,
    /** 데이터를 관측·추출한 시각 */
    observedAt: z.coerce.date(),
    license: staticDatasetLicenseSchema,
  })
  .strict()
  .refine((m) => (m.source === "mock") === (m.license.status === "MOCK"), {
    message: "mock 공급원과 MOCK 이용 조건은 함께 써야 합니다.",
    path: ["license", "status"],
  });
export type StaticDatasetMeta = z.infer<typeof staticDatasetMetaSchema>;

// ---------------------------------------------------------------------------
// 레코드 스키마
// ---------------------------------------------------------------------------

/** Item Catalog 레코드 (ItemCatalogEntry) */
export const itemCatalogEntrySchema = z
  .object({
    itemId: positiveInt,
    name: z.string().trim().min(1).max(128),
    nameLocale: z.string().regex(/^[a-z]{2}(?:[-_][A-Za-z]{2})?$/).nullable().optional(),
    /** 아이템 기본 레벨. 양의 정수. 공급원이 주지 않으면 null */
    itemLevel: positiveInt.nullable(),
    /** 클라이언트 Enum.InventoryType 값. 값 목록은 Runtime verification required */
    inventoryType: nonNegativeInt.nullable(),
    /** 클라이언트 Enum.ItemQuality 값. 값 목록은 Runtime verification required */
    quality: nonNegativeInt.nullable(),
    /** 아이콘 fileID 또는 이미지 URL. 변환 방법이 정해지기 전에는 원본 그대로 보관 */
    icon: z.string().min(1).max(512).nullable(),
    source: code,
    sourceVersion: versionText,
  })
  .strict();
export type ItemCatalogEntry = z.infer<typeof itemCatalogEntrySchema>;

const clientId = nonNegativeInt.nullable().optional();

export const classRecordSchema = z.object({ code, clientId, names: localizedNamesSchema }).strict();
export const factionRecordSchema = z.object({ code, clientId, names: localizedNamesSchema }).strict();
export const raceRecordSchema = z
  .object({ code, clientId, factionCode: code.nullable(), names: localizedNamesSchema })
  .strict();
export const gameModeRecordSchema = z
  .object({ code, clientId, maxLevel: positiveInt.nullable(), names: localizedNamesSchema })
  .strict();
const instanceRecordSchema = z
  .object({
    code,
    clientInstanceId: nonNegativeInt.nullable().optional(),
    minLevel: positiveInt.nullable(),
    maxLevel: positiveInt.nullable(),
    names: localizedNamesSchema,
  })
  .strict()
  .refine((r) => r.minLevel === null || r.maxLevel === null || r.minLevel <= r.maxLevel, {
    message: "minLevel은 maxLevel보다 클 수 없습니다.",
    path: ["minLevel"],
  });
export const dungeonRecordSchema = instanceRecordSchema;
export const raidRecordSchema = instanceRecordSchema;
export const bossRecordSchema = z
  .object({
    code,
    instanceKind: z.enum(["dungeon", "raid"]),
    instanceCode: code,
    clientEncounterId: nonNegativeInt.nullable().optional(),
    order: positiveInt.nullable(),
    names: localizedNamesSchema,
  })
  .strict();

export const STATIC_RECORD_SCHEMAS = {
  items: itemCatalogEntrySchema,
  classes: classRecordSchema,
  races: raceRecordSchema,
  factions: factionRecordSchema,
  game_modes: gameModeRecordSchema,
  dungeons: dungeonRecordSchema,
  raids: raidRecordSchema,
  bosses: bossRecordSchema,
} satisfies Record<StaticDataKind, z.ZodType>;

export type StaticRecordOf<K extends StaticDataKind> = z.infer<(typeof STATIC_RECORD_SCHEMAS)[K]>;

/** 레코드의 데이터셋 안 고유 키 */
export function recordKeyOf(kind: StaticDataKind, record: Record<string, unknown>): string {
  return kind === "items" ? String(record.itemId) : String(record.code);
}

/** 한 데이터셋의 최대 레코드 수 */
export const MAX_STATIC_RECORDS = 200_000;
