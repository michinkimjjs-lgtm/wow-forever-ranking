/**
 * Provider 인터페이스 (명세서 §16)
 *
 * UI는 Provider를 직접 호출하지 않는다. Provider의 결과는 수집 파이프라인(lib/ingestion)을 거쳐 DB에 저장된다.
 * Provider 결과에는 dataEnvironment가 없다. dataEnvironment는 서버 설정이 부여한다.
 */
import type { DataSource } from "@/lib/domain/enums";
import type { CharacterObservationInput, EquipmentItem } from "@/lib/ingestion/schema";

export interface CharacterLookup {
  region: string;
  gameMode: string;
  characterName: string;
  externalId?: string | null;
}

/** 장비를 제외한 캐릭터 관측 데이터 */
export type ProviderCharacter = Omit<CharacterObservationInput, "equipment">;

export interface ProviderGear {
  observedAt: Date;
  sourceBuild: string | null;
  equipment: EquipmentItem[];
}

export interface CharacterDataProvider {
  readonly dataSource: DataSource;
  getCharacter(input: CharacterLookup): Promise<ProviderCharacter | null>;
  getCharacterGear(input: CharacterLookup): Promise<ProviderGear | null>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderNotConfiguredError";
  }
}
