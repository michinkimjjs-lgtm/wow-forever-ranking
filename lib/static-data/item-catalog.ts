/**
 * Item Catalog (docs/STATIC-GAME-DATA.md §6)
 *
 * ItemCatalogProvider는 아이템 정보 공급원의 공통 인터페이스다.
 * 특정 외부 사이트를 핵심 공급원으로 고정하지 않는다. 이용 조건을 확인한 공급원만 실제 영역에 연결한다.
 */
import type { AppDatabase } from "@/db/types";
import type { DataEnvironment } from "@/lib/domain/enums";
import { getStaticDataRecords } from "./queries";
import { itemCatalogEntrySchema, type ItemCatalogEntry, type StaticDatasetMeta } from "./schema";
import { validateStaticDataset, type StaticDataIssue } from "./validate";

export interface ItemCatalogProvider {
  /** 데이터셋 메타데이터 (공급원, 버전, 빌드, 이용 조건) */
  describe(): StaticDatasetMeta;
  listItems(): Promise<ItemCatalogEntry[]>;
  getItem(itemId: number): Promise<ItemCatalogEntry | null>;
}

export class ItemCatalogValidationError extends Error {
  constructor(readonly issues: StaticDataIssue[]) {
    super(`아이템 카탈로그 검증에 실패했습니다: ${issues.filter((i) => i.severity === "error").map((i) => i.message).join(" / ")}`);
    this.name = "ItemCatalogValidationError";
  }
}

/** 검증한 데이터셋(메모리)을 쓰는 카탈로그. 파일에서 읽은 데이터셋을 가져오기 전에 확인할 때 쓴다. */
export class DatasetItemCatalogProvider implements ItemCatalogProvider {
  private readonly meta: StaticDatasetMeta;
  private readonly byId: Map<number, ItemCatalogEntry>;
  readonly warnings: StaticDataIssue[];

  constructor(dataset: unknown) {
    const result = validateStaticDataset(dataset);
    if (!result.ok) throw new ItemCatalogValidationError(result.issues);
    if (result.meta.kind !== "items") {
      throw new ItemCatalogValidationError([
        { severity: "error", code: "INVALID_META", message: `items 데이터셋이 아닙니다(${result.meta.kind}).` },
      ]);
    }
    this.meta = result.meta;
    this.warnings = result.issues;
    this.byId = new Map(result.records.map((r) => [Number(r.key), r.data as ItemCatalogEntry]));
  }

  describe(): StaticDatasetMeta {
    return this.meta;
  }

  async listItems(): Promise<ItemCatalogEntry[]> {
    return [...this.byId.values()].sort((a, b) => a.itemId - b.itemId);
  }

  async getItem(itemId: number): Promise<ItemCatalogEntry | null> {
    return this.byId.get(itemId) ?? null;
  }
}

/** DB에 저장된 데이터셋 하나를 읽는 카탈로그. dataEnvironment는 필수다. */
export class DatabaseItemCatalogProvider implements ItemCatalogProvider {
  private cache: Map<number, ItemCatalogEntry> | null = null;

  constructor(
    private readonly db: AppDatabase,
    private readonly dataEnvironment: DataEnvironment,
    private readonly datasetId: string,
    private readonly meta: StaticDatasetMeta,
  ) {}

  describe(): StaticDatasetMeta {
    return this.meta;
  }

  private async load(): Promise<Map<number, ItemCatalogEntry>> {
    if (!this.cache) {
      const rows = await getStaticDataRecords(this.db, this.dataEnvironment, this.datasetId);
      this.cache = new Map(rows.map((r) => {
        const entry = itemCatalogEntrySchema.parse(r.data);
        return [entry.itemId, entry];
      }));
    }
    return this.cache;
  }

  async listItems(): Promise<ItemCatalogEntry[]> {
    return [...(await this.load()).values()].sort((a, b) => a.itemId - b.itemId);
  }

  async getItem(itemId: number): Promise<ItemCatalogEntry | null> {
    return (await this.load()).get(itemId) ?? null;
  }
}

/**
 * 카탈로그 항목 → items 테이블 컬럼 값.
 * - slot_code / quality_code: 클라이언트 Enum 값 → 우리 코드 매핑이 확인되지 않아(Runtime verification required) null.
 *   원본 숫자는 카탈로그 레코드에 남아 있다.
 * - icon_url: https URL일 때만 쓴다. fileID를 이미지 URL로 바꾸는 방법은 아직 정하지 않았다.
 */
export function itemCatalogEntryToItemFields(entry: ItemCatalogEntry, meta: Pick<StaticDatasetMeta, "sourceBuild">) {
  return {
    externalItemId: String(entry.itemId),
    name: entry.name,
    nameLocale: entry.nameLocale ?? null,
    baseItemLevel: entry.itemLevel,
    slotCode: null,
    qualityCode: null,
    iconUrl: entry.icon && entry.icon.startsWith("https://") ? entry.icon : null,
    sourceBuild: meta.sourceBuild,
  };
}
