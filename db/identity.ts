/**
 * database_identity 관리 (명세서 §6.4-1, §6.4-4)
 */
import { databaseIdentity } from "./schema";
import type { AppDatabase } from "./types";
import { DATA_ENVIRONMENTS, type DataEnvironment } from "@/lib/domain/enums";

export class DatabaseIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseIdentityError";
  }
}

/** 허용 목록 규칙: mock 단독, 또는 beta / live의 부분집합 */
export function validateAllowedEnvironments(allowed: readonly DataEnvironment[]): DataEnvironment[] {
  const unique = [...new Set(allowed)].sort(
    (a, b) => DATA_ENVIRONMENTS.indexOf(a) - DATA_ENVIRONMENTS.indexOf(b),
  );
  if (unique.length === 0) throw new DatabaseIdentityError("허용할 데이터 영역을 하나 이상 지정해야 합니다.");
  if (unique.includes("mock") && unique.length > 1) {
    throw new DatabaseIdentityError("mock 데이터베이스는 mock 영역만 허용할 수 있습니다.");
  }
  return unique;
}

export async function readDatabaseIdentity(db: AppDatabase): Promise<DataEnvironment[] | null> {
  const rows = await db.select().from(databaseIdentity).limit(1);
  return rows[0]?.allowedDataEnvironments ?? null;
}

/**
 * DB 식별 표식을 설정한다. 이미 같은 값이면 아무것도 하지 않고, 다른 값이면 오류.
 * (식별 표식은 한 번만 설정할 수 있다)
 */
export async function initDatabaseIdentity(
  db: AppDatabase,
  allowed: readonly DataEnvironment[],
): Promise<{ created: boolean; allowed: DataEnvironment[] }> {
  const normalized = validateAllowedEnvironments(allowed);
  const existing = await readDatabaseIdentity(db);
  if (existing) {
    const same = existing.length === normalized.length && existing.every((e) => normalized.includes(e));
    if (!same) {
      throw new DatabaseIdentityError(
        `이 데이터베이스는 이미 [${existing.join(", ")}] 영역으로 설정되어 있어 [${normalized.join(", ")}]로 바꿀 수 없습니다.`,
      );
    }
    return { created: false, allowed: existing };
  }
  await db.insert(databaseIdentity).values({ id: 1, allowedDataEnvironments: normalized });
  return { created: true, allowed: normalized };
}

/** 앱 시작 검사: APP_DATA_ENVIRONMENT가 DB 식별 표식에 포함되는지 확인한다. */
export async function assertDatabaseIdentityMatches(db: AppDatabase, appEnv: DataEnvironment): Promise<void> {
  const allowed = await readDatabaseIdentity(db);
  if (!allowed) {
    throw new DatabaseIdentityError("데이터베이스 식별 표식(database_identity)이 없습니다. `npm run db:init`을 먼저 실행하세요.");
  }
  if (!allowed.includes(appEnv)) {
    throw new DatabaseIdentityError(
      `APP_DATA_ENVIRONMENT(${appEnv})가 이 데이터베이스의 허용 영역 [${allowed.join(", ")}]과 맞지 않습니다.`,
    );
  }
}
