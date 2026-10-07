/**
 * Phase 2D: 커뮤니티 랭킹 단계, 데이터 커버리지, 출처 표시, 중복·충돌 제출, "전체 서버 1위" 표시 조건
 * 테스트 데이터는 모두 가상 캐릭터다.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { communityRankingPolicy } from "@/config/community-ranking";
import { ingestionRecords } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { dataOriginOf } from "@/lib/domain/data-origin";
import { DATA_SOURCES, type DataSource, type VerificationStatus } from "@/lib/domain/enums";
import { selectPreferred } from "@/lib/domain/source-priority";
import {
  compareSubmissions,
  groupByCharacter,
  identityKeyOf,
  type SubmittedObservation,
} from "@/lib/domain/submission-consistency";
import {
  classifyRankingStage,
  communityRankingPolicySchema,
  evaluateServerWideClaim,
  getCommunityRankingPolicy,
  rankScopeKind,
  type CommunityRankingPolicy,
} from "@/lib/ranking/community";
import { buildCoverage, getDataCoverage, type DataCoverage } from "@/lib/ranking/coverage";
import { getLevelRanking } from "@/lib/ranking";
import { ko } from "@/locales/ko";
import { createTestDb } from "./helpers/db";
import { daysAgo, hoursAgo, insertCharacter, NOW } from "./helpers/fixtures";

const betaScope = { dataEnvironment: "beta" as const, gameMode: "standard" };

function coverage(
  groups: { verificationStatus: VerificationStatus; dataSource: DataSource; count: number }[],
  extra: Partial<Parameters<typeof buildCoverage>[0]> = {},
): DataCoverage {
  return buildCoverage({
    scope: betaScope,
    observedCharacters: groups.reduce((s, g) => s + g.count, 0),
    activeGroups: groups,
    identityConflicts: 0,
    latestSeenAt: NOW,
    oldestActiveSeenAt: NOW,
    ...extra,
  });
}

/** 테스트 전용 정책 (실제 설정은 모두 null = 미정) */
const testPolicy: CommunityRankingPolicy = {
  status: "DRAFT",
  brandedCommunity: { minActiveCharacters: 100, minIndependentSubmitters: 20, maxIdentityConflictRatio: 0.01 },
  serverWideClaim: { requireOfficialSource: true, minPopulationCoverage: 0.95, minVerifiedRatio: 0.95, maxIdentityConflictRatio: 0.001 },
};

const community = (n: number) => [{ verificationStatus: "COMMUNITY_SUBMITTED" as const, dataSource: "user_submission" as const, count: n }];
const official = (n: number) => [{ verificationStatus: "VERIFIED" as const, dataSource: "blizzard" as const, count: n }];

// ---------------------------------------------------------------------------

describe("공식 vs 커뮤니티 표시", () => {
  it("출처 구분: blizzard=공식, addon·user_submission=커뮤니티 제출, mock=테스트 데이터", () => {
    expect(DATA_SOURCES.map((s) => [s, ko.game.dataOrigins[dataOriginOf(s)]])).toEqual([
      ["mock", "테스트 데이터"],
      ["blizzard", "공식"],
      ["addon", "커뮤니티 제출"],
      ["user_submission", "커뮤니티 제출"],
    ]);
  });

  it("검증 상태 표시: 검증됨 / 로그 검증 / 커뮤니티 제출 / 미검증 / 테스트 데이터", () => {
    expect(ko.game.verificationStatuses).toEqual({
      VERIFIED: "검증됨",
      LOG_VERIFIED: "로그 검증",
      COMMUNITY_SUBMITTED: "커뮤니티 제출",
      UNVERIFIED: "미검증",
      MOCK: "테스트 데이터",
    });
  });

  it("단계별 랭킹 이름", () => {
    expect(ko.rankings.stageTitles.COMMUNITY.level).toBe("커뮤니티 레벨 랭킹");
    expect(ko.rankings.stageBadges.BRANDED_COMMUNITY).toBe("Forever Rank 커뮤니티 랭킹");
    expect(ko.rankings.stageBadges.OFFICIAL).toBe("공식 데이터 기반 랭킹");
  });

  it("'전체 서버' 표현은 허용 판단용 문구(rankScope.serverWide) 한 곳에만 있다", () => {
    const hits: string[] = [];
    const walk = (value: unknown, path: string) => {
      if (typeof value === "string") {
        if (value.includes("전체 서버")) hits.push(path);
      } else if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
      }
    };
    walk(ko, "ko");
    expect(hits).toEqual(["ko.rankings.rankScope.serverWide"]);
  });
});

