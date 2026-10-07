/**
 * Blizzard Provider (명세서 §2, §16, docs/BLIZZARD-API-INTEGRATION-PLAN.md)
 *
 * WoW: Forever용 Blizzard 공식 웹/API는 아직 존재가 확인되지 않았다(명세서 §30-1).
 * - endpoint registry(config/blizzard/endpoints.ts)는 비어 있고, capability는 모두 UNKNOWN이다.
 * - 그래서 기본 상태에서 호출하면 항상 "미구성" 오류를 반환한다. 네트워크 요청은 보내지 않는다.
 *
 * API가 공개되면 이 클래스는 고치지 않고 다음만 추가한다.
 * 1. config/blizzard/capabilities.ts: 확인한 기능을 AVAILABLE + 근거로 변경
 * 2. config/blizzard/endpoints.ts: 공식 문서의 endpoint 등록
 * 3. BlizzardResponseNormalizer 구현
 * 4. 환경변수 설정 (providers/blizzard/config.ts)
 */
import { blizzardCapabilities } from "@/config/blizzard/capabilities";
import { blizzardEndpoints } from "@/config/blizzard/endpoints";
import {
  capabilityRegistrySchema,
  CapabilityUnavailableError,
  type CapabilityRegistry,
  type ProviderCapabilityId,
} from "../capabilities";
import {
  ProviderContractError,
  ProviderNotConfiguredError,
  providerCharacterSchema,
  providerGearSchema,
  type CharacterDataProvider,
  type CharacterLookup,
  type ProviderCharacter,
  type ProviderGear,
} from "../types";
import { ClientCredentialsAuth, type BlizzardAuth } from "./auth";
import {
  getBlizzardConfigurationStatus,
  readBlizzardConfig,
  type BlizzardConfigurationStatus,
  type BlizzardProviderConfig,
} from "./config";
import { buildEndpointUrl, EndpointRegistry, type BlizzardEndpointDefinition } from "./endpoints";
import { BlizzardApiError, errorForStatus } from "./errors";
import { unconfiguredNormalizer, type BlizzardNormalizeContext, type BlizzardResponseNormalizer } from "./normalizer";
import { createFetchTransport, type BlizzardHttpTransport } from "./transport";

export interface BlizzardProviderDeps {
  config?: BlizzardProviderConfig;
  capabilities?: CapabilityRegistry;
  endpoints?: readonly BlizzardEndpointDefinition[];
  transport?: BlizzardHttpTransport;
  auth?: BlizzardAuth;
  normalizer?: BlizzardResponseNormalizer;
  now?: () => Date;
}

const NOT_CONFIGURED = "Blizzard 공급원은 아직 구성되지 않았습니다.";

export class BlizzardProvider implements CharacterDataProvider {
  readonly dataSource = "blizzard" as const;
  private readonly config: BlizzardProviderConfig;
  private readonly capabilities: CapabilityRegistry;
  private readonly endpoints: EndpointRegistry;
  private readonly transport: BlizzardHttpTransport;
  private readonly auth: BlizzardAuth;
  private readonly normalizer: BlizzardResponseNormalizer;
  private readonly now: () => Date;

  constructor(deps: BlizzardProviderDeps = {}) {
    this.config = deps.config ?? readBlizzardConfig();
    this.capabilities = capabilityRegistrySchema.parse(deps.capabilities ?? blizzardCapabilities) as CapabilityRegistry;
    this.endpoints = new EndpointRegistry(deps.endpoints ?? blizzardEndpoints, this.capabilities);
    this.now = deps.now ?? (() => new Date());
    this.transport = deps.transport ?? createFetchTransport(this.config.timeoutMs);
    this.auth = deps.auth ?? new ClientCredentialsAuth(this.config, this.transport, this.now);
    this.normalizer = deps.normalizer ?? unconfiguredNormalizer;
  }

  getCapabilities(): CapabilityRegistry {
    return this.capabilities;
  }

