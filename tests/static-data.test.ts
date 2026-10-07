/**
 * 정적 게임 데이터 (Phase 2C): Item Catalog 검증, 메타데이터 검증, 빌드/버전 분리, Mock 격리, 이용 조건
 *
 * 테스트 데이터셋은 모두 가상 값이다. 실제 WoW: Forever 아이템·이름이 아니다.
 * 이용 조건 URL은 예약된 테스트 도메인(.invalid)이다.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { GUARDED_TABLES, items, staticDataRecords, staticDatasets } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { buildMockItemCatalog, buildMockMetadataDatasets } from "@/lib/static-data/mock";
import {
  checkImportPolicy,
  DatabaseItemCatalogProvider,
  DatabaseStaticDataImporter,
  DatasetItemCatalogProvider,
  findCatalogItems,
  getLatestStaticDataset,
  ItemCatalogValidationError,
  itemCatalogEntryToItemFields,
  linkCatalogToItems,
  listStaticDatasets,
  resolveKoreanName,
  staticDatasetMetaSchema,
  validateStaticDataset,
  type StaticDatasetMeta,
} from "@/lib/static-data";
import { createTestDb } from "./helpers/db";

const OBSERVED = new Date("2026-10-06T00:00:00Z");

function meta(overrides: Partial<StaticDatasetMeta> = {}): StaticDatasetMeta {
  return {
    kind: "items",
    source: "test_catalog",
    sourceVersion: "v1",
    sourceBuild: "1.60.1.70235",
    interfaceVersion: "16001",
    datasetVersion: "2026-10-06.1",
    observedAt: OBSERVED,
    license: {
      status: "PERMITTED",
      termsUrl: "https://terms.test.invalid/catalog",
      checkedAt: "2026-10-06",
      attribution: "테스트 카탈로그",
    },
    ...overrides,
  };
}

function item(itemId: number, overrides: Record<string, unknown> = {}) {
  return {
    itemId,
    name: `테스트 아이템 ${itemId}`,
    nameLocale: "ko",
    itemLevel: 20,
    inventoryType: 1,
    quality: 2,
    icon: "12345",
    source: "test_catalog",
    sourceVersion: "v1",
    ...overrides,
  };
}

const codesOf = (issues: { code: string }[]) => issues.map((i) => i.code);

// ---------------------------------------------------------------------------

describe("Item Catalog 검증", () => {
  it("올바른 데이터셋은 통과하고 checksum을 만든다", () => {
    const result = validateStaticDataset({ meta: meta(), records: [item(2), item(1)] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records.map((r) => r.key)).toEqual(["1", "2"]);
    expect(result.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("itemId는 필수이고 양의 정수다", () => {
    for (const bad of [{ itemId: undefined }, { itemId: 0 }, { itemId: -3 }, { itemId: 1.5 }, { itemId: "7" }]) {
      const result = validateStaticDataset({ meta: meta(), records: [item(1, bad)] });
      expect(result.ok).toBe(false);
    }
  });

  it("itemLevel은 양의 정수다 (모르면 null)", () => {
    for (const itemLevel of [0, -1, 2.5, "20", Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateStaticDataset({ meta: meta(), records: [item(1, { itemLevel })] }).ok).toBe(false);
    }
    expect(validateStaticDataset({ meta: meta(), records: [item(1, { itemLevel: null })] }).ok).toBe(true);
  });

  it("같은 itemId가 같은 내용으로 중복되면 하나만 쓰고 경고한다", () => {
    const result = validateStaticDataset({ meta: meta(), records: [item(1), item(1)] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records).toHaveLength(1);
    expect(codesOf(result.issues)).toEqual(["DUPLICATE_IDENTICAL"]);
  });

  it("같은 itemId가 다른 내용으로 중복되면 데이터셋 전체를 거부한다", () => {
    const result = validateStaticDataset({ meta: meta(), records: [item(1), item(1, { itemLevel: 25 })] });
    expect(result.ok).toBe(false);
    expect(codesOf(result.issues)).toContain("DUPLICATE_CONFLICT");
  });

  it("레코드의 source / sourceVersion이 메타와 다르면 거부한다", () => {
    const result = validateStaticDataset({ meta: meta(), records: [item(1, { sourceVersion: "v2" })] });
    expect(codesOf(result.issues)).toContain("SOURCE_MISMATCH");
  });

  it("알 수 없는 필드와 빈 데이터셋을 거부한다", () => {
    expect(validateStaticDataset({ meta: meta(), records: [item(1, { rank: 1 })] }).ok).toBe(false);
    expect(codesOf(validateStaticDataset({ meta: meta(), records: [] }).issues)).toEqual(["EMPTY_DATASET"]);
  });

  it("ItemCatalogProvider: 데이터셋으로 조회하고, 잘못된 데이터셋은 만들 수 없다", async () => {
    const catalog = new DatasetItemCatalogProvider({ meta: meta(), records: [item(5), item(3)] });
    expect((await catalog.listItems()).map((i) => i.itemId)).toEqual([3, 5]);
    expect((await catalog.getItem(5))?.name).toBe("테스트 아이템 5");
    expect(await catalog.getItem(99)).toBeNull();
    expect(catalog.describe().sourceVersion).toBe("v1");
    expect(() => new DatasetItemCatalogProvider({ meta: meta(), records: [item(1, { itemLevel: 0 })] })).toThrow(ItemCatalogValidationError);
    expect(() => new DatasetItemCatalogProvider({ meta: meta({ kind: "classes" }), records: [{ code: "warrior", names: {} }] })).toThrow(
      ItemCatalogValidationError,
    );
  });

  it("items 테이블 컬럼으로 바꿀 때 확인되지 않은 슬롯·품질 매핑은 비워 둔다", () => {
    const fields = itemCatalogEntryToItemFields(item(42) as never, { sourceBuild: "1.60.1.70235" });
    expect(fields).toMatchObject({ externalItemId: "42", baseItemLevel: 20, slotCode: null, qualityCode: null, iconUrl: null });
  });
});

describe("메타데이터 검증", () => {
  const classMeta = meta({ kind: "classes", source: "test_meta" });

  it("영문 코드와 이름을 분리하고, 이름마다 확인 상태를 요구한다", () => {
    const ok = validateStaticDataset({
      meta: classMeta,
      records: [{ code: "warrior", clientId: 1, names: { ko: { value: "전사", status: "UNCONFIRMED" } } }],
    });
    expect(ok.ok).toBe(true);
    const noStatus = validateStaticDataset({ meta: classMeta, records: [{ code: "warrior", names: { ko: { value: "전사" } } }] });
    expect(noStatus.ok).toBe(false);
    const koreanCode = validateStaticDataset({ meta: classMeta, records: [{ code: "전사", names: {} }] });
    expect(koreanCode.ok).toBe(false);
  });

  it("확정 명칭은 CLIENT_CONFIRMED일 때만이다", () => {
    expect(resolveKoreanName("classes", "warrior", { ko: { value: "전사", status: "CLIENT_CONFIRMED" } })).toMatchObject({
      text: "전사",
      confirmed: true,
    });
    expect(resolveKoreanName("classes", "warrior", { ko: { value: "전사", status: "SOURCE_PROVIDED" } }).confirmed).toBe(false);
    // locales 이름은 mock 개발용 임시 명칭이므로 미확정
    expect(resolveKoreanName("classes", "warrior")).toMatchObject({ text: "전사", status: "UNCONFIRMED", confirmed: false });
    expect(resolveKoreanName("races", "unknown_race")).toMatchObject({ text: "unknown_race", confirmed: false });
  });

  it("종족의 진영, 보스의 인스턴스 참조를 확인한다", () => {
    const races = validateStaticDataset(
      { meta: meta({ kind: "races", source: "test_meta" }), records: [{ code: "orc", factionCode: "horde", names: {} }] },
      { references: { factions: ["alliance"] } },
    );
    expect(codesOf(races.issues)).toContain("UNKNOWN_REFERENCE");
    const bosses = validateStaticDataset(
      {
        meta: meta({ kind: "bosses", source: "test_meta" }),
        records: [{ code: "boss_a", instanceKind: "raid", instanceCode: "raid_x", order: 1, names: {} }],
      },
      { references: { raids: ["raid_x"], dungeons: [] } },
    );
    expect(bosses.ok).toBe(true);
  });

  it("던전 minLevel > maxLevel을 거부한다", () => {
    const result = validateStaticDataset({
      meta: meta({ kind: "dungeons", source: "test_meta" }),
      records: [{ code: "d1", minLevel: 30, maxLevel: 20, names: {} }],
    });
    expect(result.ok).toBe(false);
  });

  it("모든 정적 데이터는 sourceBuild / interfaceVersion / datasetVersion / observedAt을 가진다", () => {
    const parsed = staticDatasetMetaSchema.parse(meta());
    expect(parsed).toMatchObject({ sourceBuild: "1.60.1.70235", interfaceVersion: "16001", datasetVersion: "2026-10-06.1" });
    expect(parsed.observedAt).toBeInstanceOf(Date);
    expect(staticDatasetMetaSchema.safeParse({ ...meta(), datasetVersion: undefined }).success).toBe(false);
    expect(staticDatasetMetaSchema.safeParse({ ...meta(), interfaceVersion: "abc" }).success).toBe(false);
  });

  it("PERMITTED에는 이용 조건 URL과 확인 날짜가 필요하다", () => {
    const bad = meta({ license: { status: "PERMITTED", termsUrl: null, checkedAt: null, attribution: null } });
    expect(staticDatasetMetaSchema.safeParse(bad).success).toBe(false);
  });

  it("mock 데이터셋 생성기는 검증을 통과하고 이름을 미확정으로 둔다", () => {
    for (const dataset of [...buildMockMetadataDatasets(OBSERVED), buildMockItemCatalog(OBSERVED, { seed: 1, characterCount: 5, anchor: OBSERVED })]) {
      const result = validateStaticDataset(dataset);
      expect(result.ok, dataset.meta.kind).toBe(true);
      for (const r of dataset.records as { names?: { ko?: { status: string } } }[]) {
        if (r.names?.ko) expect(r.names.ko.status).toBe("UNCONFIRMED");
      }
    }
  });
});

describe("이용 조건 확인 (DB 없이)", () => {
  it("실제 영역에는 이용 조건을 확인하지 못한 데이터셋을 넣지 않는다", () => {
    for (const status of ["UNKNOWN", "PROHIBITED"] as const) {
      const m = meta({ license: { status, termsUrl: null, checkedAt: null, attribution: null } });
      expect(codesOf(checkImportPolicy(m, "beta"))).toContain("LICENSE_NOT_CONFIRMED");
    }
    expect(checkImportPolicy(meta(), "live")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("빌드 / 버전 분리 (실제 영역 DB)", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;
  let importer: DatabaseStaticDataImporter;

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["beta", "live"]));
    importer = new DatabaseStaticDataImporter(db, "beta");
  });
  afterAll(() => close());

  it("모든 게임 데이터 테이블(정적 데이터 포함)에 영역 쓰기 트리거가 있다", async () => {
    const result = await db.execute(sql`SELECT tgname FROM pg_trigger WHERE tgname LIKE '%_env_guard'`);
    const names = (result as unknown as { rows: { tgname: string }[] }).rows.map((r) => r.tgname);
    for (const table of GUARDED_TABLES) expect(names).toContain(`${table}_env_guard`);
  });

  it("가져오고, 같은 내용을 다시 가져오면 UNCHANGED다", async () => {
    const dataset = { meta: meta(), records: [item(1), item(2)] };
    const first = await importer.importDataset(dataset);
    expect(first).toMatchObject({ status: "IMPORTED", recordCount: 2 });
    const again = await importer.importDataset(dataset);
    expect(again).toMatchObject({ status: "UNCHANGED", datasetId: first.datasetId });
    expect(await db.$count(staticDatasets)).toBe(1);
  });

  it("같은 datasetVersion을 다른 내용으로 덮어쓰지 않는다", async () => {
    const result = await importer.importDataset({ meta: meta(), records: [item(1, { itemLevel: 99 })] });
    expect(result.status).toBe("REJECTED");
    expect(codesOf(result.issues)).toContain("DATASET_VERSION_CONFLICT");
    const [stored] = await findCatalogItems(db, "beta", result.datasetId!, [1]);
    expect(stored!.itemLevel).toBe(20);
  });

  it("새 빌드는 새 데이터셋으로 추가되고 이전 빌드 데이터는 그대로 남는다", async () => {
    const newer = await importer.importDataset({
      meta: meta({ datasetVersion: "2026-10-07.1", sourceBuild: "1.60.1.70300", observedAt: new Date("2026-10-07T00:00:00Z") }),
      records: [item(1, { itemLevel: 22 })],
    });
    expect(newer.status).toBe("IMPORTED");
    const all = await listStaticDatasets(db, "beta", "items");
    expect(all.map((d) => d.sourceBuild)).toEqual(["1.60.1.70300", "1.60.1.70235"]);

    const latest = await getLatestStaticDataset(db, "beta", "items");
    expect(latest!.sourceBuild).toBe("1.60.1.70300");
    const oldBuild = await getLatestStaticDataset(db, "beta", "items", { sourceBuild: "1.60.1.70235" });
    expect((await findCatalogItems(db, "beta", oldBuild!.id, [1]))[0]!.itemLevel).toBe(20);
    expect((await findCatalogItems(db, "beta", latest!.id, [1]))[0]!.itemLevel).toBe(22);
  });

  it("DB가 정적 데이터 수정과 실제 영역 삭제를 거부한다", async () => {
    await expect(db.update(staticDatasets).set({ recordCount: 0 })).rejects.toThrow();
    await expect(db.update(staticDataRecords).set({ recordKey: "x" })).rejects.toThrow();
    await expect(db.delete(staticDatasets)).rejects.toThrow();
  });

  it("beta와 live 데이터셋은 섞이지 않는다", async () => {
    expect(await getLatestStaticDataset(db, "live", "items")).toBeNull();
    const liveImporter = new DatabaseStaticDataImporter(db, "live");
    expect((await liveImporter.importDataset({ meta: meta(), records: [item(1)] })).status).toBe("IMPORTED");
    const beta = await getLatestStaticDataset(db, "beta", "items", { sourceBuild: "1.60.1.70235" });
    const live = await getLatestStaticDataset(db, "live", "items");
    expect(beta!.id).not.toBe(live!.id);
    // 다른 영역의 datasetId로 조회해도 결과가 없다
    expect(await findCatalogItems(db, "beta", live!.id, [1])).toEqual([]);
  });

  it("기존 items 테이블과 itemId로 연결한다 (같은 영역 안에서만)", async () => {
    await db.insert(items).values([
      { dataEnvironment: "beta", externalItemId: "1", name: "관측 아이템", dataSource: "addon" },
      { dataEnvironment: "beta", externalItemId: "777", name: "카탈로그에 없는 아이템", dataSource: "addon" },
    ]);
    const dataset = await getLatestStaticDataset(db, "beta", "items");
    const linked = await linkCatalogToItems(db, "beta", dataset!.id);
    expect(linked.map((l) => l.externalItemId)).toEqual(["1"]);
    expect(linked[0]!.catalog.itemLevel).toBe(22);
    expect(await linkCatalogToItems(db, "live", dataset!.id)).toEqual([]);
  });

  it("DatabaseItemCatalogProvider로 저장된 카탈로그를 읽는다", async () => {
    const dataset = await getLatestStaticDataset(db, "beta", "items");
    const provider = new DatabaseItemCatalogProvider(db, "beta", dataset!.id, meta());
    expect((await provider.getItem(1))!.itemLevel).toBe(22);
    expect(await provider.getItem(2)).toBeNull();
  });

  it("이용 조건이 확인되지 않은 데이터셋은 저장하지 않는다", async () => {
    const result = await importer.importDataset({
      meta: meta({ datasetVersion: "unknown-1", license: { status: "UNKNOWN", termsUrl: null, checkedAt: null, attribution: null } }),
      records: [item(1)],
    });
    expect(result.status).toBe("REJECTED");
    expect(codesOf(result.issues)).toContain("LICENSE_NOT_CONFIRMED");
  });

  it("DB CHECK도 이용 조건이 없는 실제 영역 데이터셋을 거부한다 (importer 우회 시)", async () => {
    await expect(
      db.insert(staticDatasets).values({
        dataEnvironment: "beta",
        kind: "items",
        source: "direct",
        sourceVersion: "v1",
        datasetVersion: "x",
        observedAt: OBSERVED,
        licenseStatus: "UNKNOWN",
        checksum: "x",
        recordCount: 0,
      }),
    ).rejects.toThrow();
  });
});

describe("Mock 정적 데이터 격리", () => {
  it("실제 영역 importer는 mock 데이터셋을 거부하고, DB 트리거·CHECK도 거부한다", async () => {
    const { db, close } = await createTestDb(["beta", "live"]);
    try {
      const result = await new DatabaseStaticDataImporter(db, "beta").importDataset(buildMockItemCatalog(OBSERVED, { seed: 1, characterCount: 3, anchor: OBSERVED }));
      expect(result.status).toBe("REJECTED");
      expect(codesOf(result.issues)).toContain("MOCK_ISOLATION");
      await expect(
        db.insert(staticDatasets).values({
          dataEnvironment: "mock",
          kind: "items",
          source: "mock",
          sourceVersion: "v",
          datasetVersion: "x",
          observedAt: OBSERVED,
          licenseStatus: "MOCK",
          checksum: "x",
          recordCount: 0,
        }),
      ).rejects.toThrow();
      expect(await db.$count(staticDatasets)).toBe(0);
    } finally {
      await close();
    }
  });

  it("mock 영역에는 mock 데이터셋만 들어가고, 실제 데이터셋은 거부한다", async () => {
    const { db, close } = await createTestDb(["mock"]);
    try {
      const importer = new DatabaseStaticDataImporter(db, "mock");
      for (const dataset of [...buildMockMetadataDatasets(OBSERVED), buildMockItemCatalog(OBSERVED, { seed: 1, characterCount: 3, anchor: OBSERVED })]) {
        expect((await importer.importDataset(dataset)).status).toBe("IMPORTED");
      }
      const real = await importer.importDataset({ meta: meta(), records: [item(1)] });
      expect(codesOf(real.issues)).toContain("MOCK_ISOLATION");
      const kinds = (await db.select({ kind: staticDatasets.kind }).from(staticDatasets)).map((r) => r.kind).sort();
      expect(kinds).toEqual(["classes", "factions", "game_modes", "items", "races"]);
      // mock 영역은 개발용 초기화를 위해 삭제할 수 있다
      await db.execute(sql`DELETE FROM static_datasets WHERE data_environment = 'mock'`);
      expect(await db.$count(staticDatasets)).toBe(0);
    } finally {
      await close();
    }
  });
});
