/**
 * Blizzard Provider 설정 (docs/BLIZZARD-API-INTEGRATION-PLAN.md §1, §2)
 *
 * 모든 값은 환경변수로 받는다. URL·namespace·지역의 기본값을 코드에 두지 않는다.
 * WoW: Forever용 API base, 인증 URL, namespace는 공개 자료로 확인되지 않았기 때문이다(확인 필요).
 *
 *   BLIZZARD_API_ENABLED=on
 *   BLIZZARD_REGION=<지역 코드>
 *   BLIZZARD_API_BASE_URL=https://...        (공식 문서로 확인한 값만)
 *   BLIZZARD_OAUTH_TOKEN_URL=https://...     (공식 문서로 확인한 값만)
 *   BLIZZARD_CLIENT_ID=...
 *   BLIZZARD_CLIENT_SECRET=...
 *   BLIZZARD_API_NAMESPACES=profile:<값>,static:<값>
 *   BLIZZARD_API_LOCALE=<값>                 (선택)
 *   BLIZZARD_API_TIMEOUT_MS=10000            (선택)
 */
import { z } from "zod";

export interface BlizzardProviderConfig {
  enabled: boolean;
  region: string | null;
  apiBaseUrl: string | null;
  oauthTokenUrl: string | null;
  clientId: string | null;
  clientSecret: string | null;
  /** endpoint의 namespace 종류 → 실제 namespace 값 */
  namespaces: Record<string, string>;
  locale: string | null;
  timeoutMs: number;
}

export interface BlizzardConfigurationStatus {
  configured: boolean;
  /** 빠졌거나 잘못된 설정 (한국어) */
  problems: string[];
}

const DEFAULT_TIMEOUT_MS = 10_000;
const codePattern = /^[a-z0-9][a-z0-9_-]*$/;

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseNamespaces(value: string | null): Record<string, string> {
  if (!value) return {};
  const result: Record<string, string> = {};
  for (const pair of value.split(",")) {
    const [kind, ns] = pair.split(":").map((s) => s.trim());
    if (kind && ns) result[kind] = ns;
  }
  return result;
}

export function readBlizzardConfig(env: Record<string, string | undefined> = process.env): BlizzardProviderConfig {
  const timeout = Number(env.BLIZZARD_API_TIMEOUT_MS);
  return {
    enabled: env.BLIZZARD_API_ENABLED === "on",
    region: clean(env.BLIZZARD_REGION),
    apiBaseUrl: clean(env.BLIZZARD_API_BASE_URL),
    oauthTokenUrl: clean(env.BLIZZARD_OAUTH_TOKEN_URL),
    clientId: clean(env.BLIZZARD_CLIENT_ID),
    clientSecret: clean(env.BLIZZARD_CLIENT_SECRET),
    namespaces: parseNamespaces(clean(env.BLIZZARD_API_NAMESPACES)),
    locale: clean(env.BLIZZARD_API_LOCALE),
    timeoutMs: Number.isInteger(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
  };
}

const httpsUrl = z.string().url().startsWith("https://");

export function getBlizzardConfigurationStatus(config: BlizzardProviderConfig): BlizzardConfigurationStatus {
  const problems: string[] = [];
  if (!config.enabled) problems.push("BLIZZARD_API_ENABLED가 on이 아닙니다.");
  if (!config.region) problems.push("BLIZZARD_REGION이 없습니다.");
  else if (!codePattern.test(config.region)) problems.push("BLIZZARD_REGION 형식이 올바르지 않습니다.");
  if (!config.apiBaseUrl) problems.push("BLIZZARD_API_BASE_URL이 없습니다. (Forever API base 확인 필요)");
  else if (!httpsUrl.safeParse(config.apiBaseUrl).success) problems.push("BLIZZARD_API_BASE_URL은 https URL이어야 합니다.");
  if (!config.oauthTokenUrl) problems.push("BLIZZARD_OAUTH_TOKEN_URL이 없습니다. (인증 방식 확인 필요)");
  else if (!httpsUrl.safeParse(config.oauthTokenUrl).success) problems.push("BLIZZARD_OAUTH_TOKEN_URL은 https URL이어야 합니다.");
  if (!config.clientId) problems.push("BLIZZARD_CLIENT_ID가 없습니다.");
  if (!config.clientSecret) problems.push("BLIZZARD_CLIENT_SECRET이 없습니다.");
  return { configured: problems.length === 0, problems };
}
