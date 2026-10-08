/**
 * Phase 4A: Contributor 흐름 (랭킹 등록 안내, Collector 다운로드, 설치·사용 안내, 제출 연결, 버전 관리)
 *
 * - 실제 게임 데이터 없이 동작해야 한다. 예시 파일은 테스트 fixture(가짜 데이터)다.
 * - 화면 테스트는 서버 컨텍스트를 가짜로 바꿔 렌더링한다.
 */
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { collectorRelease } from "@/config/collector";
import { submissionPolicy } from "@/config/submissions";
import type { AppDatabase } from "@/db/types";
import { buildCollectorPackage, parseToc, sha256Hex } from "@/lib/collector/package";
import { collectorManifest } from "@/lib/collector/manifest";
import { buildTestExport } from "@/lib/collector/test-export";
import { crc32, createStoredZip, readStoredZip } from "@/lib/collector/zip";
import { loadConfig, type ExportMapping } from "@/lib/config";
import type { DataEnvironment } from "@/lib/domain/enums";
import { characterExportV1Schema } from "@/lib/submissions/export-schema";
import { checkExportSchemaVersion } from "@/lib/submissions/export-version";
import { handleCharacterSubmission, type SubmissionHttpDeps } from "@/lib/submissions/http";
import { processMockCharacterExport } from "@/lib/submissions/mock-export";
import { buildExportPreview } from "@/lib/submissions/preview";
import { FixedWindowRateLimiter } from "@/lib/submissions/rate-limit";
import { issueCsrfToken } from "@/lib/submissions/security";
import { isMockFixtureExport, submitCharacterExport } from "@/lib/submissions/submit";
import { ko } from "@/locales/ko";
import { createTestDb } from "./helpers/db";

// ---------------------------------------------------------------------------
// 가짜 서버 컨텍스트
// ---------------------------------------------------------------------------

const state: { appEnv: DataEnvironment; db: AppDatabase | null; downloadAvailable: boolean } = {
  appEnv: "mock",
  db: null,
  downloadAvailable: true,
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/context", () => ({
  getServerContext: async () => ({ appEnv: state.appEnv, now: new Date("2026-10-08T06:00:00Z"), cache: null, db: state.db }),
  getAppEnvironmentSafe: () => state.appEnv,
}));
vi.mock("@/lib/collector/availability", () => ({ isCollectorDownloadAvailable: () => state.downloadAvailable }));
vi.mock("@/lib/admin/session", () => ({ isAdminAuthenticated: async () => true }));
vi.mock("@/app/admin/actions", () => ({ acceptAction: async () => {}, rejectAction: async () => {}, logoutAction: async () => {} }));
vi.mock("@/lib/config/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/config/env")>();
  return {
    ...original,
    getAdminSettings: () => ({ enabled: true, adminToken: "a".repeat(40), secret: "s".repeat(40) }),
    getPublicSubmissionSettings: () => ({ enabled: true, secret: "s".repeat(40) }),
  };
});

afterEach(() => {
  state.appEnv = "mock";
  state.downloadAvailable = true;
});

const html = async (node: Promise<React.ReactNode> | React.ReactNode) => renderToStaticMarkup(await node);
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

const MOCK_DIR = "tests/fixtures/character-export/mock";
const loadFixture = (id: string) =>
  JSON.parse(readFileSync(join(MOCK_DIR, `${id}.json`), "utf8")) as { fixture: Record<string, string>; export: Record<string, unknown> };
const mockFixtureIds = readdirSync(MOCK_DIR)
  .filter((f) => /^\d{2}-.+\.json$/.test(f))
  .map((f) => f.replace(/\.json$/, ""));

const NOW = new Date("2026-10-08T06:00:00Z");
const forever = loadConfig().gearProfiles.find((p) => p.id === "forever-draft")!;
const { _comment, ...mappingJson } = JSON.parse(readFileSync(join(MOCK_DIR, "mapping.json"), "utf8")) as Record<string, unknown>;
void _comment;
const MOCK_MAPPING = mappingJson as unknown as ExportMapping;

const ADDON_DIR = "addon/ForeverRankCollector";
const addonFile = (name: string) => readFileSync(join(ADDON_DIR, name), "utf8");

const CONTRIBUTE_LINKS = ["/contribute/download", "/contribute/install", "/contribute/how-to-use", "/submit"];

// ---------------------------------------------------------------------------
// 1. Contributor 화면
// ---------------------------------------------------------------------------

