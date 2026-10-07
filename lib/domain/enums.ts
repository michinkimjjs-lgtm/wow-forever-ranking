/**
 * 데이터 모델 전체에서 쓰는 코드 값.
 * DB enum, 입력 검증, 설정 검증이 모두 이 목록을 기준으로 한다.
 * (명세서 §6.1, §11, §8.2, §14.2)
 */

export const DATA_ENVIRONMENTS = ["mock", "beta", "live"] as const;
export type DataEnvironment = (typeof DATA_ENVIRONMENTS)[number];

/** 실제 데이터 영역. mock은 여기에 포함되지 않는다. */
export const REAL_DATA_ENVIRONMENTS = ["beta", "live"] as const satisfies readonly DataEnvironment[];

export const DATA_SOURCES = ["mock", "blizzard", "addon", "user_submission"] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const VERIFICATION_STATUSES = [
  "VERIFIED",
  "LOG_VERIFIED",
  "COMMUNITY_SUBMITTED",
  "UNVERIFIED",
  "MOCK",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** "검증된 데이터만" 필터에 포함되는 상태 (명세서 §11) */
export const VERIFIED_ONLY_STATUSES = ["VERIFIED", "LOG_VERIFIED"] as const satisfies readonly VerificationStatus[];

export const MILESTONE_TIMING_BASES = ["SOURCE_REPORTED", "FIRST_OBSERVED", "INFERRED"] as const;
export type MilestoneTimingBasis = (typeof MILESTONE_TIMING_BASES)[number];

export const INGESTION_STATUSES = ["ACCEPTED", "REJECTED", "IDENTITY_CONFLICT"] as const;
export type IngestionStatus = (typeof INGESTION_STATUSES)[number];

/** DRAFT: 초안(실제 데이터 미확인). mock 영역에서만 랭킹에 쓸 수 있다. APPROVED: 실제 데이터로 확인되어 승인됨 */
export const GEAR_PROFILE_STATUSES = ["DRAFT", "APPROVED"] as const;
export type GearProfileStatus = (typeof GEAR_PROFILE_STATUSES)[number];

export const TWO_HAND_WEAPON_POLICIES = ["COUNT_ONCE", "COUNT_TWICE", "OFFHAND_AS_EMPTY"] as const;
export type TwoHandWeaponPolicy = (typeof TWO_HAND_WEAPON_POLICIES)[number];

export const EMPTY_SLOT_POLICIES = ["EXCLUDE_FROM_DENOMINATOR", "COUNT_AS_ZERO"] as const;
export type EmptySlotPolicy = (typeof EMPTY_SLOT_POLICIES)[number];

/**
 * 불변 규칙 (명세서 §6.2)
 * dataEnvironment = mock ⇔ dataSource = mock ⇔ verificationStatus = MOCK
 */
export function isMockTripleConsistent(
  dataEnvironment: DataEnvironment,
  dataSource: DataSource,
  verificationStatus?: VerificationStatus,
): boolean {
  const envIsMock = dataEnvironment === "mock";
  const sourceIsMock = dataSource === "mock";
  if (envIsMock !== sourceIsMock) return false;
  if (verificationStatus === undefined) return true;
  return envIsMock === (verificationStatus === "MOCK");
}

/** Gear Profile 계산 방식. 계산 방식이 바뀌면 calculation.version을 올린다. */
export const GEAR_CALCULATION_METHODS = ["MEAN_OF_RANKABLE_EQUIPPED"] as const;
export type GearCalculationMethod = (typeof GEAR_CALCULATION_METHODS)[number];

/** 정적 게임 데이터 종류 (docs/STATIC-GAME-DATA.md) */
export const STATIC_DATA_KINDS = [
  "items",
  "classes",
  "races",
  "factions",
  "game_modes",
  "dungeons",
  "raids",
  "bosses",
] as const;
export type StaticDataKind = (typeof STATIC_DATA_KINDS)[number];

/**
 * 정적 데이터셋의 이용 조건 확인 상태
 * - PERMITTED: 이용 조건을 확인했고 저장·표시가 허용됨 (조건 URL과 확인 날짜 필수)
 * - MOCK: 개발용 가짜 데이터 (mock 영역 전용)
 * - UNKNOWN: 이용 조건을 확인하지 못함 → DB에 넣지 않음
 * - PROHIBITED: 이용 조건상 사용할 수 없음 → DB에 넣지 않음
 */
export const STATIC_DATA_LICENSE_STATUSES = ["PERMITTED", "MOCK", "UNKNOWN", "PROHIBITED"] as const;
export type StaticDataLicenseStatus = (typeof STATIC_DATA_LICENSE_STATUSES)[number];
