/** Blizzard API 호출 오류. retryable은 재시도해도 되는 오류(429, 5xx, 시간 초과)인지 뜻한다. */
export class BlizzardApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "BlizzardApiError";
  }
}

export function errorForStatus(status: number): BlizzardApiError {
  if (status === 401 || status === 403) {
    return new BlizzardApiError(`Blizzard API 인증이 거부되었습니다. (HTTP ${status})`, status, false);
  }
  if (status === 429) return new BlizzardApiError("Blizzard API 요청 한도를 넘었습니다. (HTTP 429)", status, true);
  if (status >= 500) return new BlizzardApiError(`Blizzard API 서버 오류입니다. (HTTP ${status})`, status, true);
  return new BlizzardApiError(`Blizzard API 요청이 실패했습니다. (HTTP ${status})`, status, false);
}
