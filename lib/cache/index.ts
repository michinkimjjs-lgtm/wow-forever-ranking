/**
 * 캐시 인터페이스 (명세서 §10.5)
 * Phase 1은 인메모리 구현을 사용한다. P1에서 Redis 구현으로 바꿔도 이 인터페이스는 유지한다.
 * 모든 캐시 키는 dataEnvironment로 시작한다(명세서 §6.4-9).
 */
import type { DataEnvironment } from "@/lib/domain/enums";

export interface CacheStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  clear(): void;
}

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, { value: unknown; expiresAt: number }>();

  constructor(private readonly maxEntries = 500) {}

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}

/** 캐시 키는 반드시 dataEnvironment로 시작한다. */
export function cacheKey(env: DataEnvironment, ...parts: (string | number | boolean | null | undefined)[]): string {
  return [env, ...parts.map((p) => (p === undefined || p === null ? "" : String(p)))].join(":");
}

export async function cached<T>(store: CacheStore, key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get<T>(key);
  if (hit !== undefined) return hit;
  const value = await load();
  store.set(key, value, ttlMs);
  return value;
}
