/**
 * 정적 게임 데이터셋 검증 / 가져오기 (docs/STATIC-GAME-DATA.md §4)
 *
 *   npm run static-data:import -- --file=dataset.json            검증만 (DB를 쓰지 않음)
 *   npm run static-data:import -- --file=dataset.json --commit   APP_DATA_ENVIRONMENT 영역에 저장
 *   npm run static-data:import -- --mock --confirm-mock --commit mock 정적 데이터셋 저장 (mock DB 전용)
 *
 * 이용 조건이 확인되지 않은 데이터셋(license.status ≠ PERMITTED)은 실제 영역에 저장하지 않는다.
 */
import { readFileSync } from "node:fs";
import { assertDatabaseIdentityMatches } from "@/db/identity";
import { loadEnvFile, openScriptDb } from "@/db/script-client";
import { getAppDataEnvironment } from "@/lib/config/env";
import { assertMockSeedAllowed } from "@/lib/mock/seed";
import { DatabaseStaticDataImporter, type StaticDataImportResult } from "@/lib/static-data/importer";
import { buildMockItemCatalog, buildMockMetadataDatasets } from "@/lib/static-data/mock";
import { validateStaticDataset } from "@/lib/static-data/validate";

loadEnvFile();

const fileArg = process.argv.find((a) => a.startsWith("--file="))?.slice("--file=".length);
const commit = process.argv.includes("--commit");
const mock = process.argv.includes("--mock");

function printResult(label: string, result: Pick<StaticDataImportResult, "status" | "recordCount" | "issues">) {
  console.log(`[${label}] ${result.status} · 레코드 ${result.recordCount}개`);
  for (const issue of result.issues) console.log(`  - ${issue.severity === "error" ? "오류" : "경고"}: ${issue.message}`);
}

if (!fileArg && !mock) {
  console.error("--file=경로 또는 --mock 인자가 필요합니다.");
  process.exit(1);
}

if (fileArg && !commit) {
  const result = validateStaticDataset(JSON.parse(readFileSync(fileArg, "utf8")));
  printResult(fileArg, {
    status: result.ok ? "UNCHANGED" : "REJECTED",
    recordCount: result.ok ? result.records.length : 0,
    issues: result.issues,
  });
  console.log(result.ok ? "검증 통과. 저장하려면 --commit을 붙입니다." : "검증 실패.");
  process.exit(result.ok ? 0 : 1);
}

const appEnv = getAppDataEnvironment();
const { db, close } = openScriptDb();
try {
  await assertDatabaseIdentityMatches(db, appEnv);
  const importer = new DatabaseStaticDataImporter(db, appEnv);
  if (mock) {
    await assertMockSeedAllowed(db, { appEnv, confirmed: process.argv.includes("--confirm-mock") });
    const observedAt = new Date("2026-10-06T00:00:00Z");
    for (const dataset of [...buildMockMetadataDatasets(observedAt), buildMockItemCatalog(observedAt, { anchor: observedAt })]) {
      printResult(dataset.meta.kind, await importer.importDataset(dataset));
    }
  } else if (fileArg) {
    const result = await importer.importDataset(JSON.parse(readFileSync(fileArg, "utf8")));
    printResult(fileArg, result);
    if (result.status === "REJECTED") process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await close();
}
