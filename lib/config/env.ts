/**
 * 배포 환경변수 (명세서 §6.3, §25).
 * 모듈을 불러올 때가 아니라 호출할 때 검증한다. (빌드 단계에서 DB 설정 없이도 번들링이 가능하도록)
 */
import { DATA_ENVIRONMENTS, type DataEnvironment } from "@/lib/domain/enums";
import { ConfigurationError } from "./index";

export function getAppDataEnvironment(): DataEnvironment {
  const value = process.env.APP_DATA_ENVIRONMENT;
  if (!value) {
    throw new ConfigurationError("APP_DATA_ENVIRONMENT 환경변수가 없습니다. mock, beta, live 중 하나를 지정해야 합니다.");
  }
  if (!(DATA_ENVIRONMENTS as readonly string[]).includes(value)) {
    throw new ConfigurationError(`APP_DATA_ENVIRONMENT 값이 올바르지 않습니다: ${value}`);
  }
  return value as DataEnvironment;
}

export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new ConfigurationError("DATABASE_URL 환경변수가 없습니다.");
  return value;
}

export function getSiteUrl(): string {
  return process.env.SITE_URL ?? "http://localhost:3000";
}

/**
 * 이 배포에서 요청이 지정할 수 있는 dataEnvironment 목록.
 * mock 배포는 mock만, 실제 배포는 beta / live만 다룬다. 두 그룹은 절대 함께 쓰이지 않는다.
 */
export function getRequestableEnvironments(appEnv: DataEnvironment): DataEnvironment[] {
  return appEnv === "mock" ? ["mock"] : ["beta", "live"];
}
