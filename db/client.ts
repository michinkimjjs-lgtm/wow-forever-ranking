import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseUrl } from "@/lib/config/env";
import * as schema from "./schema";
import type { AppDatabase } from "./types";

const globalForDb = globalThis as unknown as { __foreverRankDb?: AppDatabase };

/** 운영 / 개발 서버용 DB 연결. 개발 모드 핫 리로드에서도 연결을 하나만 유지한다. */
export function getDb(): AppDatabase {
  if (!globalForDb.__foreverRankDb) {
    const client = postgres(getDatabaseUrl(), { max: 10 });
    globalForDb.__foreverRankDb = drizzle(client, { schema });
  }
  return globalForDb.__foreverRankDb;
}
