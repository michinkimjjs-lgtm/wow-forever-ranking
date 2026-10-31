/**
 * 권리가 확인된 공개 이미지만 내려받는 수집기 (docs/DEMO-RACE-PORTRAITS.md, PR #10 docs/EXTERNAL-DATA-COLLECTION.md)
 *
 * 하는 일
 * - 이용 조건이 확인(CONFIRMED)된 항목만 내려받는다. 그 밖의 항목은 건너뛴다.
 * - robots.txt 확인, 호스트별 요청 간격 제한, 이미 받은 파일(해시 일치)은 다시 받지 않음
 * - 실제 형식·확장자·Content-Type·해상도·손상 검사, SHA-256 기록, 결과를 로그로 남김
 * - 401·403·429, CAPTCHA·봇 차단 화면을 만나면 즉시 전체 실행을 멈춘다
 *
 * 하지 않는 일 (우회 금지)
 * - 브라우저처럼 보이게 하는 User-Agent, 쿠키·로그인, 프록시·IP 변경, 차단 후 재시도
 * - 허용 호스트 밖으로의 리다이렉트 따라가기, 페이지 전체 수집
 */
import { createHash } from "node:crypto";
import { extensionMatches, inspectImage, type ImageFormat } from "./inspect";
import { isPathAllowed } from "./robots";

export const COLLECTOR_USER_AGENT = "ForeverRankImageCollector/1.0 (+https://foreverrank.co.kr; non-commercial fan site)";
const ROBOTS_TOKEN = "foreverrankimagecollector";

export type RightsStatus = "UNVERIFIED" | "CONFIRMED" | "REJECTED";

export interface ImageSource {
  /** 항목 키 (예: orc) */
  key: string;
  /** 저장할 파일 이름 (public/demo/races/ 안) */
  file: string;
  /** 이미지를 확인한 페이지 */
  pageUrl: string | null;
  /** 내려받을 이미지 주소 (https) */
  imageUrl: string | null;
  /** 이 호스트로만 요청·리다이렉트를 허용한다 */
  allowedHosts: readonly string[];
  rights: {
    status: RightsStatus;
    holder: string | null;
    terms: string | null;
    /** 이용 조건 원문 주소 */
    evidenceUrl: string | null;
    nonCommercialUse: boolean | null;
    attribution: string | null;
    checkedAt: string | null;
  };
  /** 최소 해상도 (가로·세로) */
  minSize?: number;
}

export interface CollectedEntry {
  key: string;
  file: string;
  imageUrl: string;
  finalUrl: string;
  host: string;
  format: ImageFormat;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  fetchedAt: string;
}

export type LockFile = Record<string, CollectedEntry>;

export type Outcome =
  | "DOWNLOADED"
  | "SKIPPED_CACHED"
  | "SKIPPED_RIGHTS_NOT_CONFIRMED"
  | "SKIPPED_NO_URL"
  | "SKIPPED_HOST_NOT_ALLOWED"
  | "SKIPPED_ROBOTS"
  | "SKIPPED_AFTER_STOP"
  | "FAILED_HTTP"
  | "FAILED_NETWORK"
  | "FAILED_VALIDATION"
  | "STOPPED_BLOCKED";

export interface LogEntry {
  at: string;
  key: string;
  outcome: Outcome;
  detail?: string;
  url?: string;
  status?: number;
}

export interface CollectorDeps {
  fetch: (url: string, init: { headers: Record<string, string>; redirect: "manual" }) => Promise<Response>;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  readFile: (file: string) => Promise<Uint8Array | null>;
  writeFile: (file: string, bytes: Uint8Array) => Promise<void>;
}

export interface CollectorOptions {
  /** 같은 호스트 요청 사이 최소 간격(ms) */
  minIntervalMs: number;
  /** 5xx·네트워크 오류 재시도 횟수 (401·403·429는 재시도하지 않음) */
  maxRetries: number;
  maxBytes: number;
  maxRedirects: number;
}

