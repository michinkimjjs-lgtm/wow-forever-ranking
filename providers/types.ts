/**
 * Provider 인터페이스 (명세서 §16)
 *
 * UI는 Provider를 직접 호출하지 않는다. Provider의 결과는 수집 파이프라인(lib/ingestion)을 거쳐 DB에 저장된다.
 * Provider 결과에는 dataEnvironment가 없다. dataEnvironment는 서버 설정이 부여한다.
 */
import { z } from "zod";
import type { DataSource } from "@/lib/domain/enums";
import {
  characterObservationSchema,
  equipmentItemSchema,
  type CharacterObservationInput,
  type EquipmentItem,
} from "@/lib/ingestion/schema";
import type { CapabilityRegistry } from "./capabilities";

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
  /** 이 공급원이 제공하는 기능 (providers/capabilities.ts) */
  getCapabilities(): CapabilityRegistry;
  getCharacter(input: CharacterLookup): Promise<ProviderCharacter | null>;
  getCharacterGear(input: CharacterLookup): Promise<ProviderGear | null>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderNotConfiguredError";
  }
}

/**
 * 모든 Provider가 지켜야 하는 내부 데이터 계약.
 * 결과는 수집 파이프라인의 정규화 관측 스키마와 같은 규칙으로 검증한다.
 */
export const providerCharacterSchema = characterObservationSchema.omit({ equipment: true });

export const providerGearSchema = z.object({
  observedAt: z.date(),
  sourceBuild: z.string().max(64).nullable(),
  equipment: z.array(equipmentItemSchema).max(64),
});

/** Provider 결과가 내부 계약을 지키지 않을 때 */
export class ProviderContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderContractError";
  }
}
