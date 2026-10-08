/**
 * Forever Rank Collector 배포 설정 (docs/CONTRIBUTOR-GUIDE.md)
 *
 * 버전은 두 가지를 구분한다.
 * - Collector 버전(version): 애드온 배포 버전. 애드온 파일(ForeverRankCollector.toc의 ## Version, Core.lua의 ns.VERSION)과 같아야 한다.
 * - Export 형식 버전(exportSchemaVersion): 애드온이 만드는 Character Export 파일 형식 버전(docs/CHARACTER-EXPORT-V1.md).
 *   서버는 supportedExportSchemaVersions에 있는 형식만 받는다.
 *
 * 테스트(tests/contributor.test.tsx)가 애드온 파일과 이 설정이 일치하는지 확인한다.
 * 다운로드 파일(ZIP)과 SHA-256은 scripts/build-collector.ts가 만든다.
 */
export interface CollectorRelease {
  addonName: string;
  version: string;
  releaseDate: string;
  exportSchema: string;
  exportSchemaVersion: number;
  supportedExportSchemaVersions: readonly number[];
  sourceDir: string;
  files: readonly string[];
  allowedExtensions: readonly string[];
  zipFileName: string;
  downloadPath: string;
  checksumCommand: string;
}

export const collectorRelease: CollectorRelease = {
  addonName: "ForeverRankCollector",
  /** Collector 버전 */
  version: "1.0.0",
  /** ZIP 안 파일의 수정 시각으로 쓰는 배포 날짜 (같은 파일이면 항상 같은 ZIP과 SHA-256이 나오도록 고정) */
  releaseDate: "2026-10-08",
  /** Export 형식 이름과 현재 버전 (애드온 Core.lua의 ns.EXPORT_SCHEMA / ns.EXPORT_SCHEMA_VERSION) */
  exportSchema: "forever-rank/character-export",
  exportSchemaVersion: 1,
  /** 서버가 받는 Export 형식 버전. 이보다 오래된 형식은 제출할 때 한국어 오류로 거부한다. */
  supportedExportSchemaVersions: [1],
  /** 애드온 원본 폴더 (저장소 기준) */
  sourceDir: "addon/ForeverRankCollector",
  /** ZIP에 넣는 파일. 순서대로 넣는다. Lua 애드온 파일과 안내 문서만 넣는다(실행 파일 금지). */
  files: ["ForeverRankCollector.toc", "Core.lua", "SavedVariables.lua", "Collector.lua", "Export.lua", "README.md"],
  /** ZIP에 넣어도 되는 확장자 */
  allowedExtensions: [".toc", ".lua", ".md"],
  /** 다운로드 파일 이름과 공개 경로 (public/ 아래) */
  zipFileName: "ForeverRankCollector.zip",
  downloadPath: "/downloads/ForeverRankCollector.zip",
  /** 받은 파일의 SHA-256을 확인하는 윈도우 명령 (화면에 코드로 표시) */
  checksumCommand: "certutil -hashfile ForeverRankCollector.zip SHA256",
};