describe("커뮤니티 랭킹 범위 (단계)", () => {
  it("mock은 항상 테스트 데이터 단계", () => {
    const c = buildCoverage({ ...coverageInput("mock"), activeGroups: [{ verificationStatus: "MOCK", dataSource: "mock", count: 500 }] });
    expect(classifyRankingStage(c, testPolicy)).toBe("TEST_DATA");
  });

  it("커뮤니티 제출만 있으면 1단계 커뮤니티 랭킹", () => {
    expect(classifyRankingStage(coverage(community(5)))).toBe("COMMUNITY");
  });

  it("현재 정책은 기준이 정해지지 않아(null) 2단계로 올라가지 않는다", () => {
    expect(classifyRankingStage(coverage(community(1_000_000), { independentSubmitters: 10_000 }))).toBe("COMMUNITY");
  });

  it("기준이 정해지고 모두 충족하면 2단계, 제출자 수를 모르면 1단계", () => {
    expect(classifyRankingStage(coverage(community(150), { independentSubmitters: 25 }), testPolicy)).toBe("BRANDED_COMMUNITY");
    expect(classifyRankingStage(coverage(community(150), { independentSubmitters: null }), testPolicy)).toBe("COMMUNITY");
    expect(classifyRankingStage(coverage(community(150), { independentSubmitters: 25, identityConflicts: 10 }), testPolicy)).toBe("COMMUNITY");
  });

  it("활성 캐릭터가 모두 공식 데이터일 때만 공식 데이터 기반 랭킹", () => {
    expect(classifyRankingStage(coverage(official(10)))).toBe("OFFICIAL");
    expect(classifyRankingStage(coverage([...official(10), ...community(1)]))).toBe("COMMUNITY");
  });

  it("정책 설정은 DRAFT이고 모든 기준이 null이며 스키마를 통과한다", () => {
    const policy = getCommunityRankingPolicy();
    expect(policy.status).toBe("DRAFT");
    expect(Object.values(policy.brandedCommunity).every((v) => v === null)).toBe(true);
    expect(policy.serverWideClaim.minPopulationCoverage).toBeNull();
    expect(communityRankingPolicySchema.safeParse({ ...communityRankingPolicy, serverWideClaim: { ...communityRankingPolicy.serverWideClaim, requireOfficialSource: false } }).success).toBe(false);
  });
});

function coverageInput(env: "mock" | "beta") {
  return {
    scope: { dataEnvironment: env, gameMode: "standard" },
    observedCharacters: 500,
    activeGroups: [],
    identityConflicts: 0,
    latestSeenAt: NOW,
    oldestActiveSeenAt: NOW,
  } as Parameters<typeof buildCoverage>[0];
}

describe("'전체 서버 1위' 표시 조건", () => {
  it("현재 설정에서는 어떤 데이터로도 허용되지 않는다", () => {
    for (const c of [coverage(community(10_000)), coverage(official(10_000), { populationEstimate: 10_000 })]) {
      expect(evaluateServerWideClaim(c).allowed).toBe(false);
      expect(rankScopeKind(evaluateServerWideClaim(c))).toBe("observed");
    }
  });

  it("커뮤니티 제출은 기준이 정해져도 허용되지 않는다 (공식 공급원 필요)", () => {
    const claim = evaluateServerWideClaim(coverage(community(10_000), { populationEstimate: 10_000 }), testPolicy);
    expect(claim.blockers).toContain("NOT_OFFICIAL_SOURCE");
  });

  it("모집단을 모르면 허용되지 않는다", () => {
    expect(evaluateServerWideClaim(coverage(official(10_000)), testPolicy).blockers).toEqual(["POPULATION_UNKNOWN"]);
  });

  it("공식 데이터 + 모집단 대비 충분한 커버리지 + 검증 비율 + 충돌 없음 → 허용", () => {
    const ok = evaluateServerWideClaim(coverage(official(9_900), { populationEstimate: 10_000 }), testPolicy);
    expect(ok).toEqual({ allowed: true, blockers: [] });
    expect(rankScopeKind(ok)).toBe("serverWide");
    const low = evaluateServerWideClaim(coverage(official(5_000), { populationEstimate: 10_000 }), testPolicy);
    expect(low.blockers).toEqual(["LOW_POPULATION_COVERAGE"]);
    const conflicts = evaluateServerWideClaim(coverage(official(9_900), { populationEstimate: 10_000, identityConflicts: 50 }), testPolicy);
    expect(conflicts.blockers).toEqual(["IDENTITY_CONFLICTS"]);
  });

  it("mock과 빈 데이터는 허용되지 않는다", () => {
    expect(evaluateServerWideClaim(buildCoverage(coverageInput("mock")), testPolicy).blockers).toEqual(
      expect.arrayContaining(["TEST_DATA", "NO_DATA"]),
    );
  });
});

