/**
 * Provider 호환성 / Capability Registry / BlizzardProvider 미구성 상태 (Phase 2C)
 *
 * 실제 Blizzard API는 호출하지 않는다. 연결 구조 테스트는 가짜 transport와
 * 예약된 테스트 도메인(.invalid, RFC 2606)만 쓴다. 이 값들은 실제 endpoint가 아니다.
 */
import { describe, expect, it, vi } from "vitest";
import { blizzardCapabilities } from "@/config/blizzard/capabilities";
import { blizzardEndpoints } from "@/config/blizzard/endpoints";
import { characterObservationSchema } from "@/lib/ingestion/schema";
import { AddonProvider } from "@/providers/addon/AddonProvider";
import { BlizzardProvider } from "@/providers/blizzard/BlizzardProvider";
import { getBlizzardConfigurationStatus, readBlizzardConfig, type BlizzardProviderConfig } from "@/providers/blizzard/config";
import { buildEndpointUrl, EndpointRegistry, EndpointRegistryError, type BlizzardEndpointDefinition } from "@/providers/blizzard/endpoints";
import { BlizzardApiError } from "@/providers/blizzard/errors";
import type { BlizzardResponseNormalizer } from "@/providers/blizzard/normalizer";
import type { BlizzardHttpTransport, HttpRequest, HttpResponse } from "@/providers/blizzard/transport";
import {
  CAPABILITY_STATUSES,
  capabilityRegistrySchema,
  CapabilityUnavailableError,
  PROVIDER_CAPABILITY_IDS,
  uniformCapabilities,
  type CapabilityRegistry,
} from "@/providers/capabilities";
import { MockCharacterProvider } from "@/providers/mock/MockCharacterProvider";
import { getProvider } from "@/providers/registry";
import {
  ProviderContractError,
  ProviderNotConfiguredError,
  providerCharacterSchema,
  providerGearSchema,
  type CharacterDataProvider,
  type CharacterLookup,
} from "@/providers/types";

const TEST_BASE = "https://blizzard-api.test.invalid";
const TEST_EVIDENCE = { url: "https://docs.test.invalid/forever", verifiedAt: "2026-10-07" };

function testConfig(overrides: Partial<BlizzardProviderConfig> = {}): BlizzardProviderConfig {
  return {
    enabled: true,
    region: "kr",
    apiBaseUrl: TEST_BASE,
    oauthTokenUrl: "https://oauth.test.invalid/token",
    clientId: "test-client",
    clientSecret: "test-secret",
    namespaces: { profile: "test-profile-ns" },
    locale: null,
    timeoutMs: 1000,
    ...overrides,
  };
}

/** 테스트 전용: 장비/캐릭터 capability를 AVAILABLE로 가정한 registry */
function testCapabilities(): CapabilityRegistry {
  const available = { status: "AVAILABLE" as const, note: "테스트 가정", reviewedAt: "2026-10-07", evidence: TEST_EVIDENCE };
  return { ...blizzardCapabilities, character_profile: available, character_equipment: available };
}

const testEndpoints: BlizzardEndpointDefinition[] = [
  { id: "test.character", capability: "character_profile", method: "GET", pathTemplate: "/test/{region}/{characterName}", namespaceKind: "profile", evidence: TEST_EVIDENCE },
  { id: "test.equipment", capability: "character_equipment", method: "GET", pathTemplate: "/test/{region}/{characterName}/gear", namespaceKind: "profile", evidence: TEST_EVIDENCE },
];

/** 가짜 응답 형식 (실제 Blizzard 응답 형식이 아님) */
const testNormalizer: BlizzardResponseNormalizer = {
  version: "test-1",
  normalizeCharacter(raw, ctx) {
    const r = raw as { name: string; level: number };
    return {
      dataSource: "blizzard",
      observedAt: ctx.observedAt,
      sourceUpdatedAt: ctx.sourceUpdatedAt,
      sourceBuild: null,
      identity: { region: ctx.lookup.region, gameMode: ctx.lookup.gameMode, characterName: r.name, externalId: null },
      level: r.level,
      levelReachedAt: null,
    };
  },
  normalizeGear(raw, ctx) {
    const r = raw as { items: { slot: string; id: number; name: string; ilvl: number }[] };
    return {
      observedAt: ctx.observedAt,
      sourceBuild: null,
      equipment: r.items.map((i) => ({ slotCode: i.slot, externalItemId: String(i.id), name: i.name, itemLevel: i.ilvl })),
    };
  },
};

