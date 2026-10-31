/**
 * 홈 DEMO 종족 초상화 수집: npm run portraits:collect
 *
 * - lib/demo/race-portrait-sources.ts에서 이용 조건이 확인(CONFIRMED)된 항목만 public/demo/races/에 내려받는다.
 * - 받은 파일의 해시·해상도·출처는 lib/demo/race-portraits.lock.json에 기록하고, 다시 실행하면 같은 파일은 건너뛴다.
 * - 실행 로그는 logs/image-collector/에 JSON Lines로 남긴다(저장소에 올리지 않음).
 * - 401·403·429·CAPTCHA를 만나면 즉시 멈추고 종료 코드 2로 끝난다. 우회하지 않는다.
 * 화면에 표시하려면 lib/demo/race-portraits.ts에 출처·라이선스를 등록해야 한다(수집과 별도).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { collectImages, type LockFile } from "@/lib/image-collector/collector";
import { RACE_PORTRAIT_SOURCES } from "@/lib/demo/race-portrait-sources";

const IMAGE_DIR = "public/demo/races";
const LOCK_FILE = "lib/demo/race-portraits.lock.json";
const LOG_DIR = "logs/image-collector";

const lock = JSON.parse(await readFile(LOCK_FILE, "utf8")) as LockFile;
const { lock: nextLock, log, stopped } = await collectImages(RACE_PORTRAIT_SOURCES, lock, {
  fetch: (url, init) => fetch(url, init),
  now: () => new Date(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  readFile: async (file) => readFile(join(IMAGE_DIR, file)).then((b) => new Uint8Array(b), () => null),
  writeFile: async (file, bytes) => {
    await mkdir(IMAGE_DIR, { recursive: true });
    await writeFile(join(IMAGE_DIR, file), bytes);
  },
});

await writeFile(LOCK_FILE, `${JSON.stringify(nextLock, null, 2)}\n`);
const logFile = join(LOG_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
await mkdir(dirname(logFile), { recursive: true });
await writeFile(logFile, log.map((e) => JSON.stringify(e)).join("\n") + "\n");

for (const e of log) console.log(`${e.key.padEnd(9)} ${e.outcome}${e.detail ? ` — ${e.detail}` : ""}`);
console.log(`로그: ${logFile}`);
if (stopped) {
  console.error("접근 제한(401·403·429·CAPTCHA)으로 수집을 멈췄습니다. 우회하지 말고 출처의 이용 조건과 접속 허용 여부를 확인하세요.");
  process.exitCode = 2;
}