describe("랭킹 등록 안내 (/contribute)", () => {
  it("제목·설명·5단계·현재 랭킹 기준을 한국어로 보여 준다", async () => {
    const { default: Page } = await import("@/app/contribute/page");
    const out = text(await html(<Page />));
    expect(out).toContain("내 캐릭터 랭킹 등록");
    expect(out).toContain("Forever Rank에 내 캐릭터 데이터를 제출할 수 있습니다.");
    const steps = ["Collector 다운로드", "WoW: Forever에서 Collector 실행", "캐릭터 데이터 Export 생성", "Forever Rank에 파일 제출", "검증 및 검토 후 랭킹 반영"];
    let last = -1;
    for (const step of steps) {
      const at = out.indexOf(step, last + 1);
      expect(at, step).toBeGreaterThan(last);
      last = at;
    }
    expect(out).toContain("Forever Rank가 확인한 캐릭터 기준");
    // 사용자 제출만으로 전체 서버 표현을 쓰지 않는다.
    expect(out).not.toContain("전체 서버");
  });

  it("다음 단계 버튼 4개(다운로드·설치·사용·제출)로 이어진다", async () => {
    const { default: Page } = await import("@/app/contribute/page");
    const markup = await html(<Page />);
    for (const href of CONTRIBUTE_LINKS) expect(markup).toContain(`href="${href}"`);
    for (const label of ["Collector 다운로드", "설치 방법", "사용 방법", "캐릭터 데이터 제출"]) expect(text(markup)).toContain(label);
  });

  it("어려운 용어에 짧은 설명을 붙인다", () => {
    const terms = ko.contribute.overview.glossary.map((g) => g.term);
    expect(terms).toEqual(expect.arrayContaining(["애드온", "Export 파일", "SavedVariables", "/reload", "게임 규칙", "GUID"]));
    for (const g of ko.contribute.overview.glossary) expect(g.description.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// 2. 다운로드 화면
// ---------------------------------------------------------------------------

describe("Collector 다운로드 (/contribute/download)", () => {
  it("버전·Export 형식 버전·지원 클라이언트·파일 크기·SHA-256을 manifest 값으로 보여 준다", async () => {
    const { default: Page } = await import("@/app/contribute/download/page");
    const markup = await html(<Page />);
    const out = text(markup);
    expect(out).toContain("Forever Rank Collector");
    expect(out).toContain(`Collector 버전 ${collectorManifest.version}`);
    expect(out).toContain(`Export 형식 버전 ${collectorManifest.exportSchemaVersion}`);
    expect(out).toContain("지원 클라이언트 WoW: Forever");
    expect(out).toContain(`${collectorManifest.size.toLocaleString("ko-KR")}바이트`);
    expect(markup).toContain(collectorManifest.sha256);
    expect(out).toContain("SHA-256");
    expect(markup).toContain(`href="${collectorRelease.downloadPath}"`);
    expect(markup).toContain(`download="${collectorRelease.zipFileName}"`);
  });

  it("애드온 파일이라는 점, 수집 범위·수집하지 않는 정보·네트워크 통신·직접 업로드를 안내한다", async () => {
    const { default: Page } = await import("@/app/contribute/download/page");
    const out = text(await html(<Page />));
    expect(out).toContain("이 파일은 WoW: Forever 애드온입니다.");
    expect(out).toContain("실행 파일(.exe)은 없습니다");
    expect(out).toContain("캐릭터 본인 정보");
    for (const item of ["Battle.net 비밀번호", "계정 비밀번호", "인증 정보", "결제 정보", "불필요한 개인정보"]) expect(out).toContain(item);
    expect(out).toContain("Collector 자체는 외부 서버로 게임 데이터를 직접 전송하지 않습니다.");
    expect(out).toContain("사용자가 생성한 파일을 직접 업로드합니다.");
    for (const file of collectorRelease.files) expect(out).toContain(`ForeverRankCollector/${file}`);
  });

  it("다운로드 파일이 아직 없으면 버튼 대신 준비 중 안내를 보여 준다", async () => {
    state.downloadAvailable = false;
    const { default: Page } = await import("@/app/contribute/download/page");
    const markup = await html(<Page />);
    expect(markup).not.toContain(`href="${collectorRelease.downloadPath}"`);
    expect(text(markup)).toContain(ko.contribute.download.unavailable);
  });
});

// ---------------------------------------------------------------------------
// 3. ZIP 생성
// ---------------------------------------------------------------------------

describe("Collector ZIP 생성", () => {
  const built = buildCollectorPackage(process.cwd());

  it("ZIP 안에는 ForeverRankCollector 폴더와 지정한 6개 파일만 들어 있다", () => {
    const entries = readStoredZip(built.zip);
    expect(entries.map((e) => e.name)).toEqual([
      "ForeverRankCollector/",
      "ForeverRankCollector/ForeverRankCollector.toc",
      "ForeverRankCollector/Core.lua",
      "ForeverRankCollector/SavedVariables.lua",
      "ForeverRankCollector/Collector.lua",
      "ForeverRankCollector/Export.lua",
      "ForeverRankCollector/README.md",
    ]);
  });

  it("실행 파일 없이 Lua 애드온 파일과 안내 문서만 들어 있다", () => {
    const entries = readStoredZip(built.zip).filter((e) => !e.name.endsWith("/"));
    for (const entry of entries) {
      expect(entry.name).toMatch(/\.(toc|lua|md)$/);
      // 실행 파일 서명(MZ, ELF, #!)이 없다.
      const head = Buffer.from(entry.data.subarray(0, 4)).toString("latin1");
      expect(head.startsWith("MZ") || head.startsWith("\x7fELF") || head.startsWith("#!")).toBe(false);
    }
  });

  it("ZIP 안 파일 내용은 애드온 원본과 같다 (줄바꿈 LF)", () => {
    for (const entry of readStoredZip(built.zip).filter((e) => !e.name.endsWith("/"))) {
      const source = addonFile(entry.name.replace("ForeverRankCollector/", "")).replace(/\r\n?/g, "\n");
      expect(new TextDecoder().decode(entry.data)).toBe(source);
      expect(new TextDecoder().decode(entry.data)).not.toContain("\r");
    }
  });

  it("같은 원본이면 항상 같은 ZIP이 나온다 (SHA-256 고정)", () => {
    const again = buildCollectorPackage(process.cwd());
    expect(sha256Hex(again.zip)).toBe(sha256Hex(built.zip));
    expect(Buffer.compare(Buffer.from(again.zip), Buffer.from(built.zip))).toBe(0);
  });

  it("ZIP 쓰기·읽기: CRC가 맞고, 잘못된 이름과 손상된 데이터를 거부한다", () => {
    const zip = createStoredZip([{ name: "a/b.lua", data: new TextEncoder().encode("print(1)\n") }], "2026-10-08");
    const [entry] = readStoredZip(zip);
    expect(entry!.crc32).toBe(crc32(new TextEncoder().encode("print(1)\n")));
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(() => createStoredZip([{ name: "../evil.lua", data: new Uint8Array() }], "2026-10-08")).toThrow();
    expect(() => createStoredZip([{ name: "/abs.lua", data: new Uint8Array() }], "2026-10-08")).toThrow();
    const broken = zip.slice();
    broken[30 + "a/b.lua".length] = broken[30 + "a/b.lua".length]! ^ 0xff;
    expect(() => readStoredZip(broken)).toThrow(/CRC/);
  });

  it("원본 폴더에 설정 밖의 파일(예: .exe)이 있으면 ZIP을 만들지 않는다", () => {
    const root = mkdtempSync(join(tmpdir(), "frc-"));
    try {
      cpSync(ADDON_DIR, join(root, ADDON_DIR), { recursive: true });
      writeFileSync(join(root, ADDON_DIR, "Installer.exe"), "MZ");
      expect(() => buildCollectorPackage(root)).toThrow(/설정과 다릅니다/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("허용하지 않는 확장자를 설정에 넣어도 ZIP을 만들지 않는다", () => {
    const root = mkdtempSync(join(tmpdir(), "frc-"));
    try {
      cpSync(ADDON_DIR, join(root, ADDON_DIR), { recursive: true });
      writeFileSync(join(root, ADDON_DIR, "Tool.exe"), "MZ");
      const release = { ...collectorRelease, files: [...collectorRelease.files, "Tool.exe"] };
      expect(() => buildCollectorPackage(root, release)).toThrow(/넣을 수 없는 파일 형식/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 4. 버전 일치와 checksum
// ---------------------------------------------------------------------------

describe("버전 일치", () => {
  const toc = parseToc(addonFile("ForeverRankCollector.toc"));
  const core = addonFile("Core.lua");

  it("Collector 버전: 설정 = TOC = Core.lua = README = manifest = 문서", () => {
    const version = collectorRelease.version;
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(toc.fields.Version).toBe(version);
    expect(core).toContain(`ns.VERSION = "${version}"`);
    expect(addonFile("README.md")).toContain(`버전: ${version}`);
    expect(collectorManifest.version).toBe(version);
    expect(readFileSync("docs/CONTRIBUTOR-GUIDE.md", "utf8")).toContain(`Collector 버전 | \`${version}\``);
  });

  it("Export 형식 버전: 설정 = Core.lua = 서버 스키마 = JSON Schema = 문서. Collector 버전과는 다른 값이다", () => {
    const schemaVersion = collectorRelease.exportSchemaVersion;
    expect(core).toContain(`ns.EXPORT_SCHEMA_VERSION = ${schemaVersion}`);
    expect(core).toContain(`ns.EXPORT_SCHEMA = "${collectorRelease.exportSchema}"`);
    expect(collectorRelease.supportedExportSchemaVersions).toContain(schemaVersion);
    const jsonSchema = JSON.parse(readFileSync("docs/schemas/character-export-v1.schema.json", "utf8")) as {
      properties: { schemaVersion: { const: number }; schema: { const: string } };
    };
    expect(jsonSchema.properties.schemaVersion.const).toBe(schemaVersion);
    expect(jsonSchema.properties.schema.const).toBe(collectorRelease.exportSchema);
    expect(characterExportV1Schema.shape.schemaVersion.value).toBe(schemaVersion);
    expect(readFileSync("docs/CONTRIBUTOR-GUIDE.md", "utf8")).toContain(`Export 형식 버전 | \`${schemaVersion}\``);
    expect(String(schemaVersion)).not.toBe(collectorRelease.version);
  });

  it("TOC가 불러오는 Lua 파일은 ZIP의 Lua 파일과 같다", () => {
    expect(toc.files).toEqual(collectorRelease.files.filter((f) => f.endsWith(".lua")));
  });

  it("저장된 manifest(lib/collector/release-manifest.json)는 애드온 원본으로 새로 만든 값과 같다", () => {
    const { manifest, zip } = buildCollectorPackage(process.cwd());
    expect(collectorManifest).toEqual(manifest);
    expect(collectorManifest.size).toBe(zip.length);
    expect(collectorManifest.sha256).toBe(sha256Hex(zip));
    expect(collectorManifest.sha256).toMatch(/^[0-9a-f]{64}$/);
    for (const file of collectorManifest.files) {
      const source = new TextEncoder().encode(addonFile(file.path.replace("ForeverRankCollector/", "")).replace(/\r\n?/g, "\n"));
      expect(file.sha256).toBe(sha256Hex(source));
      expect(file.size).toBe(source.length);
    }
  });

  it("버전이 어긋나면 ZIP을 만들지 않는다", () => {
    expect(() => buildCollectorPackage(process.cwd(), { ...collectorRelease, version: "9.9.9" })).toThrow(/버전/);
    expect(() => buildCollectorPackage(process.cwd(), { ...collectorRelease, exportSchemaVersion: 2 })).toThrow(/EXPORT_SCHEMA_VERSION/);
  });

  it("다운로드 경로는 정적 파일 경로이고 생성 파일은 저장소에 넣지 않는다", () => {
    expect(collectorRelease.downloadPath).toBe(`/downloads/${collectorRelease.zipFileName}`);
    expect(readFileSync(".gitignore", "utf8")).toContain("/public/downloads/");
    expect(readFileSync(".gitattributes", "utf8")).toMatch(/addon\/\*\* text eol=lf/);
    const scripts = (JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }).scripts;
    expect(scripts.prebuild).toContain("build-collector");
    expect(scripts.predev).toContain("build-collector");
  });
});

// ---------------------------------------------------------------------------
// 5. 설치·사용 안내
// ---------------------------------------------------------------------------

describe("설치 안내 (/contribute/install)", () => {
  it("10단계를 순서대로 안내한다", async () => {
    const { default: Page } = await import("@/app/contribute/install/page");
    const out = text(await html(<Page />));
    const titles = [
      "ZIP 다운로드",
      "압축 해제",
      "WoW Forever AddOns 폴더 열기",
      "ForeverRankCollector 폴더 복사",
      "게임 실행",
      "애드온 활성화",
      "캐릭터 접속",
      "Export 명령 실행",
      "생성된 파일 확인",
      "사이트에서 업로드",
    ];
    expect(ko.contribute.install.steps.map((s) => s.title)).toEqual(titles);
    let last = -1;
    for (const title of titles) {
      const at = out.indexOf(title, last + 1);
      expect(at, title).toBeGreaterThan(last);
      last = at;
    }
  });

  it("경로는 예시이며 설치 방식에 맞게 바꾸라고 안내하고, 특정 클라이언트 폴더 이름을 고정하지 않는다", async () => {
    const { default: Page } = await import("@/app/contribute/install/page");
    const out = text(await html(<Page />));
    expect(out).toContain("사용자의 설치 방식에 맞게 바꿔서");
    expect(out).toContain("(WoW: Forever 클라이언트 폴더)\\Interface\\AddOns\\ForeverRankCollector");
    const sources = [
      JSON.stringify(ko.contribute),
      JSON.stringify(ko.submit),
      readFileSync("app/contribute/install/page.tsx", "utf8"),
      readFileSync("app/contribute/how-to-use/page.tsx", "utf8"),
      addonFile("README.md"),
    ].join("\n");
    for (const folder of ["_classic_beta_", "_classic_era_", "_retail_", "_classic_", "C:\\\\Program Files", "C:\\Program Files"]) {
      expect(sources).not.toContain(folder);
    }
  });

  it("실제 게임 실행이 필요한 단계에 '실제 게임에서 확인 필요'를 표시한다", async () => {
    const { default: Page } = await import("@/app/contribute/install/page");
    const out = text(await html(<Page />));
    const runtimeSteps = ko.contribute.install.steps.filter((s) => s.runtime).map((s) => s.title);
    expect(runtimeSteps).toEqual(expect.arrayContaining(["애드온 활성화", "Export 명령 실행", "생성된 파일 확인"]));
    expect(out.split("실제 게임에서 확인 필요").length - 1).toBeGreaterThanOrEqual(runtimeSteps.length);
  });
});

describe("사용 방법 (/contribute/how-to-use)", () => {
  /** Core.lua의 슬래시 명령 처리에 실제로 있는 하위 명령 */
  const subcommands = [...addonFile("Core.lua").matchAll(/command == "(\w+)"/g)].map((m) => m[1]);

  it("안내하는 명령어는 Collector에 실제로 있는 명령어뿐이다 (새 명령어를 만들지 않음)", () => {
    expect(addonFile("Core.lua")).toContain('SLASH_FOREVERRANKCOLLECTOR1 = "/frc"');
    const documented = ko.contribute.howToUse.commands.map((c) => c.command);
    expect(documented).toEqual(["/frc", ...subcommands.map((s) => `/frc ${s}`)]);
    expect(documented).toContain("/frc export");
    // 다른 안내 문구에도 Collector에 없는 /frc 명령어가 없다.
    const all = JSON.stringify([ko.contribute, ko.submit]);
    for (const match of all.matchAll(/\/frc(?: (\w+))?/g)) {
      if (match[1]) expect(subcommands).toContain(match[1]);
    }
  });

  it("Export 파일 위치·파일 이름 규칙과 실제 게임 확인 필요 표시를 보여 준다", async () => {
    const { default: Page } = await import("@/app/contribute/how-to-use/page");
    const out = text(await html(<Page />));
    expect(out).toContain("/frc export");
    expect(out).toContain("\\WTF\\Account\\(계정 폴더)\\SavedVariables\\ForeverRankCollector.lua");
    expect(out).toContain("항상 ForeverRankCollector.lua");
    expect(out).toContain("실제 게임에서 확인 필요");
    expect(out).toContain(`Collector ${collectorRelease.version}, Export 형식 ${collectorRelease.exportSchemaVersion}`);
  });

  it("테스트용 예시 파일은 테스트 데이터 배포(mock)에서만 보여 준다", async () => {
    const { default: Page } = await import("@/app/contribute/how-to-use/page");
    state.appEnv = "mock";
    expect(await html(<Page />)).toContain('href="/contribute/test-export"');
    for (const env of ["beta", "live"] as const) {
      state.appEnv = env;
      expect(await html(<Page />)).not.toContain("/contribute/test-export");
    }
  });
});

// ---------------------------------------------------------------------------
// 6. 제출 화면 연결과 제출 전 확인
// ---------------------------------------------------------------------------

describe("제출 화면 연결 (/submit)", () => {
  it("모든 안내 화면에 [Collector 다운로드] [설치 방법] [사용 방법] [캐릭터 데이터 제출] 버튼이 있다", async () => {
    const pages = [
      (await import("@/app/contribute/page")).default,
      (await import("@/app/contribute/download/page")).default,
      (await import("@/app/contribute/install/page")).default,
      (await import("@/app/contribute/how-to-use/page")).default,
      (await import("@/app/submit/page")).default,
    ];
    for (const Page of pages) {
      const markup = await html(<Page />);
      const nav = /<nav aria-label="랭킹 등록 안내"[^>]*>([\s\S]*?)<\/nav>/.exec(markup)?.[1] ?? "";
      expect(nav, Page.name).not.toBe("");
      for (const href of CONTRIBUTE_LINKS) expect(nav).toContain(`href="${href}"`);
      expect(text(nav)).toMatch(/Collector 다운로드.*설치 방법.*사용 방법.*캐릭터 데이터 제출/);
    }
  });

  it("안내 화면은 다운로드 → 설치 → 사용 → 제출 순서로 다음 단계를 연결한다", async () => {
    const chain: [string, string][] = [
      ["@/app/contribute/page", "/contribute/download"],
      ["@/app/contribute/download/page", "/contribute/install"],
      ["@/app/contribute/install/page", "/contribute/how-to-use"],
      ["@/app/contribute/how-to-use/page", "/submit"],
    ];
    for (const [path, next] of chain) {
      const { default: Page } = (await import(/* @vite-ignore */ path)) as { default: () => React.ReactNode };
      const markup = await html(<Page />);
      const lastLink = [...markup.matchAll(/<a\b[^>]*>/g)]
        .map((m) => m[0])
        .filter((tag) => / bg-accent /.test(` ${/class="([^"]*)"/.exec(tag)?.[1] ?? ""} `))
        .map((tag) => /href="([^"]+)"/.exec(tag)?.[1])
        .pop();
      expect(lastLink, path).toBe(next);
    }
  });

  it("파일 선택 전에 '제출 전에 확인하세요' 영역을 보여 준다", async () => {
    const { default: Page } = await import("@/app/submit/page");
    const markup = await html(<Page />);
    const out = text(markup);
    const before = markup.indexOf("제출 전에 확인하세요");
    const fileInput = markup.indexOf('type="file"');
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(fileInput);
    for (const phrase of ["본인 캐릭터 데이터만 제출", "계정 정보", "비밀번호를 제출하지 마세요", "개인정보", "커뮤니티 랭킹", "삭제 요청"]) {
      expect(out).toContain(phrase);
    }
    expect(markup).toContain('href="/contribute"');
  });

  it("홈·머리글·바닥글·준비 중 화면에서 랭킹 등록 안내로 갈 수 있다", async () => {
    const { SiteFooter } = await import("@/components/layout/site-footer");
    expect(await html(<SiteFooter />)).toContain('href="/contribute"');
    const header = readFileSync("components/layout/site-header.tsx", "utf8");
    expect(header).toContain("routes.contribute()");
    const { SetupPending } = await import("@/components/setup-pending");
    expect(await html(<SetupPending dataEnvironment="beta" />)).toContain('href="/contribute"');
    state.appEnv = "beta";
    const { default: Home } = await import("@/app/page");
    const home = await html(Home());
    expect(home).toContain('href="/contribute"');
    expect(text(home)).toContain(ko.home.contributeCta.button);
  });
});

// ---------------------------------------------------------------------------
// 7. Export 형식 버전 확인
// ---------------------------------------------------------------------------

describe("Export 형식 버전", () => {
  const valid = loadFixture("01-valid-character").export;
  const real = (overrides: Record<string, unknown>) => ({
    ...JSON.parse(readFileSync("tests/fixtures/character-export/valid.json", "utf8")),
    ...overrides,
  });

  it("지원하는 형식은 통과, 오래된 형식은 OUTDATED, 새 형식은 TOO_NEW", () => {
    expect(checkExportSchemaVersion(valid)).toEqual({ ok: true });
    expect(checkExportSchemaVersion({ ...valid, schemaVersion: 0 })).toMatchObject({ ok: false, reason: "OUTDATED", version: 0 });
    expect(checkExportSchemaVersion({ ...valid, schemaVersion: 2 })).toMatchObject({ ok: false, reason: "TOO_NEW", version: 2 });
    expect(checkExportSchemaVersion({ ...valid, schemaVersion: 1 }, [2, 3])).toMatchObject({ ok: false, reason: "OUTDATED" });
    // Forever Rank Export가 아니거나 버전이 숫자가 아니면 형식 검증에 맡긴다.
    expect(checkExportSchemaVersion({ schema: "other", schemaVersion: 0 })).toEqual({ ok: true });
    expect(checkExportSchemaVersion({ ...valid, schemaVersion: "1" })).toEqual({ ok: true });
    expect(checkExportSchemaVersion(null)).toEqual({ ok: true });
  });

  it("Collector 버전이 달라도 같은 Export 형식이면 받는다 (예전 Collector 0.1.0 파일)", async () => {
    const result = await submitCharacterExport(real({}), {
      targetEnvironment: "beta",
      mapping: TEST_MAPPING,
      slotProfile: forever,
      rankingProfile: null,
      now: new Date("2026-10-07T06:00:00Z"),
      dryRun: true,
      db: null,
    });
    expect(result.ok).toBe(true);
  });

  it("서버는 오래된 Export 형식을 한국어 안내와 함께 거부한다 (400)", async () => {
    for (const [schemaVersion, code] of [
      [0, "EXPORT_SCHEMA_OUTDATED"],
      [2, "EXPORT_SCHEMA_TOO_NEW"],
    ] as const) {
      const result = await submitCharacterExport(real({ schemaVersion }), {
        targetEnvironment: "beta",
        mapping: MOCK_MAPPING,
        slotProfile: forever,
        rankingProfile: null,
        now: NOW,
        dryRun: true,
        db: null,
      });
      expect(result).toMatchObject({ ok: false, stage: "validate", issues: [{ code, path: "schemaVersion" }] });
    }
    const res = await handleCharacterSubmission(publicRequest({ export: real({ schemaVersion: 0 }), consent: CONSENT }, { dryRun: true }), publicDeps());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string; issues: { code: string; message: string }[] } };
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.issues[0]).toMatchObject({ code: "EXPORT_SCHEMA_OUTDATED" });
    expect(body.error.issues[0]!.message).toMatch(/오래된 Export 형식/);
    expect(body.error.issues[0]!.message).toMatch(/최신 Collector/);
  });

  it("브라우저 안내 문구는 파일의 버전과 최신 Collector·Export 형식 버전을 알려 준다", () => {
    expect(ko.submit.errors.SCHEMA_OUTDATED).toContain("{version}");
    expect(ko.submit.errors.SCHEMA_OUTDATED).toContain("{collector}");
    expect(ko.submit.errors.SCHEMA_OUTDATED).toContain("{current}");
    expect(ko.submissions.issues.EXPORT_SCHEMA_TOO_NEW).toMatch(/지원하지 않는 새 Export 형식/);
  });

  it("오래된 형식 fixture(13)는 mock 경로에서도 검증 단계에서 멈춘다", async () => {
    const f = loadFixture("13-outdated-schema-version");
    expect(f.fixture).toMatchObject({ dataEnvironment: "mock", dataSource: "mock", verificationStatus: "MOCK" });
    const result = await processMockCharacterExport(f.export, {
      appEnv: "mock",
      db: null as unknown as AppDatabase,
      mapping: MOCK_MAPPING,
      gearProfile: forever,
      now: NOW,
    });
    expect(result).toMatchObject({ ok: false, stage: "validate", issues: [{ code: "EXPORT_SCHEMA_OUTDATED" }] });
  });
});

// ---------------------------------------------------------------------------
// 8. 실제 데이터 없이 흐름 확인: fixture는 MOCK을 유지한다
// ---------------------------------------------------------------------------

describe("테스트용 예시 파일과 fixture는 MOCK을 유지한다", () => {
  it("예시 Export는 fixture 01과 같은 가짜 데이터이고 mock 표식이 있으며 형식 검증을 통과한다", () => {
    const sample = buildTestExport(new Date("2026-11-01T12:34:56Z"));
    const parsed = characterExportV1Schema.parse(sample);
    expect(isMockFixtureExport(parsed)).toBe(true);
    expect(parsed.collector.version).toBe(`${collectorRelease.version}-mock-fixture`);
    expect(parsed.observedAt).toBe(Date.parse("2026-11-01T12:00:00Z") / 1000);
    const fixture = loadFixture("01-valid-character").export as { observedAt: number; levelEvents: { observedAt: number }[] };
    expect(parsed.observedAt! - parsed.levelEvents[0]!.observedAt!).toBe(fixture.observedAt - fixture.levelEvents[0]!.observedAt);
    const strip = (e: Record<string, unknown>) => ({ ...e, observedAt: 0, levelEvents: [], collector: null });
    expect(strip(sample as unknown as Record<string, unknown>)).toEqual(strip(fixture as unknown as Record<string, unknown>));
    expect(JSON.stringify(sample)).toContain("MOCK-FIXTURE-");
  });

  it.each(mockFixtureIds)("%s: 실제 영역 제출 경로에서는 저장·검증 모두 거부된다", async (id) => {
    const input = loadFixture(id).export;
    for (const dryRun of [true, false]) {
      const result = await submitCharacterExport(input, {
        targetEnvironment: "beta",
        mapping: MOCK_MAPPING,
        slotProfile: forever,
        rankingProfile: null,
        now: NOW,
        dryRun,
        db: null,
        allowMockFixture: false,
      });
      expect(result.ok).toBe(false);
      if (result.ok) expect(result.verificationStatus).not.toBe("COMMUNITY_SUBMITTED");
    }
  });

  it("mock 배포의 검증 전용 제출만 fixture를 검증하고, 결과는 테스트 데이터(MOCK)이며 저장하지 않는다", async () => {
    const sample = buildTestExport(NOW);
    const res = await handleCharacterSubmission(publicRequest({ export: sample }, { dryRun: true }), publicDeps());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({ mode: "dry-run", verificationStatus: "MOCK", testFixture: true, submissionId: null, reviewStatus: null });
    expect(body.data.verificationStatus).not.toBe("COMMUNITY_SUBMITTED");
    expect(body.data.verificationStatus).not.toBe("VERIFIED");
    // mock 배포에서도 저장 요청은 거부한다.
    const stored = await handleCharacterSubmission(publicRequest({ export: sample, consent: CONSENT }), publicDeps());
    expect(stored.status).toBe(409);
  });

  it("beta / live 배포는 검증 전용 제출이어도 fixture를 거부한다", async () => {
    for (const appEnv of ["beta", "live"] as const) {
      const res = await handleCharacterSubmission(
        publicRequest({ export: buildTestExport(NOW) }, { dryRun: true }),
        publicDeps({ appEnv, db: null }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { issues: { code: string }[] } };
      expect(body.error.issues[0]!.code).toBe("MOCK_FIXTURE_REJECTED");
    }
  });

  it("fixture 허용은 DB가 있거나 저장 요청이면 쓰이지 않는다", async () => {
    const base = { targetEnvironment: "beta" as const, mapping: MOCK_MAPPING, slotProfile: forever, rankingProfile: null, now: NOW, allowMockFixture: true };
    const stored = await submitCharacterExport(buildTestExport(NOW), { ...base, dryRun: false, db: null });
    expect(stored).toMatchObject({ ok: false, issues: [{ code: "MOCK_FIXTURE_REJECTED" }] });
    const withDb = await submitCharacterExport(buildTestExport(NOW), { ...base, dryRun: true, db: {} as AppDatabase });
    expect(withDb).toMatchObject({ ok: false, issues: [{ code: "MOCK_FIXTURE_REJECTED" }] });
  });

  it("예시 파일 경로는 mock에서만 응답하고 검색 엔진에서 제외한다", async () => {
    const { GET } = await import("@/app/contribute/test-export/route");
    state.appEnv = "mock";
    const ok = GET();
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-disposition")).toContain("forever-rank-test-export.json");
    expect(ok.headers.get("x-robots-tag")).toContain("noindex");
    expect(isMockFixtureExport((await ok.json()) as { collector: { version: string } })).toBe(true);
    for (const env of ["beta", "live"] as const) {
      state.appEnv = env;
      const res = GET();
      expect(res.status).toBe(404);
      expect(((await res.json()) as { error: { message: string } }).error.message).toBe(ko.api.NOT_FOUND);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. 관리자 화면: 제출 경로·데이터 출처·검토 상태
// ---------------------------------------------------------------------------

describe("관리자 제출 검토 화면", () => {
  let close: () => Promise<void>;
  beforeAll(async () => {
    const created = await createTestDb(["beta", "live"]);
    state.db = created.db;
    close = created.close;
    const valid = JSON.parse(readFileSync("tests/fixtures/character-export/valid.json", "utf8")) as Record<string, unknown>;
    const now = new Date("2026-10-07T06:00:00Z");
    const res = await handleCharacterSubmission(
      publicRequest({ export: valid, consent: CONSENT }, { now }),
      publicDeps({ appEnv: "beta", db: created.db, now }),
    );
    expect(res.status).toBe(200);
  });
  afterAll(async () => {
    state.db = null;
    await close();
  });

  it("제출 경로(웹 업로드), 데이터 출처(커뮤니티 제출), 검토 상태(검토 대기), Collector·Export 형식 버전을 보여 준다", async () => {
    state.appEnv = "beta";
    const { default: Page } = await import("@/app/admin/submissions/page");
    const out = text(await html(Page({ searchParams: Promise.resolve({}) })));
    expect(out).toContain("제출 경로 · 데이터 출처");
    expect(out).toContain("웹 업로드");
    expect(out).toContain("커뮤니티 제출");
    expect(out).toContain("검토 대기");
    expect(out).toContain("Collector 버전 0.1.0");
    expect(out).toContain("Export 형식 버전 1");
    expect(out).not.toContain("공개 제출");
  });

  it("미리보기 요약에 Collector 버전과 Export 형식 버전을 남긴다", () => {
    const preview = buildExportPreview(characterExportV1Schema.parse(buildTestExport(NOW)), forever);
    expect(preview).toMatchObject({ collectorVersion: `${collectorRelease.version}-mock-fixture`, exportSchemaVersion: 1 });
  });
});

// ---------------------------------------------------------------------------
// 10. SEO, 한국어 UI, 모바일 레이아웃
// ---------------------------------------------------------------------------

describe("SEO", () => {
  const pages = [
    ["@/app/page", "/", "WoW 포에버 랭킹 | Forever Rank"],
    ["@/app/contribute/page", "/contribute", "내 캐릭터 랭킹 등록 | Forever Rank"],
    ["@/app/contribute/download/page", "/contribute/download", "Forever Rank Collector 다운로드 | Forever Rank"],
    ["@/app/contribute/install/page", "/contribute/install", "Collector 설치 방법 | Forever Rank"],
    ["@/app/contribute/how-to-use/page", "/contribute/how-to-use", "Collector 사용 방법 | Forever Rank"],
    ["@/app/submit/page", "/submit", "캐릭터 데이터 제출 | Forever Rank"],
  ] as const;

  it.each(pages)("%s: 한국어 title / description / canonical", async (path, canonical, title) => {
    state.appEnv = "live";
    const mod = (await import(/* @vite-ignore */ path)) as { generateMetadata: () => import("next").Metadata };
    const meta = mod.generateMetadata();
    expect(meta.title).toEqual({ absolute: title });
    expect(String(meta.description)).toMatch(/[가-힣]/);
    expect(meta.alternates?.canonical).toBe(canonical);
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.openGraph?.locale).toBe("ko_KR");
  });

  it("테스트 데이터 배포는 제목·설명에 표시를 붙이고 검색 엔진에서 제외한다", async () => {
    state.appEnv = "mock";
    const { generateMetadata } = await import("@/app/contribute/page");
    const meta = generateMetadata();
    expect(meta.title).toEqual({ absolute: "[테스트 데이터] 내 캐릭터 랭킹 등록 | Forever Rank" });
    expect(String(meta.description)).toMatch(/^테스트 데이터 화면입니다\. 실제 WoW 포에버 랭킹이 아닙니다\./);
    expect(meta.openGraph?.title).toBe("[테스트 데이터] 내 캐릭터 랭킹 등록 | Forever Rank");
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("robots.txt: 테스트 데이터 배포는 전체 제외, 실제 배포는 관리자·API·예시 파일만 제외", async () => {
    const { default: robots } = await import("@/app/robots");
    state.appEnv = "mock";
    expect(robots().rules).toEqual([{ userAgent: "*", disallow: "/" }]);
    state.appEnv = "live";
    expect(robots().rules).toEqual([{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/contribute/test-export"] }]);
  });
});

describe("모바일 우선 레이아웃", () => {
  it("단계 버튼은 모바일에서 2열, 넓은 화면에서 4열이고 누르기 쉬운 높이(44px)다", async () => {
    const { ContributeNav } = await import("@/components/contribute/contribute-nav");
    const nav = await html(<ContributeNav current="download" />);
    expect(nav).toMatch(/class="grid grid-cols-2 gap-2 sm:grid-cols-4"/);
    expect(nav.match(/min-h-11/g)?.length).toBe(4);
    expect(nav).toContain('aria-current="page"');
  });

  it("긴 경로·SHA-256은 줄바꿈되고, 안내 화면에 고정 폭 레이아웃이 없다", async () => {
    const { CodeBlock } = await import("@/components/contribute/contribute-nav");
    expect(await html(<CodeBlock>{"a\\b"}</CodeBlock>)).toContain("break-words");
    const { default: Download } = await import("@/app/contribute/download/page");
    expect(await html(<Download />)).toMatch(/class="block break-all font-mono text-xs" data-testid="collector-sha256"/);
    for (const file of ["app/contribute/page.tsx", "app/contribute/download/page.tsx", "app/contribute/install/page.tsx", "app/contribute/how-to-use/page.tsx", "components/contribute/contribute-nav.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\bw-\[\d{3,}px\]|\bmin-w-\[\d{3,}px\]/);
    }
  });
});

describe("한국어 UI", () => {
  it("안내 화면 문구는 locale에 있고 화면 제목은 한국어다", async () => {
    for (const path of ["@/app/contribute/page", "@/app/contribute/install/page", "@/app/contribute/how-to-use/page"]) {
      const { default: Page } = (await import(/* @vite-ignore */ path)) as { default: () => React.ReactNode };
      const h1 = /<h1[^>]*>([^<]+)<\/h1>/.exec(await html(<Page />))?.[1] ?? "";
      expect(h1).toMatch(/[가-힣]/);
    }
    expect(ko.contribute.nav).toEqual({
      label: "랭킹 등록 안내",
      overview: "등록 안내",
      download: "Collector 다운로드",
      install: "설치 방법",
      howToUse: "사용 방법",
      submit: "캐릭터 데이터 제출",
    });
    expect(ko.common.nav.contribute).toBe("랭킹 등록");
  });
});

// ---------------------------------------------------------------------------
// HTTP 도우미 (tests/submission-system.test.ts와 같은 방식)
// ---------------------------------------------------------------------------

const SECRET = "s".repeat(40);
const ORIGIN = "http://localhost:3000";
const CONSENT = {
  consentVersion: submissionPolicy.consentVersion,
  policyVersion: submissionPolicy.policyVersion,
  agreements: { dataUsage: true, noPersonalData: true },
};
const TEST_MAPPING: ExportMapping = {
  regionById: { "901": "test-region" },
  gameModeByActiveGameMode: { "902": "test-mode" },
  classByFile: { TESTCLASS: "warrior" },
  raceByFile: { TestRace: "orc" },
  factionByTag: { TestFaction: "horde" },
  qualityById: { "3": "rare" },
  twoHandInventoryTypes: [17],
  nameSeparator: " ",
  maxObservationAgeDays: 14,
  maxFutureSkewSeconds: 300,
};

function publicDeps(partial: Partial<SubmissionHttpDeps> = {}): SubmissionHttpDeps {
  return {
    settings: { enabled: false, adminToken: null },
    appEnv: "mock",
    db: null,
    now: NOW,
    rateLimiter: new FixedWindowRateLimiter(100, 60_000),
    config: { mapping: () => TEST_MAPPING, slotProfile: () => forever, rankingProfile: () => null },
    publicSubmission: {
      settings: { enabled: true, secret: SECRET },
      policy: submissionPolicy,
      allowedOrigins: [ORIGIN],
      clientLimiter: new FixedWindowRateLimiter(100, 60_000),
      globalLimiter: new FixedWindowRateLimiter(1000, 60_000),
    },
    ...partial,
  };
}

function publicRequest(body: unknown, options: { dryRun?: boolean; now?: Date } = {}) {
  return new Request(`${ORIGIN}/api/v1/submissions/character${options.dryRun ? "?dryRun=true" : ""}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      "x-forwarded-for": "198.51.100.1",
      "x-forever-rank-csrf": issueCsrfToken(SECRET, options.now ?? NOW),
    },
    body: JSON.stringify(body),
  });
}
