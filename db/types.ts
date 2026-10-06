import type { PgDatabase } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * postgres-js(운영)와 PGlite(테스트) 드라이버를 모두 받는 공통 DB 타입.
 * 트랜잭션 객체도 이 타입으로 전달할 수 있다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppDatabase = PgDatabase<any, typeof schema>;
