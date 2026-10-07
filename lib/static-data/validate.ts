/**
 * 정적 데이터셋 검증 (docs/STATIC-GAME-DATA.md §3)
 *
 * - 메타데이터와 레코드를 종류별 스키마로 검증한다.
 * - 같은 키가 여러 번 나오면: 내용이 같으면 하나만 남기고 경고, 다르면 오류(데이터셋 전체 거부).
 * - Item Catalog 레코드의 source / sourceVersion은 데이터셋 메타와 같아야 한다.
 * - 다른 데이터셋을 참조하는 값(종족의 진영, 보스의 던전/공격대)은 references가 주어지면 확인한다.
 */
import type { StaticDataKind } from "@/lib/domain/enums";
import { sha256, stableStringify } from "@/lib/util/stable-json";
import {
  MAX_STATIC_RECORDS,
  STATIC_RECORD_SCHEMAS,
  recordKeyOf,
  staticDatasetMetaSchema,
  type StaticDatasetMeta,
} from "./schema";

export interface StaticDataIssue {
  severity: "error" | "warning";
  code:
    | "INVALID_META"
    | "INVALID_RECORD"
    | "TOO_MANY_RECORDS"
    | "EMPTY_DATASET"
    | "DUPLICATE_IDENTICAL"
    | "DUPLICATE_CONFLICT"
    | "SOURCE_MISMATCH"
    | "UNKNOWN_REFERENCE";
  message: string;
  index?: number;
  key?: string;
}

export interface StaticDataReferences {
  factions?: readonly string[];
  dungeons?: readonly string[];
  raids?: readonly string[];
}

export interface ValidatedRecord {
  key: string;
  data: Record<string, unknown>;
}

export type StaticDatasetValidation =
  | {
      ok: true;
      meta: StaticDatasetMeta;
      records: ValidatedRecord[];
      /** 메타 + 정렬한 레코드의 sha256. 같은 버전을 다른 내용으로 다시 넣는 것을 막는 데 쓴다. */
      checksum: string;
      issues: StaticDataIssue[];
    }
  | { ok: false; issues: StaticDataIssue[] };

function zodMessage(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return error.issues.map((i) => `${i.path.map(String).join(".") || "(값)"}: ${i.message}`).join("; ");
}

export function validateStaticDataset(
  input: unknown,
  options: { references?: StaticDataReferences } = {},
): StaticDatasetValidation {
  const issues: StaticDataIssue[] = [];
  const raw = (input ?? {}) as { meta?: unknown; records?: unknown };

  const metaResult = staticDatasetMetaSchema.safeParse(raw.meta);
  if (!metaResult.success) {
    return { ok: false, issues: [{ severity: "error", code: "INVALID_META", message: `메타데이터 오류: ${zodMessage(metaResult.error)}` }] };
  }
  const meta = metaResult.data;
  if (!Array.isArray(raw.records)) {
    return { ok: false, issues: [{ severity: "error", code: "INVALID_RECORD", message: "records는 배열이어야 합니다." }] };
  }
  if (raw.records.length === 0) {
    return { ok: false, issues: [{ severity: "error", code: "EMPTY_DATASET", message: "레코드가 없습니다." }] };
  }
  if (raw.records.length > MAX_STATIC_RECORDS) {
    return {
      ok: false,
      issues: [{ severity: "error", code: "TOO_MANY_RECORDS", message: `레코드는 최대 ${MAX_STATIC_RECORDS}개까지 받습니다.` }],
    };
  }

  const schema = STATIC_RECORD_SCHEMAS[meta.kind];
  const byKey = new Map<string, { data: Record<string, unknown>; serialized: string }>();

  raw.records.forEach((record, index) => {
    const parsed = schema.safeParse(record);
    if (!parsed.success) {
      issues.push({ severity: "error", code: "INVALID_RECORD", index, message: `레코드 ${index}: ${zodMessage(parsed.error)}` });
      return;
    }
    const data = parsed.data as Record<string, unknown>;
    const key = recordKeyOf(meta.kind, data);

    if (meta.kind === "items" && (data.source !== meta.source || data.sourceVersion !== meta.sourceVersion)) {
      issues.push({
        severity: "error",
        code: "SOURCE_MISMATCH",
        index,
        key,
        message: `레코드 ${index}: source / sourceVersion이 데이터셋 메타와 다릅니다.`,
      });
      return;
    }
    checkReferences(meta.kind, data, options.references, index, key, issues);

    const serialized = stableStringify(data);
    const existing = byKey.get(key);
    if (existing) {
      if (existing.serialized === serialized) {
        issues.push({ severity: "warning", code: "DUPLICATE_IDENTICAL", index, key, message: `키 ${key}가 같은 내용으로 중복되어 하나만 사용합니다.` });
      } else {
        issues.push({ severity: "error", code: "DUPLICATE_CONFLICT", index, key, message: `키 ${key}가 다른 내용으로 중복되었습니다.` });
      }
      return;
    }
    byKey.set(key, { data, serialized });
  });

  if (issues.some((i) => i.severity === "error")) return { ok: false, issues };

  const records = [...byKey.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, v]) => ({ key, data: v.data }));
  const checksum = sha256(stableStringify({ meta, records }));
  return { ok: true, meta, records, checksum, issues };
}

function checkReferences(
  kind: StaticDataKind,
  data: Record<string, unknown>,
  references: StaticDataReferences | undefined,
  index: number,
  key: string,
  issues: StaticDataIssue[],
): void {
  if (!references) return;
  let missing: string | null = null;
  if (kind === "races" && references.factions && data.factionCode != null) {
    if (!references.factions.includes(String(data.factionCode))) missing = `진영 ${String(data.factionCode)}`;
  }
  if (kind === "bosses") {
    const list = data.instanceKind === "raid" ? references.raids : references.dungeons;
    if (list && !list.includes(String(data.instanceCode))) missing = `${String(data.instanceKind)} ${String(data.instanceCode)}`;
  }
  if (missing) {
    issues.push({ severity: "error", code: "UNKNOWN_REFERENCE", index, key, message: `레코드 ${index}: 참조한 ${missing}이(가) 없습니다.` });
  }
}
