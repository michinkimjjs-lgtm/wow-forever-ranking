/**
 * 검증된 설정 접근 모듈.
 * 설정 파일은 처음 사용할 때 한 번 검증하고, 실패하면 예외를 던진다.
 */
import { codesConfig } from "@/config/codes";
import { exportMappingConfig } from "@/config/export-mapping";
import { gameScopesConfig } from "@/config/game-scopes";
import { gearProfiles } from "@/config/gear-profiles";
import { rankingConfig } from "@/config/ranking";
import { rulesetsConfig } from "@/config/rulesets";
import { RULESET_CODES, type DataEnvironment, type RulesetCode } from "@/lib/domain/enums";
import {
  codesConfigSchema,
  exportMappingConfigSchema,
  gameScopesConfigSchema,
  gearProfilesSchema,
  rankingConfigSchema,
  rulesetsConfigSchema,
  type RulesetDefinition,
  type RulesetsConfig,
  type Codes,
  type ExportMapping,
  type GameScope,
  type GearProfile,
  type RankingConfig,
} from "./schema";

export type { Codes, ExportMapping, GameScope, GearProfile, RankingConfig, RulesetDefinition } from "./schema";

interface LoadedConfig {
  gameScopes: Record<DataEnvironment, GameScope | null>;
  ranking: RankingConfig;
  codes: Record<DataEnvironment, Codes | null>;
  gearProfiles: GearProfile[];
  exportMapping: { beta: ExportMapping; live: ExportMapping };
  rulesets: RulesetsConfig;
}

let cached: LoadedConfig | null = null;

export function loadConfig(): LoadedConfig {
  if (cached) return cached;
  cached = {
    gameScopes: gameScopesConfigSchema.parse(gameScopesConfig),
    ranking: rankingConfigSchema.parse(rankingConfig),
    codes: codesConfigSchema.parse(codesConfig),
    gearProfiles: gearProfilesSchema.parse(gearProfiles),
    exportMapping: exportMappingConfigSchema.parse(exportMappingConfig),
    rulesets: rulesetsConfigSchema.parse(rulesetsConfig),
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

/**
 * region / gameMode 설정이 아직 확정되지 않은 영역 (명세서 §30-5, 6).
 * 애플리케이션 오류가 아니라 "준비 중" 상태다. 화면과 API는 500 대신 준비 중 상태로 응답한다.
 */
export class GameScopeNotConfiguredError extends ConfigurationError {
  constructor(readonly dataEnvironment: DataEnvironment) {
    super(`${dataEnvironment} 영역의 region / gameMode 설정이 아직 확정되지 않았습니다.`);
    this.name = "GameScopeNotConfiguredError";
  }
}

export function isGameScopeConfigured(env: DataEnvironment): boolean {
  return getGameScope(env) !== null;
}

export function requireGameScope(env: DataEnvironment): GameScope {
  const scope = getGameScope(env);
  if (!scope) throw new GameScopeNotConfiguredError(env);
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
 * 랭킹 계산에 쓸 Gear Profile을 찾는다 (명세서 §9.4, §9.5, docs/GEAR-PROFILE.md).
 * - mock은 DRAFT 프로필도 사용할 수 있다. (개발용 임시 기준으로 화면에 표시)
 * - beta / live는 APPROVED 프로필만 사용한다. 없으면 null (장비 랭킹 준비 중).
 * - 여러 개가 맞으면 가장 높은 버전을 사용한다.
 */
export function resolveGearProfile(
  env: DataEnvironment,
  gameMode: string,
  sourceBuild?: string | null,
): GearProfile | null {
  return findGearProfile(env, gameMode, sourceBuild, { includeDraft: env === "mock" });
}

/**
 * 수집 데이터의 슬롯 이름을 슬롯 코드로 바꿀 때 쓰는 프로필. DRAFT도 포함한다.
 * (슬롯 이름 매핑은 랭킹 승인과 별개로 필요하다. 이 프로필로 랭킹을 계산하지 않는다)
 */
export function resolveSlotMappingProfile(
  env: DataEnvironment,
  gameMode: string,
  sourceBuild?: string | null,
): GearProfile | null {
  return findGearProfile(env, gameMode, sourceBuild, { includeDraft: true });
}

function findGearProfile(
  env: DataEnvironment,
  gameMode: string,
  sourceBuild: string | null | undefined,
  options: { includeDraft: boolean },
): GearProfile | null {
  const candidates = loadConfig()
    .gearProfiles.filter((p) => p.appliesTo.dataEnvironments.includes(env))
    .filter((p) => options.includeDraft || p.status === "APPROVED")
    .filter((p) => matches(p.appliesTo.gameModes, gameMode))
    .filter((p) => sourceBuild === undefined || matches(p.appliesTo.sourceBuilds, sourceBuild))
    .sort(
      (a, b) =>
        Number(b.status === "APPROVED") - Number(a.status === "APPROVED") ||
        b.version - a.version ||
        a.id.localeCompare(b.id),
    );
  return candidates[0] ?? null;
}

/** Character Export v1 매핑. 실제 영역(beta / live)에만 있다. */
export function getExportMapping(env: "beta" | "live"): ExportMapping {
  return loadConfig().exportMapping[env];
}

// ---------------------------------------------------------------------------
// 공식 Ruleset (docs/RULESETS.md)
// ---------------------------------------------------------------------------

/** 공식 Ruleset 목록 (RULESET_CODES 순서) */
export function getRulesets(): RulesetDefinition[] {
  const list = loadConfig().rulesets.rulesets;
  return RULESET_CODES.map((code) => list.find((r) => r.code === code)!);
}

export function getRulesetSources() {
  return loadConfig().rulesets.officialSources;
}

export function isRulesetCode(value: string): value is RulesetCode {
  return (RULESET_CODES as readonly string[]).includes(value);
}

/** 데이터 영역의 gameMode 코드가 뜻하는 Ruleset. 연결이 없으면 null */
export function rulesetOfGameMode(env: DataEnvironment, gameMode: string): RulesetCode | null {
  const mode = getGameScope(env)?.gameModes.find((m) => m.code === gameMode);
  if (!mode) return null;
  if (mode.ruleset) return mode.ruleset;
  return isRulesetCode(mode.code) ? mode.code : null;
}

/** 데이터 영역에서 Ruleset에 해당하는 gameMode 코드. 설정이 없거나 데이터가 없으면 null */
export function gameModeForRuleset(env: DataEnvironment, ruleset: RulesetCode): string | null {
  const scope = getGameScope(env);
  if (!scope) return null;
  return scope.gameModes.find((m) => rulesetOfGameMode(env, m.code) === ruleset)?.code ?? null;
}

/**
 * 요청한 Ruleset이 이 데이터 영역에 아직 없음 (예: 출시 후 제공되는 하드코어, 설정되지 않은 규칙).
 * 오류가 아니라 "데이터 준비 중" 상태다.
 */
export class RulesetNotAvailableError extends ConfigurationError {
  constructor(
    readonly dataEnvironment: DataEnvironment,
    readonly ruleset: RulesetCode,
  ) {
    super(`${dataEnvironment} 영역에는 ${ruleset} 규칙 데이터가 아직 없습니다.`);
    this.name = "RulesetNotAvailableError";
  }
}
