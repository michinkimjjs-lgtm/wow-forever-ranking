/**
 * 다운로드 파일(public/downloads/ForeverRankCollector.zip)이 준비되어 있는지 확인한다.
 * 파일은 dev / build 전에 scripts/build-collector.ts가 만든다.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { collectorManifest } from "./manifest";

export function isCollectorDownloadAvailable(): boolean {
  return existsSync(join(process.cwd(), "public", collectorManifest.downloadPath));
}
