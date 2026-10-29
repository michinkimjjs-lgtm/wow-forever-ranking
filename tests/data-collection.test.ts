/**
 * 공식 API 준비: 발견·중복 제거·30일 보존·갱신 계획 (lib/collection, config/blizzard/data-policy.ts)
 * 네트워크 호출 없음. 공식 API가 공개되기 전에는 어떤 발견 경로도 연결하지 않는다.
 */
import { describe, expect, it } from "vitest";
import { blizzardCapabilities } from "@/config/blizzard/capabilities";
import { blizzardDataPolicy } from "@/config/blizzard/data-policy";
import { blizzardEndpoints } from "@/config/blizzard/endpoints";
import { DISCOVERY_SOURCE_PROFILES, describeDiscoveryCoverage, mergeDiscoveries, type DiscoveryCandidate } from "@/lib/collection/discovery";
import { planRefreshBatch } from "@/lib/collection/refresh-plan";
import { decideOnStatusCheck, decideRetention } from "@/lib/collection/retention";

const NOW = new Date("2026-11-20T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

const candidate = (overrides: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  source: "guild_roster",
  region: "test-region",
  gameMode: "test-mode",
  characterName: "가상 캐릭터",
  externalId: null,
  discoveredAt: daysAgo(1),
  ...overrides,
});

