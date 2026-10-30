/**
 * 디자인 확인용 Vercel Preview 배포 (lib/server/design-preview.ts)
 *
 * - VERCEL_ENV = preview이고 APP_DATA_ENVIRONMENT가 없으면 홈(/)은 DB 없이 기능 미리보기를 보여 준다.
 * - 다른 페이지·API는 설정이 없으므로 데이터를 내보내지 않는다.
 * - Production과 로컬 실행은 시작 검사(설정·DB 식별 표식)를 그대로 한다.
 *
 * 서버 컨텍스트를 가짜로 바꾸지 않는다. DB 연결 함수만 "쓰면 실패"하도록 바꿔, 실제 경로에서 DB 접근이 없는지 확인한다.
 */
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { homeDemoFixture } from "@/lib/demo/home-preview-fixture";
import { isDesignPreviewDeployment } from "@/lib/server/design-preview";
import { ko } from "@/locales/ko";

const db = vi.hoisted(() => ({ calls: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/db/client", () => ({
  getDb: () => {
    db.calls += 1;
    // 식별 표식 조회까지 가면 이 오류로 실패한다 (= 검사가 실행되었다는 표시)
    return new Proxy(
      {},
      {
        get() {
          throw new Error("DB_ACCESS_ATTEMPTED");
        },
      },
    );
  },
}));

const PREVIEW = { VERCEL: "1", VERCEL_ENV: "preview" };
const ENV_KEYS = ["VERCEL", "VERCEL_ENV", "APP_DATA_ENVIRONMENT", "DATABASE_URL", "DATABASE_URL_UNPOOLED"] as const;

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
}