describe("데이터 커버리지 계산", () => {
  it("검증 비율·공식 비율·출처 구분을 계산한다", () => {
    const c = coverage([
      { verificationStatus: "VERIFIED", dataSource: "blizzard", count: 2 },
      { verificationStatus: "LOG_VERIFIED", dataSource: "addon", count: 1 },
      { verificationStatus: "COMMUNITY_SUBMITTED", dataSource: "user_submission", count: 7 },
    ]);
    expect(c.activeCharacters).toBe(10);
    expect(c.verifiedRatio).toBeCloseTo(0.3);
    expect(c.officialRatio).toBeCloseTo(0.2);
    expect(c.origins).toEqual(["official", "community"]);
    expect(c.populationEstimate).toBeNull();
  });

  it("활성 캐릭터가 없으면 비율은 null", () => {
    const c = coverage([]);
    expect(c.verifiedRatio).toBeNull();
    expect(c.officialRatio).toBeNull();
  });
});

describe("커버리지와 오래된 데이터 (DB)", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["beta", "live"]));
    await insertCharacter(db, { characterName: "활동 하나", dataEnvironment: "beta", lastSeenAt: hoursAgo(2) });
    await insertCharacter(db, { characterName: "활동 둘", dataEnvironment: "beta", lastSeenAt: daysAgo(6) });
    await insertCharacter(db, { characterName: "오래됨", dataEnvironment: "beta", lastSeenAt: daysAgo(8) });
    await insertCharacter(db, { characterName: "다른 모드", dataEnvironment: "beta", gameMode: "alternate", lastSeenAt: hoursAgo(1) });
    await insertCharacter(db, { characterName: "라이브", dataEnvironment: "live", lastSeenAt: hoursAgo(1) });
    await db.insert(ingestionRecords).values({
      dataEnvironment: "beta",
      dataSource: "user_submission",
      parserVersion: "t",
      receivedAt: hoursAgo(3),
      payload: {},
      payloadHash: "x",
      status: "IDENTITY_CONFLICT",
    });
  });
  afterAll(() => close());

  it("7일 기준으로 활성 / 오래된 캐릭터를 나누고, 다른 게임 모드·영역은 세지 않는다", async () => {
    const c = await getDataCoverage(db, betaScope, NOW);
    expect(c.observedCharacters).toBe(3);
    expect(c.activeCharacters).toBe(2);
    expect(c.staleCharacters).toBe(1);
    expect(c.rankableCharacters).toBe(2);
    expect(c.byVerification.COMMUNITY_SUBMITTED).toBe(2);
    expect(c.origins).toEqual(["community"]);
    expect(c.identityConflicts).toBe(1);
    expect(c.oldestActiveSeenAt!.getTime()).toBe(daysAgo(6).getTime());
  });

  it("커버리지의 활성 수는 필터 없는 레벨 랭킹 대상 수와 같다", async () => {
    const ranking = await getLevelRanking(db, { scope: betaScope, pagination: { page: 1, pageSize: 50 }, now: NOW });
    const c = await getDataCoverage(db, betaScope, NOW);
    expect(ranking.status === "ok" && ranking.total).toBe(c.rankableCharacters);
    expect(classifyRankingStage(c)).toBe("COMMUNITY");
  });
});

// ---------------------------------------------------------------------------

let seq = 0;
function sub(overrides: Partial<SubmittedObservation>): SubmittedObservation {
  seq += 1;
  return {
    submissionId: `s${seq}`,
    submitterKey: `u${seq}`,
    observedAt: hoursAgo(10),
    region: "kr",
    gameMode: "standard",
    characterName: "가상 캐릭터",
    level: 20,
    classCode: "warrior",
    ...overrides,
  };
}

