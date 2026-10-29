/**
 * 캐릭터 발견(discovery)과 중복 제거 (docs/DATA-COLLECTION-STRATEGY.md §3)
 *
 * 발견은 "조회할 캐릭터 후보"를 모으는 단계다. 실제 캐릭터 정보는 이후 Provider 조회 → 수집 파이프라인을 거친다.
 * - 어떤 발견 경로도 WoW: Forever의 모든 캐릭터를 보장하지 않는다. 그래서 전체 목록이라고 표시하지 않는다.
 * - 무작위 이름 대입, 스크래핑, 비공개 API 접근은 발견 경로로 쓰지 않는다. 아래 목록에 없는 경로는 추가하지 않는다.
 * - 같은 캐릭터가 여러 경로에서 발견되면 한 번만 조회하도록 합친다 (외부 ID → 자연 키 순).
 */
import { normalizeName } from "@/lib/domain/names";
import type { DataEnvironment } from "@/lib/domain/enums";
import type { ProviderCapabilityId } from "@/providers/capabilities";

export const DISCOVERY_SOURCES = ["leaderboard", "guild_roster", "character_lookup", "community_submission", "addon_export"] as const;
export type DiscoverySource = (typeof DISCOVERY_SOURCES)[number];

/** 경로별로 찾을 수 있는 범위 */
export type DiscoveryReach = "TOP_RANKED_ONLY" | "GUILD_MEMBERS_ONLY" | "REQUESTED_ONLY" | "SELF_REPORTED_ONLY";

export interface DiscoverySourceProfile {
  /** 공식 API 경로면 필요한 capability. 사용자 제출 경로는 null */
  requiresCapability: ProviderCapabilityId | null;
  reach: DiscoveryReach;
  /** 이 경로만으로 전체 캐릭터 목록을 얻을 수 있는지. 확인된 경로는 하나도 없다 */
  canEnumerateAll: false;
}

export const DISCOVERY_SOURCE_PROFILES: Record<DiscoverySource, DiscoverySourceProfile> = {
  leaderboard: { requiresCapability: "leaderboard", reach: "TOP_RANKED_ONLY", canEnumerateAll: false },
  guild_roster: { requiresCapability: "guild_roster", reach: "GUILD_MEMBERS_ONLY", canEnumerateAll: false },
  character_lookup: { requiresCapability: "character_profile", reach: "REQUESTED_ONLY", canEnumerateAll: false },
  community_submission: { requiresCapability: null, reach: "SELF_REPORTED_ONLY", canEnumerateAll: false },
  addon_export: { requiresCapability: null, reach: "SELF_REPORTED_ONLY", canEnumerateAll: false },
};

export interface DiscoveryCandidate {
  source: DiscoverySource;
  region: string;
  gameMode: string;
  /** 전체 이름(이름 + 성). 첫 이름만으로 식별하지 않는다 */
  characterName: string;
  externalId: string | null;
  discoveredAt: Date;
}

/** 발견 경로 인터페이스. 공식 API가 공개되기 전에는 구현을 등록하지 않는다 */
export interface CharacterDiscoverySource {
  readonly source: DiscoverySource;
  discover(scope: { dataEnvironment: Exclude<DataEnvironment, "mock">; region: string; gameMode: string }): AsyncIterable<DiscoveryCandidate>;
}

export interface DiscoveredCharacter {
  key: string;
  region: string;
  gameMode: string;
  characterName: string;
  externalId: string | null;
  sources: DiscoverySource[];
  firstDiscoveredAt: Date;
  lastDiscoveredAt: Date;
  /** 같은 자연 키에 서로 다른 외부 ID가 있음 (삭제 후 같은 이름 재사용 등). 자동으로 합치지 않는다 */
  identityConflict: boolean;
}

const naturalKey = (c: Pick<DiscoveryCandidate, "region" | "gameMode" | "characterName">) =>
  `nat:${c.region}\u0000${c.gameMode}\u0000${normalizeName(c.characterName)}`;

/**
 * 발견 후보를 캐릭터 단위로 합친다.
 * 1. 외부 ID가 같으면 같은 캐릭터 (이름이 바뀌어도)
 * 2. 외부 ID가 없는 후보는 자연 키(region, gameMode, 정규화한 전체 이름)로 묶고,
 *    같은 자연 키의 외부 ID 캐릭터가 하나뿐이면 그쪽에 합친다.
 * 3. 같은 자연 키에 외부 ID가 둘 이상이면 identityConflict로 표시하고 외부 ID 없는 후보는 따로 둔다.
 */
export function mergeDiscoveries(candidates: readonly DiscoveryCandidate[]): DiscoveredCharacter[] {
  const byKey = new Map<string, DiscoveredCharacter>();
  const idsByNatural = new Map<string, Set<string>>();

  const add = (key: string, c: DiscoveryCandidate) => {
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        key,
        region: c.region,
        gameMode: c.gameMode,
        characterName: c.characterName,
        externalId: c.externalId,
        sources: [c.source],
        firstDiscoveredAt: c.discoveredAt,
        lastDiscoveredAt: c.discoveredAt,
        identityConflict: false,
      });
      return;
    }
    if (!existing.sources.includes(c.source)) existing.sources.push(c.source);
    if (c.discoveredAt < existing.firstDiscoveredAt) existing.firstDiscoveredAt = c.discoveredAt;
    if (c.discoveredAt > existing.lastDiscoveredAt) {
      existing.lastDiscoveredAt = c.discoveredAt;
      existing.characterName = c.characterName;
    }
  };

  const withId = candidates.filter((c) => c.externalId);
  for (const c of withId) {
    const key = `ext:${c.region}\u0000${c.externalId}`;
    add(key, c);
    const nat = naturalKey(c);
    idsByNatural.set(nat, (idsByNatural.get(nat) ?? new Set()).add(key));
  }
  for (const keys of idsByNatural.values()) {
    if (keys.size > 1) for (const key of keys) byKey.get(key)!.identityConflict = true;
  }
  for (const c of candidates.filter((c) => !c.externalId)) {
    const nat = naturalKey(c);
    const ids = idsByNatural.get(nat);
    add(ids && ids.size === 1 ? [...ids][0]! : nat, c);
  }

  return [...byKey.values()]
    .map((d) => ({ ...d, sources: [...d.sources].sort() }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export interface DiscoveryCoverage {
  /** 전체 캐릭터를 모았다고 말할 수 있는지. 확인된 경로로는 항상 false */
  canClaimAllCharacters: boolean;
  reaches: DiscoveryReach[];
}

/** 사용한 발견 경로로 말할 수 있는 범위 */
export function describeDiscoveryCoverage(sources: readonly DiscoverySource[]): DiscoveryCoverage {
  const profiles = [...new Set(sources)].map((s) => DISCOVERY_SOURCE_PROFILES[s]);
  return {
    canClaimAllCharacters: profiles.length > 0 && profiles.some((p) => p.canEnumerateAll),
    reaches: [...new Set(profiles.map((p) => p.reach))].sort(),
  };
}
