/** 캐릭터 제출 API 문구 (관리자 / 개발 검증용) */
export const submissions = {
  issues: {
    INVALID_FORMAT: "제출 데이터 형식이 올바르지 않습니다.",
    OBSERVED_AT_REQUIRED: "관측 시각이 없습니다.",
    OBSERVED_AT_IN_FUTURE: "관측 시각이 현재보다 미래입니다.",
    OBSERVED_AT_TOO_OLD: "관측 시각이 너무 오래되었습니다.",
    SOURCE_BUILD_REQUIRED: "클라이언트 빌드 정보가 없습니다.",
    CHARACTER_NAME_REQUIRED: "캐릭터 이름이 없습니다.",
    CHARACTER_LEVEL_REQUIRED: "캐릭터 레벨이 없습니다.",
    NAME_SEPARATOR_UNCONFIRMED: "이름과 성의 구분 방식이 아직 확인되지 않아 처리할 수 없습니다.",
    MAPPING_MISSING: "아직 확인되지 않은 게임 값이 있어 처리할 수 없습니다.",
    UNKNOWN_SLOT: "알 수 없는 장비 슬롯입니다.",
    SLOT_MAPPING_UNAVAILABLE: "장비 슬롯 기준이 없어 장비를 처리할 수 없습니다.",
  },
  errors: {
    UNAUTHORIZED: "인증 정보가 올바르지 않습니다.",
    UNSUPPORTED_MEDIA_TYPE: "JSON 형식으로 보내야 합니다.",
    PAYLOAD_TOO_LARGE: "제출 데이터가 너무 큽니다.",
    RATE_LIMITED: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    MOCK_ENVIRONMENT: "테스트 데이터 환경에서는 검증(dryRun)만 할 수 있습니다.",
    INVALID_JSON: "JSON을 읽을 수 없습니다.",
    VALIDATION_FAILED: "제출 데이터를 처리할 수 없습니다.",
  },
} as const;
