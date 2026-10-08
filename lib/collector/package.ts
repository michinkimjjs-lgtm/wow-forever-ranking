/**
 * Collector 다운로드 파일(ZIP)과 manifest 만들기 (node 전용, 빌드 스크립트와 테스트에서 사용)
 *
 * - 애드온 원본(addon/ForeverRankCollector)을 검사한 뒤 ZIP으로 묶는다.
 *   - 설정(config/collector.ts)의 파일 목록과 원본 폴더의 파일이 정확히 같아야 한다.
 *   - 허용한 확장자(.toc / .lua / .md)만 넣는다. 실행 파일은 넣지 않는다.
 *   - TOC의 ## Version, Core.lua의 ns.VERSION / ns.EXPORT_SCHEMA_VERSION이 설정과 같아야 한다.
 *   - TOC가 불러오는 Lua 파일 목록과 ZIP의 Lua 파일 목록이 같아야 한다.
 * - 줄바꿈은 LF로 통일한다(운영체제 설정에 따라 SHA-256이 달라지지 않도록).
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { collectorRelease, type CollectorRelease } from "@/config/collector";
import type { CollectorManifest } from "./manifest";
import { createStoredZip } from "./zip";

export interface CollectorPackage {
  zip: Uint8Array;
  manifest: CollectorManifest;
}

export function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** TOC의 메타데이터(## Key: value)와 불러오는 파일 목록 */
export function parseToc(text: string): { fields: Record<string, string>; files: string[] } {
  const fields: Record<string, string> = {};
  const files: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const field = /^##\s*([^:]+):\s*(.*)$/.exec(line);
    if (field) fields[field[1]!.trim()] = field[2]!.trim();
    else if (!line.startsWith("#")) files.push(line);
  }
  return { fields, files };
}

function luaString(source: string, name: string): string | null {
  return new RegExp(`^ns\\.${name}\\s*=\\s*"([^"]*)"`, "m").exec(source)?.[1] ?? null;
}

function luaNumber(source: string, name: string): number | null {
  const value = new RegExp(`^ns\\.${name}\\s*=\\s*(\\d+)\\s*$`, "m").exec(source)?.[1];
  return value === undefined ? null : Number(value);
}

/** 애드온 원본 검사 후 ZIP과 manifest를 만든다. 문제가 있으면 오류(빌드 실패). */
export function buildCollectorPackage(rootDir: string, release: CollectorRelease = collectorRelease): CollectorPackage {
  const sourceDir = join(rootDir, release.sourceDir);
  const actual = readdirSync(sourceDir).sort();
  const expected = [...release.files].sort();
  if (actual.join("\n") !== expected.join("\n")) {
    throw new Error(`애드온 폴더의 파일이 설정과 다릅니다.\n폴더: ${actual.join(", ")}\n설정: ${expected.join(", ")}`);
  }
  for (const file of release.files) {
    if (!release.allowedExtensions.includes(extname(file).toLowerCase())) {
      throw new Error(`ZIP에 넣을 수 없는 파일 형식입니다: ${file}`);
    }
  }

  const texts = new Map<string, string>();
  for (const file of release.files) {
    const text = readFileSync(join(sourceDir, file), "utf8").replace(/\r\n?/g, "\n");
    texts.set(file, text);
  }

  const toc = parseToc(texts.get(`${release.addonName}.toc`) ?? "");
  if (toc.fields.Version !== release.version) {
    throw new Error(`TOC 버전(${toc.fields.Version})이 설정 버전(${release.version})과 다릅니다.`);
  }
  const core = texts.get("Core.lua") ?? "";
  if (luaString(core, "VERSION") !== release.version) {
    throw new Error(`Core.lua의 ns.VERSION이 설정 버전(${release.version})과 다릅니다.`);
  }
  if (luaNumber(core, "EXPORT_SCHEMA_VERSION") !== release.exportSchemaVersion) {
    throw new Error(`Core.lua의 ns.EXPORT_SCHEMA_VERSION이 설정(${release.exportSchemaVersion})과 다릅니다.`);
  }
  if (luaString(core, "EXPORT_SCHEMA") !== release.exportSchema) {
    throw new Error(`Core.lua의 ns.EXPORT_SCHEMA가 설정(${release.exportSchema})과 다릅니다.`);
  }
  const luaFiles = release.files.filter((f) => f.endsWith(".lua"));
  if ([...toc.files].sort().join(",") !== [...luaFiles].sort().join(",")) {
    throw new Error(`TOC가 불러오는 파일(${toc.files.join(", ")})과 ZIP의 Lua 파일(${luaFiles.join(", ")})이 다릅니다.`);
  }
  const readme = texts.get("README.md") ?? "";
  if (!readme.includes(`버전: ${release.version}`) || !readme.includes(`Export 형식 버전: ${release.exportSchemaVersion}`)) {
    throw new Error("README.md에 현재 Collector 버전과 Export 형식 버전이 적혀 있지 않습니다.");
  }

  const encoder = new TextEncoder();
  const folder = `${release.addonName}/`;
  const files = release.files.map((file) => {
    const data = encoder.encode(texts.get(file)!);
    return { name: `${folder}${file}`, data };
  });
  const zip = createStoredZip([{ name: folder, data: new Uint8Array() }, ...files], release.releaseDate);

  const interfaceVersion = Number(toc.fields.Interface);
  const manifest: CollectorManifest = {
    addonName: release.addonName,
    version: release.version,
    releaseDate: release.releaseDate,
    exportSchema: release.exportSchema,
    exportSchemaVersion: release.exportSchemaVersion,
    interfaceVersion: Number.isInteger(interfaceVersion) ? interfaceVersion : null,
    fileName: release.zipFileName,
    downloadPath: release.downloadPath,
    size: zip.length,
    sha256: sha256Hex(zip),
    files: files.map((f) => ({ path: f.name, size: f.data.length, sha256: sha256Hex(f.data) })),
  };
  return { zip, manifest };
}
