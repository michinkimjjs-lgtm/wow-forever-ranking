/**
 * 이미지 수집기 (lib/image-collector) — 실제 네트워크 없이 가짜 응답으로 확인한다.
 * 테스트 이미지는 테스트 안에서 만든 단색 PNG와 형식 헤더뿐이다(외부 이미지 없음).
 */
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { collectImages, COLLECTOR_USER_AGENT, type CollectorDeps, type ImageSource, type LockFile } from "@/lib/image-collector/collector";
import { extensionMatches, inspectImage } from "@/lib/image-collector/inspect";
import { isPathAllowed } from "@/lib/image-collector/robots";
import { RACE_PORTRAIT_SOURCES } from "@/lib/demo/race-portrait-sources";
import { DEMO_RACES } from "@/lib/demo/home-preview-fixture";

// --- 테스트 이미지 -----------------------------------------------------------
function crc32(buf: Uint8Array) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(Buffer.from(type, "ascii"), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function png(w: number, h: number) {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = new Uint8Array(h * (1 + w * 3));
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array())];
  return new Uint8Array(Buffer.concat(parts));
}
function webpVp8x(w: number, h: number) {
  const b = new Uint8Array(30);
  b.set(Buffer.from("RIFF"), 0);
  new DataView(b.buffer).setUint32(4, 22, true);
  b.set(Buffer.from("WEBPVP8X"), 8);
  new DataView(b.buffer).setUint32(16, 10, true);
  const put24 = (o: number, v: number) => b.set([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff], o);
  put24(24, w - 1);
  put24(27, h - 1);
  return b;
}
function jpeg(w: number, h: number) {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
}
const gif = (w: number, h: number) => new Uint8Array([...Buffer.from("GIF89a"), w & 0xff, w >> 8, h & 0xff, h >> 8, 0, 0, 0, 0x3b]);
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

// --- 가짜 환경 ---------------------------------------------------------------
type Route = (url: string) => Response | Promise<Response>;
function env(routes: Record<string, Route>, files: Record<string, Uint8Array> = {}) {
  let clock = Date.parse("2026-10-31T00:00:00Z");
  const calls: { url: string; headers: Record<string, string>; redirect: string; at: number }[] = [];
  const sleeps: number[] = [];
  const written: Record<string, Uint8Array> = {};
  const deps: CollectorDeps = {
    fetch: async (url, init) => {
      calls.push({ url, headers: init.headers, redirect: init.redirect, at: clock });
      const route = routes[url];
      if (!route) return new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
      return route(url);
    },
    now: () => new Date(clock),
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    readFile: async (f) => files[f] ?? written[f] ?? null,
    writeFile: async (f, b) => {
      written[f] = b;
    },
  };
  return { deps, calls, sleeps, written };
}
const image = (bytes: Uint8Array, type: string) => () => new Response(Buffer.from(bytes), { status: 200, headers: { "content-type": type } });
const robotsOk = () => new Response("User-agent: *\nDisallow: /private/\n", { status: 200, headers: { "content-type": "text/plain" } });

function source(key: string, overrides: Partial<ImageSource> = {}): ImageSource {
  return {
    key,
    file: `${key}.png`,
    pageUrl: "https://img.example.test/page",
    imageUrl: `https://img.example.test/races/${key}.png`,
    allowedHosts: ["img.example.test"],
    rights: {
      status: "CONFIRMED",
      holder: "테스트 권리자",
      terms: "테스트 조건",
      evidenceUrl: "https://img.example.test/terms",
      nonCommercialUse: true,
      attribution: "테스트 표시",
      checkedAt: "2026-10-31",
    },
    minSize: 64,
    ...overrides,
  };
}
const OPTS = { minIntervalMs: 1000, maxRetries: 2, maxBytes: 2 * 1024 * 1024, maxRedirects: 3 };