function fakeTransport(handler: (req: HttpRequest) => HttpResponse) {
  const calls: HttpRequest[] = [];
  const transport: BlizzardHttpTransport = {
    async send(req) {
      calls.push(req);
      if (req.url.startsWith("https://oauth.test.invalid")) {
        return { status: 200, headers: {}, body: { access_token: "test-token", expires_in: 3600 } };
      }
      return handler(req);
    },
  };
  return { transport, calls };
}

const NOW = new Date("2026-10-07T00:00:00Z");

function connectedBlizzard(handler: (req: HttpRequest) => HttpResponse) {
  const { transport, calls } = fakeTransport(handler);
  const provider = new BlizzardProvider({
    config: testConfig(),
    capabilities: testCapabilities(),
    endpoints: testEndpoints,
    transport,
    normalizer: testNormalizer,
    now: () => NOW,
  });
  return { provider, calls };
}

const lookup: CharacterLookup = { region: "kr", gameMode: "standard", characterName: "테스트 캐릭터" };

// ---------------------------------------------------------------------------

describe("Capability Registry", () => {
  it("Blizzard registry는 8개 기능을 모두 갖고 스키마를 통과한다", () => {
    expect(Object.keys(blizzardCapabilities).sort()).toEqual([...PROVIDER_CAPABILITY_IDS].sort());
    expect(capabilityRegistrySchema.safeParse(blizzardCapabilities).success).toBe(true);
  });

  it("Forever 웹 API는 확인되지 않았으므로 모든 기능이 UNKNOWN이다 (추측으로 AVAILABLE 금지)", () => {
    for (const id of PROVIDER_CAPABILITY_IDS) {
      expect(blizzardCapabilities[id].status).toBe("UNKNOWN");
      expect(blizzardCapabilities[id].evidence).toBeNull();
    }
  });

  it("endpoint registry는 비어 있다 (존재가 확인되지 않은 URL을 만들지 않음)", () => {
    expect(blizzardEndpoints).toHaveLength(0);
    expect(new EndpointRegistry(blizzardEndpoints, blizzardCapabilities).size).toBe(0);
  });

  it("상태 값은 AVAILABLE / UNAVAILABLE / UNKNOWN / RUNTIME_REQUIRED 네 가지다", () => {
    expect([...CAPABILITY_STATUSES]).toEqual(["AVAILABLE", "UNAVAILABLE", "UNKNOWN", "RUNTIME_REQUIRED"]);
    const bad = { ...blizzardCapabilities, guild: { ...blizzardCapabilities.guild, status: "MAYBE" } };
    expect(capabilityRegistrySchema.safeParse(bad).success).toBe(false);
  });

  it("AVAILABLE이 아닌 기능에는 endpoint를 등록할 수 없다", () => {
    expect(() => new EndpointRegistry([testEndpoints[0]!], blizzardCapabilities)).toThrow(EndpointRegistryError);
  });

  it("AVAILABLE이어도 공식 근거(evidence)가 없으면 endpoint를 등록할 수 없다", () => {
    const caps = { ...testCapabilities(), character_profile: { ...testCapabilities().character_profile, evidence: null } };
    expect(() => new EndpointRegistry([testEndpoints[0]!], caps)).toThrow(EndpointRegistryError);
  });

  it("endpoint 경로는 상대 경로만 허용하고 전체 URL·상위 경로·알 수 없는 자리표시자를 거부한다", () => {
    const caps = testCapabilities();
    for (const pathTemplate of ["https://evil.test.invalid/x", "//host/x", "/a/../b", "/x/{password}", "x/y"]) {
      expect(() => new EndpointRegistry([{ ...testEndpoints[0]!, pathTemplate }], caps)).toThrow(EndpointRegistryError);
    }
  });

  it("같은 capability에 endpoint를 두 개 등록할 수 없다", () => {
    const dup = { ...testEndpoints[0]!, id: "test.character2" };
    expect(() => new EndpointRegistry([testEndpoints[0]!, dup], testCapabilities())).toThrow(EndpointRegistryError);
  });

  it("URL은 설정의 API base와 인코딩한 값으로만 만든다", () => {
    const url = buildEndpointUrl(`${TEST_BASE}/`, testEndpoints[0]!, { region: "kr", characterName: "가 나/다" }, { namespace: "ns" });
    expect(url).toBe(`${TEST_BASE}/test/kr/${encodeURIComponent("가 나/다")}?namespace=ns`);
    expect(() => buildEndpointUrl(TEST_BASE, testEndpoints[0]!, { region: "kr" })).toThrow(EndpointRegistryError);
  });
});

