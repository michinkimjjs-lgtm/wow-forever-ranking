/**
 * Vercel Production 빌드의 운영 DB 자동 초기화 (docs/DEPLOYMENT.md)
 *
 *   vercel.json buildCommand → npm run build:vercel
 *     → scripts/production-db-init.ts (이 모듈) → 성공할 때만 npm run build
 *
 * 순서
 *   1. VERCEL_ENV = production 인지 확인한다. Preview / 로컬 빌드는 DB에 접속하지 않고 건너뛴다.
 *   2. APP_DATA_ENVIRONMENT = live 인지 확인한다.
 *   3. DATABASE_URL_UNPOOLED(Neon 직접 연결 주소)가 있는지 확인한다.
 *   4. 이미 다른 영역(beta / mock)으로 표시된 DB면 migration 전에 멈춘다.
 *   5. migration → database_identity = [live] (이미 live면 그대로) → 검증
 *
 * 안전장치
 *   - Mock seed는 이 모듈에서 부르지 않는다. 게임 데이터·테스트 데이터를 넣지 않는다.
 *   - 연결 주소와 비밀번호는 출력하지 않는다. 오류 메시지에서도 지운다.
 *   - 여러 빌드가 동시에 실행돼도 advisory lock으로 한 번에 하나만 초기화한다.
 *   - 실패하면 예외를 던져 빌드를 중단한다(이전 Production 배포는 그대로 유지된다).
 */
import { sql } from "drizzle-orm";
import type { AppDatabase } from "@/db/types";
import { assertDatabaseIdentityMatches, initDatabaseIdentity, readDatabaseIdentity } from "@/db/identity";

/** 이 초기화에서 읽는 환경변수 이름 (Vercel 설정 이름 그대로) */
export const PRODUCTION_DB_ENV = {
  vercel: "VERCEL",
  vercelEnv: "VERCEL_ENV",
  appEnv: "APP_DATA_ENVIRONMENT",
  unpooledUrl: "DATABASE_URL_UNPOOLED",
} as const;

/** 동시에 실행되는 Production 빌드가 같은 DB를 함께 초기화하지 않도록 잡는 잠금 번호 */
export const PRODUCTION_DB_INIT_LOCK_KEY = 4_120_250_001;

export type ProductionDbInitDecision =
  | { action: "skip"; reason: string }
  | { action: "fail"; reason: string }
  | { action: "run"; url: string };

type Env = Readonly<Record<string, string | undefined>>;

/** 환경변수만 보고 실행 여부를 정한다. DB에 접속하지 않는다. */
export function decideProductionDbInit(env: Env): ProductionDbInitDecision {
  if (env[PRODUCTION_DB_ENV.vercel] !== "1") {
    return { action: "skip", reason: "Vercel 빌드가 아니므로 운영 DB 초기화를 건너뜁니다." };
  }
  const vercelEnv = env[PRODUCTION_DB_ENV.vercelEnv];
  if (!vercelEnv) {
    return {
      action: "fail",
      reason: "VERCEL_ENV를 알 수 없습니다. Vercel 프로젝트에서 시스템 환경변수 노출이 켜져 있는지 확인하세요.",
    };
  }
  if (vercelEnv !== "production") {
    return { action: "skip", reason: `${vercelEnv} 빌드이므로 운영 DB에 접속하지 않습니다.` };
  }
  const appEnv = env[PRODUCTION_DB_ENV.appEnv];
  if (appEnv !== "live") {
    return {
      action: "fail",
      reason: `Production 빌드의 APP_DATA_ENVIRONMENT는 live여야 합니다(현재: ${appEnv ? appEnv : "없음"}).`,
    };
  }
  const url = env[PRODUCTION_DB_ENV.unpooledUrl]?.trim();
  if (!url) {
    return { action: "fail", reason: "DATABASE_URL_UNPOOLED가 없습니다. Neon 직접 연결 주소가 필요합니다." };
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    return { action: "fail", reason: "DATABASE_URL_UNPOOLED가 PostgreSQL 연결 주소 형식이 아닙니다." };
  }
  if (/-pooler[.:]/.test(url)) {
    return { action: "fail", reason: "DATABASE_URL_UNPOOLED가 풀링 주소(-pooler)입니다. migration에는 직접 연결 주소가 필요합니다." };
  }
  return { action: "run", url };
}

