/**
 * 테스트용 PostgreSQL (PGlite, 메모리). 실제 마이그레이션(트리거, CHECK 포함)을 그대로 적용한다.
 */
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { initDatabaseIdentity } from "@/db/identity";
import * as schema from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import type { DataEnvironment } from "@/lib/domain/enums";

export async function createTestDb(allowed: DataEnvironment[] | null) {
  const client = new PGlite({ extensions: { pg_trgm } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "db/migrations" });
  if (allowed) await initDatabaseIdentity(db as unknown as AppDatabase, allowed);
  return { db: db as unknown as AppDatabase, client, close: () => client.close() };
}
