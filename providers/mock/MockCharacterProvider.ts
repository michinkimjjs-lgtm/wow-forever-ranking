/**
 * Mock Provider (명세서 §16)
 * mock 배포에서만 등록된다(providers/registry.ts).
 */
import { normalizeName } from "@/lib/domain/names";
import type { CharacterObservationInput, EquipmentItem } from "@/lib/ingestion/schema";
import { generateMockDataset, type MockDatasetOptions } from "@/lib/mock/generator";
import type { CharacterDataProvider, CharacterLookup, ProviderCharacter, ProviderGear } from "../types";
import { uniformCapabilities, type CapabilityRegistry } from "../capabilities";

const AVAILABLE_IN_MOCK = {
  status: "AVAILABLE",
  note: "개발용 가짜 데이터 생성기가 제공합니다.",
  reviewedAt: "2026-10-07",
  evidence: null,
} as const;

/** mock 생성기가 만드는 데이터만 AVAILABLE. 던전·공격대·업적은 만들지 않는다. */
const mockCapabilities = uniformCapabilities("UNAVAILABLE", "mock 생성기는 이 데이터를 만들지 않습니다.", "2026-10-07", {
  character_profile: AVAILABLE_IN_MOCK,
  character_level: AVAILABLE_IN_MOCK,
  character_equipment: AVAILABLE_IN_MOCK,
  item: AVAILABLE_IN_MOCK,
  guild: AVAILABLE_IN_MOCK,
});

export class MockCharacterProvider implements CharacterDataProvider {
  readonly dataSource = "mock" as const;
  private readonly observations: CharacterObservationInput[];

  constructor(options: MockDatasetOptions = {}) {
    this.observations = generateMockDataset(options).observations;
  }

  getCapabilities(): CapabilityRegistry {
    return mockCapabilities;
  }

  /** seed 작업용: 시간 순서로 정렬된 전체 관측 데이터 */
  listObservations(): CharacterObservationInput[] {
    return this.observations;
  }

  private latestFor(input: CharacterLookup): CharacterObservationInput | null {
    const name = normalizeName(input.characterName);
    const matches = this.observations.filter(
      (o) =>
        o.identity.region === input.region &&
        o.identity.gameMode === input.gameMode &&
        (input.externalId ? o.identity.externalId === input.externalId : normalizeName(o.identity.characterName) === name),
    );
    return matches[matches.length - 1] ?? null;
  }

  async getCharacter(input: CharacterLookup): Promise<ProviderCharacter | null> {
    const latest = this.latestFor(input);
    if (!latest) return null;
    const { equipment: _equipment, ...rest } = latest;
    void _equipment;
    return rest;
  }

  async getCharacterGear(input: CharacterLookup): Promise<ProviderGear | null> {
    const latest = this.latestFor(input);
    if (!latest?.equipment) return null;
    return {
      observedAt: new Date(latest.observedAt as Date),
      sourceBuild: latest.sourceBuild ?? null,
      equipment: latest.equipment as EquipmentItem[],
    };
  }
}
