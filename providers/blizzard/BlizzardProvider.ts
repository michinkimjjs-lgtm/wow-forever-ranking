/**
 * Blizzard Provider (명세서 §2, §16)
 *
 * WoW: Forever용 Blizzard 공식 웹/API는 아직 존재가 확인되지 않았다(명세서 §30-1).
 * 확인 전까지 엔드포인트를 구현하지 않고, 호출하면 "미구성" 오류를 반환한다.
 */
import {
  ProviderNotConfiguredError,
  type CharacterDataProvider,
  type CharacterLookup,
  type ProviderCharacter,
  type ProviderGear,
} from "../types";

export class BlizzardProvider implements CharacterDataProvider {
  readonly dataSource = "blizzard" as const;

  async getCharacter(input: CharacterLookup): Promise<ProviderCharacter | null> {
    void input;
    throw new ProviderNotConfiguredError("Blizzard 공급원은 아직 구성되지 않았습니다.");
  }

  async getCharacterGear(input: CharacterLookup): Promise<ProviderGear | null> {
    void input;
    throw new ProviderNotConfiguredError("Blizzard 공급원은 아직 구성되지 않았습니다.");
  }
}
