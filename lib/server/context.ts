import "server-only";
/**
 * 요청 처리용 서버 컨텍스트.
 * 처음 사용할 때 설정 검증과 DB 식별 표식 검사(명세서 §6.4-4)를 하고, 실패하면 요청을 처리하지 않는다.
 */
import { getDb } from "@/db/client";
import { assertDatabaseIdentityMatches } from "@/db/identity";
import type { AppDatabase } from "@/db/types";
import { MemoryCacheStore, type CacheStore } from "@/lib/cache";
import { loadConfig } from "@/lib/config";
import { getAppDataEnvironment } from "@/lib/config/env";
import type { DataEnvironment } from "@/lib/domain/enums";

export interface ServerContext {
  db: AppDatabase;
  appEnv: DataEnvironment;
  cache: CacheStore;
  now: Date;
}

const globalState = globalThis as unknown as {
  __foreverRankVerified?: Promise<void>;
  __foreverRankCache?: CacheStore;
};

/** 설정과 DB 식별 표식을 확인한다. 성공한 결과만 기억한다. */
export async function verifyStartup(): Promise<{ db: AppDatabase; appEnv: DataEnvironment }> {
  const appEnv = getAppDataEnvironment();
  loadConfig();
  const db = getDb();
  if (!globalState.__foreverRankVerified) {
    globalState.__foreverRankVerified = assertDatabaseIdentityMatches(db, appEnv).catch((error: unknown) => {
      globalState.__foreverRankVerified = undefined;
      throw error;
    });
  }
  await globalState.__foreverRankVerified;
  return { db, appEnv };
}

export async function getServerContext(): Promise<ServerContext> {
  const { db, appEnv } = await verifyStartup();
  globalState.__foreverRankCache ??= new MemoryCacheStore();
  return { db, appEnv, cache: globalState.__foreverRankCache, now: new Date() };
}

/** DB에 접속하지 않고 배포 영역만 확인한다. (레이아웃의 Mock 안내 표시용) */
export function getAppEnvironmentSafe(): DataEnvironment | null {
  try {
    return getAppDataEnvironment();
  } catch {
    return null;
  }
}
