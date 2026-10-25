/**
 * 웹 직접 등록 차단 (게임 설정·매핑 미확인 / 기능 꺼짐)과 Collector 제출 화면 안내
 *
 * - 화면: 등록을 받지 않으면 입력 양식을 렌더링하지 않는다.
 * - API: 같은 조건을 검사하고, 조건이 안 되면 DB에 연결하지 않는다.
 * - 환경변수는 테스트 프로세스 안에서만 가짜 값으로 바꾼다. 실제 비밀값을 쓰지 않는다.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submissionPolicy } from "@/config/submissions";
import type { DataEnvironment } from "@/lib/domain/enums";
import { issueCsrfToken } from "@/lib/submissions/security";
import { ko } from "@/locales/ko";

const state: { appEnv: DataEnvironment; forceOpen: boolean; serverContextCalls: number } = {
  appEnv: "live",
  forceOpen: false,
  serverContextCalls: 0,
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/context", () => ({
  getAppEnvironmentSafe: () => state.appEnv,
  getServerContext: async () => {
    state.serverContextCalls += 1;
    throw new Error("DB에 연결하면 안 됩니다");
  },
}));
// "설정이 갖춰진 경우" 화면을 확인할 때만 실제 판단 결과를 덮어쓴다 (실제 설정값은 바꾸지 않음)
vi.mock("@/lib/submissions/availability", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/submissions/availability")>();
  return {
    ...actual,
    currentManualRegistrationStatus: (appEnv: DataEnvironment | null) => {
      const real = actual.currentManualRegistrationStatus(appEnv);
      return state.forceOpen
        ? { ...real, ready: true, gaps: [], regions: ["kr"], rulesets: ["normal"], open: real.featureEnabled }
        : real;
    },
  };
});

const SECRET = "t".repeat(40);
const ORIGIN = "http://localhost:3000";
const ENV_KEYS = ["FEATURE_PUBLIC_SUBMISSIONS", "SUBMISSION_SECRET", "SITE_URL", "APP_DATA_ENVIRONMENT"] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function setFeature(on: boolean, secret: string | null = SECRET) {
  if (on) process.env.FEATURE_PUBLIC_SUBMISSIONS = "on";
  else delete process.env.FEATURE_PUBLIC_SUBMISSIONS;
  if (secret) process.env.SUBMISSION_SECRET = secret;
  else delete process.env.SUBMISSION_SECRET;
}

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  process.env.SITE_URL = ORIGIN;
  process.env.APP_DATA_ENVIRONMENT = "live";
  state.appEnv = "live";
  state.forceOpen = false;
  state.serverContextCalls = 0;
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

async function renderRegister() {
  const Page = (await import("@/app/contribute/register/page")).default;
  return renderToStaticMarkup(<Page />);
}
async function renderSubmit() {
  const Page = (await import("@/app/submit/page")).default;
  return renderToStaticMarkup(<Page />);
}
async function renderContribute() {
  const Page = (await import("@/app/contribute/page")).default;
  return renderToStaticMarkup(<Page />);
}
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

const r = ko.register;
const REQUIRED_NOTICE =
  "현재는 게임의 공식 설정과 매핑이 확인되지 않아 캐릭터 등록을 받고 있지 않습니다. 설정이 확인되기 전에는 등록 자료가 랭킹에 반영되지 않습니다. 등록 재개 시점은 정해지지 않았습니다.";

describe("등록 화면 차단", () => {
  it("안내 문구는 요청된 문장과 정확히 같다 (화면·API 오류 메시지 모두)", () => {
    expect(r.closed.setupMissing).toBe(REQUIRED_NOTICE);
    expect(ko.submissions.errors.REGISTRATION_UNAVAILABLE).toBe(REQUIRED_NOTICE);
  });

  it.each([
    ["기능 꺼짐", false, SECRET],
    ["기능 켜짐 + 비밀값 없음", true, null],
    ["기능 켜짐 + live 설정 미완성", true, SECRET],
  ] as const)("%s: 입력 양식을 렌더링하지 않고 안내만 표시한다", async (_label, on, secret) => {
    setFeature(on, secret);
    const html = decode(await renderRegister());
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<select");
    expect(html).not.toContain(r.actions.submit);
    expect(html).toContain(r.closed.title);
    // 실제 설정은 비어 있으므로 기능 설정과 관계없이 "설정 미확인" 이유를 보여 준다
    expect(html).toContain(REQUIRED_NOTICE);
    expect(html).toContain(r.closed.later);
    expect(html).toContain('href="/contribute"');
    // 실제 동작과 맞지 않는 "관리자 검토 후 반영" 표현이 없다
    expect(html).not.toContain("검토 후 반영");
    expect(html).not.toContain(r.scope.reviewValue);
  });

  it("설정이 갖춰졌지만 기능이 꺼져 있으면 기능이 열려 있지 않다고 안내한다 (양식 없음)", async () => {
    setFeature(false);
    state.forceOpen = true;
    const html = decode(await renderRegister());
    expect(html).not.toContain("<form");
    expect(html).toContain(r.closed.featureOff);
    expect(html).not.toContain(REQUIRED_NOTICE);
  });

  it("설정이 갖춰지고 기능이 켜졌을 때만 양식을 보여 주며, 확인된 지역·규칙만 선택지로 쓴다", async () => {
    setFeature(true);
    state.forceOpen = true;
    const html = decode(await renderRegister());
    expect(html).toContain("<form");
    expect(html).toContain(`>${r.regions.kr}</option>`);
    expect(html).not.toContain(`>${r.regions.us}</option>`);
    expect(html).toContain(`>${ko.game.rulesets.normal}</option>`);
    expect(html).not.toContain(`>${ko.game.rulesets.pvp}</option>`);
    expect(html).not.toContain(r.closed.title);
  });
});

describe("등록 API 직접 호출 차단", () => {
  async function post(body: unknown, query = "") {
    const { POST } = await import("@/app/api/v1/submissions/manual/route");
    return POST(
      new Request(`${ORIGIN}/api/v1/submissions/manual${query}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN, "x-forever-rank-csrf": issueCsrfToken(SECRET, new Date()) },
        body: JSON.stringify(body),
      }),
    );
  }
  const body = { registration: { schema: "forever-rank/manual-character" }, consent: {} };

  it("기능이 꺼져 있으면 404, DB에 연결하지 않는다", async () => {
    setFeature(false);
    expect((await post(body)).status).toBe(404);
    expect(state.serverContextCalls).toBe(0);
  });

  it("기능이 켜져 있어도 live 설정이 없으면 503, 저장·검증 모두 거부하고 DB에 연결하지 않는다", async () => {
    setFeature(true);
    for (const query of ["", "?dryRun=true"]) {
      const res = await post(body, query);
      const json = (await res.json()) as { error: { code: string; message: string; reasons: string[] } };
      expect(res.status).toBe(503);
      expect(json.error.code).toBe("REGISTRATION_UNAVAILABLE");
      expect(json.error.message).toBe(REQUIRED_NOTICE);
      expect(json.error.reasons).toEqual(
        expect.arrayContaining(["GAME_SCOPE_MISSING", "NAME_SEPARATOR_UNCONFIRMED", "REGION_MAPPING_MISSING", "RULESET_MAPPING_MISSING", "CLASS_MAPPING_MISSING"]),
      );
    }
    expect(state.serverContextCalls).toBe(0);
  });

  it("CSRF·Origin 검사는 차단 판단보다 먼저 적용된다", async () => {
    setFeature(true);
    const { POST } = await import("@/app/api/v1/submissions/manual/route");
    const res = await POST(
      new Request(`${ORIGIN}/api/v1/submissions/manual`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.test.invalid" },
        body: JSON.stringify(body),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("관련 화면 안내와 Collector 제출 영향", () => {
  it("/contribute: 직접 등록 링크를 보여 주지 않고, 랭킹 미반영 사실을 안내한다", async () => {
    setFeature(true);
    const html = decode(await renderContribute());
    expect(html).not.toContain('href="/contribute/register"');
    expect(html).not.toContain(r.entry.title);
    expect(html).toContain(ko.contribute.rankingBasis.detailNotReady);
    expect(html).not.toContain(ko.contribute.rankingBasis.detail);
  });

  it("/submit: Collector 파일 선택과 미리보기는 그대로 있고, 현재 랭킹 미반영 안내를 표시한다", async () => {
    setFeature(true);
    const html = decode(await renderSubmit());
    expect(html).toContain('type="file"');
    expect(html).toContain(ko.submit.file.choose);
    expect(html).toContain(ko.submit.rankingNotReady.title);
    expect(html).toContain(ko.submit.rankingNotReady.body);
    expect(html).not.toContain(ko.submit.rankingReady);
    expect(html).not.toContain('href="/contribute/register"');
  });

  it("동의 문구와 버전은 바뀌지 않았다 (Collector·직접 등록 공통)", () => {
    expect(submissionPolicy.consentVersion).toBe("consent-2026-10-07");
    expect(submissionPolicy.policyVersion).toBe("privacy-2026-10-07");
    expect(ko.submit.consent.dataUsage).toBe("내가 제출한 캐릭터 데이터가 랭킹과 서비스 품질 개선을 위해 사용되는 것에 동의합니다.");
    expect(ko.submit.consent.noPersonalData).toBe("개인정보가 포함된 파일을 제출하지 않았음을 확인합니다.");
  });
});
