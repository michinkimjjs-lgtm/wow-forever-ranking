/**
 * Mock Provider (명세서 §16)
 * mock 배포에서만 등록된다(providers/registry.ts).
 */
import { normalizeName } from "@/lib/domain/names";
import type { CharacterObservationInput, EquipmentItem } from "@/lib/ingestion/schema";
import { generateMockDataset, type MockDatasetOptions } from "@/lib/mock/generator";
import type { CharacterDataProvider, CharacterLookup, ProviderCharacter, ProviderGear } from "../types";

export class MockCharacterProvider implements CharacterDataProvider {
  readonly dataSource = "mock" as const;
  private readonly observations: CharacterObservationInput[];

  constructor(options: MockDatasetOptions = {}) {
    this.observations = generateMockDataset(options).observations;
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
