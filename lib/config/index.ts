/**
 * 검증된 설정 접근 모듈.
 * 설정 파일은 처음 사용할 때 한 번 검증하고, 실패하면 예외를 던진다.
 */
import { codesConfig } from "@/config/codes";
import { gameScopesConfig } from "@/config/game-scopes";
import { gearProfiles } from "@/config/gear-profiles";
import { rankingConfig } from "@/config/ranking";
import type { DataEnvironment } from "@/lib/domain/enums";
import {
  codesConfigSchema,
  gameScopesConfigSchema,
  gearProfilesSchema,
  rankingConfigSchema,
  type Codes,
  type GameScope,
  type GearProfile,
  type RankingConfig,
} from "./schema";

export type { Codes, GameScope, GearProfile, RankingConfig } from "./schema";

interface LoadedConfig {
  gameScopes: Record<DataEnvironment, GameScope | null>;
  ranking: RankingConfig;
  codes: Record<DataEnvironment, Codes | null>;
  gearProfiles: GearProfile[];
}

let cached: LoadedConfig | null = null;

export function loadConfig(): LoadedConfig {
  if (cached) return cached;
  cached = {
    gameScopes: gameScopesConfigSchema.parse(gameScopesConfig),
    ranking: rankingConfigSchema.parse(rankingConfig),
    codes: codesConfigSchema.parse(codesConfig),
    gearProfiles: gearProfilesSchema.parse(gearProfiles),
  };
  return cached;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/** dataEnvironment에 대한 지역/게임 모드 설정. 미확정 영역이면 null. */
export function getGameScope(env: DataEnvironment): GameScope | null {
  return loadConfig().gameScopes[env];
}

export function requireGameScope(env: DataEnvironment): GameScope {
  const scope = getGameScope(env);
  if (!scope) {
    throw new ConfigurationError(`${env} 영역의 region / gameMode 설정이 아직 확정되지 않았습니다.`);
  }
  return scope;
}

export function getCodes(env: DataEnvironment): Codes | null {
  return loadConfig().codes[env];
}

export function getStaleAfterDays(env: DataEnvironment): number {
  return loadConfig().ranking.staleAfterDays[env];
}

export function getAllowedVerificationStatuses(env: DataEnvironment) {
  return loadConfig().ranking.allowedVerificationStatuses[env];
}

export function getRankingConfig(): RankingConfig {
  return loadConfig().ranking;
}

function matches(list: string[], value: string | null | undefined): boolean {
  return list.includes("*") || (value != null && list.includes(value));
}

/**
 * 적용 가능한 Gear Profile을 찾는다 (명세서 §9.4, §9.5).
 * - mock은 PROVISIONAL 프로필도 사용할 수 있다.
 * - beta / live는 APPROVED 프로필만 사용한다. 없으면 null (장비 랭킹 준비 중).
 * - 여러 개가 맞으면 가장 높은 버전을 사용한다.
 */
export function resolveGearProfile(
  env: DataEnvironment,
  gameMode: string,
  sourceBuild?: string | null,
): GearProfile | null {
  const candidates = loadConfig()
    .gearProfiles.filter((p) => p.appliesTo.dataEnvironments.includes(env))
    .filter((p) => env === "mock" || p.status === "APPROVED")
    .filter((p) => matches(p.appliesTo.gameModes, gameMode))
    .filter((p) => sourceBuild === undefined || matches(p.appliesTo.sourceBuilds, sourceBuild))
    .sort((a, b) => b.version - a.version || a.id.localeCompare(b.id));
  return candidates[0] ?? null;
}
