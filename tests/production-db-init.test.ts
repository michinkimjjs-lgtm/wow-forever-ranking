/**
 * Vercel Production 빌드의 운영 DB 자동 초기화 (lib/deploy/production-db-init.ts)
 *
 * DB 동작은 PGlite(메모리 PostgreSQL)에 실제 migration을 적용해 확인한다.
 * 연결 주소는 모두 가짜 값이다.
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it, vi } from "vitest";
import { initDatabaseIdentity, readDatabaseIdentity } from "@/db/identity";
import * as schema from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import {
  decideProductionDbInit,
  redactSecrets,
  runProductionDbInit,
  type ProductionDbConnection,
} from "@/lib/deploy/production-db-init";

const FAKE_URL = "postgresql://owner:s3cr3t-pass@ep-fake-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const EXPECTED = (JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8")) as { entries: unknown[] }).entries.length;

const PRODUCTION = { VERCEL: "1", VERCEL_ENV: "production", APP_DATA_ENVIRONMENT: "live", DATABASE_URL_UNPOOLED: FAKE_URL };

/** PGlite 기반 연결. 같은 PGlite를 여러 번 연결해 "다시 배포"를 흉내 낸다. */
function pgliteConnection(client: PGlite, options: { failMigrate?: boolean } = {}) {
  const calls = { connect: 0, migrate: 0, close: 0, urls: [] as string[] };
  const connect = async (url: string): Promise<ProductionDbConnection> => {
    calls.connect += 1;
    calls.urls.push(url);
    const db = drizzle(client, { schema });
    return {
      db: db as unknown as AppDatabase,
      migrate: async () => {
        calls.migrate += 1;
        if (options.failMigrate) throw new Error(`migration failed while connected to ${FAKE_URL}`);
        await migrate(db, { migrationsFolder: "db/migrations" });
      },
      close: async () => {
        calls.close += 1;
      },
    };
  };
  return { connect, calls };
}

const newClient = () => new PGlite({ extensions: { pg_trgm } });

async function countRows(client: PGlite, table: string): Promise<number> {
  const result = await client.query<{ n: number }>(`select count(*)::int as n from ${table}`);
  return result.rows[0]!.n;
}

describe("실행 조건 판단 (DB 접속 없음)", () => {
  it("Production + live + 직접 연결 주소일 때만 실행한다", () => {
    expect(decideProductionDbInit(PRODUCTION)).toEqual({ action: "run", url: FAKE_URL });
  });

  it("Preview·Development 빌드는 운영 DB에 접속하지 않고 건너뛴다 (주소가 있어도)", () => {
    for (const vercelEnv of ["preview", "development"]) {
      expect(decideProductionDbInit({ ...PRODUCTION, VERCEL_ENV: vercelEnv })).toMatchObject({ action: "skip" });
    }
  });

  it("로컬 빌드(VERCEL 없음)는 건너뛴다", () => {
    expect(decideProductionDbInit({ APP_DATA_ENVIRONMENT: "live", DATABASE_URL_UNPOOLED: FAKE_URL })).toMatchObject({ action: "skip" });
    expect(decideProductionDbInit({})).toMatchObject({ action: "skip" });
  });

  it("Vercel인데 VERCEL_ENV를 알 수 없으면 실패한다 (Production인지 확인할 수 없음)", () => {
    expect(decideProductionDbInit({ VERCEL: "1", APP_DATA_ENVIRONMENT: "live", DATABASE_URL_UNPOOLED: FAKE_URL })).toMatchObject({
      action: "fail",
    });
  });

  it("Production에서 필요한 환경변수가 없거나 잘못되면 실패한다", () => {
    const cases: Record<string, string | undefined>[] = [
      { ...PRODUCTION, APP_DATA_ENVIRONMENT: undefined },
      { ...PRODUCTION, APP_DATA_ENVIRONMENT: "mock" },
      { ...PRODUCTION, APP_DATA_ENVIRONMENT: "beta" },
      { ...PRODUCTION, DATABASE_URL_UNPOOLED: undefined },
      { ...PRODUCTION, DATABASE_URL_UNPOOLED: "  " },
      { ...PRODUCTION, DATABASE_URL_UNPOOLED: "mysql://x" },
      { ...PRODUCTION, DATABASE_URL_UNPOOLED: FAKE_URL.replace("ep-fake-123456", "ep-fake-123456-pooler") },
    ];
    for (const env of cases) {
      const decision = decideProductionDbInit(env);
      expect(decision.action).toBe("fail");
      if (decision.action === "fail") expect(decision.reason).not.toContain("s3cr3t");
    }
  });

  it("DATABASE_URL(풀링 주소)만 있고 DATABASE_URL_UNPOOLED가 없으면 실패한다 (이름을 바꿔 쓰지 않음)", () => {
    const env = { VERCEL: "1", VERCEL_ENV: "production", APP_DATA_ENVIRONMENT: "live", DATABASE_URL: FAKE_URL };
    expect(decideProductionDbInit(env)).toMatchObject({ action: "fail" });
  });
});