describe("중복 캐릭터 식별", () => {
  it("식별 우선순위: stableId → guid → region + gameMode + 전체 이름 (realm 없음)", () => {
    expect(identityKeyOf(sub({ stableId: "A", guid: "G" })).kind).toBe("stable");
    expect(identityKeyOf(sub({ guid: "G" })).kind).toBe("guid");
    const natural = identityKeyOf(sub({}));
    expect(natural).toEqual({ kind: "natural", key: "name:kr|standard|가상 캐릭터" });
    expect(natural.key).not.toContain("realm");
  });

  it("이름 대소문자·유니코드 정규화가 달라도 같은 캐릭터로 묶는다", () => {
    const groups = groupByCharacter([sub({ characterName: "Test Name" }), sub({ characterName: "  test   name " })]);
    expect(groups).toHaveLength(1);
  });

  it("게임 모드가 다르면 다른 캐릭터다", () => {
    expect(groupByCharacter([sub({}), sub({ gameMode: "alternate" })])).toHaveLength(2);
  });

  it("GUID가 없는 제출은 같은 이름의 GUID 그룹이 하나일 때만 붙인다", () => {
    expect(groupByCharacter([sub({ guid: "G1" }), sub({})])).toHaveLength(1);
    // 같은 이름에 GUID가 둘(이름 재사용 가능성) → GUID 없는 제출은 따로 둔다
    expect(groupByCharacter([sub({ guid: "G1" }), sub({ guid: "G2" }), sub({})])).toHaveLength(3);
  });

  it("이름이 바뀌어도 GUID가 같으면 같은 캐릭터이고 NAME_CHANGED로 남긴다", () => {
    const list = [sub({ guid: "G", characterName: "옛 이름", level: 10, observedAt: hoursAgo(20) }), sub({ guid: "G", characterName: "새 이름", level: 11 })];
    expect(groupByCharacter(list)).toHaveLength(1);
    const result = compareSubmissions(list);
    expect(result.issues.map((i) => i.code)).toEqual(["NAME_CHANGED"]);
    expect(result.status).not.toBe("CONFLICT");
  });
});

describe("충돌하는 제출", () => {
  it("한 건이면 SINGLE", () => {
    expect(compareSubmissions([sub({})]).status).toBe("SINGLE");
  });

  it("레벨이 시간 순으로 오르면 정상, 서로 다른 제출자 둘이 최신 상태에 동의하면 CORROBORATED", () => {
    const result = compareSubmissions([
      sub({ level: 18, observedAt: hoursAgo(30) }),
      sub({ level: 20, observedAt: hoursAgo(5) }),
      sub({ level: 20, observedAt: hoursAgo(4) }),
    ]);
    expect(result.status).toBe("CORROBORATED");
    expect(result.independentAgreements).toBe(2);
  });

  it("같은 제출자가 여러 번 보내도 독립 동의로 세지 않는다", () => {
    const result = compareSubmissions([sub({ submitterKey: "same", observedAt: hoursAgo(5) }), sub({ submitterKey: "same", observedAt: hoursAgo(4) })]);
    expect(result.status).toBe("CONSISTENT");
    expect(result.independentAgreements).toBe(1);
  });

  it("레벨 감소는 충돌", () => {
    const result = compareSubmissions([sub({ level: 25, observedAt: hoursAgo(10) }), sub({ level: 22, observedAt: hoursAgo(2) })]);
    expect(result.status).toBe("CONFLICT");
    expect(result.issues[0]!.code).toBe("LEVEL_DECREASE");
  });

  it("거의 같은 시각에 레벨이 다르면 충돌 (조작 가능성)", () => {
    const t = hoursAgo(3);
    const result = compareSubmissions([sub({ level: 20, observedAt: t }), sub({ level: 30, observedAt: new Date(t.getTime() + 60_000) })]);
    expect(result.issues.map((i) => i.code)).toContain("SAME_TIME_DIFFERENT_LEVEL");
  });

  it("직업 변경과 GUID 불일치는 충돌, 종족·진영 변경은 경고", () => {
    expect(compareSubmissions([sub({ observedAt: hoursAgo(9) }), sub({ classCode: "mage" })]).issues.map((i) => i.code)).toContain("CLASS_CHANGED");
    expect(compareSubmissions([sub({ guid: "A", observedAt: hoursAgo(9) }), sub({ guid: "B" })]).status).toBe("CONFLICT");
    const race = compareSubmissions([sub({ raceCode: "orc", observedAt: hoursAgo(9) }), sub({ raceCode: "troll" })]);
    expect(race.status).not.toBe("CONFLICT");
    expect(race.issues[0]).toMatchObject({ code: "RACE_OR_FACTION_CHANGED", severity: "warning" });
  });
});

describe("공급원 우선순위 (공식 vs 커뮤니티)", () => {
  it("같은 캐릭터에 공식(VERIFIED)과 커뮤니티 제출이 있으면 공식 데이터를 쓴다", () => {
    const picked = selectPreferred([
      { id: "community", dataEnvironment: "beta" as const, verificationStatus: "COMMUNITY_SUBMITTED" as const, observedAt: hoursAgo(1) },
      { id: "official", dataEnvironment: "beta" as const, verificationStatus: "VERIFIED" as const, observedAt: hoursAgo(20) },
    ]);
    expect(picked!.id).toBe("official");
  });
});
