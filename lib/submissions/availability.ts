/**
 * 등록·제출 자료를 랭킹에 반영할 수 있는 설정이 갖춰졌는지 (docs/DATA-COLLECTION-STRATEGY.md §2.5)
 *
 * 설정값을 확인만 한다. 값이 비어 있으면 채우지 않고(추측 금지) "받지 않음 / 반영 불가"로 판단한다.
 * - 웹 직접 등록: 설정이 갖춰지지 않으면 화면과 API 모두 등록을 받지 않는다(DB에 저장하지 않음).
 * - Collector 제출: 동작은 그대로 두고, 화면 안내만 이 판단에 맞춘다.
 */
import { registrationConfig, type BattleNetRegion, type RegistrationConfig } from "@/config/registration";
import type { ExportMapping } from "@/lib/config";
import { gameModeForRuleset, getExportMapping, getGameScope, isRulesetCode } from "@/lib/config";
import { getPublicSubmissionSettings } from "@/lib/config/env";
import type { DataEnvironment } from "@/lib/domain/enums";
import { REGISTRABLE_RULESETS } from "./manual-schema";

type RealEnvironment = "beta" | "live";

/** 등록·제출을 받을 데이터 영역. mock 배포는 beta 기준 설정으로 검증만 한다 */
export function submissionTargetEnvironment(appEnv: DataEnvironment | null): RealEnvironment {
  return appEnv === "live" ? "live" : "beta";
}

export type RankingSetupGap =
  /** 데이터 영역의 region / gameMode 설정(config/game-scopes.ts)이 없음 */
  | "GAME_SCOPE_MISSING"
  /** 이름과 성의 구분 방식(config/export-mapping.ts nameSeparator)이 확인되지 않음 */
  | "NAME_SEPARATOR_UNCONFIRMED"
  /** Battle.net 지역 → region 코드 매핑이 없음 (config/registration.ts) */
  | "REGION_MAPPING_MISSING"
  /** 등록 가능한 게임 규칙 → gameMode 매핑이 없음 */
  | "RULESET_MAPPING_MISSING"
  /** 직업 이름 → 직업 코드 매핑이 없음 (config/registration.ts) */
  | "CLASS_MAPPING_MISSING"
  /** Collector 값 매핑(region / gameMode / 직업)이 없음 (config/export-mapping.ts) */
  | "EXPORT_MAPPING_MISSING";

export interface SetupSources {
  mapping: ExportMapping;
  registration?: RegistrationConfig;
  hasGameScope?: (env: RealEnvironment) => boolean;
  gameModeForRuleset?: (env: RealEnvironment, ruleset: string) => string | null;
}

const defaultHasGameScope = (env: RealEnvironment) => getGameScope(env) !== null;
const defaultGameModeForRuleset = (env: RealEnvironment, ruleset: string) =>
  isRulesetCode(ruleset) ? gameModeForRuleset(env, ruleset) : null;

export interface ManualRegistrationSetup {
  /** 등록 자료를 랭킹에 반영할 수 있는 설정이 모두 있는지 */
  ready: boolean;
  gaps: RankingSetupGap[];
  /** 매핑이 확인된 지역·게임 규칙만 등록 화면 선택지로 쓴다 */
  regions: BattleNetRegion[];
  rulesets: string[];
}

export function evaluateManualRegistrationSetup(env: RealEnvironment, sources: SetupSources): ManualRegistrationSetup {
  const registration = sources.registration ?? registrationConfig;
  const hasGameScope = sources.hasGameScope ?? defaultHasGameScope;
  const toGameMode = sources.gameModeForRuleset ?? defaultGameModeForRuleset;
  const gaps: RankingSetupGap[] = [];

  if (!hasGameScope(env)) gaps.push("GAME_SCOPE_MISSING");
  if (sources.mapping.nameSeparator === null) gaps.push("NAME_SEPARATOR_UNCONFIRMED");
  const regionMap = registration.regionCodeByBattleNetRegion[env];
  const regions = registration.battleNetRegions.map((r) => r.code).filter((code) => Boolean(regionMap[code]));
  if (regions.length === 0) gaps.push("REGION_MAPPING_MISSING");
  const rulesets = REGISTRABLE_RULESETS.filter((code) => toGameMode(env, code) !== null);
  if (rulesets.length === 0) gaps.push("RULESET_MAPPING_MISSING");
  if (Object.keys(registration.classCodeByName[env]).length === 0) gaps.push("CLASS_MAPPING_MISSING");

  return { ready: gaps.length === 0, gaps, regions, rulesets };
}

/** Collector 제출 자료를 랭킹에 반영할 수 있는 설정이 있는지 (판단만, 제출 동작은 바꾸지 않음) */
export function evaluateCollectorRankingSetup(env: RealEnvironment, sources: SetupSources): { ready: boolean; gaps: RankingSetupGap[] } {
  const hasGameScope = sources.hasGameScope ?? defaultHasGameScope;
  const { mapping } = sources;
  const gaps: RankingSetupGap[] = [];
  if (!hasGameScope(env)) gaps.push("GAME_SCOPE_MISSING");
  if (mapping.nameSeparator === null) gaps.push("NAME_SEPARATOR_UNCONFIRMED");
  const empty = (record: Record<string, string>) => Object.keys(record).length === 0;
  if (empty(mapping.regionById) || empty(mapping.gameModeByActiveGameMode) || empty(mapping.classByFile)) {
    gaps.push("EXPORT_MAPPING_MISSING");
  }
  return { ready: gaps.length === 0, gaps };
}

export interface ManualRegistrationStatus extends ManualRegistrationSetup {
  /** FEATURE_PUBLIC_SUBMISSIONS와 비밀값이 갖춰졌는지 (값은 읽지 않고 사용 가능 여부만) */
  featureEnabled: boolean;
  /** 등록 화면을 열고 등록을 받는지 */
  open: boolean;
}

/** 현재 배포의 웹 직접 등록 상태 (화면·안내 링크용). DB에 접속하지 않는다 */
export function currentManualRegistrationStatus(appEnv: DataEnvironment | null): ManualRegistrationStatus {
  const env = submissionTargetEnvironment(appEnv);
  const featureEnabled = getPublicSubmissionSettings().enabled && appEnv !== null;
  const setup = evaluateManualRegistrationSetup(env, { mapping: getExportMapping(env) });
  return { ...setup, featureEnabled, open: featureEnabled && setup.ready };
}

/** 현재 배포의 Collector 제출 자료가 랭킹에 반영될 수 있는지 (안내 문구용) */
export function currentCollectorRankingReady(appEnv: DataEnvironment | null): boolean {
  const env = submissionTargetEnvironment(appEnv);
  return evaluateCollectorRankingSetup(env, { mapping: getExportMapping(env) }).ready;
}