describe("이미지 검사", () => {
  it("실제 형식·해상도를 내용으로 판단한다 (PNG·JPEG·WebP·GIF)", () => {
    expect(inspectImage(png(128, 96))).toMatchObject({ ok: true, format: "png", mime: "image/png", width: 128, height: 96 });
    expect(inspectImage(jpeg(200, 150))).toMatchObject({ ok: true, format: "jpeg", width: 200, height: 150 });
    expect(inspectImage(webpVp8x(256, 256))).toMatchObject({ ok: true, format: "webp", width: 256, height: 256 });
    expect(inspectImage(gif(80, 80))).toMatchObject({ ok: true, format: "gif", width: 80, height: 80 });
  });

  it("손상된 파일과 이미지가 아닌 내용을 거부한다", () => {
    const full = png(64, 64);
    expect(inspectImage(full.subarray(0, full.length - 12))).toEqual({ ok: false, reason: "CORRUPT" });
    expect(inspectImage(webpVp8x(64, 64).subarray(0, 28))).toEqual({ ok: false, reason: "CORRUPT" });
    expect(inspectImage(jpeg(64, 64).subarray(0, 15))).toEqual({ ok: false, reason: "CORRUPT" });
    expect(inspectImage(new Uint8Array(Buffer.from("<html>captcha</html>")))).toEqual({ ok: false, reason: "UNSUPPORTED_FORMAT" });
  });

  it("확장자와 실제 형식이 맞는지 확인한다", () => {
    expect(extensionMatches("orc.webp", "webp")).toBe(true);
    expect(extensionMatches("orc.jpg", "jpeg")).toBe(true);
    expect(extensionMatches("orc.webp", "png")).toBe(false);
  });
});

describe("robots.txt", () => {
  it("가장 긴 규칙을 따르고, 우리 수집기 그룹이 있으면 그 그룹을 쓴다", () => {
    const text = "User-agent: *\nDisallow: /img/\nAllow: /img/races/\n\nUser-agent: ForeverRankImageCollector\nDisallow: /\n";
    expect(isPathAllowed("User-agent: *\nDisallow: /img/\nAllow: /img/races/\n", "foreverrankimagecollector", "/img/races/orc.png")).toBe(true);
    expect(isPathAllowed("User-agent: *\nDisallow: /img/\n", "foreverrankimagecollector", "/img/orc.png")).toBe(false);
    expect(isPathAllowed(text, "foreverrankimagecollector", "/img/races/orc.png")).toBe(false);
    expect(isPathAllowed("", "foreverrankimagecollector", "/a")).toBe(true);
  });

  it("해석하지 않는 와일드카드 규칙은 허용하지 않는 쪽으로 처리한다", () => {
    expect(isPathAllowed("User-agent: *\nDisallow: /*.png$\n", "foreverrankimagecollector", "/races/orc.png")).toBe(false);
  });
});

