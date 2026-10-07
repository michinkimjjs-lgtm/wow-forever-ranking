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
import { uniformCapabilities, type CapabilityRegistry } from "../capabilities";

/**
 * 애드온 데이터는 서버가 받는(push) 방식이라 Provider로 조회(pull)하지 않는다.
 * 클라이언트 API로 읽을 수 있는 항목은 docs/FOREVER-API-CAPABILITY.md에 있고, 값은 게임 실행으로 확인해야 한다.
 */
const addonCapabilities = uniformCapabilities(
  "UNAVAILABLE",
  "애드온 데이터는 Provider 조회가 아니라 제출 API(Character Export v1)로 받습니다.",
  "2026-10-07",
);

export class AddonProvider implements CharacterDataProvider {
  readonly dataSource = "addon" as const;

  getCapabilities(): CapabilityRegistry {
    return addonCapabilities;
  }

  async getCharacter(input: CharacterLookup): Promise<ProviderCharacter | null> {
    void input;
    throw new ProviderNotConfiguredError("애드온 공급원은 아직 구현되지 않았습니다. (P1)");
  }

  async getCharacterGear(input: CharacterLookup): Promise<ProviderGear | null> {
    void input;
    throw new ProviderNotConfiguredError("애드온 공급원은 아직 구현되지 않았습니다. (P1)");
  }
}
