/**
 * Provider 등록 제한 (명세서 §6.4-5)
 * - mock 배포: MockProvider만 사용할 수 있다.
 * - beta / live 배포: MockProvider를 사용할 수 없다.
 */
import type { DataEnvironment, DataSource } from "@/lib/domain/enums";
import { AddonProvider } from "./addon/AddonProvider";
import { BlizzardProvider } from "./blizzard/BlizzardProvider";
import { MockCharacterProvider } from "./mock/MockCharacterProvider";
import type { CharacterDataProvider } from "./types";
import type { MockDatasetOptions } from "@/lib/mock/generator";

export class ProviderRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderRegistrationError";
  }
}

export function getProvider(
  appEnv: DataEnvironment,
  source: DataSource,
  mockOptions?: MockDatasetOptions,
): CharacterDataProvider {
  if (source === "mock") {
    if (appEnv !== "mock") {
      throw new ProviderRegistrationError(`${appEnv} 배포에서는 MockProvider를 사용할 수 없습니다.`);
    }
    return new MockCharacterProvider(mockOptions);
  }
  if (appEnv === "mock") {
    throw new ProviderRegistrationError(`mock 배포에서는 실제 공급원(${source})을 사용할 수 없습니다.`);
  }
  switch (source) {
    case "blizzard":
      return new BlizzardProvider();
    case "addon":
      return new AddonProvider();
    case "user_submission":
      throw new ProviderRegistrationError("사용자 제출은 Provider가 아니라 제출 API(P1)로 받습니다.");
  }
}

export function getMockProvider(appEnv: DataEnvironment, options?: MockDatasetOptions): MockCharacterProvider {
  return getProvider(appEnv, "mock", options) as MockCharacterProvider;
}
