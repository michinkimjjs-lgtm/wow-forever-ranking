/**
 * 간단한 고정 창(fixed window) 요청 제한. 관리자 검증용 API의 남용을 막는다.
 * 프로세스 메모리 기반이므로 여러 서버로 늘릴 때는 Redis 구현으로 바꾼다(P1).
 */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** 허용되면 true */
  take(key: string, now = Date.now()): boolean {
    const current = this.windows.get(key);
    if (!current || now - current.start >= this.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      if (this.windows.size > 10_000) this.windows.clear();
      return true;
    }
    if (current.count >= this.limit) return false;
    current.count += 1;
    return true;
  }
}
