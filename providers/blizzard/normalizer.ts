/**
 * Blizzard 응답 정규화 (docs/BLIZZARD-API-INTEGRATION-PLAN.md §3, §4)
 *
 * 응답 형식은 아직 알 수 없다. 공식 문서가 공개되면 이 인터페이스를 구현한다.
 * 정규화 결과는 다른 공급원과 같은 내부 계약(ProviderCharacter / ProviderGear)을 따르고,
 * BlizzardProvider가 zod 스키마로 한 번 더 검증한다.
 */
import { ProviderNotConfiguredError, type CharacterLookup, type ProviderCharacter, type ProviderGear } from "../types";

export interface BlizzardNormalizeContext {
  lookup: CharacterLookup;
  /** 서버가 응답을 받은 시각 */
  observedAt: Date;
  /** 응답 헤더 등에서 얻은 원본 갱신 시각. 없으면 null */
  sourceUpdatedAt: Date | null;
}

export interface BlizzardResponseNormalizer {
  /** 사용하는 응답 형식 버전. 파서 버전처럼 ingestion_records에 남긴다. */
  readonly version: string;
  normalizeCharacter(raw: unknown, ctx: BlizzardNormalizeContext): ProviderCharacter | null;
  normalizeGear(raw: unknown, ctx: BlizzardNormalizeContext): ProviderGear | null;
}

/** 응답 형식이 확인되기 전 기본값. 호출하면 "미구성" 오류 */
export const unconfiguredNormalizer: BlizzardResponseNormalizer = {
  version: "unconfigured",
  normalizeCharacter() {
    throw new ProviderNotConfiguredError("Blizzard 응답 정규화 규칙이 아직 없습니다.");
  },
  normalizeGear() {
    throw new ProviderNotConfiguredError("Blizzard 응답 정규화 규칙이 아직 없습니다.");
  },
};