describe("수집기", () => {
  it("이용 조건이 확인되지 않은 항목은 요청 없이 건너뛴다", async () => {
    const { deps, calls } = env({});
    const unconfirmed = source("orc", { rights: { ...source("orc").rights, status: "UNVERIFIED" } });
    const { log, lock } = await collectImages([unconfirmed, source("troll", { imageUrl: null })], {}, deps, OPTS);
    expect(log.map((e) => e.outcome)).toEqual(["SKIPPED_RIGHTS_NOT_CONFIRMED", "SKIPPED_NO_URL"]);
    expect(calls).toHaveLength(0);
    expect(lock).toEqual({});
  });

  it("확인된 이미지를 받아 검사하고 SHA-256·해상도·출처를 기록한다. 정직한 User-Agent, 리다이렉트 수동 처리", async () => {
    const bytes = png(128, 128);
    const { deps, calls, written } = env({
      "https://img.example.test/robots.txt": robotsOk,
      "https://img.example.test/races/orc.png": image(bytes, "image/png"),
    });
    const { lock, log, stopped } = await collectImages([source("orc")], {}, deps, OPTS);
    expect(stopped).toBe(false);
    expect(log.map((e) => e.outcome)).toEqual(["DOWNLOADED"]);
    expect(written["orc.png"]).toEqual(bytes);
    expect(lock.orc).toMatchObject({ format: "png", width: 128, height: 128, bytes: bytes.length, sha256: sha(bytes), host: "img.example.test" });
    expect(lock.orc).not.toHaveProperty("bytesData");
    for (const c of calls) {
      expect(c.headers["User-Agent"]).toBe(COLLECTOR_USER_AGENT);
      expect(c.redirect).toBe("manual");
    }
  });

  it("같은 호스트 요청 사이에 최소 간격을 둔다", async () => {
    const { deps, calls } = env({
      "https://img.example.test/robots.txt": robotsOk,
      "https://img.example.test/races/orc.png": image(png(64, 64), "image/png"),
      "https://img.example.test/races/troll.png": image(png(64, 64), "image/png"),
    });
    await collectImages([source("orc"), source("troll")], {}, deps, OPTS);
    expect(calls).toHaveLength(3); // robots.txt는 호스트당 한 번
    for (let i = 1; i < calls.length; i++) expect(calls[i]!.at - calls[i - 1]!.at).toBeGreaterThanOrEqual(1000);
  });

  it("다시 실행하면 이미 받은 파일(해시 일치)은 요청하지 않는다. 파일이 바뀌었으면 다시 받는다", async () => {
    const bytes = png(64, 64);
    const lock: LockFile = {
      orc: { key: "orc", file: "orc.png", imageUrl: "https://img.example.test/races/orc.png", finalUrl: "https://img.example.test/races/orc.png", host: "img.example.test", format: "png", mime: "image/png", width: 64, height: 64, bytes: bytes.length, sha256: sha(bytes), fetchedAt: "2026-10-30T00:00:00.000Z" },
    };
    const same = env({}, { "orc.png": bytes });
    const r1 = await collectImages([source("orc")], lock, same.deps, OPTS);
    expect(r1.log.map((e) => e.outcome)).toEqual(["SKIPPED_CACHED"]);
    expect(same.calls).toHaveLength(0);

    const changed = env({ "https://img.example.test/robots.txt": robotsOk, "https://img.example.test/races/orc.png": image(bytes, "image/png") }, { "orc.png": png(70, 70) });
    const r2 = await collectImages([source("orc")], lock, changed.deps, OPTS);
    expect(r2.log.map((e) => e.outcome)).toEqual(["DOWNLOADED"]);
  });

  it.each([401, 403, 429])("HTTP %s: 재시도 없이 전체 수집을 즉시 멈춘다", async (status) => {
    const { deps, calls, written } = env({
      "https://img.example.test/robots.txt": robotsOk,
      "https://img.example.test/races/orc.png": () => new Response("blocked", { status, headers: { "content-type": "text/plain" } }),
      "https://img.example.test/races/troll.png": image(png(64, 64), "image/png"),
    });
    const { log, stopped } = await collectImages([source("orc"), source("troll")], {}, deps, OPTS);
    expect(stopped).toBe(true);
    expect(log.map((e) => e.outcome)).toEqual(["STOPPED_BLOCKED", "SKIPPED_AFTER_STOP"]);
    expect(calls.filter((c) => c.url.endsWith("orc.png"))).toHaveLength(1);
    expect(calls.some((c) => c.url.endsWith("troll.png"))).toBe(false);
    expect(written).toEqual({});
  });

  it("CAPTCHA·봇 차단 화면을 만나면 멈춘다", async () => {
    const { deps } = env({
      "https://img.example.test/robots.txt": robotsOk,
      "https://img.example.test/races/orc.png": () => new Response("<html><title>Just a moment...</title><div id=challenge-platform>captcha</div></html>", { status: 200, headers: { "content-type": "text/html" } }),
    });
    const { log, stopped } = await collectImages([source("orc")], {}, deps, OPTS);
    expect(stopped).toBe(true);
    expect(log[0]!.outcome).toBe("STOPPED_BLOCKED");
  });

  it("robots.txt 자체가 403이면 멈춘다. robots.txt가 막은 경로는 받지 않는다", async () => {
    const blocked = env({ "https://img.example.test/robots.txt": () => new Response("no", { status: 403 }) });
    expect((await collectImages([source("orc")], {}, blocked.deps, OPTS)).stopped).toBe(true);
    const disallowed = env({ "https://img.example.test/robots.txt": () => new Response("User-agent: *\nDisallow: /races/\n", { status: 200 }) });
    const r = await collectImages([source("orc")], {}, disallowed.deps, OPTS);
    expect(r.log[0]!.outcome).toBe("SKIPPED_ROBOTS");
    expect(disallowed.calls.some((c) => c.url.endsWith("orc.png"))).toBe(false);
  });

  it.each([
    ["Content-Type과 실제 형식 불일치", image(png(64, 64), "image/jpeg")],
    ["확장자와 실제 형식 불일치", image(webpVp8x(64, 64), "image/webp")],
    ["해상도 부족", image(png(32, 32), "image/png")],
    ["손상 파일", image(png(64, 64).subarray(0, 40), "image/png")],
    ["이미지가 아닌 내용", image(new Uint8Array(Buffer.from("plain")), "image/png")],
  ] as const)("검증 실패(%s)는 저장하지 않는다", async (_label, route) => {
    const { deps, written } = env({ "https://img.example.test/robots.txt": robotsOk, "https://img.example.test/races/orc.png": route });
    const { log, lock } = await collectImages([source("orc")], {}, deps, OPTS);
    expect(log[0]!.outcome).toBe("FAILED_VALIDATION");
    expect(written).toEqual({});
    expect(lock).toEqual({});
  });

  it("허용 호스트 밖으로의 이미지 주소·리다이렉트는 따라가지 않는다", async () => {
    const other = env({});
    const r1 = await collectImages([source("orc", { imageUrl: "https://elsewhere.test/orc.png" })], {}, other.deps, OPTS);
    expect(r1.log[0]!.outcome).toBe("SKIPPED_HOST_NOT_ALLOWED");
    expect(other.calls).toHaveLength(0);

    const redirect = env({
      "https://img.example.test/robots.txt": robotsOk,
      "https://img.example.test/races/orc.png": () => new Response(null, { status: 302, headers: { location: "https://elsewhere.test/orc.png" } }),
    });
    const r2 = await collectImages([source("orc")], {}, redirect.deps, OPTS);
    expect(r2.log[0]!.outcome).toBe("SKIPPED_HOST_NOT_ALLOWED");
    expect(redirect.calls.some((c) => c.url.startsWith("https://elsewhere.test"))).toBe(false);
  });

  it("5xx는 간격을 늘려 정해진 횟수만 다시 시도한다", async () => {
    let n = 0;
    const { deps, sleeps } = env({
      "https://img.example.test/robots.txt": robotsOk,
      "https://img.example.test/races/orc.png": () => (n++ < 1 ? new Response("err", { status: 503, headers: { "content-type": "text/plain" } }) : image(png(64, 64), "image/png")()),
    });
    const { log } = await collectImages([source("orc")], {}, deps, OPTS);
    expect(log[0]!.outcome).toBe("DOWNLOADED");
    expect(sleeps.some((s) => s >= 2000)).toBe(true);
  });
});

describe("종족 초상화 수집 대상", () => {
  it("8종 종족만 대상이고, 이용 조건을 확인하기 전에는 주소를 비워 둔다", () => {
    expect(RACE_PORTRAIT_SOURCES.map((s) => s.key).sort()).toEqual([...DEMO_RACES].sort());
    for (const s of RACE_PORTRAIT_SOURCES) {
      if (s.rights.status === "CONFIRMED") {
        // 확인된 항목은 근거를 모두 갖춰야 한다
        expect(s.imageUrl).toMatch(/^https:\/\//);
        expect(s.allowedHosts).toContain(new URL(s.imageUrl!).host);
        for (const v of [s.rights.holder, s.rights.terms, s.rights.evidenceUrl, s.rights.checkedAt]) expect(v).toBeTruthy();
        expect(s.rights.nonCommercialUse).toBe(true);
      } else {
        expect(s.imageUrl).toBeNull();
      }
    }
  });
});
