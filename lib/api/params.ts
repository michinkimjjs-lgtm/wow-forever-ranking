/**
 * 요청 파라미터 검증 (명세서 §17)
 * API와 페이지가 같은 규칙을 쓴다. API는 알 수 없는 파라미터를 거부하고, 페이지는 무시한다.
 * 순위 값(rank 등)은 받지 않는다(명세서 §10.1).
 */
import { z } from "zod";
import {
  gameModeForRuleset,
  getCodes,
  getRankingConfig,
  isRulesetCode,
  requireGameScope,
  rulesetOfGameMode,
  RulesetNotAvailableError,
} from "@/lib/config";
import { getRequestableEnvironments } from "@/lib/config/env";
import { DATA_ENVIRONMENTS, type DataEnvironment, type RulesetCode } from "@/lib/domain/enums";
import type { RankingFilters, RankingScope, Pagination } from "@/lib/ranking/types";

export class InvalidQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQueryError";
  }
}

export type SearchParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

export function toURLSearchParams(input: SearchParamsInput): URLSearchParams {
  if (input instanceof URLSearchParams) return input;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  return params;
}

interface ParseOptions {
  /** true면 알 수 없는 파라미터가 있을 때 오류 (API) */
  strict: boolean;
}

const LIST_KEYS = ["page", "pageSize", "gameMode", "ruleset", "region", "class", "faction", "guild", "verifiedOnly", "dataEnvironment"] as const;

function single(params: URLSearchParams, key: string): string | undefined {
  const values = params.getAll(key);
  if (values.length > 1) throw new InvalidQueryError(`${key} 파라미터가 여러 번 지정되었습니다.`);
  const value = values[0]?.trim();
  return value === "" ? undefined : value;
}

function checkKeys(params: URLSearchParams, allowed: readonly string[], options: ParseOptions) {
  if (!options.strict) return;
  for (const key of params.keys()) {
    if (!allowed.includes(key)) throw new InvalidQueryError(`알 수 없는 파라미터입니다: ${key}`);
  }
}

function parseIntParam(value: string | undefined, name: string, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  const result = z.coerce.number().int().min(min).max(max).safeParse(value);
  if (!result.success || !/^\d+$/.test(value)) throw new InvalidQueryError(`${name} 값이 올바르지 않습니다.`);
  return result.data;
}

export interface ParsedListParams {
  scope: RankingScope;
  filters: RankingFilters;
  pagination: Pagination;
  /** scope.gameMode가 뜻하는 공식 Ruleset. 연결이 없으면 null */
  ruleset: RulesetCode | null;
}

/** 목록 / 랭킹 공통 파라미터 */
export function parseListParams(
  input: SearchParamsInput,
  appEnv: DataEnvironment,
  options: ParseOptions,
  extraKeys: readonly string[] = [],
): ParsedListParams {
  const params = toURLSearchParams(input);
  checkKeys(params, [...LIST_KEYS, ...extraKeys], options);
  const ranking = getRankingConfig();

  const requestedEnv = single(params, "dataEnvironment");
  let dataEnvironment: DataEnvironment = appEnv;
  if (requestedEnv !== undefined) {
    if (!(DATA_ENVIRONMENTS as readonly string[]).includes(requestedEnv)) {
      throw new InvalidQueryError("dataEnvironment 값이 올바르지 않습니다.");
    }
    if (!getRequestableEnvironments(appEnv).includes(requestedEnv as DataEnvironment)) {
      throw new InvalidQueryError(`이 배포에서는 ${requestedEnv} 데이터를 조회할 수 없습니다.`);
    }
    dataEnvironment = requestedEnv as DataEnvironment;
  }

  const gameScope = requireGameScope(dataEnvironment);
  const codes = getCodes(dataEnvironment);

  // ruleset 파라미터 (docs/RULESETS.md): 공식 Ruleset 코드 → 이 영역의 gameMode. 기존 gameMode 파라미터도 그대로 받는다.
  const rulesetParam = single(params, "ruleset");
  const gameModeParam = single(params, "gameMode");
  let gameMode = gameModeParam ?? gameScope.defaultGameMode;
  if (rulesetParam !== undefined) {
    if (!isRulesetCode(rulesetParam)) throw new InvalidQueryError("ruleset 값이 올바르지 않습니다.");
    const mapped = gameModeForRuleset(dataEnvironment, rulesetParam);
    if (mapped === null) throw new RulesetNotAvailableError(dataEnvironment, rulesetParam);
    if (gameModeParam !== undefined && gameModeParam !== mapped) {
      throw new InvalidQueryError("ruleset과 gameMode가 서로 맞지 않습니다.");
    }
    gameMode = mapped;
  }
  if (!gameScope.gameModes.some((m) => m.code === gameMode)) throw new InvalidQueryError("gameMode 값이 올바르지 않습니다.");

  const region = single(params, "region");
  if (region !== undefined && !gameScope.regions.some((r) => r.code === region)) {
    throw new InvalidQueryError("region 값이 올바르지 않습니다.");
  }
  const classCode = single(params, "class");
  if (classCode !== undefined && !codes?.classes.includes(classCode)) throw new InvalidQueryError("class 값이 올바르지 않습니다.");
  const factionCode = single(params, "faction");
  if (factionCode !== undefined && !codes?.factions.includes(factionCode)) {
    throw new InvalidQueryError("faction 값이 올바르지 않습니다.");
  }
  const guildId = single(params, "guild");
  if (guildId !== undefined && !z.uuid().safeParse(guildId).success) throw new InvalidQueryError("guild 값이 올바르지 않습니다.");

  const verifiedRaw = single(params, "verifiedOnly");
  if (verifiedRaw !== undefined && verifiedRaw !== "true" && verifiedRaw !== "false") {
    throw new InvalidQueryError("verifiedOnly 값은 true 또는 false여야 합니다.");
  }

  return {
    ruleset: rulesetOfGameMode(dataEnvironment, gameMode),
    scope: { dataEnvironment, gameMode },
    filters: {
      region,
      classCode,
      factionCode,
      guildId,
      verifiedOnly: verifiedRaw === "true",
    },
    pagination: {
      page: parseIntParam(single(params, "page"), "page", 1, 1, 100_000),
      pageSize: parseIntParam(single(params, "pageSize"), "pageSize", ranking.defaultPageSize, 1, ranking.maxPageSize),
    },
  };
}

export interface ParsedSearchParams extends ParsedListParams {
  q: string | null;
}

export const SEARCH_QUERY_MAX_LENGTH = 32;

/** 캐릭터 검색 파라미터. 검색은 gameMode를 지정하지 않으면 모든 게임 모드에서 찾는다. */
export function parseSearchParams(
  input: SearchParamsInput,
  appEnv: DataEnvironment,
  options: ParseOptions & { requireQuery: boolean },
): ParsedSearchParams & { gameModeSpecified: boolean } {
  const params = toURLSearchParams(input);
  const parsed = parseListParams(params, appEnv, options, ["q"]);
  const q = single(params, "q") ?? null;
  if (q !== null && q.length > SEARCH_QUERY_MAX_LENGTH) throw new InvalidQueryError("검색어가 너무 깁니다.");
  if (q === null && options.requireQuery) throw new InvalidQueryError("q 파라미터가 필요합니다.");
  const specified = (key: string) => params.has(key) && single(params, key) !== undefined;
  return { ...parsed, q, gameModeSpecified: specified("gameMode") || specified("ruleset") };
}

export function assertNoParams(input: SearchParamsInput, options: ParseOptions, allowed: readonly string[] = []): void {
  checkKeys(toURLSearchParams(input), allowed, options);
}

export function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}