describe("공식 API 미공개 상태 유지", () => {
  it("발견·상태 확인 기능도 UNKNOWN이고 endpoint는 비어 있다", () => {
    for (const id of ["guild_roster", "leaderboard", "character_search", "character_status"] as const) {
      expect(blizzardCapabilities[id]).toMatchObject({ status: "UNKNOWN", evidence: null });
    }
    expect(blizzardEndpoints).toEqual([]);
  });

  it("어떤 발견 경로도 전체 캐릭터 목록을 보장하지 않는다", () => {
    for (const profile of Object.values(DISCOVERY_SOURCE_PROFILES)) expect(profile.canEnumerateAll).toBe(false);
    const coverage = describeDiscoveryCoverage(["leaderboard", "guild_roster", "character_lookup", "community_submission", "addon_export"]);
    expect(coverage.canClaimAllCharacters).toBe(false);
    expect(coverage.reaches).toEqual(["GUILD_MEMBERS_ONLY", "REQUESTED_ONLY", "SELF_REPORTED_ONLY", "TOP_RANKED_ONLY"]);
    expect(describeDiscoveryCoverage([]).canClaimAllCharacters).toBe(false);
  });

  it("보존 정책: 30일 최대, 21일부터 갱신, 시간당 36,000회 한도 (근거 주소 포함)", () => {
    expect(blizzardDataPolicy.retention).toMatchObject({ maxRetentionDays: 30, refreshAfterDays: 21 });
    expect(blizzardDataPolicy.rateLimit).toMatchObject({ requestsPerHour: 36_000, requestsPerSecond: 100 });
    expect(blizzardDataPolicy.retention.evidence.url).toMatch(/^https:\/\/us\.forums\.blizzard\.com\//);
  });
});

describe("발견 후보 중복 제거", () => {
  it("여러 경로에서 같은 캐릭터를 찾으면 한 번만 조회하도록 합친다 (외부 ID 기준, 이름 변경에도)", () => {
    const merged = mergeDiscoveries([
      candidate({ source: "leaderboard", externalId: "42", discoveredAt: daysAgo(3) }),
      candidate({ source: "guild_roster", externalId: "42", characterName: "새이름 캐릭터", discoveredAt: daysAgo(1) }),
      candidate({ source: "community_submission", externalId: null, characterName: "새이름 캐릭터" }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      externalId: "42",
      characterName: "새이름 캐릭터",
      sources: ["community_submission", "guild_roster", "leaderboard"],
      firstDiscoveredAt: daysAgo(3),
      identityConflict: false,
    });
  });

  it("외부 ID가 없으면 정규화한 전체 이름으로 묶는다. 대소문자·NFC 차이는 같은 캐릭터", () => {
    const merged = mergeDiscoveries([
      candidate({ characterName: "Test Name" }),
      candidate({ characterName: "test name", source: "addon_export" }),
      candidate({ characterName: "Test Other" }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("첫 이름만 같은 다른 캐릭터, 다른 region·gameMode는 합치지 않는다", () => {
    const merged = mergeDiscoveries([
      candidate({ characterName: "가상 하나" }),
      candidate({ characterName: "가상 둘" }),
      candidate({ characterName: "가상 하나", gameMode: "other-mode" }),
      candidate({ characterName: "가상 하나", region: "other-region" }),
    ]);
    expect(merged).toHaveLength(4);
  });

  it("같은 이름에 외부 ID가 둘이면 식별 충돌로 표시하고 자동으로 합치지 않는다", () => {
    const merged = mergeDiscoveries([
      candidate({ externalId: "1" }),
      candidate({ externalId: "2" }),
      candidate({ externalId: null, source: "community_submission" }),
    ]);
    expect(merged).toHaveLength(3);
    expect(merged.filter((m) => m.identityConflict).map((m) => m.externalId).sort()).toEqual(["1", "2"]);
  });
});

describe("30일 보존 판단", () => {
  it("Blizzard 출처: 21일 전 KEEP, 21일부터 REFRESH, 30일부터 PURGE", () => {
    const at = (d: number) => decideRetention({ dataSource: "blizzard", lastFetchedAt: daysAgo(d) }, NOW, blizzardDataPolicy).action;
    expect([at(0), at(20), at(21), at(29), at(30), at(45)]).toEqual(["KEEP", "KEEP", "REFRESH", "REFRESH", "PURGE", "PURGE"]);
  });

  it("사용자 제출·애드온 데이터에는 Blizzard 30일 규칙을 적용하지 않는다", () => {
    for (const dataSource of ["user_submission", "addon"] as const) {
      expect(decideRetention({ dataSource, lastFetchedAt: daysAgo(90) }, NOW, blizzardDataPolicy).action).toBe("KEEP");
    }
  });

  it("상태 확인: 없음·다른 캐릭터 → PURGE, 같은 캐릭터 → REFRESH, 오류 → RETRY", () => {
    expect(decideOnStatusCheck("42", { kind: "NOT_FOUND" })).toBe("PURGE");
    expect(decideOnStatusCheck("42", { kind: "FOUND", externalId: "43" })).toBe("PURGE");
    expect(decideOnStatusCheck("42", { kind: "FOUND", externalId: "42" })).toBe("REFRESH");
    expect(decideOnStatusCheck(null, { kind: "FOUND", externalId: "42" })).toBe("REFRESH");
    expect(decideOnStatusCheck("42", { kind: "ERROR" })).toBe("RETRY");
  });
});

describe("갱신 계획 (호출 한도)", () => {
  const policy = { ...blizzardDataPolicy, rateLimit: { ...blizzardDataPolicy.rateLimit, requestsPerHour: 100, refreshShare: 0.5 } };

  it("한도 안에서 만료가 가까운 순으로 고르고, 보존 기간 안의 캐릭터는 고르지 않는다", () => {
    const plan = planRefreshBatch({
      policy,
      now: NOW,
      windowMinutes: 60,
      callsPerCharacter: 25,
      candidates: [
        { characterId: "fresh", lastFetchedAt: daysAgo(5) },
        { characterId: "day22", lastFetchedAt: daysAgo(22) },
        { characterId: "day28", lastFetchedAt: daysAgo(28) },
        { characterId: "new", lastFetchedAt: null },
      ],
    });
    expect(plan.budget).toBe(2);
    expect(plan.selected).toEqual(["day28", "day22"]);
    expect(plan.deferred).toEqual(["new"]);
    expect(plan.atRisk).toEqual([]);
  });

  it("미루면 다음 회차 전에 만료되는 캐릭터를 알려 준다", () => {
    const plan = planRefreshBatch({
      policy,
      now: NOW,
      windowMinutes: 60,
      callsPerCharacter: 50,
      candidates: [
        { characterId: "a", lastFetchedAt: new Date(NOW.getTime() - 30 * 86_400_000 + 30 * 60_000) },
        { characterId: "b", lastFetchedAt: new Date(NOW.getTime() - 30 * 86_400_000 + 40 * 60_000) },
      ],
    });
    expect(plan.selected).toEqual(["a"]);
    expect(plan.atRisk).toEqual(["b"]);
  });
});
