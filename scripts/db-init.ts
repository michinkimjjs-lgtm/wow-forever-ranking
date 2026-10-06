/**
 * DB 식별 표식 초기화 (명세서 §6.4-1): 이 DB가 받을 데이터 영역을 한 번만 설정한다.
 *
 *   npm run db:init -- --allow=mock
 *   npm run db:init -- --allow=beta,live
 *
 * --allow 값이 APP_DATA_ENVIRONMENT를 포함해야 한다.
 */
import { initDatabaseIdentity } from "@/db/identity";
import { loadEnvFile, openScriptDb } from "@/db/script-client";
import { getAppDataEnvironment } from "@/lib/config/env";
import { DATA_ENVIRONMENTS, type DataEnvironment } from "@/lib/domain/enums";

loadEnvFile();
const arg = process.argv.find((a) => a.startsWith("--allow="));
if (!arg) {
  console.error("--allow 인자가 필요합니다. 예: npm run db:init -- --allow=mock");
  process.exit(1);
}
const allowed = arg
  .slice("--allow=".length)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (!allowed.every((v): v is DataEnvironment => (DATA_ENVIRONMENTS as readonly string[]).includes(v))) {
  console.error(`허용 영역 값이 올바르지 않습니다: ${allowed.join(", ")}`);
  process.exit(1);
}
const appEnv = getAppDataEnvironment();
if (!allowed.includes(appEnv)) {
  console.error(`--allow(${allowed.join(", ")})에 APP_DATA_ENVIRONMENT(${appEnv})가 포함되어야 합니다.`);
  process.exit(1);
}

const { db, close } = openScriptDb();
try {
  const result = await initDatabaseIdentity(db, allowed);
  console.log(
    result.created
      ? `DB 식별 표식을 설정했습니다: [${result.allowed.join(", ")}]`
      : `DB 식별 표식이 이미 [${result.allowed.join(", ")}]로 설정되어 있습니다.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await close();
}
