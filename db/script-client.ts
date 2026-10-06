/**
 * CLI 스크립트(마이그레이션, 초기화, seed)용 DB 연결.
 * server-only 제약 없이 사용하고, 끝나면 연결을 닫는다.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseUrl } from "@/lib/config/env";
import * as schema from "./schema";
import type { AppDatabase } from "./types";

export function openScriptDb(): { db: AppDatabase; close: () => Promise<void> } {
  const client = postgres(getDatabaseUrl(), { max: 1, onnotice: () => {} });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

/** .env 파일이 있으면 읽는다. (Next.js는 자동으로 읽지만 CLI 스크립트는 직접 읽어야 한다) */
export function loadEnvFile(): void {
  try {
    process.loadEnvFile(".env");
  } catch {
    // .env가 없으면 이미 설정된 환경변수만 사용한다.
  }
}