/** 오류 메시지에서 연결 주소·비밀번호를 지운다. */
export function redactSecrets(message: string, url: string | null): string {
  let out = message;
  if (url) {
    const secrets = [url];
    try {
      const parsed = new URL(url);
      if (parsed.password) secrets.push(parsed.password, decodeURIComponent(parsed.password));
      if (parsed.username) secrets.push(`${parsed.username}:`);
    } catch {
      // 주소를 해석하지 못해도 원문 주소는 지운다.
    }
    for (const secret of secrets.filter((s) => s.length >= 4)) out = out.split(secret).join("***");
  }
  return out.replace(/postgres(?:ql)?:\/\/[^\s'"]+/g, "postgres://***");
}

export interface ProductionDbConnection {
  db: AppDatabase;
  /** db/migrations를 적용한다 */
  migrate: () => Promise<void>;
  close: () => Promise<void>;
}

export interface ProductionDbInitDeps {
  connect: (url: string) => Promise<ProductionDbConnection>;
  /** db/migrations/meta/_journal.json의 migration 수 */
  expectedMigrations: number;
  log: (message: string) => void;
}

export type ProductionDbInitResult =
  | { status: "skipped"; reason: string }
  | { status: "initialized"; identityCreated: boolean; appliedMigrations: number };

export class ProductionDbInitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionDbInitError";
  }
}

async function tableExists(db: AppDatabase, name: string): Promise<boolean> {
  const rows = (await db.execute(sql`select to_regclass(${`public.${name}`}) is not null as present`)) as unknown;
  const list = Array.isArray(rows) ? rows : ((rows as { rows?: unknown[] }).rows ?? []);
  return Boolean((list[0] as { present?: boolean } | undefined)?.present);
}

async function countAppliedMigrations(db: AppDatabase): Promise<number> {
  const rows = (await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)) as unknown;
  const list = Array.isArray(rows) ? rows : ((rows as { rows?: unknown[] }).rows ?? []);
  return Number((list[0] as { n?: number } | undefined)?.n ?? 0);
}

/** 오류 메시지와 원인(드라이버 오류)을 함께 보여 준다. 출력 전에 redactSecrets로 비밀값을 지운다. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if (error instanceof ProductionDbInitError) return error.message;
  const cause = error.cause instanceof Error ? error.cause.message : null;
  const head = error.message.split("\n")[0] ?? error.message;
  return cause && !head.includes(cause) ? `${head} (원인: ${cause})` : head;
}

export async function runProductionDbInit(env: Env, deps: ProductionDbInitDeps): Promise<ProductionDbInitResult> {
  const decision = decideProductionDbInit(env);
  if (decision.action === "skip") {
    deps.log(decision.reason);
    return { status: "skipped", reason: decision.reason };
  }
  if (decision.action === "fail") throw new ProductionDbInitError(decision.reason);

  const url = decision.url;
  let connection: ProductionDbConnection | null = null;
  let step = "DB 연결";
  try {
    deps.log("운영 DB(live) 초기화를 시작합니다.");
    connection = await deps.connect(url);
    const { db } = connection;

    step = "초기화 잠금";
    await db.execute(sql`select pg_advisory_lock(${PRODUCTION_DB_INIT_LOCK_KEY})`);
    try {
      step = "기존 식별 표식 확인";
      if (await tableExists(db, "database_identity")) {
        const existing = await readDatabaseIdentity(db);
        if (existing && !(existing.length === 1 && existing[0] === "live")) {
          throw new ProductionDbInitError(
            `이 DB는 이미 [${existing.join(", ")}] 영역으로 표시되어 있습니다. live 운영 DB가 아니므로 migration을 실행하지 않고 멈춥니다.`,
          );
        }
      }

      step = "migration";
      await connection.migrate();
      deps.log("migration을 적용했습니다.");

      step = "database_identity 설정";
      const identity = await initDatabaseIdentity(db, ["live"]);
      deps.log(
        identity.created
          ? "DB 식별 표식을 [live]로 설정했습니다."
          : "DB 식별 표식이 이미 [live]입니다. 변경하지 않았습니다.",
      );

      step = "검증";
      await assertDatabaseIdentityMatches(db, "live");
      const allowed = await readDatabaseIdentity(db);
      if (!allowed || allowed.length !== 1 || allowed[0] !== "live") {
        throw new ProductionDbInitError(`DB 식별 표식이 [live]가 아닙니다: [${(allowed ?? []).join(", ")}]`);
      }
      const applied = await countAppliedMigrations(db);
      if (applied !== deps.expectedMigrations) {
        throw new ProductionDbInitError(`적용된 migration 수(${applied})가 저장소의 migration 수(${deps.expectedMigrations})와 다릅니다.`);
      }
      deps.log(`검증 완료: migration ${applied}/${deps.expectedMigrations}, 허용 영역 [live].`);
      return { status: "initialized", identityCreated: identity.created, appliedMigrations: applied };
    } finally {
      await db.execute(sql`select pg_advisory_unlock(${PRODUCTION_DB_INIT_LOCK_KEY})`).catch(() => undefined);
    }
  } catch (error) {
    throw new ProductionDbInitError(`운영 DB 초기화 실패(${step}): ${redactSecrets(describeError(error), url)}`);
  } finally {
    await connection?.close().catch(() => undefined);
  }
}
