/**
 * 제출 처리 오류 코드 (docs/DATA-SPEC.md §9)
 * 메시지는 locales/ko/submissions.ts의 한국어 문구를 쓴다.
 */
export const SUBMISSION_ISSUE_CODES = [
  "INVALID_FORMAT",
  "MOCK_FIXTURE_REJECTED",
  "OBSERVED_AT_REQUIRED",
  "OBSERVED_AT_IN_FUTURE",
  "OBSERVED_AT_TOO_OLD",
  "SOURCE_BUILD_REQUIRED",
  "CHARACTER_NAME_REQUIRED",
  "CHARACTER_LEVEL_REQUIRED",
  "NAME_SEPARATOR_UNCONFIRMED",
  "FULL_NAME_REQUIRED",
  "MAPPING_MISSING",
  "UNKNOWN_SLOT",
  "SLOT_MAPPING_UNAVAILABLE",
] as const;
export type SubmissionIssueCode = (typeof SUBMISSION_ISSUE_CODES)[number];

export interface SubmissionIssue {
  code: SubmissionIssueCode;
  /** 문제가 된 위치 (예: "gear[2].itemLevel") */
  path: string;
  /** 영어 개발용 설명 (사용자 문구는 code로 locale에서 찾는다) */
  detail?: string;
}
