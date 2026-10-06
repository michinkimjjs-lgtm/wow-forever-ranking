/**
 * DB 마이그레이션 실행: npm run db:migrate
 */
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { loadEnvFile, openScriptDb } from "@/db/script-client";

loadEnvFile();
const { db, close } = openScriptDb();
try {
  await migrate(db as Parameters<typeof migrate>[0], { migrationsFolder: "db/migrations" });
  console.log("마이그레이션을 적용했습니다.");
} catch (error) {
  console.error("마이그레이션에 실패했습니다.", error);
  process.exitCode = 1;
} finally {
  await close();
}
