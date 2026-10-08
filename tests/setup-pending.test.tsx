/**
 * Phase 3B: 지역·게임 모드 설정이 확정되지 않은 영역(beta / live)의 준비 중 처리, 한국어 UI, 파일 선택 UI
 *
 * 화면 테스트는 서버 컨텍스트를 가짜로 바꿔 DB 없이 렌더링한다.
 * 설정이 없는 영역에서는 DB를 조회하기 전에 준비 중 화면을 돌려줘야 하므로 DB가 필요 없다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseIdentityError } from "@/db/identity";
import { InvalidQueryError, parseListParams, parseSearchParams } from "@/lib/api/params";
import { handleApiError } from "@/lib/api/response";
import { GameScopeNotConfiguredError, getGameScope, isGameScopeConfigured, requireGameScope } from "@/lib/config";
import type { DataEnvironment } from "@/lib/domain/enums";
import { ko } from "@/locales/ko";

const serverState: { appEnv: DataEnvironment } = { appEnv: "beta" };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/context", () => ({
  getServerContext: async () => {
    if (serverState.appEnv !== "mock") {
      // 설정이 없는 영역은 DB를 쓰기 전에 준비 중 화면을 돌려줘야 한다.
      return { appEnv: serverState.appEnv, now: new Date("2026-10-07T06:00:00Z"), cache: null, db: null };
    }
    throw new Error("mock 화면 렌더링은 DB가 필요하므로 이 테스트에서 다루지 않는다");
  },
  getAppEnvironmentSafe: () => serverState.appEnv,
}));

afterEach(() => {
  serverState.appEnv = "beta";
});

const html = async (node: Promise<React.ReactNode> | React.ReactNode) => renderToStaticMarkup(await node);

describe("설정 미완료 영역 판단", () => {
  it("mock은 설정이 있고, beta / live는 아직 확정되지 않았다 (값을 만들어 넣지 않음)", () => {
    expect(isGameScopeConfigured("mock")).toBe(true);
    expect(getGameScope("beta")).toBeNull();
    expect(getGameScope("live")).toBeNull();
    expect(requireGameScope("mock").defaultGameMode).toBeTruthy();
  });

  it.each(["beta", "live"] as const)("%s: 설정 미완료는 전용 오류(GameScopeNotConfiguredError)로 구분된다", (env) => {
    expect(() => requireGameScope(env)).toThrow(GameScopeNotConfiguredError);
    expect(() => parseListParams({}, env, { strict: true })).toThrow(GameScopeNotConfiguredError);
    expect(() => parseSearchParams({ q: "x" }, env, { strict: true, requireQuery: true })).toThrow(GameScopeNotConfiguredError);
  });

  it("mock 파라미터 해석은 그대로 동작한다", () => {
    const parsed = parseListParams({}, "mock", { strict: true });
    expect(parsed.scope).toEqual({ dataEnvironment: "mock", gameMode: requireGameScope("mock").defaultGameMode });
    expect(() => parseListParams({ class: "zzz" }, "mock", { strict: true })).toThrow(InvalidQueryError);
  });
});

describe("API: 설정 미완료는 500이 아니다", () => {
  it.each(["beta", "live"] as const)("%s: 200 + 빈 목록 + 준비 중 상태 + 한국어 안내", async (env) => {
    const res = handleApiError(new GameScopeNotConfiguredError(env));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; meta: Record<string, unknown> };
    expect(body.data).toEqual([]);
    expect(body.meta).toMatchObject({
      dataEnvironment: env,
      isMockData: false,
      status: "unavailable",
      unavailableReason: "GAME_SCOPE_NOT_CONFIGURED",
      notice: ko.api.GAME_SCOPE_NOT_CONFIGURED,
    });
  });

  it("다른 오류는 구분해서 응답한다: 잘못된 요청 400, DB 식별 불일치 503, 그 밖 500", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(handleApiError(new InvalidQueryError("x")).status).toBe(400);
    expect(handleApiError(new DatabaseIdentityError("x")).status).toBe(503);
    expect(handleApiError(new Error("connection refused")).status).toBe(500);
    spy.mockRestore();
  });
});

describe("화면: 설정 미완료 시 준비 중 화면 (500 방지)", () => {
  it.each(["beta", "live"] as const)("%s 홈", async (env) => {
    serverState.appEnv = env;
    const { default: HomePage } = await import("@/app/page");
    const out = await html(HomePage());
    expect(out).toContain(ko.common.setupPending.title);
    expect(out).toContain(ko.game.dataEnvironments[env]);
    expect(out).toContain(ko.home.title);
  });

  it.each(["level", "gear", "highest-item"] as const)("beta 랭킹 (%s)", async (type) => {
    const { RankingPageView } = await import("@/components/ranking/ranking-page");
    const out = await html(RankingPageView({ type, searchParams: {} }));
    expect(out).toContain(ko.common.setupPending.title);
    expect(out).toContain(ko.rankings.stageTitles.COMMUNITY[type]);
    // 확인되지 않은 지역·게임 모드 값을 실제 값처럼 표시하지 않는다
    expect(out).not.toContain(ko.game.gameModes.standard!);
  });

  it("live 랭킹과 잘못된 필터가 붙은 요청도 준비 중 화면", async () => {
    serverState.appEnv = "live";
    const { RankingPageView } = await import("@/components/ranking/ranking-page");
    const out = await html(RankingPageView({ type: "level", searchParams: { class: "zzz", gameMode: "x" } }));
    expect(out).toContain(ko.common.setupPending.title);
  });

  it("beta 캐릭터 검색", async () => {
    const { default: CharacterSearchPage } = await import("@/app/characters/page");
    const out = await html(CharacterSearchPage({ searchParams: Promise.resolve({ q: "테스트" }) }));
    expect(out).toContain(ko.common.setupPending.title);
    expect(out).toContain(ko.characters.search.title);
  });
});

describe("파일 선택 UI", () => {
  it("브라우저 기본 파일 입력을 숨기고 한국어 버튼과 안내를 보여 준다", async () => {
    const { SubmitForm } = await import("@/components/submit/submit-form");
    const out = renderToStaticMarkup(
      <SubmitForm
        endpoint="/api/v1/submissions/character"
        csrfToken={null}
        consentVersion="c"
        policyVersion="p"
        maxBytes={256 * 1024}
        limits={{ maxDepth: 12, maxStringLength: 2048, maxNodes: 20000 }}
        slotProfile={null}
        submitEnabled={false}
        verifyOnly
        allowMockFixture={false}
        collectorVersion="1.0.0"
        exportSchemaVersion={1}
        supportedExportSchemaVersions={[1]}
      />,
    );
    expect(out).toContain(`>${ko.submit.file.choose}<`);
    expect(out).toContain(ko.submit.file.none);
    expect(out).toContain("지원 형식: .json / .lua");
    expect(out).toMatch(/<input[^>]*type="file"[^>]*class="hidden"/);
    expect(out).not.toContain("Choose File");
  });
});

// ---------------------------------------------------------------------------
// 한국어 UI 검사
// ---------------------------------------------------------------------------

/** 사용자 화면에 영어로 남겨도 되는 단어 (고유명사, 형식·코드 이름) */
const ALLOWED_ENGLISH = new Set([
  "WoW", "Forever", "Rank", "Armory", "Blizzard", "Entertainment", "API", "JSON", "KST", "World", "First",
  "Battle.net", "BattleTag", "GUID", "IP", "KB", "Character", "Export", "Collector", "ForeverRankCollector",
  "SavedVariables", "WTF", "Account", "lua", "json", "frc", "export", "reload",
  // Phase 4A: Collector 배포·설치 안내 (형식 이름, 게임 폴더 이름, 애드온 명령)
  "Lua", "ZIP", "zip", "SHA", "exe", "Interface", "AddOns", "status", "clear",
]);

