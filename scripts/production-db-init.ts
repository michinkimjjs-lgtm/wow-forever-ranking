/**
 * Vercel Production 빌드 전 운영 DB 자동 초기화 (lib/deploy/production-db-init.ts, docs/DEPLOYMENT.md)
 *
 *   npm run build:vercel  =  이 스크립트 → 성공할 때만 npm run build
 *
 * - Preview / 로컬 빌드: DB에 접속하지 않고 건너뛴다(성공으로 끝남).
 * - Production 빌드: migration → database_identity = [live] → 검증. 실패하면 종료 코드 1로 빌드를 멈춘다.
 * - Mock seed는 실행하지 않는다. 연결 주소는 출력하지 않는다.
 * - .env 파일을 읽지 않는다. Vercel 환경변수만 쓴다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { runProductionDbInit, type ProductionDbConnection } from "@/lib/deploy/production-db-init";

const MIGRATIONS = join(process.cwd(), "db/migrations");
const log = (message: string) => console.log(`[운영 DB 초기화] ${message}`);

async function connect(url: string): Promise<ProductionDbConnection> {
  const client = postgres(url, { max: 1, connect_timeout: 30, onnotice: () => {} });
  const db = drizzle(client, { schema });
  return {
    db: db as unknown as AppDatabase,
    migrate: () => migrate(db, { migrationsFolder: MIGRATIONS }),
    close: () => client.end({ timeout: 5 }),
  };
}

const journal = JSON.parse(readFileSync(join(MIGRATIONS, "meta/_journal.json"), "utf8")) as { entries: unknown[] };

try {
  const result = await runProductionDbInit(process.env, { connect, expectedMigrations: journal.entries.length, log });
  if (result.status === "initialized") log("완료. Next.js 빌드를 계속합니다.");
} catch (error) {
  console.error(`[운영 DB 초기화] ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
  console.error("[운영 DB 초기화] 빌드를 중단합니다. 기존 Production 배포는 바뀌지 않습니다.");
  process.exitCode = 1;
}
