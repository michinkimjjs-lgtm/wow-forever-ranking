/**
 * 제출 파일 읽기와 미리보기 (docs/SUBMISSION-SYSTEM.md §3)
 *
 * 브라우저와 서버에서 함께 쓴다(node 전용 모듈 없음).
 * - 미리보기는 export 원본 값과 슬롯 매핑 프로필(DRAFT 포함)로 계산한 "참고용" 값이다.
 *   랭킹에 쓰는 값은 서버가 승인된 Gear Profile로 다시 계산한다.
 * - GUID 같은 식별값은 미리보기에 넣지 않는다.
 */
import type { GearProfile } from "@/lib/config";
import { calculateEquippedItemLevel, type GearCalculationStatus } from "@/lib/gear/calculate";
import type { CharacterExportV1 } from "./export-schema";

export type FileReadError = "UNSUPPORTED_FILE" | "EXPORT_NOT_FOUND";

/**
 * 업로드한 파일에서 Character Export JSON 문자열을 꺼낸다.
 * - .json: 파일 내용 그대로
 * - .lua: Collector SavedVariables의 latestExportJson 문자열 (docs/CHARACTER-EXPORT-V1.md §3)
 *   WoW 클라이언트가 Lua 문자열을 어떻게 이스케이프해 저장하는지는 Runtime verification required.
 */
export function extractExportJson(fileName: string, content: string): { ok: true; json: string } | { ok: false; error: FileReadError } {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) return { ok: true, json: content };
  if (!lower.endsWith(".lua")) return { ok: false, error: "UNSUPPORTED_FILE" };
  const match = /\["?latestExportJson"?\]\s*=\s*"|latestExportJson\s*=\s*"/.exec(content);
  if (!match) return { ok: false, error: "EXPORT_NOT_FOUND" };
  const decoded = readLuaString(content, match.index + match[0].length);
  return decoded === null ? { ok: false, error: "EXPORT_NOT_FOUND" } : { ok: true, json: decoded };
}

/** 큰따옴표 Lua 문자열 본문을 읽는다. start는 여는 따옴표 다음 위치 */
function readLuaString(content: string, start: number): string | null {
  const bytes: number[] = [];
  const encoder = new TextEncoder();
  const pushText = (text: string) => bytes.push(...encoder.encode(text));
  for (let i = start; i < content.length; i++) {
    const ch = content[i]!;
    if (ch === '"') return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
    if (ch === "\n") return null;
    if (ch !== "\\") {
      pushText(ch);
      continue;
    }
    const next = content[i + 1];
    if (next === undefined) return null;
    const simple: Record<string, string> = { n: "\n", r: "\r", t: "\t", "\\": "\\", '"': '"', "'": "'", "\n": "\n" };
    if (next in simple) {
      pushText(simple[next]!);
      i += 1;
    } else if (/\d/.test(next)) {
      const digits = /^\d{1,3}/.exec(content.slice(i + 1, i + 4))![0];
      const code = Number(digits);
      if (code > 255) return null;
      bytes.push(code);
      i += digits.length;
    } else {
      return null;
    }
  }
  return null;
}

export interface ExportPreview {
  name: string | null;
  surname: string | null;
  level: number | null;
  /** 클라이언트가 준 표시 이름 (없으면 파일 코드) */
  className: string | null;
  raceName: string | null;
  factionName: string | null;
  guildName: string | null;
  gearCount: number;
  gearWithItemLevel: number;
  averageItemLevel: number | null;
  highestItemLevel: number | null;
  coverage: number | null;
  coverageStatus: GearCalculationStatus | null;
  /** 미리보기 계산에 쓴 프로필 */
  profile: { id: string; version: number; status: GearProfile["status"] } | null;
  /** ISO 문자열 (JSON으로 저장·전달하기 위해) */
  observedAt: string | null;
  sourceBuild: string | null;
  interfaceVersion: number | null;
}

export function buildExportPreview(data: CharacterExportV1, slotProfile: GearProfile | null): ExportPreview {
  const c = data.character;
  const slotByName = new Map<string, string>();
  for (const slot of slotProfile?.slots ?? []) if (slot.clientSlotName) slotByName.set(slot.clientSlotName, slot.code);

  const calculation = slotProfile
    ? calculateEquippedItemLevel(
        data.gear
          .filter((g) => slotByName.has(g.slotName))
          .map((g) => ({ slotCode: slotByName.get(g.slotName)!, itemLevel: Number.isInteger(g.itemLevel) ? g.itemLevel : null })),
        slotProfile,
      )
    : null;

  const { buildVersion, buildNumber, interfaceVersion } = data.client;
  return {
    name: c.name ?? null,
    surname: c.surname ?? null,
    level: c.level ?? null,
    className: c.className ?? c.classFile ?? null,
    raceName: c.raceName ?? c.raceFile ?? null,
    factionName: c.factionName ?? c.faction ?? null,
    guildName: c.isInGuild === false ? null : (c.guildName ?? null),
    gearCount: data.gear.length,
    gearWithItemLevel: data.gear.filter((g) => g.itemLevel !== undefined).length,
    averageItemLevel: calculation?.averageItemLevel ?? null,
    highestItemLevel: calculation?.highestItemLevel ?? null,
    coverage: calculation ? calculation.coverage : null,
    coverageStatus: calculation?.status ?? null,
    profile: slotProfile ? { id: slotProfile.id, version: slotProfile.version, status: slotProfile.status } : null,
    observedAt: data.observedAt !== undefined ? new Date(data.observedAt * 1000).toISOString() : null,
    sourceBuild: buildVersion && buildNumber ? `${buildVersion}.${buildNumber}` : null,
    interfaceVersion: interfaceVersion ?? null,
  };
}

/** 미리보기의 캐릭터 이름 표시 (이름과 성을 잇는 실제 구분자는 확인 전이므로 공백으로 보여 주기만 한다) */
export function previewDisplayName(preview: Pick<ExportPreview, "name" | "surname">): string {
  return [preview.name, preview.surname].filter(Boolean).join(" ") || "-";
}
