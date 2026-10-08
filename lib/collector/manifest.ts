/**
 * Collector 배포 정보 (다운로드 화면에 표시)
 *
 * release-manifest.json은 scripts/build-collector.ts가 애드온 원본에서 만든 파일이다. 손으로 고치지 않는다.
 * - npm run collector:build 로 다시 만든다(dev / build 전에 자동 실행).
 * - 테스트가 애드온 원본으로 새로 만든 결과와 이 파일이 같은지 확인한다(버전·크기·SHA-256 불일치 방지).
 */
import generated from "./release-manifest.json";

export interface CollectorManifestFile {
  /** ZIP 안 경로 (예: ForeverRankCollector/Core.lua) */
  path: string;
  size: number;
  sha256: string;
}

export interface CollectorManifest {
  addonName: string;
  /** Collector 버전 */
  version: string;
  releaseDate: string;
  exportSchema: string;
  /** Export 형식 버전 */
  exportSchemaVersion: number;
  /** TOC의 ## Interface 값 (게임 내 실행 검증 필요) */
  interfaceVersion: number | null;
  fileName: string;
  downloadPath: string;
  /** ZIP 크기 (바이트) */
  size: number;
  /** ZIP SHA-256 (소문자 16진수) */
  sha256: string;
  files: CollectorManifestFile[];
}

export const collectorManifest: CollectorManifest = generated;
