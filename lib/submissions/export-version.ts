/**
 * Export 형식(schema) 버전 확인 (docs/CHARACTER-EXPORT-V1.md §버전, config/collector.ts)
 *
 * Collector 버전(애드온 배포 버전)과 Export 형식 버전(파일의 schemaVersion)은 서로 다른 값이다.
 * 서버는 Export 형식 버전만으로 받을지 정한다. 같은 형식이면 Collector 버전이 달라도 받는다.
 *
 * 형식 검증(zod)보다 먼저 실행해, 오래된 형식이면 "형식이 올바르지 않음" 대신 버전 안내를 보여 준다.
 * 브라우저와 서버에서 함께 쓴다.
 */
import { collectorRelease } from "@/config/collector";
import type { SubmissionIssue } from "./issues";

export type ExportVersionCheck =
  | { ok: true }
  | { ok: false; reason: "OUTDATED" | "TOO_NEW"; version: number; supported: readonly number[] };

export function checkExportSchemaVersion(
  input: unknown,
  supported: readonly number[] = collectorRelease.supportedExportSchemaVersions,
): ExportVersionCheck {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: true };
  const { schema, schemaVersion } = input as { schema?: unknown; schemaVersion?: unknown };
  // Forever Rank Export가 아니거나 버전이 숫자가 아니면 형식 검증에 맡긴다.
  if (schema !== collectorRelease.exportSchema || typeof schemaVersion !== "number" || !Number.isFinite(schemaVersion)) {
    return { ok: true };
  }
  if (supported.includes(schemaVersion)) return { ok: true };
  const newest = Math.max(...supported);
  return { ok: false, reason: schemaVersion > newest ? "TOO_NEW" : "OUTDATED", version: schemaVersion, supported };
}

/** 제출 처리용: 지원하지 않는 버전이면 제출 오류 항목, 아니면 null */
export function exportVersionIssue(input: unknown): SubmissionIssue | null {
  const check = checkExportSchemaVersion(input);
  if (check.ok) return null;
  return {
    code: check.reason === "TOO_NEW" ? "EXPORT_SCHEMA_TOO_NEW" : "EXPORT_SCHEMA_OUTDATED",
    path: "schemaVersion",
    detail: `schemaVersion ${check.version} is not supported (supported: ${check.supported.join(", ")})`,
  };
}
