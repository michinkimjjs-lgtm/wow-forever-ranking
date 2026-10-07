/**
 * Blizzard endpoint registry (docs/BLIZZARD-API-INTEGRATION-PLAN.md §2, §3)
 *
 * endpoint는 config/blizzard/endpoints.ts에만 등록한다. 지금은 비어 있다.
 * 이 모듈은 등록된 정의를 검증하고, API base와 상대 경로로 요청 URL을 만든다.
 * - 전체 URL(https://...)을 경로로 쓰지 않는다. API base는 설정에서만 온다.
 * - 등록하려면 capability가 AVAILABLE이고 공식 근거(evidence)가 있어야 한다.
 */
import type { CapabilityRegistry, ProviderCapabilityId } from "../capabilities";

/** 경로에 쓸 수 있는 자리표시자 */
export const ENDPOINT_PLACEHOLDERS = ["region", "gameMode", "characterName", "externalId", "itemId", "guildId"] as const;
export type EndpointPlaceholder = (typeof ENDPOINT_PLACEHOLDERS)[number];

export interface BlizzardEndpointDefinition {
  id: string;
  capability: ProviderCapabilityId;
  method: "GET";
  /** API base 기준 상대 경로. 예: "/path/{characterName}" (형태 예시일 뿐 실제 경로가 아님) */
  pathTemplate: string;
  /** namespace 종류 (BLIZZARD_API_NAMESPACES의 키). 없으면 null */
  namespaceKind: string | null;
  evidence: { url: string; verifiedAt: string };
}

export class EndpointRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EndpointRegistryError";
  }
}

const PLACEHOLDER = /\{([A-Za-z]+)\}/g;

export function validateEndpointDefinition(def: BlizzardEndpointDefinition, capabilities: CapabilityRegistry): void {
  const where = `endpoint "${def.id}"`;
  if (!/^[a-z0-9][a-z0-9_.-]*$/.test(def.id)) throw new EndpointRegistryError(`${where}: id 형식이 올바르지 않습니다.`);
  if (!def.pathTemplate.startsWith("/") || def.pathTemplate.includes("://") || def.pathTemplate.startsWith("//")) {
    throw new EndpointRegistryError(`${where}: 경로는 API base 기준 상대 경로여야 합니다.`);
  }
  if (def.pathTemplate.split("/").some((part) => part === ".." || part === ".")) {
    throw new EndpointRegistryError(`${where}: 경로에 . 또는 ..을 쓸 수 없습니다.`);
  }
  for (const match of def.pathTemplate.matchAll(PLACEHOLDER)) {
    if (!(ENDPOINT_PLACEHOLDERS as readonly string[]).includes(match[1] ?? "")) {
      throw new EndpointRegistryError(`${where}: 알 수 없는 자리표시자 {${match[1]}}`);
    }
  }
  if (!/^https:\/\//.test(def.evidence.url) || !/^\d{4}-\d{2}-\d{2}$/.test(def.evidence.verifiedAt)) {
    throw new EndpointRegistryError(`${where}: 공식 근거 URL(https)과 확인 날짜가 필요합니다.`);
  }
  const capability = capabilities[def.capability];
  if (capability.status !== "AVAILABLE" || capability.evidence === null) {
    throw new EndpointRegistryError(
      `${where}: capability ${def.capability}가 AVAILABLE이 아닙니다(${capability.status}). 확인되지 않은 기능의 endpoint는 등록할 수 없습니다.`,
    );
  }
}

export class EndpointRegistry {
  private readonly byCapability = new Map<ProviderCapabilityId, BlizzardEndpointDefinition>();

  constructor(definitions: readonly BlizzardEndpointDefinition[], capabilities: CapabilityRegistry) {
    const ids = new Set<string>();
    for (const def of definitions) {
      validateEndpointDefinition(def, capabilities);
      if (ids.has(def.id)) throw new EndpointRegistryError(`endpoint id가 중복되었습니다: ${def.id}`);
      if (this.byCapability.has(def.capability)) {
        throw new EndpointRegistryError(`capability ${def.capability}에 endpoint가 두 개 이상 등록되었습니다.`);
      }
      ids.add(def.id);
      this.byCapability.set(def.capability, def);
    }
  }

  get size(): number {
    return this.byCapability.size;
  }

  find(capability: ProviderCapabilityId): BlizzardEndpointDefinition | null {
    return this.byCapability.get(capability) ?? null;
  }
}

/** API base + 상대 경로 + 인코딩한 자리표시자 값으로 URL을 만든다. */
export function buildEndpointUrl(
  apiBaseUrl: string,
  def: BlizzardEndpointDefinition,
  params: Partial<Record<EndpointPlaceholder, string>>,
  query: Record<string, string> = {},
): string {
  const path = def.pathTemplate.replace(PLACEHOLDER, (_, name: string) => {
    const value = params[name as EndpointPlaceholder];
    if (value === undefined || value === "") {
      throw new EndpointRegistryError(`endpoint "${def.id}": {${name}} 값이 없습니다.`);
    }
    return encodeURIComponent(value);
  });
  const url = new URL(apiBaseUrl.replace(/\/+$/, "") + path);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}
