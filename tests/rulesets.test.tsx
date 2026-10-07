/**
 * Phase 3C: WoW: Forever 공식 Ruleset (docs/RULESETS.md)
 * - Ruleset 이름·공개 상태와 클라이언트 내부 Enum.GameMode 값(미확인)을 구분한다.
 * - region과 ruleset은 서로 다른 축이다. 캐릭터는 region + ruleset + 전체 이름으로 식별한다.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rulesetsConfig } from "@/config/rulesets";
import { InvalidQueryError, parseListParams, parseSearchParams } from "@/lib/api/params";
import { handleApiError } from "@/lib/api/response";
import {
  gameModeForRuleset,
  GameScopeNotConfiguredError,
  getExportMapping,
  getRulesets,
  getRulesetSources,
  loadConfig,
  rulesetOfGameMode,
  RulesetNotAvailableError,
  type ExportMapping,
} from "@/lib/config";
import { exportMappingConfigSchema, gameScopesConfigSchema, rulesetsConfigSchema } from "@/lib/config/schema";
import { RULESET_CODES, type DataEnvironment } from "@/lib/domain/enums";
import { buildFullName, normalizeName } from "@/lib/domain/names";
import { identityKeyOf } from "@/lib/domain/submission-consistency";
import { characterExportV1Schema } from "@/lib/submissions/export-schema";
import { normalizeCharacterExport } from "@/lib/submissions/normalize";
import { submitCharacterExport } from "@/lib/submissions/submit";
import { ko } from "@/locales/ko";

const serverState: { appEnv: DataEnvironment } = { appEnv: "mock" };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/context", () => ({
  // 이 테스트의 화면은 파라미터 단계에서 준비 중 상태가 정해지므로 DB가 필요 없다.
  getServerContext: async () => ({ appEnv: serverState.appEnv, now: new Date("2026-10-07T06:00:00Z"), cache: null, db: null }),
  getAppEnvironmentSafe: () => serverState.appEnv,
}));
afterEach(() => {
  serverState.appEnv = "mock";
});

describe("공식 Ruleset 등록", () => {
  it("normal / pvp / roleplaying / hardcore 네 가지이고 한국어 이름은 일반 / 전쟁 / 롤플레잉 / 하드코어다", () => {
    expect(getRulesets().map((r) => r.code)).toEqual(["normal", "pvp", "roleplaying", "hardcore"]);
    expect(RULESET_CODES.map((code) => ko.game.rulesets[code])).toEqual(["일반", "전쟁", "롤플레잉", "하드코어"]);
  });

  it.each([
    ["normal", "AVAILABLE"],
    ["pvp", "AVAILABLE"],
    ["roleplaying", "AVAILABLE"],
    ["hardcore", "POST_LAUNCH"],
  ] as const)("%s의 공개 상태는 %s", (code, status) => {
    expect(getRulesets().find((r) => r.code === code)?.publicStatus).toBe(status);
  });

  it("POST_LAUNCH는 '출시 후 제공'으로 표시한다", () => {
    expect(ko.game.rulesetStatuses.POST_LAUNCH).toBe("출시 후 제공");
  });

  it("클라이언트 내부 Enum.GameMode 값은 모두 미확인(UNKNOWN, null)이다", () => {
    for (const ruleset of getRulesets()) expect(ruleset.clientGameMode).toEqual({ value: null, status: "UNKNOWN" });
  });

  it("공식 근거(URL, 확인 날짜, 확인 내용)를 기록한다", () => {
    const sources = getRulesetSources();
    expect(sources.map((s) => s.id)).toEqual(["choose-your-ruleset", "create-a-name", "deep-dive-panel"]);
    for (const source of sources) {
      expect(source.url).toMatch(/^https:\/\/news\.blizzard\.com\//);
      expect(source.checkedAt).toBe("2026-10-07");
      expect(source.finding.length).toBeGreaterThan(0);
    }
  });

  it("확인되지 않은 값을 확정값처럼 넣으면 설정 검증이 거부한다", () => {
    const withGuess = structuredClone(rulesetsConfig);
    withGuess.rulesets[0]!.clientGameMode = { status: "UNKNOWN", value: 3 } as never;
    expect(rulesetsConfigSchema.safeParse(withGuess).success).toBe(false);
    const missing = { ...rulesetsConfig, rulesets: rulesetsConfig.rulesets.slice(0, 3) };
    expect(rulesetsConfigSchema.safeParse(missing).success).toBe(false);
  });
});

describe("미확인 enum 값", () => {
  it("실제 export 매핑의 Enum.GameMode → 규칙 연결은 비어 있다 (추측하지 않음)", () => {
    expect(getExportMapping("beta").gameModeByActiveGameMode).toEqual({});
    expect(getExportMapping("live").gameModeByActiveGameMode).toEqual({});
  });

  it("매핑 값은 공식 Ruleset 코드만 허용한다", () => {
    const base = getExportMapping("beta");
    const bad = { beta: { ...base, gameModeByActiveGameMode: { "1": "standard" } }, live: base };
    expect(exportMappingConfigSchema.safeParse(bad).success).toBe(false);
    const good = { beta: { ...base, gameModeByActiveGameMode: { "1": "normal" } }, live: base };
    expect(exportMappingConfigSchema.safeParse(good).success).toBe(true);
  });
});

describe("region + ruleset (서로 다른 축)", () => {
  const mockScope = loadConfig().gameScopes.mock;

  it("beta / live의 gameMode는 공식 Ruleset 코드여야 하고, region과 합친 문자열은 거부한다", () => {
    const scope = (code: string) => ({
      regions: [{ code: "test-region" }],
      gameModes: [{ code, maxLevel: null }],
      defaultRegion: "test-region",
      defaultGameMode: code,
    });
    expect(gameScopesConfigSchema.safeParse({ mock: mockScope, beta: scope("normal"), live: null }).success).toBe(true);
    expect(gameScopesConfigSchema.safeParse({ mock: mockScope, beta: scope("test-region-normal"), live: null }).success).toBe(false);
    expect(gameScopesConfigSchema.safeParse({ mock: mockScope, beta: null, live: scope("standard") }).success).toBe(false);
  });

  it("mock 개발용 코드는 Ruleset에 연결된다 (standard → 일반, alternate → 전쟁)", () => {
    expect(rulesetOfGameMode("mock", "standard")).toBe("normal");
    expect(rulesetOfGameMode("mock", "alternate")).toBe("pvp");
    expect(gameModeForRuleset("mock", "roleplaying")).toBeNull();
    expect(gameModeForRuleset("mock", "hardcore")).toBeNull();
  });

  it("ruleset 파라미터는 gameMode로 바뀌고, 기존 gameMode 파라미터도 그대로 동작한다", () => {
    expect(parseListParams({ ruleset: "pvp" }, "mock", { strict: true })).toMatchObject({
      ruleset: "pvp",
      scope: { gameMode: "alternate" },
    });
    expect(parseListParams({ gameMode: "standard" }, "mock", { strict: true }).ruleset).toBe("normal");
    expect(parseListParams({}, "mock", { strict: true }).ruleset).toBe("normal");
  });

  it("데이터가 없는 규칙은 오류가 아니라 '데이터 준비 중', 잘못된 값은 400", () => {
    expect(() => parseListParams({ ruleset: "hardcore" }, "mock", { strict: true })).toThrow(RulesetNotAvailableError);
    expect(() => parseListParams({ ruleset: "roleplaying" }, "mock", { strict: true })).toThrow(RulesetNotAvailableError);
    expect(() => parseListParams({ ruleset: "classic" }, "mock", { strict: true })).toThrow(InvalidQueryError);
    expect(() => parseListParams({ ruleset: "pvp", gameMode: "standard" }, "mock", { strict: true })).toThrow(InvalidQueryError);
  });

  it("검색은 규칙을 지정하면 그 규칙만, 지정하지 않으면 전체 규칙에서 찾는다", () => {
    expect(parseSearchParams({ q: "a", ruleset: "pvp" }, "mock", { strict: true, requireQuery: true })).toMatchObject({
      gameModeSpecified: true,
      scope: { gameMode: "alternate" },
    });
    expect(parseSearchParams({ q: "a" }, "mock", { strict: true, requireQuery: true }).gameModeSpecified).toBe(false);
  });

  it("API: 데이터가 없는 규칙은 200 + 준비 중 상태 + 한국어 안내", async () => {
    const res = handleApiError(new RulesetNotAvailableError("mock", "hardcore"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; meta: Record<string, unknown> };
    expect(body).toMatchObject({
      data: [],
      meta: { status: "unavailable", unavailableReason: "RULESET_NOT_AVAILABLE", ruleset: "hardcore", notice: ko.api.RULESET_NOT_AVAILABLE },
    });
  });
});

describe.each(["beta", "live"] as const)("%s 설정 미완료", (env) => {
  it("ruleset을 지정해도 '데이터 설정 준비 중'을 유지한다", () => {
    expect(() => parseListParams({ ruleset: "normal" }, env, { strict: true })).toThrow(GameScopeNotConfiguredError);
    expect(gameModeForRuleset(env, "normal")).toBeNull();
  });

  it("랭킹 화면: 준비 중 + 규칙 4개 모두 데이터 준비 중 (하드코어는 출시 후 제공)", async () => {
    serverState.appEnv = env;
    const { RankingPageView } = await import("@/components/ranking/ranking-page");
    const out = renderToStaticMarkup(await RankingPageView({ type: "level", searchParams: { ruleset: "normal" } }));
    expect(out).toContain(ko.common.setupPending.title);
    expect(out).toContain(ko.rankings.ruleset.label);
    for (const code of RULESET_CODES) expect(out).toContain(ko.game.rulesets[code]);
    expect(out).toContain(ko.game.rulesetStatuses.POST_LAUNCH);
    expect(out).not.toContain('href="/rankings/level?ruleset=');
  });
});

describe("랭킹 화면의 게임 규칙 필터 (mock)", () => {
  it("데이터가 없는 규칙을 고르면 '데이터 준비 중'을 보여 주고 다른 규칙은 링크로 남긴다", async () => {
    const { RankingPageView } = await import("@/components/ranking/ranking-page");
    const out = renderToStaticMarkup(await RankingPageView({ type: "level", searchParams: { ruleset: "hardcore" } }));
    expect(out).toContain(ko.rankings.ruleset.unavailableTitle);
    expect(out).toContain('href="/rankings/level?ruleset=normal"');
    expect(out).toContain('href="/rankings/level?ruleset=pvp"');
    expect(out).not.toContain('href="/rankings/level?ruleset=roleplaying"');
    expect(out).not.toContain('href="/rankings/level?ruleset=hardcore"');
    expect(out).toContain(ko.rankings.ruleset.separateNote);
  });
});

// ---------------------------------------------------------------------------
// 전체 이름 식별
// ---------------------------------------------------------------------------

const NOW = new Date("2026-10-07T06:00:00Z");
const MAPPING: ExportMapping = {
  regionById: { "901": "test-region" },
  gameModeByActiveGameMode: { "902": "normal" },
  classByFile: { TESTCLASS: "warrior" },
  raceByFile: { TestRace: "orc" },
  factionByTag: { TestFaction: "horde" },
  qualityById: {},
  twoHandInventoryTypes: [],
  nameSeparator: " ",
  maxObservationAgeDays: 14,
  maxFutureSkewSeconds: 300,
};

function exportWith(character: Record<string, unknown>) {
  return characterExportV1Schema.parse({
    schema: "forever-rank/character-export",
    schemaVersion: 1,
    collector: { name: "ForeverRankCollector", version: "0.1.0" },
    observedAt: Math.floor(NOW.getTime() / 1000) - 60,
    observedAtSource: "GetServerTime",
    trigger: "manual",
    client: { buildVersion: "0.0.0", buildNumber: "00000", regionId: 901 },
    gameMode: { activeGameMode: 902 },
    character: { guid: "TEST-GUID", level: 10, classFile: "TESTCLASS", raceFile: "TestRace", faction: "TestFaction", ...character },
    gear: [],
    levelEvents: [],
    unavailable: [],
  });
}

describe("전체 이름(이름 + 성) 식별", () => {
  it("전체 이름은 이름과 성이 모두 있고 구분자를 알 때만 만든다", () => {
    expect(buildFullName("아샤", "브라이트베일", " ")).toBe("아샤 브라이트베일");
    expect(buildFullName("아샤", null, " ")).toBeNull();
    expect(buildFullName("아샤", "브라이트베일", null)).toBeNull();
  });

  it("성이 없으면 첫 이름만으로 식별하지 않는다 (FULL_NAME_REQUIRED)", () => {
    const result = normalizeCharacterExport(exportWith({ name: "아샤" }), { mapping: MAPPING, slotProfile: null, now: NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.code)).toEqual(["FULL_NAME_REQUIRED"]);
    expect(ko.submissions.issues.FULL_NAME_REQUIRED).toMatch(/전체 이름/);
  });

  it("전체 이름이 있으면 region + ruleset + 전체 이름으로 식별한다", () => {
    const result = normalizeCharacterExport(exportWith({ name: "아샤", surname: "브라이트베일" }), {
      mapping: MAPPING,
      slotProfile: null,
      now: NOW,
    });
    expect(result.ok && result.observation.identity).toEqual({
      externalId: "TEST-GUID",
      region: "test-region",
      gameMode: "normal",
      characterName: "아샤 브라이트베일",
    });
  });

  it("첫 이름이 같아도 성이 다르면 다른 캐릭터, 같은 전체 이름도 규칙이 다르면 다른 캐릭터", () => {
    const key = (characterName: string, gameMode = "normal") =>
      identityKeyOf({ submissionId: "s", submitterKey: null, observedAt: NOW, region: "test-region", gameMode, characterName, level: 1 }).key;
    expect(key("아샤 브라이트베일")).not.toBe(key("아샤 문쉐이드"));
    expect(key("아샤 브라이트베일")).not.toBe(key("아샤 브라이트베일", "pvp"));
    expect(key("Asha Brightvale")).toBe(key("asha  brightvale"));
    expect(normalizeName("Asha Brightvale")).toBe("asha brightvale");
  });

  it("공개 제출에서 성이 없는 export는 버리지 않고 검토 대기(매핑 대기)로 둔다", async () => {
    const result = await submitCharacterExport(exportWith({ name: "아샤" }), {
      targetEnvironment: "beta",
      mapping: MAPPING,
      slotProfile: null,
      rankingProfile: null,
      now: NOW,
      dryRun: true,
      db: null,
      review: { channel: "public", mode: "queue", consent: null, frequency: null, autoAcceptNonConflicting: false },
    });
    expect(result).toMatchObject({ ok: true, mode: "dry-run", blockedReason: "MAPPING_PENDING" });
  });
});