describe("운영 DB 초기화 실행", () => {
  it("Preview 빌드에서는 DB 연결 함수가 한 번도 호출되지 않는다", async () => {
    const connect = vi.fn();
    const result = await runProductionDbInit({ ...PRODUCTION, VERCEL_ENV: "preview" }, { connect, expectedMigrations: EXPECTED, log: () => {} });
    expect(result.status).toBe("skipped");
    expect(connect).not.toHaveBeenCalled();
  });

  it("환경변수가 없으면 DB에 접속하지 않고 실패한다", async () => {
    const connect = vi.fn();
    await expect(
      runProductionDbInit({ ...PRODUCTION, DATABASE_URL_UNPOOLED: undefined }, { connect, expectedMigrations: EXPECTED, log: () => {} }),
    ).rejects.toThrow(/DATABASE_URL_UNPOOLED/);
    expect(connect).not.toHaveBeenCalled();
  });

  it("빈 DB: migration → database_identity [live] → 검증, 게임 데이터·Mock 데이터는 없다", async () => {
    const client = newClient();
    const { connect, calls } = pgliteConnection(client);
    const logs: string[] = [];
    const result = await runProductionDbInit(PRODUCTION, { connect, expectedMigrations: EXPECTED, log: (m) => logs.push(m) });
    expect(result).toEqual({ status: "initialized", identityCreated: true, appliedMigrations: EXPECTED });
    expect(calls).toMatchObject({ connect: 1, migrate: 1, close: 1, urls: [FAKE_URL] });
    const db = drizzle(client, { schema }) as unknown as AppDatabase;
    expect(await readDatabaseIdentity(db)).toEqual(["live"]);
    for (const table of ["characters", "guilds", "items", "character_items", "character_snapshots", "level_milestones", "ingestion_records", "character_submissions", "static_datasets"]) {
      expect(await countRows(client, table)).toBe(0);
    }
    expect(logs.join("\n")).not.toContain("s3cr3t");
    expect(logs.join("\n")).not.toContain("neon.tech");
    await client.close();
  });

  it("이미 live로 초기화된 DB에서 다시 실행해도 안전하다 (재배포)", async () => {
    const client = newClient();
    const first = pgliteConnection(client);
    await runProductionDbInit(PRODUCTION, { connect: first.connect, expectedMigrations: EXPECTED, log: () => {} });
    const second = pgliteConnection(client);
    const result = await runProductionDbInit(PRODUCTION, { connect: second.connect, expectedMigrations: EXPECTED, log: () => {} });
    expect(result).toEqual({ status: "initialized", identityCreated: false, appliedMigrations: EXPECTED });
    expect(await readDatabaseIdentity(drizzle(client, { schema }) as unknown as AppDatabase)).toEqual(["live"]);
    await client.close();
  });

  it("다른 영역(beta / mock)으로 표시된 DB는 덮어쓰지 않고, migration도 실행하지 않고 실패한다", async () => {
    for (const other of [["beta"], ["mock"], ["beta", "live"]] as const) {
      const client = newClient();
      const db = drizzle(client, { schema });
      await migrate(db, { migrationsFolder: "db/migrations" });
      await initDatabaseIdentity(db as unknown as AppDatabase, [...other]);
      const { connect, calls } = pgliteConnection(client);
      await expect(runProductionDbInit(PRODUCTION, { connect, expectedMigrations: EXPECTED, log: () => {} })).rejects.toThrow(
        /live 운영 DB가 아니므로/,
      );
      expect(calls.migrate).toBe(0);
      expect(calls.close).toBe(1);
      expect(await readDatabaseIdentity(db as unknown as AppDatabase)).toEqual([...other]);
      await client.close();
    }
  });

  it("migration이 실패하면 식별 표식을 만들지 않고 빌드를 멈추며, 오류에 연결 주소를 남기지 않는다", async () => {
    const client = newClient();
    const { connect, calls } = pgliteConnection(client, { failMigrate: true });
    const error = await runProductionDbInit(PRODUCTION, { connect, expectedMigrations: EXPECTED, log: () => {} }).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/운영 DB 초기화 실패\(migration\)/);
    expect((error as Error).message).not.toContain("s3cr3t");
    expect((error as Error).message).not.toContain("ep-fake-123456");
    expect(calls.close).toBe(1);
    const tables = await client.query(`select to_regclass('public.database_identity') as t`);
    expect((tables.rows[0] as { t: string | null }).t).toBeNull();
    await client.close();
  });

  it("저장소의 migration 수와 적용 결과가 다르면 실패한다", async () => {
    const client = newClient();
    const { connect } = pgliteConnection(client);
    await expect(runProductionDbInit(PRODUCTION, { connect, expectedMigrations: EXPECTED + 1, log: () => {} })).rejects.toThrow(
      /migration 수/,
    );
    await client.close();
  });
});

describe("비밀값 보호", () => {
  it("오류 메시지에서 연결 주소·비밀번호를 지운다", () => {
    const message = `connect failed: ${FAKE_URL} (password s3cr3t-pass) other postgres://u:p@h/db`;
    const out = redactSecrets(message, FAKE_URL);
    expect(out).not.toContain("s3cr3t-pass");
    expect(out).not.toContain("ep-fake-123456");
    expect(out).not.toContain("u:p@h");
  });

  it("빌드 스크립트는 Mock seed를 부르지 않고 .env를 읽지 않는다", () => {
    for (const file of ["scripts/production-db-init.ts", "lib/deploy/production-db-init.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/seed(Mock|-mock)|db:seed|lib\/mock/);
      expect(source).not.toMatch(/loadEnvFile|process\.loadEnvFile/);
      expect(source).not.toMatch(/console\.(log|error)\([^)]*url/i);
    }
  });

  it("Vercel 빌드 명령은 전용 스크립트를 거쳐 기존 build를 그대로 실행한다", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { buildCommand: string };
    const scripts = (JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }).scripts;
    expect(vercel.buildCommand).toBe("npm run build:vercel");
    expect(scripts["build:vercel"]).toBe("tsx scripts/production-db-init.ts && npm run build");
    expect(scripts.build).toBe("next build");
    expect(scripts.prebuild).toContain("build-collector");
  });
});
