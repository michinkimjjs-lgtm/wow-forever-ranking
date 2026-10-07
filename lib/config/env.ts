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

/**
 * 캐릭터 제출 API 기능 플래그 (docs/ARCHITECTURE.md §8)
 * - FEATURE_CHARACTER_SUBMISSIONS=on 이고 SUBMISSIONS_ADMIN_TOKEN이 32자 이상일 때만 켜진다.
 * - 기본값은 꺼짐. 꺼져 있으면 API는 404로 응답한다(존재를 드러내지 않음).
 * - 지금은 관리자 / 개발 환경 검증용이다. 공개하지 않는다.
 */
export interface SubmissionSettings {
  enabled: boolean;
  adminToken: string | null;
}

export function getSubmissionSettings(): SubmissionSettings {
  const flag = process.env.FEATURE_CHARACTER_SUBMISSIONS;
  const token = process.env.SUBMISSIONS_ADMIN_TOKEN ?? null;
  const tokenOk = token !== null && token.length >= 32;
  return { enabled: flag === "on" && tokenOk, adminToken: tokenOk ? token : null };
}

/**
 * 공개 제출과 관리자 화면 설정 (docs/SUBMISSION-SYSTEM.md §2)
 * - FEATURE_PUBLIC_SUBMISSIONS=on 이고 SUBMISSION_SECRET이 32자 이상이면 공개 제출을 받는다.
 * - SUBMISSION_SECRET: 제출 화면 보안 토큰, 요청 제한용 일시 식별값, 관리자 로그인 서명에 쓴다. 저장소에 넣지 않는다.
 * - 관리자 화면은 SUBMISSIONS_ADMIN_TOKEN(32자 이상)과 SUBMISSION_SECRET이 모두 있어야 열린다.
 */
export interface PublicSubmissionSettings {
  enabled: boolean;
  secret: string | null;
}

export function getSubmissionSecret(): string | null {
  const secret = process.env.SUBMISSION_SECRET ?? null;
  return secret !== null && secret.length >= 32 ? secret : null;
}

export function getPublicSubmissionSettings(): PublicSubmissionSettings {
  const secret = getSubmissionSecret();
  return { enabled: process.env.FEATURE_PUBLIC_SUBMISSIONS === "on" && secret !== null, secret };
}

export interface AdminSettings {
  enabled: boolean;
  adminToken: string | null;
  secret: string | null;
}

export function getAdminSettings(): AdminSettings {
  const token = process.env.SUBMISSIONS_ADMIN_TOKEN ?? null;
  const tokenOk = token !== null && token.length >= 32;
  const secret = getSubmissionSecret();
  return { enabled: tokenOk && secret !== null, adminToken: tokenOk ? token : null, secret };
}