function englishWords(text: string): string[] {
  const withoutPlaceholders = text.replace(/\{\w+\}/g, "");
  return withoutPlaceholders
    .split(/[\s()[\]·:,/"'.\\]+(?=[^A-Za-z]|$)|[\s()[\]·:,/"'\\]+/)
    .flatMap((token) => token.match(/[A-Za-z][A-Za-z.]*[A-Za-z]|[A-Za-z]{2,}/g) ?? [])
    .flatMap((w) => (ALLOWED_ENGLISH.has(w) ? [] : w.split(".").filter((p) => p.length >= 2 && !ALLOWED_ENGLISH.has(p))));
}

function walk(value: unknown, path: string, out: { path: string; words: string[] }[]) {
  if (typeof value === "string") {
    const words = englishWords(value);
    if (words.length > 0) out.push({ path, words });
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`, out);
  }
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx$/.test(name) ? [path] : [];
  });
}

describe("한국어 UI 검사", () => {
  it("검사기는 허용 목록 밖의 영어를 찾고, 고유명사·형식 이름은 통과시킨다", () => {
    expect(englishWords("최고 레벨 Top 10")).toEqual(["Top"]);
    expect(englishWords("장비 coverage")).toEqual(["coverage"]);
    expect(englishWords("WoW 포에버 Armory · KST · JSON · {size}KB")).toEqual([]);
  });

  it("locale 문구에 허용 목록 밖의 영어 단어가 없다", () => {
    const found: { path: string; words: string[] }[] = [];
    walk(ko, "ko", found);
    expect(found).toEqual([]);
  });

  it("화면 코드(JSX)에 영어 문구를 직접 쓰지 않는다", () => {
    const offenders: string[] = [];
    for (const file of [...files("app"), ...files("components")]) {
      const source = readFileSync(file, "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      for (const match of source.matchAll(/>([^<>{}]*[A-Za-z]{2,}[^<>{}]*)</g)) {
        const text = match[1]!.trim();
        if (text && !/[=;()&]|=>/.test(text) && englishWords(text).length > 0) offenders.push(`${file}: ${text}`);
      }
      for (const match of source.matchAll(/\b(?:placeholder|aria-label|title|alt)="([^"]*)"/g)) {
        if (englishWords(match[1]!).length > 0) offenders.push(`${file}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("이번 단계에서 고친 영어 문구가 한국어로 바뀌었다", () => {
    expect(ko.home.cards.level).toBe("최고 레벨 상위 10명");
    expect(ko.submit.preview.coverage).toBe("장비 정보 범위");
    expect(ko.admin.submissions.columns.coverage).toBe("장비 정보 범위");
    expect(ko.submissions.errors.MOCK_ENVIRONMENT).not.toMatch(/dryRun/);
    expect(ko.common.setupPending.title).toBe("데이터 설정 준비 중");
  });
});
