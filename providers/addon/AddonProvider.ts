/**
 * Addon Provider (명세서 §2, §16) — P1에서 구현
 *
 * 사용자 동의 기반 애드온 데이터는 서버가 받는(push) 방식이므로, 실제 구현은 sourceBuild별 파서(./parsers)가
 * 원본을 정규화 관측 데이터로 바꾸는 형태가 된다. 애드온 API 범위는 아직 확인되지 않았다(명세서 §30-2, 3).
 */
import {
  ProviderNotConfiguredError,
  type CharacterDataProvider,
  type CharacterLookup,
  type ProviderCharacter,
  type ProviderGear,
} from "../types";

export class AddonProvider implements CharacterDataProvider {
  readonly dataSource = "addon" as const;

  async getCharacter(input: CharacterLookup): Promise<ProviderCharacter | null> {
    void input;
    throw new ProviderNotConfiguredError("애드온 공급원은 아직 구현되지 않았습니다. (P1)");
  }

  async getCharacterGear(input: CharacterLookup): Promise<ProviderGear | null> {
    void input;
    throw new ProviderNotConfiguredError("애드온 공급원은 아직 구현되지 않았습니다. (P1)");
  }
}
