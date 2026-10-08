/**
 * Collector 다운로드 파일 만들기
 *
 *   npm run collector:build          public/downloads/ForeverRankCollector.zip과 lib/collector/release-manifest.json을 만든다.
 *   npm run collector:build -- --check   파일을 쓰지 않고 manifest가 최신인지만 확인한다(다르면 실패).
 *
 * dev / build 전에 자동으로 실행된다(package.json predev / prebuild).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { collectorRelease } from "@/config/collector";
import { buildCollectorPackage } from "@/lib/collector/package";

const root = process.cwd();
const check = process.argv.includes("--check");
const { zip, manifest } = buildCollectorPackage(root);
const manifestPath = join(root, "lib/collector/release-manifest.json");
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;

if (check) {
  let current = "";
  try {
    current = readFileSync(manifestPath, "utf8");
  } catch {
    // 없으면 아래에서 실패
  }
  if (current !== manifestText) {
    console.error("lib/collector/release-manifest.json이 애드온 원본과 다릅니다. npm run collector:build 를 실행하세요.");
    process.exit(1);
  }
  console.log(`Collector ${manifest.version} manifest 확인 완료 (SHA-256 ${manifest.sha256})`);
} else {
  const zipPath = join(root, "public", collectorRelease.downloadPath);
  mkdirSync(dirname(zipPath), { recursive: true });
  writeFileSync(zipPath, zip);
  writeFileSync(manifestPath, manifestText);
  console.log(`Collector ${manifest.version} → ${collectorRelease.downloadPath} (${manifest.size} bytes, SHA-256 ${manifest.sha256})`);
}
