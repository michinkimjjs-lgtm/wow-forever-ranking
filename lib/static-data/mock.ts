/**
 * mock 정적 데이터셋 (개발용). mock 영역에만 넣을 수 있다.
 *
 * - 직업·종족·진영·게임 모드: config/codes.ts, config/game-scopes.ts의 mock 값으로 만든다.
 * - 아이템: mock 데이터 생성기의 장비에서 만든다. itemId는 개발용 번호이며 실제 게임 아이템 ID가 아니다.
 * - 던전·공격대·보스: mock 생성기가 만들지 않으므로 데이터셋도 만들지 않는다.
 * - 이름 상태는 모두 UNCONFIRMED다.
 */
import { getCodes, getGameScope } from "@/lib/config";
import { generateMockDataset, MOCK_SOURCE_BUILD, type MockDatasetOptions } from "@/lib/mock/generator";
import { game } from "@/locales/ko/game";
import type { ItemCatalogEntry, StaticDatasetMeta } from "./schema";

export const MOCK_STATIC_SOURCE = "mock";
export const MOCK_STATIC_SOURCE_VERSION = "mock-static-1";

function mockMeta(kind: StaticDatasetMeta["kind"], observedAt: Date): StaticDatasetMeta {
  return {
    kind,
    source: MOCK_STATIC_SOURCE,
    sourceVersion: MOCK_STATIC_SOURCE_VERSION,
    sourceBuild: MOCK_SOURCE_BUILD,
    interfaceVersion: null,
    datasetVersion: "mock-1",
    observedAt,
    license: { status: "MOCK", termsUrl: null, checkedAt: null, attribution: null, note: "개발용 가짜 데이터" },
  };
}

const unconfirmedKo = (dict: Record<string, string>, code: string) =>
  dict[code] ? { ko: { value: dict[code]!, status: "UNCONFIRMED" as const } } : {};

export interface MockStaticDataset {
  meta: StaticDatasetMeta;
  records: Record<string, unknown>[];
}

export function buildMockMetadataDatasets(observedAt: Date): MockStaticDataset[] {
  const codes = getCodes("mock");
  const scope = getGameScope("mock");
  if (!codes || !scope) return [];
  return [
    {
      meta: mockMeta("factions", observedAt),
      records: codes.factions.map((code) => ({ code, clientId: null, names: unconfirmedKo(game.factions, code) })),
    },
    {
      meta: mockMeta("classes", observedAt),
      records: codes.classes.map((code) => ({ code, clientId: null, names: unconfirmedKo(game.classes, code) })),
    },
    {
      meta: mockMeta("races", observedAt),
      records: codes.races.map((r) => ({ code: r.code, clientId: null, factionCode: r.faction, names: unconfirmedKo(game.races, r.code) })),
    },
    {
      meta: mockMeta("game_modes", observedAt),
      records: scope.gameModes.map((m) => ({ code: m.code, clientId: null, maxLevel: m.maxLevel, names: unconfirmedKo(game.gameModes, m.code) })),
    },
  ];
}

/** mock 생성기의 장비에서 아이템 카탈로그를 만든다. 같은 입력이면 항상 같은 결과다. */
export function buildMockItemCatalog(observedAt: Date, options: MockDatasetOptions = {}): MockStaticDataset {
  const seen = new Map<string, { name: string; baseItemLevel: number | null }>();
  for (const obs of generateMockDataset(options).observations) {
    for (const item of obs.equipment ?? []) {
      if (!seen.has(item.externalItemId)) {
        seen.set(item.externalItemId, { name: item.name, baseItemLevel: item.baseItemLevel ?? null });
      }
    }
  }
  const records: ItemCatalogEntry[] = [...seen.keys()].sort().map((externalId, index) => {
    const item = seen.get(externalId)!;
    return {
      itemId: index + 1,
      name: item.name,
      nameLocale: "ko",
      itemLevel: item.baseItemLevel && item.baseItemLevel > 0 ? item.baseItemLevel : null,
      inventoryType: null,
      quality: null,
      icon: null,
      source: MOCK_STATIC_SOURCE,
      sourceVersion: MOCK_STATIC_SOURCE_VERSION,
    };
  });
  return { meta: mockMeta("items", observedAt), records };
}