  getConfigurationStatus(): BlizzardConfigurationStatus {
    return getBlizzardConfigurationStatus(this.config);
  }

  async getCharacter(input: CharacterLookup): Promise<ProviderCharacter | null> {
    const fetched = await this.fetchFor("character_profile", input);
    if (!fetched) return null;
    const result = this.normalizer.normalizeCharacter(fetched.body, fetched.ctx);
    if (result === null) return null;
    const parsed = providerCharacterSchema.safeParse(result);
    if (!parsed.success || parsed.data.dataSource !== "blizzard") {
      throw new ProviderContractError("Blizzard 캐릭터 정규화 결과가 내부 데이터 계약과 맞지 않습니다.");
    }
    return result;
  }

  async getCharacterGear(input: CharacterLookup): Promise<ProviderGear | null> {
    const fetched = await this.fetchFor("character_equipment", input);
    if (!fetched) return null;
    const result = this.normalizer.normalizeGear(fetched.body, fetched.ctx);
    if (result === null) return null;
    if (!providerGearSchema.safeParse(result).success) {
      throw new ProviderContractError("Blizzard 장비 정규화 결과가 내부 데이터 계약과 맞지 않습니다.");
    }
    return result;
  }

  /** 설정 → capability → endpoint 순서로 확인한 뒤 요청한다. 하나라도 없으면 요청하지 않는다. */
  private async fetchFor(
    capability: ProviderCapabilityId,
    lookup: CharacterLookup,
  ): Promise<{ body: unknown; ctx: BlizzardNormalizeContext } | null> {
    const status = this.getConfigurationStatus();
    if (!status.configured) {
      throw new ProviderNotConfiguredError(`${NOT_CONFIGURED} (${status.problems.join(" ")})`);
    }
    const entry = this.capabilities[capability];
    if (entry.status !== "AVAILABLE") {
      throw new CapabilityUnavailableError(
        capability,
        entry.status,
        `${NOT_CONFIGURED} Blizzard 공급원의 ${capability} 기능 상태가 ${entry.status}입니다.`,
      );
    }
    const endpoint = this.endpoints.find(capability);
    if (!endpoint) throw new ProviderNotConfiguredError(`${NOT_CONFIGURED} (${capability} endpoint 없음)`);

    const query: Record<string, string> = {};
    if (endpoint.namespaceKind) {
      const ns = this.config.namespaces[endpoint.namespaceKind];
      if (!ns) throw new ProviderNotConfiguredError(`${NOT_CONFIGURED} (namespace ${endpoint.namespaceKind} 없음)`);
      query.namespace = ns;
    }
    if (this.config.locale) query.locale = this.config.locale;

    const url = buildEndpointUrl(
      this.config.apiBaseUrl!,
      endpoint,
      {
        region: lookup.region,
        gameMode: lookup.gameMode,
        // 대소문자·정규화 규칙은 공식 문서 확인 필요. 받은 이름을 그대로 인코딩한다.
        characterName: lookup.characterName,
        externalId: lookup.externalId ?? undefined,
      },
      query,
    );
    const token = await this.auth.getAccessToken();
    let response;
    try {
      response = await this.transport.send({ method: "GET", url, headers: { authorization: `Bearer ${token}` } });
    } catch (error) {
      throw new BlizzardApiError(`Blizzard API에 연결하지 못했습니다. (${(error as Error).message})`, null, true);
    }
    if (response.status === 404) return null;
    if (response.status !== 200) throw errorForStatus(response.status);

    const lastModified = response.headers["last-modified"];
    const sourceUpdatedAt = lastModified ? new Date(lastModified) : null;
    return {
      body: response.body,
      ctx: {
        lookup,
        observedAt: this.now(),
        sourceUpdatedAt: sourceUpdatedAt && !Number.isNaN(sourceUpdatedAt.getTime()) ? sourceUpdatedAt : null,
      },
    };
  }
}
