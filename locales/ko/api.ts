/** API 오류 응답의 사용자 문구 (명세서 §17) */
export const api = {
  INVALID_QUERY: "요청 값이 올바르지 않습니다.",
  NOT_FOUND: "요청한 데이터를 찾을 수 없습니다.",
  CHARACTER_NOT_FOUND: "캐릭터를 찾을 수 없습니다.",
  GUILD_NOT_FOUND: "길드를 찾을 수 없습니다.",
  GAME_SCOPE_NOT_CONFIGURED: "이 데이터 영역의 지역·게임 모드 설정이 아직 확인되지 않아 데이터를 준비 중입니다.",
  SERVICE_UNAVAILABLE: "서비스 설정을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.",
  INTERNAL_ERROR: "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
} as const;