describe("BlizzardProvider 미구성 상태", () => {
  it("환경변수가 없으면 미구성이고, 빠진 설정을 한국어로 알려 준다", () => {
    const status = getBlizzardConfigurationStatus(readBlizzardConfig({}));
    expect(status.configured).toBe(false);
    expect(status.problems.join(" ")).toContain("BLIZZARD_API_BASE_URL");
    expect(status.problems.join(" ")).toContain("BLIZZARD_OAUTH_TOKEN_URL");
  });

  it("URL 기본값을 코드에 두지 않는다", () => {
    const config = readBlizzardConfig({});
    expect(config.apiBaseUrl).toBeNull();
    expect(config.oauthTokenUrl).toBeNull();
    expect(config.region).toBeNull();
    expect(config.namespaces).toEqual({});
  });

  it("http URL은 거부한다", () => {
    const status = getBlizzardConfigurationStatus(testConfig({ apiBaseUrl: "http://plain.test.invalid" }));
    expect(status.configured).toBe(false);
  });

  it("기본 Provider는 호출해도 네트워크 요청 없이 미구성 오류를 낸다", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const provider = new BlizzardProvider({ config: readBlizzardConfig({}) });
    await expect(provider.getCharacter(lookup)).rejects.toThrow(ProviderNotConfiguredError);
    await expect(provider.getCharacterGear(lookup)).rejects.toThrow(ProviderNotConfiguredError);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("설정이 모두 있어도 capability가 UNKNOWN이면 요청하지 않는다", async () => {
    const { transport, calls } = fakeTransport(() => ({ status: 200, headers: {}, body: {} }));
    const provider = new BlizzardProvider({ config: testConfig(), transport });
    await expect(provider.getCharacter(lookup)).rejects.toThrow(CapabilityUnavailableError);
    expect(calls).toHaveLength(0);
  });

  it("registry의 blizzard Provider도 미구성 오류를 낸다", async () => {
    const provider = getProvider("beta", "blizzard");
    await expect(provider.getCharacter(lookup)).rejects.toThrow(ProviderNotConfiguredError);
    expect(provider.getCapabilities().character_profile.status).toBe("UNKNOWN");
  });
});

describe("BlizzardProvider 연결 구조 (가짜 transport)", () => {
  it("토큰을 받아 Bearer로 요청하고, namespace를 붙이고, 토큰을 재사용한다", async () => {
    const { provider, calls } = connectedBlizzard(() => ({ status: 200, headers: {}, body: { name: "테스트 캐릭터", level: 20 } }));
    await provider.getCharacter(lookup);
    await provider.getCharacter(lookup);
    const tokenCalls = calls.filter((c) => c.url.startsWith("https://oauth.test.invalid"));
    const apiCalls = calls.filter((c) => c.url.startsWith(TEST_BASE));
    expect(tokenCalls).toHaveLength(1);
    expect(apiCalls).toHaveLength(2);
    expect(apiCalls[0]!.headers.authorization).toBe("Bearer test-token");
    expect(apiCalls[0]!.url).toContain("namespace=test-profile-ns");
  });

  it("404는 null, 429·5xx는 재시도 가능 오류, 401은 재시도 불가 오류다", async () => {
    expect(await connectedBlizzard(() => ({ status: 404, headers: {}, body: null })).provider.getCharacter(lookup)).toBeNull();
    for (const [status, retryable] of [[429, true], [503, true], [401, false]] as const) {
      const { provider } = connectedBlizzard(() => ({ status, headers: {}, body: null }));
      const error = await provider.getCharacter(lookup).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BlizzardApiError);
      expect((error as BlizzardApiError).retryable).toBe(retryable);
    }
  });

  it("정규화 결과가 내부 계약을 어기면 거부한다", async () => {
    const { provider } = connectedBlizzard(() => ({ status: 200, headers: {}, body: { name: "", level: 0 } }));
    await expect(provider.getCharacter(lookup)).rejects.toThrow(ProviderContractError);
  });
});

