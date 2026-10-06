/**
 * Mock 데이터 seed (명세서 §6.4-6)
 *
 *   npm run db:seed -- --confirm-mock [--seed=20261006] [--anchor=2026-10-06T00:00:00Z] [--count=120]
 *
 * mock 영역 데이터만 지우고 다시 만든다. 같은 seed와 같은 anchor면 항상 같은 결과가 나온다.
 * anchor를 생략하면 오늘 0시(UTC)를 기준으로 한다.
 */
import { loadEnvFile, openScriptDb } from "@/db/script-client";
import { getAppDataEnvironment } from "@/lib/config/env";
import { DEFAULT_MOCK_CHARACTER_COUNT, DEFAULT_MOCK_SEED, startOfUtcDay } from "@/lib/mock/generator";
import { MockSeedRefusedError, seedMockDatabase } from "@/lib/mock/seed";

loadEnvFile();

function argValue(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

const seed = Number(argValue("seed") ?? DEFAULT_MOCK_SEED);
const count = Number(argValue("count") ?? DEFAULT_MOCK_CHARACTER_COUNT);
const anchorArg = argValue("anchor");
const anchor = anchorArg ? new Date(anchorArg) : startOfUtcDay(new Date());
if (!Number.isInteger(seed) || !Number.isInteger(count) || count < 1 || Number.isNaN(anchor.getTime())) {
  console.error("seed, count, anchor 값이 올바르지 않습니다.");
  process.exit(1);
}

const { db, close } = openScriptDb();
try {
  const summary = await seedMockDatabase(db, {
    appEnv: getAppDataEnvironment(),
    confirmed: process.argv.includes("--confirm-mock"),
    options: { seed, anchor, characterCount: count },
  });
  console.log(
    `mock 데이터를 만들었습니다. seed=${summary.seed}, 기준 시각=${anchor.toISOString()}, ` +
      `관측 ${summary.observations}건 (반영 ${summary.accepted}, 거부 ${summary.rejected}, 식별 충돌 ${summary.conflicts})`,
  );
} catch (error) {
  console.error(error instanceof MockSeedRefusedError ? error.message : error);
  process.exitCode = 1;
} finally {
  await close();
}
