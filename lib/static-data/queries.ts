/**
 * 정적 데이터 조회 (docs/STATIC-GAME-DATA.md §5)
 * 모든 조회는 dataEnvironment를 필수 인자로 받는다. 기본값은 없다.
 */
import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { items, staticDataRecords, staticDatasets } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import type { DataEnvironment, StaticDataKind } from "@/lib/domain/enums";
import { itemCatalogEntrySchema, type ItemCatalogEntry } from "./schema";

export type StaticDatasetRow = typeof staticDatasets.$inferSelect;

export interface DatasetFilter {
  source?: string;
  sourceBuild?: string;
}

export async function listStaticDatasets(
  db: AppDatabase,
  dataEnvironment: DataEnvironment,
  kind: StaticDataKind,
): Promise<StaticDatasetRow[]> {
  return db
    .select()
    .from(staticDatasets)
    .where(and(eq(staticDatasets.dataEnvironment, dataEnvironment), eq(staticDatasets.kind, kind)))
    .orderBy(desc(staticDatasets.observedAt), desc(staticDatasets.importedAt), asc(staticDatasets.id));
}

/** 가장 최근에 관측한 데이터셋. sourceBuild를 주면 그 빌드의 데이터셋만 본다. */
export async function getLatestStaticDataset(
  db: AppDatabase,
  dataEnvironment: DataEnvironment,
  kind: StaticDataKind,
  filter: DatasetFilter = {},
): Promise<StaticDatasetRow | null> {
  const conditions: SQL[] = [eq(staticDatasets.dataEnvironment, dataEnvironment), eq(staticDatasets.kind, kind)];
  if (filter.source) conditions.push(eq(staticDatasets.source, filter.source));
  if (filter.sourceBuild) conditions.push(eq(staticDatasets.sourceBuild, filter.sourceBuild));
  const [row] = await db
    .select()
    .from(staticDatasets)
    .where(and(...conditions))
    .orderBy(desc(staticDatasets.observedAt), desc(staticDatasets.importedAt), asc(staticDatasets.id))
    .limit(1);
  return row ?? null;
}

export async function getStaticDataRecords(
  db: AppDatabase,
  dataEnvironment: DataEnvironment,
  datasetId: string,
): Promise<{ key: string; data: unknown }[]> {
  const rows = await db
    .select({ key: staticDataRecords.recordKey, data: staticDataRecords.data })
    .from(staticDataRecords)
    .where(and(eq(staticDataRecords.dataEnvironment, dataEnvironment), eq(staticDataRecords.datasetId, datasetId)))
    .orderBy(asc(staticDataRecords.recordKey));
  return rows;
}

/** 데이터셋에서 아이템 ID 목록에 해당하는 카탈로그 레코드 */
export async function findCatalogItems(
  db: AppDatabase,
  dataEnvironment: DataEnvironment,
  datasetId: string,
  itemIds: readonly number[],
): Promise<ItemCatalogEntry[]> {
  if (itemIds.length === 0) return [];
  const rows = await db
    .select({ data: staticDataRecords.data })
    .from(staticDataRecords)
    .where(
      and(
        eq(staticDataRecords.dataEnvironment, dataEnvironment),
        eq(staticDataRecords.datasetId, datasetId),
        eq(staticDataRecords.kind, "items"),
        inArray(staticDataRecords.recordKey, itemIds.map(String)),
      ),
    )
    .orderBy(asc(staticDataRecords.recordKey));
  return rows.map((r) => itemCatalogEntrySchema.parse(r.data));
}

export interface LinkedCatalogItem {
  /** items.id */
  itemRowId: string;
  externalItemId: string;
  catalog: ItemCatalogEntry;
}

/**
 * 기존 items 테이블과 카탈로그 연결: items.external_item_id = 카탈로그 itemId (같은 영역 안에서만)
 * items 행은 바꾸지 않는다. 화면이나 계산에서 카탈로그 값을 함께 쓸 때 사용한다.
 */
export async function linkCatalogToItems(
  db: AppDatabase,
  dataEnvironment: DataEnvironment,
  datasetId: string,
): Promise<LinkedCatalogItem[]> {
  const rows = await db
    .select({ itemRowId: items.id, externalItemId: items.externalItemId, data: staticDataRecords.data })
    .from(items)
    .innerJoin(
      staticDataRecords,
      and(
        eq(staticDataRecords.dataEnvironment, items.dataEnvironment),
        eq(staticDataRecords.recordKey, items.externalItemId),
        eq(staticDataRecords.kind, "items"),
        eq(staticDataRecords.datasetId, datasetId),
      ),
    )
    .where(eq(items.dataEnvironment, dataEnvironment))
    .orderBy(asc(items.externalItemId));
  return rows.map((r) => ({
    itemRowId: r.itemRowId,
    externalItemId: r.externalItemId,
    catalog: itemCatalogEntrySchema.parse(r.data),
  }));
}
