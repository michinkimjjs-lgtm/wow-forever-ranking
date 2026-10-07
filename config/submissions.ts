/**
 * 캐릭터 제출 정책 (docs/SUBMISSION-SYSTEM.md, docs/PRIVACY-DATA-POLICY.md)
 *
 * 숫자는 운영 보호용 값이다(게임 데이터 가정이 아님). 운영하면서 조정한다.
 */
export const submissionPolicy = {
  /** 동의 문구 버전. 문구를 바꾸면 올린다. 저장된 동의 기록과 함께 남는다. */
  consentVersion: "consent-2026-10-07",
  /** 개인정보·데이터 정책 버전 (docs/PRIVACY-DATA-POLICY.md) */
  policyVersion: "privacy-2026-10-07",
  /**
   * 충돌이 없는 공개 제출을 자동으로 랭킹에 반영할지.
   * false: 모든 공개 제출은 관리자 검토(PENDING) 후 반영한다.
   */
  autoAcceptNonConflicting: false,
  limits: {
    /** 업로드 파일 / 요청 본문 최대 크기 */
    maxBytes: 256 * 1024,
    /** JSON 최대 중첩 깊이 */
    maxDepth: 12,
    /** JSON 문자열 값 하나의 최대 길이 */
    maxStringLength: 2048,
    /** JSON 전체 값(객체·배열·원시값) 최대 개수 */
    maxNodes: 20_000,
  },
  rateLimit: {
    /** 같은 클라이언트(일시 식별값) 기준 */
    perClient: { limit: 10, windowMs: 60 * 60_000 },
    /** 서버 전체 공개 제출 */
    global: { limit: 500, windowMs: 60 * 60_000 },
  },
  /** 같은 캐릭터를 다시 제출할 수 있는 최소 간격 (분) */
  perCharacterMinIntervalMinutes: 10,
  /** 같은 캐릭터의 검토 대기(PENDING / CONFLICT) 최대 건수 */
  maxOpenPerCharacter: 5,
  /** 제출 화면 보안 토큰 유효 시간 (분) */
  csrfTokenTtlMinutes: 120,
  /** 관리자 로그인 유지 시간 (분) */
  adminSessionMinutes: 8 * 60,
} as const;

export type SubmissionPolicy = typeof submissionPolicy;