export const DEFAULT_COLLECTOR_OPTIONS: CollectorOptions = { minIntervalMs: 3000, maxRetries: 2, maxBytes: 2 * 1024 * 1024, maxRedirects: 3 };

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** 봇 차단·CAPTCHA 화면으로 보이는 응답 */
export function looksLikeChallenge(res: Response, bodyText: string | null): boolean {
  if (res.headers.get("cf-mitigated")) return true;
  if (!bodyText) return false;
  return /captcha|cf-chl|challenge-platform|are you a robot|attention required|access denied/i.test(bodyText);
}

class StopError extends Error {}

export async function collectImages(
  sources: readonly ImageSource[],
  lock: LockFile,
  deps: CollectorDeps,
  options: CollectorOptions = DEFAULT_COLLECTOR_OPTIONS,
): Promise<{ lock: LockFile; log: LogEntry[]; stopped: boolean }> {
  const log: LogEntry[] = [];
  const nextLock: LockFile = { ...lock };
  const lastRequest = new Map<string, number>();
  const robotsCache = new Map<string, string | null>();
  let stopped = false;
  const record = (e: Omit<LogEntry, "at">) => log.push({ at: deps.now().toISOString(), ...e });

  const throttledFetch = async (url: string) => {
    const host = new URL(url).host;
    const last = lastRequest.get(host);
    const wait = last === undefined ? 0 : last + options.minIntervalMs - deps.now().getTime();
    if (wait > 0) await deps.sleep(wait);
    lastRequest.set(host, deps.now().getTime());
    return deps.fetch(url, { headers: { "User-Agent": COLLECTOR_USER_AGENT, Accept: "image/*,text/plain;q=0.5" }, redirect: "manual" });
  };

  const robotsAllows = async (url: URL): Promise<boolean> => {
    if (!robotsCache.has(url.origin)) {
      try {
        const res = await throttledFetch(`${url.origin}/robots.txt`);
        if (res.status === 401 || res.status === 403 || res.status === 429) throw new StopError(`robots.txt ${res.status}`);
        robotsCache.set(url.origin, res.ok ? await res.text() : "");
      } catch (error) {
        if (error instanceof StopError) throw error;
        // robots.txt를 확인할 수 없으면 허용하지 않는다
        robotsCache.set(url.origin, null);
      }
    }
    const text = robotsCache.get(url.origin);
    return text === null ? false : isPathAllowed(text ?? "", ROBOTS_TOKEN, url.pathname);
  };

  for (const source of sources) {
    if (stopped) {
      record({ key: source.key, outcome: "SKIPPED_AFTER_STOP" });
      continue;
    }
    if (source.rights.status !== "CONFIRMED") {
      record({ key: source.key, outcome: "SKIPPED_RIGHTS_NOT_CONFIRMED", detail: source.rights.status });
      continue;
    }
    if (!source.imageUrl) {
      record({ key: source.key, outcome: "SKIPPED_NO_URL" });
      continue;
    }
    const url = new URL(source.imageUrl);
    if (url.protocol !== "https:" || !source.allowedHosts.includes(url.host)) {
      record({ key: source.key, outcome: "SKIPPED_HOST_NOT_ALLOWED", url: source.imageUrl });
      continue;
    }
    // 이미 받은 파일: 기록된 해시와 디스크 파일이 같으면 다시 받지 않는다
    const cached = nextLock[source.key];
    if (cached && cached.imageUrl === source.imageUrl) {
      const existing = await deps.readFile(source.file);
      if (existing && sha256(existing) === cached.sha256) {
        record({ key: source.key, outcome: "SKIPPED_CACHED", detail: cached.sha256 });
        continue;
      }
    }

    try {
      if (!(await robotsAllows(url))) {
        record({ key: source.key, outcome: "SKIPPED_ROBOTS", url: source.imageUrl });
        continue;
      }
      const result = await downloadOne(source, url);
      if (result) {
        nextLock[source.key] = result;
        await deps.writeFile(source.file, result.bytesData);
        delete (result as Partial<typeof result>).bytesData;
        record({ key: source.key, outcome: "DOWNLOADED", url: result.finalUrl, detail: `${result.format} ${result.width}x${result.height} ${result.bytes}B sha256=${result.sha256}` });
      }
    } catch (error) {
      if (error instanceof StopError) {
        stopped = true;
        record({ key: source.key, outcome: "STOPPED_BLOCKED", detail: error.message, url: source.imageUrl });
      } else {
        throw error;
      }
    }
  }
  return { lock: nextLock, log, stopped };

  async function downloadOne(source: ImageSource, start: URL): Promise<(CollectedEntry & { bytesData: Uint8Array }) | null> {
    let attempt = 0;
    for (;;) {
      let current = start;
      let res: Response;
      try {
        res = await throttledFetch(current.toString());
        let redirects = 0;
        while (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
          const next = new URL(res.headers.get("location")!, current);
          if (next.protocol !== "https:" || !source.allowedHosts.includes(next.host) || ++redirects > options.maxRedirects) {
            record({ key: source.key, outcome: "SKIPPED_HOST_NOT_ALLOWED", url: next.toString(), detail: "허용되지 않은 리다이렉트" });
            return null;
          }
          current = next;
          res = await throttledFetch(current.toString());
        }
      } catch (error) {
        if (attempt++ < options.maxRetries) {
          await deps.sleep(options.minIntervalMs * 2 ** attempt);
          continue;
        }
        record({ key: source.key, outcome: "FAILED_NETWORK", url: current.toString(), detail: error instanceof Error ? error.message : String(error) });
        return null;
      }

      if (res.status === 401 || res.status === 403 || res.status === 429) {
        throw new StopError(`HTTP ${res.status} (${current.host}) — 접근 제한으로 수집을 멈춤`);
      }
      const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      if (!res.ok || contentType.startsWith("text/html")) {
        const text = contentType.startsWith("text/") ? await res.text().catch(() => null) : null;
        if (looksLikeChallenge(res, text)) throw new StopError(`봇 차단·CAPTCHA 화면 (${current.host}) — 수집을 멈춤`);
        if (res.status >= 500 && attempt++ < options.maxRetries) {
          await deps.sleep(options.minIntervalMs * 2 ** attempt);
          continue;
        }
        record({ key: source.key, outcome: "FAILED_HTTP", status: res.status, url: current.toString(), detail: contentType || "content-type 없음" });
        return null;
      }

      const bytesData = new Uint8Array(await res.arrayBuffer());
      const fail = (detail: string) => {
        record({ key: source.key, outcome: "FAILED_VALIDATION", url: current.toString(), detail });
        return null;
      };
      if (bytesData.length > options.maxBytes) return fail(`파일이 너무 큼 (${bytesData.length}B)`);
      const info = inspectImage(bytesData);
      if (!info.ok) return fail(info.reason);
      if (!contentType.startsWith(info.mime)) return fail(`Content-Type(${contentType || "없음"})과 실제 형식(${info.mime})이 다름`);
      if (!extensionMatches(source.file, info.format)) return fail(`파일 이름 확장자와 실제 형식(${info.format})이 다름`);
      const min = source.minSize ?? 64;
      if (info.width < min || info.height < min) return fail(`해상도가 너무 작음 (${info.width}x${info.height}, 최소 ${min})`);
      return {
        key: source.key,
        file: source.file,
        imageUrl: source.imageUrl!,
        finalUrl: current.toString(),
        host: current.host,
        format: info.format,
        mime: info.mime,
        width: info.width,
        height: info.height,
        bytes: info.bytes,
        sha256: sha256(bytesData),
        fetchedAt: deps.now().toISOString(),
        bytesData,
      };
    }
  }
}