const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  db.calls = 0;
  vi.resetModules();
  (globalThis as { __foreverRankVerified?: unknown }).__foreverRankVerified = undefined;
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("디자인 확인 배포 판단", () => {
  it("Vercel Preview + 데이터 영역 설정 없음일 때만 참", () => {
    expect(isDesignPreviewDeployment({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe(true);
    expect(isDesignPreviewDeployment({ VERCEL: "1", VERCEL_ENV: "preview", DATABASE_URL: "postgres://x" })).toBe(true);
    // Production은 설정이 없어도 절대 참이 아니다
    expect(isDesignPreviewDeployment({ VERCEL: "1", VERCEL_ENV: "production" })).toBe(false);
    expect(isDesignPreviewDeployment({ VERCEL: "1", VERCEL_ENV: "production", APP_DATA_ENVIRONMENT: "live" })).toBe(false);
    // Preview라도 데이터 영역을 설정했으면 일반 경로
    expect(isDesignPreviewDeployment({ VERCEL: "1", VERCEL_ENV: "preview", APP_DATA_ENVIRONMENT: "beta" })).toBe(false);
    // 로컬·개발 실행, Vercel 밖
    expect(isDesignPreviewDeployment({})).toBe(false);
    expect(isDesignPreviewDeployment({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isDesignPreviewDeployment({ VERCEL: "1", VERCEL_ENV: "development" })).toBe(false);
  });
});

describe("서버 시작 검사 (instrumentation-node.ts)", () => {
  it("Preview 디자인 확인 배포: 설정·DB 없이 시작하고 DB에 연결하지 않는다", async () => {
    setEnv(PREVIEW);
    await expect(import("@/instrumentation-node")).resolves.toBeDefined();
    expect(db.calls).toBe(0);
  });

  it("회귀: Production은 APP_DATA_ENVIRONMENT가 없으면 시작하지 않는다", async () => {
    setEnv({ VERCEL: "1", VERCEL_ENV: "production" });
    await expect(import("@/instrumentation-node")).rejects.toMatchObject({ name: "ConfigurationError", message: expect.stringContaining("APP_DATA_ENVIRONMENT") });
    expect(db.calls).toBe(0);
  });

  it("회귀: Production과 로컬 실행은 설정이 있으면 DB 식별 표식을 조회한다", async () => {
    for (const env of [
      { VERCEL: "1", VERCEL_ENV: "production", APP_DATA_ENVIRONMENT: "live", DATABASE_URL: "postgres://unused" },
      { APP_DATA_ENVIRONMENT: "live", DATABASE_URL: "postgres://unused" },
      { VERCEL: "1", VERCEL_ENV: "preview", APP_DATA_ENVIRONMENT: "beta", DATABASE_URL: "postgres://unused" },
    ]) {
      vi.resetModules();
      (globalThis as { __foreverRankVerified?: unknown }).__foreverRankVerified = undefined;
      db.calls = 0;
      setEnv(env);
      await expect(import("@/instrumentation-node")).rejects.toThrow("DB_ACCESS_ATTEMPTED");
      expect(db.calls).toBe(1);
    }
  });
});

describe("Preview 디자인 확인 배포의 화면과 API", () => {
  it("홈(/): 머리글·메뉴·바닥글을 포함한 전체 화면에 준비 중 안내와 DEMO 미리보기를 보여 주고 DB를 쓰지 않는다", async () => {
    setEnv(PREVIEW);
    const { default: RootLayout } = await import("@/app/layout");
    const { default: HomePage } = await import("@/app/page");
    const out = renderToStaticMarkup(RootLayout({ children: await HomePage() }));
    expect(db.calls).toBe(0);
    // 전체 화면
    expect(out).toContain("<header");
    expect(out).toContain("<footer");
    expect(out).toContain(ko.common.siteName);
    expect(out).toContain(ko.common.nav.rankings);
    // 데이터 영역을 읽지 못한 배포는 테스트 데이터 안내를 끌 수 없이 표시한다
    expect(out).toContain(ko.common.mockBanner.title);
    // 준비 중 안내 + 연결된 데이터 영역 없음
    expect(out).toContain(ko.common.setupPending.title);
    expect(out).toContain(ko.common.setupPending.noEnvironment);
    // DEMO 미리보기
    expect(out).toContain(ko.home.demo.hero.title);
    expect(out.split(ko.home.demo.notice).length - 1).toBe(3);
    expect(out).toContain(homeDemoFixture.characters[0]!.name);
    expect(out).not.toContain("<form");
  });

  it("검색 엔진에 노출하지 않는다 (설정을 읽지 못한 배포는 테스트 데이터 배포로 본다)", async () => {
    setEnv(PREVIEW);
    const { generateMetadata } = await import("@/app/page");
    expect(generateMetadata().robots).toEqual({ index: false, follow: false });
    const { default: robots } = await import("@/app/robots");
    expect(robots().rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });

  it.each(["level", "gear", "highest-item"])("랭킹 API(%s): 데이터를 내보내지 않고 설정 오류로 응답, DB 미사용", async (type) => {
    setEnv(PREVIEW);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await import("@/app/api/v1/rankings/[type]/route");
    const res = await GET(new NextRequest(`http://localhost/api/v1/rankings/${type}`), { params: Promise.resolve({ type }) });
    const raw = await res.text();
    spy.mockRestore();
    expect(res.status).toBe(503);
    expect(JSON.parse(raw)).toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" } });
    for (const c of homeDemoFixture.characters) expect(raw).not.toContain(c.name);
    expect(db.calls).toBe(0);
  });

  it("캐릭터 검색 API: 데이터를 내보내지 않고 설정 오류로 응답, DB 미사용", async () => {
    setEnv(PREVIEW);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await import("@/app/api/v1/characters/search/route");
    const name = homeDemoFixture.characters[0]!.name;
    const res = await GET(new NextRequest(`http://localhost/api/v1/characters/search?q=${encodeURIComponent(name)}`));
    spy.mockRestore();
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain(name);
    expect(db.calls).toBe(0);
  });

  it("다른 데이터 화면(랭킹)은 미리보기 데이터를 쓰지 않고 오류로 끝난다", async () => {
    setEnv(PREVIEW);
    const { RankingPageView } = await import("@/components/ranking/ranking-page");
    await expect(Promise.resolve().then(() => RankingPageView({ type: "level", searchParams: {} }))).rejects.toMatchObject({ name: "ConfigurationError" });
    expect(db.calls).toBe(0);
  });

  it("웹 직접 등록은 계속 막혀 있다 (기능 꺼짐 → 404, DB 미사용)", async () => {
    setEnv(PREVIEW);
    const { POST } = await import("@/app/api/v1/submissions/manual/route");
    const res = await POST(new NextRequest("http://localhost/api/v1/submissions/manual", { method: "POST", body: "{}" }));
    expect(res.status).toBe(404);
    expect(db.calls).toBe(0);
  });
});