// ---------------------------------------------------------------------------
// MockProvider와 BlizzardProvider가 같은 CharacterDataProvider 계약을 쓰는지
// ---------------------------------------------------------------------------

const mockProvider = new MockCharacterProvider({ seed: 7, characterCount: 5, anchor: NOW });
const mockLookup = (() => {
  const first = mockProvider.listObservations()[0]!;
  return { region: first.identity.region, gameMode: first.identity.gameMode, characterName: first.identity.characterName };
})();

const contractCases: { name: string; provider: () => CharacterDataProvider; lookup: CharacterLookup }[] = [
  { name: "MockProvider", provider: () => mockProvider, lookup: mockLookup },
  {
    name: "BlizzardProvider (가짜 transport)",
    provider: () =>
      connectedBlizzard((req): HttpResponse =>
        req.url.endsWith("/gear") || req.url.includes("/gear?")
          ? { status: 200, headers: {}, body: { items: [{ slot: "head", id: 1, name: "테스트 투구", ilvl: 20 }] } }
          : { status: 200, headers: { "last-modified": "Tue, 06 Oct 2026 00:00:00 GMT" }, body: { name: "테스트 캐릭터", level: 20 } },
      ).provider,
    lookup,
  },
];

describe.each(contractCases)("CharacterDataProvider 계약: $name", ({ provider, lookup: input }) => {
  it("모든 capability 상태를 제공한다", () => {
    const caps = provider().getCapabilities();
    expect(capabilityRegistrySchema.safeParse(caps).success).toBe(true);
  });

  it("getCharacter 결과가 내부 정규화 관측 스키마를 통과하고 dataEnvironment를 담지 않는다", async () => {
    const p = provider();
    const result = await p.getCharacter(input);
    expect(result).not.toBeNull();
    expect(providerCharacterSchema.safeParse(result).success).toBe(true);
    expect(result!.dataSource).toBe(p.dataSource);
    expect(result).not.toHaveProperty("dataEnvironment");
  });

  it("getCharacterGear 결과가 장비 계약을 통과하고, 캐릭터와 합치면 수집 스키마를 통과한다", async () => {
    const p = provider();
    const character = await p.getCharacter(input);
    const gear = await p.getCharacterGear(input);
    expect(gear).not.toBeNull();
    expect(providerGearSchema.safeParse(gear).success).toBe(true);
    expect(characterObservationSchema.safeParse({ ...character, equipment: gear!.equipment }).success).toBe(true);
  });

  it("없는 캐릭터는 null이다", async () => {
    const p = provider();
    if (p instanceof BlizzardProvider) return; // 가짜 transport는 항상 200을 준다. 404 처리는 위에서 확인
    expect(await p.getCharacter({ ...input, characterName: "존재하지않는이름" })).toBeNull();
  });
});

describe("다른 Provider의 capability", () => {
  it("mock은 던전·공격대·업적을 제공하지 않는다", () => {
    const caps = mockProvider.getCapabilities();
    expect(caps.character_level.status).toBe("AVAILABLE");
    expect(caps.dungeon.status).toBe("UNAVAILABLE");
    expect(caps.raid.status).toBe("UNAVAILABLE");
  });

  it("addon은 Provider 조회(pull)를 하지 않는다", () => {
    expect(new AddonProvider().getCapabilities().character_profile.status).toBe("UNAVAILABLE");
  });

  it("uniformCapabilities는 잘못된 상태를 거부한다", () => {
    expect(() => uniformCapabilities("NOPE" as never, "x", "2026-10-07")).toThrow();
  });
});
